<template>
  <v-dialog v-model="open" fullscreen transition="dialog-bottom-transition">
    <v-card>
      <v-toolbar density="compact">
        <v-toolbar-title>{{ previewTitle }}</v-toolbar-title>
        <v-spacer />
        <v-switch v-model="autoDetect" density="compact" hide-details label="자동 감지" class="mr-3" />
        <v-btn variant="text" size="small" :color="showOutline ? 'primary' : 'default'" icon="mdi-format-list-bulleted"
          @click="showOutline = !showOutline" />
        <v-btn variant="text" size="small" :color="showDebug ? 'primary' : 'default'" icon="mdi-bug-outline" @click="showDebug = !showDebug" />
        <v-text-field v-model="searchQuery" density="compact" hide-details placeholder="검색" variant="outlined" prepend-inner-icon="mdi-magnify" class="preview-search" />
        <v-btn icon="mdi-close" variant="text" @click="open = false" />
      </v-toolbar>
      <v-card-text class="preview-body" :class="{ 'preview-body--outline': showOutline }">
        <div class="preview-layout" :class="{ 'preview-layout--outline': showOutline }">
          <div ref="previewContainer" class="preview-content" @scroll.passive="onScroll">
            <div v-if="loading" class="d-flex justify-center py-10">
              <v-progress-circular indeterminate color="primary" />
            </div>
            <v-alert v-else-if="error" type="error" density="compact" class="mb-4">
              {{ error }}
            </v-alert>
            <div v-else-if="previewBlocks.length === 0" class="text-medium-emphasis">
              미리보기할 내용이 없습니다.
            </div>
            <div v-else>
              <div v-for="item in previewBlocks" :key="item.id" class="preview-block" :id="`block-${item.id}`"
                :data-block-id="item.id">
                <div v-if="showDebug" class="preview-debug">
                  #{{ item.id }} · {{ item.block.blockType || "block" }}
                  <span v-if="item.block.sortOrder != null">· sort={{ item.block.sortOrder }}</span>
                  <span v-if="item.block.parentBlockId != null">· parent={{ item.block.parentBlockId }}</span>
                </div>
                <div v-if="item.html" v-html="item.html"></div>
              </div>
            </div>
          </div>
          <aside v-if="showOutline" class="preview-outline">
            <div class="preview-outline-title">목차</div>
            <div v-if="outlineItems.length === 0" class="text-medium-emphasis">표시할 항목이 없습니다.</div>
            <div v-else class="preview-outline-list">
              <button v-for="item in outlineItems" :key="item.id"
                :class="['preview-outline-item', `preview-outline-level-${item.level}`, { active: item.id === activeOutlineId }]"
                @click="scrollToBlock(item.id)">
                {{ item.title }}
              </button>
            </div>
          </aside>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { generateHTML } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight, common } from "lowlight";
import hljs from "highlight.js/lib/core";
import java from "highlight.js/lib/languages/java";
import sql from "highlight.js/lib/languages/sql";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import yaml from "highlight.js/lib/languages/yaml";
import kotlin from "highlight.js/lib/languages/kotlin";
import Youtube from "@tiptap/extension-youtube";
import { documentApi } from "@/data/studio/mgmt/document";
import type {
  DocumentBlock,
  DocumentBlockNode,
  DocumentVersionBundle,
} from "@/types/studio/document";
import { resolveAxiosError } from "@/utils/helpers";

const open = defineModel<boolean>({ default: false });

const props = defineProps<{
  documentId?: number | null;
  title?: string | null;
}>();

const loading = ref(false);
const error = ref<string | null>(null);
const bundle = ref<DocumentVersionBundle | null>(null);
const blockTree = ref<DocumentBlockNode[]>([]);
const previewContainer = ref<HTMLElement | null>(null);
const autoDetect = ref(true);
const highlightTimer = ref<number | null>(null);
const searchQuery = ref("");
const searchTimer = ref<number | null>(null);
const showOutline = ref(false);
const showDebug = ref(false);
const languageOverrides = ref(new Map<number, string>());
const activeOutlineId = ref<number | null>(null);

const lowlight = createLowlight(common);
const register = (name: string, lang: any) => {
  const target: any = lowlight as any;
  if (typeof target.registerLanguage === "function") {
    target.registerLanguage(name, lang);
    return;
  }
  if (typeof target.register === "function") {
    target.register(name, lang);
  }
};
register("java", java);
register("sql", sql);
register("python", python);
register("bash", bash);
register("yaml", yaml);
register("kotlin", kotlin);
hljs.registerLanguage("java", java);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("python", python);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("kotlin", kotlin);
const CodeBlockWithTheme = CodeBlockLowlight.extend({
  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      theme: {
        default: "github",
        parseHTML: (element) =>
          element.getAttribute("data-theme") || "github",
        renderHTML: (attrs) => ({
          "data-theme": attrs.theme,
        }),
      },
    };
  },
});

const previewExtensions = [
  StarterKit.configure({
    codeBlock: false,
  }),
  Image,
  Placeholder.configure({ placeholder: "" }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  CodeBlockWithTheme.configure({
    lowlight,
    defaultLanguage: "javascript",
  }),
  Youtube.configure({
    controls: true,
    modestBranding: true,
  }),
];

const previewTitle = computed(() => {
  const title =
    props.title ?? bundle.value?.version?.title ?? bundle.value?.document?.name;
  return title ? `미리보기: ${title}` : "문서 미리보기";
});

const toDocFromText = (text: string) => ({
  type: "doc",
  content: text
    ? [
        {
          type: "paragraph",
          content: [{ type: "text", text }],
        },
      ]
    : [],
});

const parseBlockData = (raw?: string | null) => {
  if (!raw) return toDocFromText("");
  try {
    return JSON.parse(raw);
  } catch {
    return toDocFromText(raw);
  }
};

const flattenTree = (nodes: DocumentBlockNode[]) => {
  const items: DocumentBlock[] = [];
  const walk = (list: DocumentBlockNode[]) => {
    const sorted = list.slice().sort((a, b) => {
      const sa = a.block.sortOrder;
      const sb = b.block.sortOrder;
      if (sa == null && sb == null) return a.block.blockId - b.block.blockId;
      if (sa == null) return 1;
      if (sb == null) return -1;
      return sa - sb;
    });
    for (const node of sorted) {
      items.push(node.block);
      if (node.children?.length) {
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return items;
};

const previewBlocks = computed(() => {
  const blocks = flattenTree(blockTree.value);
  return blocks.map((block) => {
    const doc = parseBlockData(block.blockData);
    const html = generateHTML(doc, previewExtensions);
    return { id: block.blockId, html, block, doc };
  });
});

const textFromDoc = (doc: any) => {
  const parts: string[] = [];
  const walk = (node: any) => {
    if (!node) return;
    if (node.type === "text" && typeof node.text === "string") {
      parts.push(node.text);
      return;
    }
    const content = node.content;
    if (Array.isArray(content)) {
      content.forEach(walk);
    }
  };
  walk(doc);
  return parts.join(" ").trim();
};

const outlineItems = computed(() => {
  return previewBlocks.value
    .map((item) => {
      let level = 1;
      let title = "";
      const content = item.doc?.content ?? [];
      for (const node of content) {
        if (node?.type === "heading") {
          level = Number(node.attrs?.level ?? 1);
          title = textFromDoc(node);
          break;
        }
      }
      if (!title) return null;
      return { id: item.id, title, level };
    })
    .filter((item): item is { id: number; title: string; level: number } => !!item);
});

const parseLanguage = (codeEl: HTMLElement) => {
  const className = codeEl.className || "";
  const match =
    className.match(/language-([a-z0-9-]+)/i) ||
    className.match(/lang-([a-z0-9-]+)/i);
  return match?.[1] ?? "";
};

const enhanceCodeBlocks = (container: HTMLElement) => {
  container.querySelectorAll("pre").forEach((pre) => {
    const element = pre as HTMLElement;
    const blockId = Number(element.closest("[data-block-id]")?.getAttribute("data-block-id"));
    if (element.dataset.enhanced === "true") {
      if (blockId && languageOverrides.value.has(blockId)) {
        const override = languageOverrides.value.get(blockId) ?? "";
        const code = element.querySelector("code") as HTMLElement | null;
        if (code && override) {
          code.className = `language-${override}`;
        }
      }
      return;
    }
    const code = element.querySelector("code") as HTMLElement | null;
    const overrideLang = blockId ? languageOverrides.value.get(blockId) : "";
    const language = overrideLang || (code ? parseLanguage(code) : "");
    const toolbar = document.createElement("div");
    toolbar.className = "preview-code-toolbar";
    const badge = document.createElement("span");
    badge.className = "preview-code-language";
    badge.textContent = language || "code";
    badge.title = "클릭해서 언어 변경";
    badge.addEventListener("click", () => {
      if (!code || !blockId) return;
      const current = overrideLang || parseLanguage(code) || "";
      const next = window.prompt(
        "언어를 입력하세요 (예: javascript, java, sql, python, bash, yaml, kotlin)",
        current
      );
      if (next == null) return;
      const value = next.trim().toLowerCase();
      if (!value) return;
      languageOverrides.value.set(blockId, value);
      code.className = `language-${value}`;
      badge.textContent = value;
      applyHighlight();
    });
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "preview-code-copy";
    copy.textContent = "복사";
    copy.addEventListener("click", async () => {
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code.textContent ?? "");
        copy.textContent = "복사됨";
        window.setTimeout(() => {
          copy.textContent = "복사";
        }, 1200);
      } catch {
        copy.textContent = "실패";
        window.setTimeout(() => {
          copy.textContent = "복사";
        }, 1200);
      }
    });
    toolbar.appendChild(badge);
    toolbar.appendChild(copy);
    element.prepend(toolbar);
    element.dataset.enhanced = "true";
  });
};

const enhanceMedia = (container: HTMLElement) => {
  container.querySelectorAll("img").forEach((img) => {
    const element = img as HTMLImageElement;
    if (element.dataset.previewBound === "true") return;
    element.addEventListener("error", () => {
      const fallback = document.createElement("div");
      fallback.className = "preview-media-fallback";
      fallback.textContent = "이미지를 불러오지 못했습니다.";
      element.replaceWith(fallback);
    });
    element.dataset.previewBound = "true";
  });
  container.querySelectorAll("iframe").forEach((iframe) => {
    const element = iframe as HTMLIFrameElement;
    if (element.dataset.previewBound === "true") return;
    let loaded = false;
    element.addEventListener("load", () => {
      loaded = true;
    });
    window.setTimeout(() => {
      if (loaded) return;
      const fallback = document.createElement("div");
      fallback.className = "preview-media-fallback";
      fallback.textContent = "임베드 컨텐츠를 불러오지 못했습니다.";
      element.replaceWith(fallback);
    }, 4000);
    element.dataset.previewBound = "true";
  });
};

const clearSearchHighlights = (container: HTMLElement) => {
  container.querySelectorAll("mark.preview-search-hit").forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
    parent.normalize();
  });
};

const applySearchHighlights = (container: HTMLElement) => {
  clearSearchHighlights(container);
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return;
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = (node as Text).parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest("pre") || parent.closest("code")) {
          return NodeFilter.FILTER_REJECT;
        }
        if (!node.nodeValue || !node.nodeValue.trim()) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
  }
  nodes.forEach((textNode) => {
    const value = textNode.nodeValue || "";
    const lower = value.toLowerCase();
    const index = lower.indexOf(query);
    if (index === -1) return;
    const span = document.createElement("span");
    let lastIndex = 0;
    let pos = index;
    while (pos !== -1) {
      if (pos > lastIndex) {
        span.appendChild(document.createTextNode(value.slice(lastIndex, pos)));
      }
      const mark = document.createElement("mark");
      mark.className = "preview-search-hit";
      mark.textContent = value.slice(pos, pos + query.length);
      span.appendChild(mark);
      lastIndex = pos + query.length;
      pos = lower.indexOf(query, lastIndex);
    }
    if (lastIndex < value.length) {
      span.appendChild(document.createTextNode(value.slice(lastIndex)));
    }
    const parent = textNode.parentNode;
    if (parent) {
      parent.replaceChild(span, textNode);
    }
  });
};

const applyHighlight = async () => {
  await nextTick();
  const container = previewContainer.value;
  if (!container) return;
  enhanceCodeBlocks(container);
  enhanceMedia(container);
  const containerRect = container.getBoundingClientRect();
  container.querySelectorAll("pre code").forEach((node) => {
    const code = node as HTMLElement;
    if (!autoDetect.value && !parseLanguage(code)) {
      return;
    }
    const rect = code.getBoundingClientRect();
    const visible =
      rect.bottom >= containerRect.top && rect.top <= containerRect.bottom;
    if (!visible) return;
    try {
      hljs.highlightElement(code);
    } catch {
      // ignore highlight errors to keep preview stable
    }
  });
  applySearchHighlights(container);
};

const updateActiveOutline = () => {
  const container = previewContainer.value;
  if (!container) return;
  const containerRect = container.getBoundingClientRect();
  let currentId: number | null = null;
  let minDistance = Infinity;
  container.querySelectorAll<HTMLElement>("[data-block-id]").forEach((el) => {
    const rect = el.getBoundingClientRect();
    const distance = Math.abs(rect.top - containerRect.top - 60);
    if (rect.bottom < containerRect.top + 40) return;
    if (distance < minDistance) {
      minDistance = distance;
      const id = Number(el.dataset.blockId);
      if (Number.isFinite(id)) {
        currentId = id;
      }
    }
  });
  activeOutlineId.value = currentId;
};

const loadPreview = async () => {
  if (!props.documentId) return;
  loading.value = true;
  error.value = null;
  try {
    const latest = await documentApi.getLatest(props.documentId);
    bundle.value = latest.data;
    const versionId = latest.data.version?.versionId;
    const tree = await documentApi.listBlocksTree(props.documentId, {
      versionId,
      includeDeleted: false,
    });
    blockTree.value = tree.data;
  } catch (err: any) {
    error.value = resolveAxiosError(err);
  } finally {
    loading.value = false;
  }
};

watch(
  () => open.value,
  (value) => {
    if (value) {
      loadPreview();
    }
  }
);

watch(
  () => props.documentId,
  (value) => {
    if (open.value && value) {
      loadPreview();
    }
  }
);

watch(
  previewBlocks,
  () => {
    if (!open.value) return;
    if (highlightTimer.value) {
      window.clearTimeout(highlightTimer.value);
    }
    highlightTimer.value = window.setTimeout(() => {
      applyHighlight();
    }, 120);
  },
  { flush: "post" }
);

watch(autoDetect, () => {
  if (open.value) {
    applyHighlight();
  }
});

watch(searchQuery, () => {
  if (!open.value) return;
  if (searchTimer.value) {
    window.clearTimeout(searchTimer.value);
  }
  searchTimer.value = window.setTimeout(() => {
    applyHighlight();
  }, 150);
});

const scrollToBlock = (id: number) => {
  const el = previewContainer.value?.querySelector(`#block-${id}`) as HTMLElement | null;
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
};

const onScroll = () => {
  updateActiveOutline();
};

watch(
  () => showOutline.value,
  (value) => {
    if (value) {
      nextTick(() => updateActiveOutline());
    }
  }
);

watch(
  previewBlocks,
  () => {
    nextTick(() => updateActiveOutline());
  },
  { flush: "post" }
);

watch(
  () => open.value,
  (value) => {
    if (value) {
      nextTick(() => updateActiveOutline());
    }
  }
);
</script>

<style scoped>
.preview-body {
  max-width: 860px;
  margin: 0 auto;
}

.preview-body--outline {
  max-width: none;
  margin: 0;
  padding-right: 8px;
}

.preview-layout {
  display: flex;
  gap: 16px;
}

.preview-layout--outline {
  max-width: none;
}

.preview-outline {
  width: 220px;
  flex: 0 0 220px;
  position: sticky;
  top: 64px;
  align-self: flex-start;
  border-left: 1px solid rgba(0, 0, 0, 0.08);
  padding-left: 12px;
  max-height: calc(100vh - 120px);
  overflow: auto;
  font-size: 0.9rem;
}

.preview-outline-title {
  font-weight: 600;
  margin-bottom: 6px;
}

.preview-outline-list {
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-outline-item {
  cursor: pointer;
  text-align: left;
  background: transparent;
  border: none;
  padding: 4px 6px;
  border-radius: 6px;
  color: rgba(0, 0, 0, 0.7);
  transition: background 0.2s ease, color 0.2s ease;
}

.preview-outline-item:hover {
  background: rgba(25, 118, 210, 0.08);
}

.preview-outline-item.active {
  background: rgba(25, 118, 210, 0.15);
  color: rgba(25, 118, 210, 0.95);
  font-weight: 600;
  position: relative;
  padding-left: 14px;
}

.preview-outline-item.active::before {
  content: "";
  position: absolute;
  left: 4px;
  top: 6px;
  bottom: 6px;
  width: 3px;
  border-radius: 999px;
  background: rgba(25, 118, 210, 0.95);
}

.preview-outline-level-2 {
  padding-left: 12px;
}

.preview-outline-level-3 {
  padding-left: 24px;
}

.preview-outline-level-4,
.preview-outline-level-5,
.preview-outline-level-6 {
  padding-left: 36px;
}

.preview-content {
  flex: 1;
  min-width: 0;
  max-height: calc(100vh - 140px);
  overflow: auto;
  padding-right: 8px;
  font-size: 0.95rem;
}

.preview-search {
  max-width: 200px;
}

.preview-block {
  padding: 8px 0;
}

.preview-debug {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  margin-bottom: 4px;
}

.preview-block :deep(blockquote) {
  border-left: 3px solid rgba(0, 0, 0, 0.2);
  margin: 8px 0;
  padding: 6px 12px;
  color: rgba(0, 0, 0, 0.75);
  background: rgba(0, 0, 0, 0.04);
  border-radius: 6px;
}

.preview-block :deep(pre) {
  background: rgba(0, 0, 0, 0.85);
  color: #f8f8f2;
  padding: 12px 14px;
  border-radius: 8px;
  overflow: auto;
  font-size: 0.9rem;
}

.preview-block :deep(pre[data-theme="github"]) {
  background: #f6f8fa;
  color: #24292e;
}

.preview-block :deep(pre[data-theme="monokai"]) {
  background: #272822;
  color: #f8f8f2;
}

.preview-block :deep(pre[data-theme="atom-one-dark"]) {
  background: #282c34;
  color: #e06c75;
}

.preview-block :deep(pre[data-theme="tokyo-night"]) {
  background: #1a1b26;
  color: #c0caf5;
}

.preview-block :deep(code) {
  background: rgba(0, 0, 0, 0.06);
  padding: 2px 4px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  font-size: 0.92em;
}

.preview-block :deep(mark.preview-search-hit) {
  background: #ffe082;
  padding: 0 2px;
  border-radius: 2px;
}

.preview-block :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 12px 0;
  font-size: 0.95em;
}

.preview-block :deep(th),
.preview-block :deep(td) {
  border: 1px solid rgba(0, 0, 0, 0.12);
  padding: 8px 10px;
  vertical-align: top;
}

.preview-block :deep(th) {
  background: rgba(0, 0, 0, 0.04);
  font-weight: 600;
}

.preview-block :deep(pre) {
  position: relative;
  padding-top: 36px;
}

.preview-block :deep(.preview-code-toolbar) {
  position: absolute;
  top: 6px;
  right: 8px;
  left: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  opacity: 0.85;
  pointer-events: none;
}

.preview-block :deep(.preview-code-language) {
  background: rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.85);
  padding: 2px 8px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  font-size: 11px;
}

.preview-block :deep(.preview-code-copy) {
  pointer-events: auto;
  background: rgba(255, 255, 255, 0.18);
  border: none;
  color: rgba(255, 255, 255, 0.9);
  padding: 2px 8px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 11px;
}

.preview-block :deep(pre[data-theme="github"]) .preview-code-language,
.preview-block :deep(pre[data-theme="github"]) .preview-code-copy {
  background: rgba(0, 0, 0, 0.08);
  color: rgba(0, 0, 0, 0.7);
}

.preview-block :deep(.preview-media-fallback) {
  padding: 16px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.04);
  color: rgba(0, 0, 0, 0.6);
  font-size: 14px;
  text-align: center;
}
</style>
