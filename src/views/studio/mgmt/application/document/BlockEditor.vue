<template>
  <v-card variant="text" density="compact" class="h-100">
    <v-card-title class="d-flex align-center">
      <v-banner icon="mdi-information-outline" lines="one" text="/ 입력하여 블록을 추가할 수 있습니다." :stacked="false" class="pa-0">
      </v-banner>
      <v-spacer />
      <v-btn variant="text" icon="mdi-delete-outline" color="error" :disabled="!block || isDeleting"
        :loading="isDeleting" @click="onDelete" />
      <span v-if="autoSaveLabel" class="auto-save-status">{{ autoSaveLabel }}</span>
      <v-btn variant="outlined" prepend-icon="mdi-content-save" rounded="xl" color="primary" width="100"
        :disabled="!block || isSaving" :loading="isSaving" @click="onSave">
        저장
      </v-btn>
    </v-card-title>
    <v-card-text v-if="!block" style="min-height:300px;">
      선택된 블록이 없습니다.
    </v-card-text>
    <v-card-text v-else class="pa-0">
      <v-row dense>
        <v-col cols="12">
          <div v-if="editorMode === 'tiptap'" class="editor-shell">
            <div class="editor-toolbar">
              <div class="toolbar-group">
              <v-tooltip text="Bold (Ctrl+B)" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" size="x-small" :variant="isActive('bold') ? 'tonal' : 'text'"
                    :color="isActive('bold') ? 'primary' : undefined" icon="mdi-format-bold"
                    @click="toggleMark('bold')" />
                </template>
              </v-tooltip>
              <v-tooltip text="Italic (Ctrl+I)" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" size="x-small" :variant="isActive('italic') ? 'tonal' : 'text'"
                    :color="isActive('italic') ? 'primary' : undefined" icon="mdi-format-italic"
                    @click="toggleMark('italic')" />
                </template>
              </v-tooltip>
              <v-tooltip text="Strike (Ctrl+Shift+X)" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" size="x-small" :variant="isActive('strike') ? 'tonal' : 'text'"
                    :color="isActive('strike') ? 'primary' : undefined" icon="mdi-format-strikethrough"
                    @click="toggleMark('strike')" />
                </template>
              </v-tooltip>
            </div>
            <div class="toolbar-group">
              <v-tooltip text="Heading 1 (Ctrl+Alt+1)" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" size="x-small" :variant="isActive('heading', { level: 1 }) ? 'tonal' : 'text'"
                    :color="isActive('heading', { level: 1 }) ? 'primary' : undefined" icon="mdi-format-header-1"
                    @click="setHeading(1)" />
                </template>
              </v-tooltip>
              <v-tooltip text="Heading 2 (Ctrl+Alt+2)" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" size="x-small" :variant="isActive('heading', { level: 2 }) ? 'tonal' : 'text'"
                    :color="isActive('heading', { level: 2 }) ? 'primary' : undefined" icon="mdi-format-header-2"
                    @click="setHeading(2)" />
                </template>
              </v-tooltip>
              <v-tooltip text="Heading 3 (Ctrl+Alt+3)" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" size="x-small" :variant="isActive('heading', { level: 3 }) ? 'tonal' : 'text'"
                    :color="isActive('heading', { level: 3 }) ? 'primary' : undefined" icon="mdi-format-header-3"
                    @click="setHeading(3)" />
                </template>
              </v-tooltip>
            </div>
            <div class="toolbar-group">
              <v-tooltip text="Bullet List (Ctrl+Shift+8)" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" size="x-small" :variant="isActive('bulletList') ? 'tonal' : 'text'"
                    :color="isActive('bulletList') ? 'primary' : undefined" icon="mdi-format-list-bulleted"
                    @click="toggleBullet" />
                </template>
              </v-tooltip>
              <v-tooltip text="Ordered List (Ctrl+Shift+7)" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" size="x-small" :variant="isActive('orderedList') ? 'tonal' : 'text'"
                    :color="isActive('orderedList') ? 'primary' : undefined" icon="mdi-format-list-numbered"
                    @click="toggleOrdered" />
                </template>
              </v-tooltip>
              <v-tooltip text="Quote (Ctrl+Shift+9)" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" size="x-small" :variant="isActive('blockquote') ? 'tonal' : 'text'"
                    :color="isActive('blockquote') ? 'primary' : undefined" icon="mdi-format-quote-close"
                    @click="toggleQuote" />
                </template>
              </v-tooltip>
              <v-tooltip text="Code Block (Ctrl+Alt+C)" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" size="x-small" :variant="isActive('codeBlock') ? 'tonal' : 'text'"
                    :color="isActive('codeBlock') ? 'primary' : undefined" icon="mdi-code-braces"
                    @click="toggleCodeBlock" />
                </template>
              </v-tooltip>
              <v-tooltip text="Divider" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" size="x-small" variant="text" icon="mdi-minus" @click="insertDivider" />
                </template>
              </v-tooltip>
            </div>
            <div class="toolbar-group">
              <v-tooltip text="Link (Ctrl+K)" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" size="x-small" :variant="isActive('link') ? 'tonal' : 'text'"
                    :color="isActive('link') ? 'primary' : undefined" icon="mdi-link-variant" @click="insertLink" />
                </template>
              </v-tooltip>
              <v-tooltip text="Image" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" size="x-small" variant="text" icon="mdi-image-outline" @click="insertImage" />
                </template>
              </v-tooltip>
              <v-tooltip text="YouTube" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" size="x-small" variant="text" icon="mdi-youtube" @click="insertYoutube" />
                </template>
              </v-tooltip>
            </div>
            <div class="toolbar-group">
              <v-tooltip text="Insert Table" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" size="x-small" :variant="isActive('table') ? 'tonal' : 'text'"
                    :color="isActive('table') ? 'primary' : undefined" icon="mdi-table" @click="insertTable" />
                </template>
              </v-tooltip>
              <v-tooltip text="Add Row" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" size="x-small" variant="text" icon="mdi-table-row-plus-after"
                    @click="addRowAfter" />
                </template>
              </v-tooltip>
              <v-tooltip text="Add Column" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" size="x-small" variant="text" icon="mdi-table-column-plus-after"
                    @click="addColumnAfter" />
                </template>
              </v-tooltip>
              <v-tooltip text="Delete Table" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" size="x-small" variant="text" icon="mdi-table-remove" @click="deleteTable" />
                </template>
              </v-tooltip>
            </div>
            <div class="toolbar-group toolbar-selects">
              <v-select v-model="codeLanguage" :items="codeLanguages" label="Code" density="compact" hide-details
                variant="outlined" class="toolbar-select" @update:model-value="setCodeLanguage" />
              <v-select v-model="codeTheme" :items="codeThemes" label="Theme" density="compact" hide-details
                variant="outlined" class="toolbar-select" @update:model-value="setCodeTheme" />
            </div>
            </div>
            <div v-if="codeBlockActive" class="code-block-badge">
              <v-chip size="small" color="primary" variant="tonal">
                Code: {{ codeLanguage }}
              </v-chip>
              <v-chip size="small" variant="tonal" class="ml-2">
                Theme: {{ codeTheme }}
              </v-chip>
            </div>
          </div>
          <div v-if="editorMode === 'tiptap'" class="editor-scroll">
            <div ref="editorContainer" class="tiptap-editor">
            <EditorContent :editor="editor" />
            <div v-if="slashOpen" class="slash-menu"
              :style="{ left: `${slashPosition.x}px`, top: `${slashPosition.y}px` }">
              <v-list density="compact">
                <v-list-item
                  v-for="(item, index) in slashItems"
                  :key="item.id"
                  :class="{ 'slash-item-active': index === slashIndex }"
                  @mouseenter="slashIndex = index"
                  @click="applySlashCommand(item.id)"
                >
                  {{ item.label }}
                </v-list-item>
              </v-list>
            </div>
          </div>
          </div>
          <v-textarea v-else v-model="jsonText" label="blockData (JSON)" rows="14" auto-grow density="compact"
            variant="outlined" />
        </v-col>
        <v-col cols="12">
          <v-expansion-panels variant="accordion" density="compact">
            <v-expansion-panel>
              <v-expansion-panel-title>  
                <template v-slot:default="{ expanded }">
                  <v-row no-gutters>
                    <v-col class="d-flex justify-start" cols="4">
                      블록 에디터 설정
                    </v-col>
                    <v-col class="text-grey" cols="8">
                      <v-fade-transition leave-absolute>
                        <span v-if="expanded" key="0">
                          blockType, editor, sortOrder 을 수정할 수 있습니다.
                        </span>
                        <span v-else key="1">
                          {{ editorMode }}
                        </span>
                      </v-fade-transition>
                    </v-col>
                  </v-row>
                </template>
              </v-expansion-panel-title>
              <v-expansion-panel-text bg-color="white">
                <v-row dense>
                  <v-col cols="12" md="4">
                    <v-text-field v-model="localBlockType" label="blockType" density="compact" variant="outlined" />
                  </v-col>
                  <v-col cols="12" md="4">
                    <v-select v-model="editorMode" :items="modeOptions" label="editor" density="compact"
                      variant="outlined" @update:model-value="modeTouched = true" />
                  </v-col>
                  <v-col cols="12" md="4">
                    <v-text-field :model-value="block.sortOrder ?? ''" label="sortOrder" density="compact"
                      variant="outlined" readonly />
                  </v-col>
                </v-row>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-col>
      </v-row>
      <v-alert v-if="localError" type="error" density="compact" class="mt-2">
        {{ localError }}
      </v-alert>
    </v-card-text>
    <v-dialog v-model="linkDialog" width="520">
      <v-card>
        <v-card-title>링크 추가</v-card-title>
        <v-card-text>
          <v-text-field v-model="linkUrl" label="URL" density="compact" variant="outlined" />
          <v-alert v-if="linkError" type="error" density="compact" class="mt-2">
            {{ linkError }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="linkDialog = false">취소</v-btn>
          <v-btn color="primary" variant="tonal" @click="confirmLink">추가</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog v-model="imageDialog" width="560">
      <v-card>
        <v-card-title>이미지 추가</v-card-title>
        <v-card-text>
          <v-text-field v-model="imageUrl" label="이미지 URL" density="compact" variant="outlined" />
          <v-img v-if="imageUrl" :src="imageUrl" max-height="220" class="mt-2" />
          <v-alert v-if="imageError" type="error" density="compact" class="mt-2">
            {{ imageError }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="imageDialog = false">취소</v-btn>
          <v-btn color="primary" variant="tonal" @click="confirmImage">추가</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog v-model="fileDialog" width="560">
      <v-card>
        <v-card-title>파일 추가</v-card-title>
        <v-card-text>
          <v-text-field v-model="fileUrl" label="파일 URL" density="compact" variant="outlined" />
          <v-text-field v-model="fileLabel" label="표시 이름" density="compact" variant="outlined" class="mt-2" />
          <v-alert v-if="fileError" type="error" density="compact" class="mt-2">
            {{ fileError }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="fileDialog = false">취소</v-btn>
          <v-btn color="primary" variant="tonal" @click="confirmFile">추가</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog v-model="youtubeDialog" width="560">
      <v-card>
        <v-card-title>유튜브 추가</v-card-title>
        <v-card-text>
          <v-text-field v-model="youtubeUrl" label="유튜브 URL" density="compact" variant="outlined" />
          <v-text-field v-model="youtubeStart" label="시작 시간(초)" density="compact" variant="outlined" class="mt-2" />
          <div v-if="youtubeUrl" class="mt-2">
            <iframe
              :src="youtubeEmbedUrl"
              width="100%"
              height="240"
              style="border:0"
              allowfullscreen
            ></iframe>
          </div>
          <v-alert v-if="youtubeError" type="error" density="compact" class="mt-2">
            {{ youtubeError }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="youtubeDialog = false">취소</v-btn>
          <v-btn color="primary" variant="tonal" @click="confirmYoutube">추가</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useDocumentStore } from "@/stores/studio/mgmt/document.store";
import type { DocumentBlock } from "@/types/studio/document";
import { resolveAxiosError } from "@/utils/helpers";
import { EditorContent, useEditor } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Youtube from "@tiptap/extension-youtube";
import { createLowlight, common } from "lowlight";
import java from "highlight.js/lib/languages/java";
import sql from "highlight.js/lib/languages/sql";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import yaml from "highlight.js/lib/languages/yaml";
import kotlin from "highlight.js/lib/languages/kotlin";
import { useConfirm } from "@/plugins/confirm";

type EditorMode = "tiptap" | "json";

const props = defineProps<{
  block: DocumentBlock | null;
}>();

const emit = defineEmits<{
  (e: "saved", blockId: number): void;
  (e: "deleted", blockId: number): void;
}>();

const store = useDocumentStore();
const confirm = useConfirm();

const localBlockType = ref("json");
const jsonText = ref("");
const localError = ref<string | null>(null);
const isSaving = ref(false);
const isDeleting = ref(false);
const editorMode = ref<EditorMode>("tiptap");
const modeTouched = ref(false);
const slashOpen = ref(false);
const slashPosition = ref({ x: 0, y: 0 });
const editorContainer = ref<HTMLDivElement | null>(null);
const codeLanguage = ref("javascript");
const codeTheme = ref("github");
const lastCodeLanguage = ref("javascript");
const lastCodeTheme = ref("github");
const codeBlockActive = ref(false);
const autoSaveStatus = ref<"idle" | "saving" | "saved" | "error">("idle");
const isAutoSaving = ref(false);
const autoSaveTimer = ref<number | null>(null);

const linkDialog = ref(false);
const linkUrl = ref("");
const linkError = ref<string | null>(null);

const imageDialog = ref(false);
const imageUrl = ref("");
const imageError = ref<string | null>(null);

const fileDialog = ref(false);
const fileUrl = ref("");
const fileLabel = ref("파일");
const fileError = ref<string | null>(null);

const youtubeDialog = ref(false);
const youtubeUrl = ref("");
const youtubeStart = ref("0");
const youtubeError = ref<string | null>(null);

const slashIndex = ref(0);

const codeLanguages = [
  { title: "JavaScript", value: "javascript" },
  { title: "JSON", value: "json" },
  { title: "HTML", value: "html" },
  { title: "CSS", value: "css" },
  { title: "Java", value: "java" },
  { title: "SQL", value: "sql" },
];

const codeThemes = [
  { title: "GitHub", value: "github" },
  { title: "Monokai", value: "monokai" },
  { title: "Atom One Dark", value: "atom-one-dark" },
  { title: "Tokyo Night", value: "tokyo-night" },
];

const slashItems = [
  { id: "paragraph", label: "텍스트" },
  { id: "heading-1", label: "제목 1" },
  { id: "heading-2", label: "제목 2" },
  { id: "bullet", label: "불릿 리스트" },
  { id: "ordered", label: "번호 리스트" },
  { id: "quote", label: "인용" },
  { id: "codeblock", label: "코드 블록" },
  { id: "divider", label: "구분선" },
  { id: "image", label: "이미지" },
  { id: "file", label: "파일" },
  { id: "youtube", label: "유튜브" },
];

const autoSaveLabel = computed(() => {
  if (autoSaveStatus.value === "saving") return "자동 저장중...";
  if (autoSaveStatus.value === "saved") return "자동 저장됨";
  if (autoSaveStatus.value === "error") return "자동 저장 실패";
  return "";
});

const youtubeEmbedUrl = computed(() => {
  if (!youtubeUrl.value) return "";
  const url = new URL(youtubeUrl.value, window.location.origin);
  const id =
    url.searchParams.get("v") ||
    url.pathname.split("/").filter(Boolean).pop() ||
    "";
  const start = Number(youtubeStart.value || 0);
  const startParam = Number.isFinite(start) && start > 0 ? `?start=${start}` : "";
  return id ? `https://www.youtube.com/embed/${id}${startParam}` : "";
});

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

const modeOptions = computed(() => [
  { title: "tiptap", value: "tiptap" },
  { title: "json", value: "json" },
]);

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

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      codeBlock: false,
    }),
    Image,
    Placeholder.configure({
      placeholder: "여기에 입력하세요. '/' 로 블록을 추가할 수 있어요.",
    }),
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
  ],
  content: { type: "doc", content: [] },
  editorProps: {
    handleClick: () => {
      slashOpen.value = false;
      return false;
    },
    handleKeyDown: (_, event) => {
      if (editorMode.value !== "tiptap") return false;
      if (slashOpen.value) {
        if (event.key === "ArrowDown") {
          slashIndex.value = (slashIndex.value + 1) % slashItems.length;
          event.preventDefault();
          return true;
        }
        if (event.key === "ArrowUp") {
          slashIndex.value =
            (slashIndex.value - 1 + slashItems.length) % slashItems.length;
          event.preventDefault();
          return true;
        }
        if (event.key === "Enter") {
          const item = slashItems[slashIndex.value];
          if (item) applySlashCommand(item.id);
          event.preventDefault();
          return true;
        }
      }
      if (event.key === "/") {
        const view = editor?.value?.view;
        const { from } = view?.state.selection ?? { from: 0 };
        const coords = view?.coordsAtPos(from);
        const container = editorContainer.value?.getBoundingClientRect();
        if (coords && container) {
          slashPosition.value = {
            x: coords.left - container.left,
            y: coords.bottom - container.top + 6,
          };
          slashOpen.value = true;
          slashIndex.value = 0;
        }
      } else if (event.key === "Escape" && slashOpen.value) {
        slashOpen.value = false;
      }
      return false;
    },
  },
  onUpdate: () => {
    scheduleAutoSave();
  },
  onSelectionUpdate: ({ editor: instance }) => {
    const activeCode = instance.isActive("codeBlock");
    codeBlockActive.value = activeCode;
    if (activeCode) {
      const attrs = instance.getAttributes("codeBlock");
      if (attrs?.language) {
        codeLanguage.value = attrs.language;
        lastCodeLanguage.value = attrs.language;
      }
      if (attrs?.theme) {
        codeTheme.value = attrs.theme;
        lastCodeTheme.value = attrs.theme;
      }
    }
  },
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

const parseJsonContent = (value: string) => {
  try {
    const parsed = JSON.parse(value);
    return parsed;
  } catch {
    return null;
  }
};

const isValidUrl = (value: string) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

watch(
  () => props.block,
  (value) => {
    if (!value) {
    localBlockType.value = "json";
      jsonText.value = "";
      localError.value = null;
      editorMode.value = "tiptap";
      modeTouched.value = false;
      editor?.value?.commands.setContent({ type: "doc", content: [] });
      autoSaveStatus.value = "idle";
      return;
    }
    localBlockType.value = value.blockType ?? "json";
    localError.value = null;
    const rawData = value.blockData ?? "";
    const parsed = parseJsonContent(rawData);
    const doc = parsed ?? toDocFromText(rawData);
    editor?.value?.commands.setContent(doc);
    jsonText.value = JSON.stringify(doc, null, 2);
    if (!modeTouched.value) {
      editorMode.value = "tiptap";
    }
    modeTouched.value = false;
    autoSaveStatus.value = "idle";
  },
  { immediate: true }
);

watch(editorMode, (value) => {
  if (value === "json") {
    const content = editor?.value?.getJSON() ?? toDocFromText("");
    jsonText.value = JSON.stringify(content, null, 2);
    return;
  }
  const parsed = parseJsonContent(jsonText.value || "{}");
  if (!parsed) {
    localError.value = "JSON 형식이 올바르지 않습니다.";
    return;
  }
  localError.value = null;
  editor?.value?.commands.setContent(parsed);
});

watch(jsonText, () => {
  if (editorMode.value === "json") {
    scheduleAutoSave();
  }
});

const removeSlashTrigger = () => {
  const view = editor?.value?.view;
  if (!view) return;
  const { from } = view.state.selection;
  const prev = view.state.doc.textBetween(from - 1, from, "\n");
  if (prev === "/") {
    editor?.value?.commands.deleteRange({ from: from - 1, to: from });
  }
};

const applySlashCommand = (type: string) => {
  slashOpen.value = false;
  removeSlashTrigger();
  const chain = editor?.value?.chain().focus();
  if (!chain) return;
  switch (type) {
    case "paragraph":
      chain.setParagraph().run();
      break;
    case "heading-1":
      chain.toggleHeading({ level: 1 }).run();
      break;
    case "heading-2":
      chain.toggleHeading({ level: 2 }).run();
      break;
    case "bullet":
      chain.toggleBulletList().run();
      break;
    case "ordered":
      chain.toggleOrderedList().run();
      break;
    case "quote":
      chain.toggleBlockquote().run();
      break;
    case "codeblock":
      chain
        .setCodeBlock({
          language: codeLanguage.value,
          theme: codeTheme.value,
        } as any)
        .run();
      break;
    case "divider":
      chain.setHorizontalRule().run();
      break;
    case "image":
      openImageDialog();
      break;
    case "file":
      openFileDialog();
      break;
    case "youtube":
      openYoutubeDialog();
      break;
    default:
      break;
  }
};

const toggleMark = (mark: "bold" | "italic" | "strike") => {
  const chain = editor?.value?.chain().focus();
  if (!chain) return;
  if (mark === "bold") chain.toggleBold().run();
  if (mark === "italic") chain.toggleItalic().run();
  if (mark === "strike") chain.toggleStrike().run();
};

const isActive = (name: string, attrs?: Record<string, any>) => {
  return editor?.value?.isActive(name, attrs) ?? false;
};

const setHeading = (level: 1 | 2 | 3) => {
  editor?.value?.chain().focus().toggleHeading({ level }).run();
};

const toggleBullet = () => {
  editor?.value?.chain().focus().toggleBulletList().run();
};

const toggleOrdered = () => {
  editor?.value?.chain().focus().toggleOrderedList().run();
};

const toggleQuote = () => {
  editor?.value?.chain().focus().toggleBlockquote().run();
};

const toggleCodeBlock = () => {
  const instance = editor?.value;
  if (!instance) return;
  if (instance.isActive("codeBlock")) {
    instance.chain().focus().toggleCodeBlock().run();
    return;
  }
  instance
    .chain()
    .focus()
    .setCodeBlock({
      language: codeLanguage.value,
      theme: codeTheme.value,
    } as any)
    .run();
};

const insertDivider = () => {
  editor?.value?.chain().focus().setHorizontalRule().run();
};

const openLinkDialog = () => {
  linkUrl.value = "";
  linkError.value = null;
  linkDialog.value = true;
};

const confirmLink = () => {
  if (!linkUrl.value || !isValidUrl(linkUrl.value)) {
    linkError.value = "유효한 URL을 입력하세요.";
    return;
  }
  const chain = editor?.value?.chain().focus();
  if (!chain) return;
  const isEmpty = editor?.value?.state.selection.empty ?? true;
  if (isEmpty) {
    chain
      .insertContent({
        type: "text",
        text: linkUrl.value,
        marks: [{ type: "link", attrs: { href: linkUrl.value } }],
      })
      .run();
  } else {
    chain.extendMarkRange("link").setLink({ href: linkUrl.value }).run();
  }
  linkDialog.value = false;
};

const openImageDialog = () => {
  imageUrl.value = "";
  imageError.value = null;
  imageDialog.value = true;
};

const confirmImage = () => {
  if (!imageUrl.value || !isValidUrl(imageUrl.value)) {
    imageError.value = "유효한 URL을 입력하세요.";
    return;
  }
  editor?.value?.chain().focus().setImage({ src: imageUrl.value }).run();
  imageDialog.value = false;
};

const openFileDialog = () => {
  fileUrl.value = "";
  fileLabel.value = "파일";
  fileError.value = null;
  fileDialog.value = true;
};

const confirmFile = () => {
  if (!fileUrl.value || !isValidUrl(fileUrl.value)) {
    fileError.value = "유효한 URL을 입력하세요.";
    return;
  }
  const label = fileLabel.value?.trim() || "파일";
  editor?.value
    ?.chain()
    .focus()
    .insertContent({
      type: "text",
      text: label,
      marks: [{ type: "link", attrs: { href: fileUrl.value } }],
    })
    .run();
  fileDialog.value = false;
};

const openYoutubeDialog = () => {
  youtubeUrl.value = "";
  youtubeStart.value = "0";
  youtubeError.value = null;
  youtubeDialog.value = true;
};

const confirmYoutube = () => {
  if (!youtubeUrl.value || !isValidUrl(youtubeUrl.value)) {
    youtubeError.value = "유효한 URL을 입력하세요.";
    return;
  }
  const startAt = Number(youtubeStart.value || 0);
  editor?.value
    ?.chain()
    .focus()
    .setYoutubeVideo({
      src: youtubeUrl.value,
      start: Number.isFinite(startAt) ? startAt : 0,
    })
    .run();
  localBlockType.value = "youtube";
  youtubeDialog.value = false;
};

const insertLink = () => {
  openLinkDialog();
};

const insertImage = () => {
  openImageDialog();
};

const insertYoutube = () => {
  openYoutubeDialog();
};

const insertTable = () => {
  editor?.value
    ?.chain()
    .focus()
    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
    .run();
};

const setCodeLanguage = (value: string) => {
  const instance = editor?.value;
  if (!instance) return;
  if (instance.isActive("codeBlock")) {
    instance
      .chain()
      .focus()
      .updateAttributes("codeBlock", { language: value })
      .run();
    lastCodeLanguage.value = value;
    return;
  }
  const ok = window.confirm("코드 블록을 생성하고 언어를 적용할까요?");
  if (!ok) {
    codeLanguage.value = lastCodeLanguage.value;
    return;
  }
  instance
    .chain()
    .focus()
    .setCodeBlock({
      language: value,
      theme: codeTheme.value,
    } as any)
    .run();
  lastCodeLanguage.value = value;
};

const setCodeTheme = (value: string) => {
  const instance = editor?.value;
  if (!instance) return;
  if (instance.isActive("codeBlock")) {
    instance
      .chain()
      .focus()
      .updateAttributes("codeBlock", { theme: value })
      .run();
    lastCodeTheme.value = value;
    return;
  }
  const ok = window.confirm("코드 블록을 생성하고 테마를 적용할까요?");
  if (!ok) {
    codeTheme.value = lastCodeTheme.value;
    return;
  }
  instance
    .chain()
    .focus()
    .setCodeBlock({
      language: codeLanguage.value,
      theme: value,
    } as any)
    .run();
  lastCodeTheme.value = value;
};

const addRowAfter = () => {
  editor?.value?.chain().focus().addRowAfter().run();
};

const addColumnAfter = () => {
  editor?.value?.chain().focus().addColumnAfter().run();
};

const deleteTable = () => {
  editor?.value?.chain().focus().deleteTable().run();
};

const buildBlockData = () => {
  if (editorMode.value === "json") {
    const parsed = parseJsonContent(jsonText.value || "{}");
    if (!parsed) {
      localError.value = "JSON 형식이 올바르지 않습니다.";
      return null;
    }
    return JSON.stringify(parsed);
  }
  const content = editor?.value?.getJSON() ?? toDocFromText("");
  jsonText.value = JSON.stringify(content, null, 2);
  return JSON.stringify(content);
};

const scheduleAutoSave = () => {
  if (!props.block) return;
  if (isSaving.value || isDeleting.value) return;
  autoSaveStatus.value = "saving";
  if (autoSaveTimer.value) {
    clearTimeout(autoSaveTimer.value);
  }
  autoSaveTimer.value = window.setTimeout(() => {
    autoSaveTimer.value = null;
    void runAutoSave();
  }, 1200);
};

const runAutoSave = async () => {
  if (!props.block || isSaving.value || isAutoSaving.value) return;
  const blockData = buildBlockData();
  if (!blockData) {
    autoSaveStatus.value = "error";
    return;
  }
  isAutoSaving.value = true;
  try {
    await store.updateBlock(
      props.block.documentId,
      props.block.blockId,
      {
        parentBlockId: props.block.parentBlockId ?? null,
        blockType: localBlockType.value || "json",
        blockData,
        sortOrder: props.block.sortOrder ?? null,
      },
      store.blocksEtag
    );
    autoSaveStatus.value = "saved";
  } catch {
    autoSaveStatus.value = "error";
  } finally {
    isAutoSaving.value = false;
  }
};

const isConflictError = (err: any) => {
  const status = err?.response?.status;
  return status === 409 || status === 412;
};

const onSave = async () => {
  if (!props.block) return;
  localError.value = null;
  if (isSaving.value) return;
  if (autoSaveTimer.value) {
    clearTimeout(autoSaveTimer.value);
    autoSaveTimer.value = null;
  }
  isSaving.value = true;
  const blockData = buildBlockData();
  if (!blockData) {
    isSaving.value = false;
    autoSaveStatus.value = "error";
    return;
  }

  const payload = {
    parentBlockId: props.block.parentBlockId ?? null,
    blockType: localBlockType.value || "json",
    blockData,
    sortOrder: props.block.sortOrder ?? null,
  };

  try {
    await store.updateBlock(
      props.block.documentId,
      props.block.blockId,
      payload,
      store.blocksEtag
    );
    store.clearError();
    emit("saved", props.block.blockId);
    autoSaveStatus.value = "saved";
  } catch (err: any) {
    if (isConflictError(err)) {
      store.setConflictError("최신 버전과 충돌했습니다.", blockData);
      return;
    }
    store.setError({ type: "error", message: resolveAxiosError(err) });
    autoSaveStatus.value = "error";
  } finally {
    isSaving.value = false;
  }
};

const onDelete = async () => {
  if (!props.block) return;
  if (isDeleting.value) return;
  const ok = await confirm({
    title: "확인",
    message: "이 블록을 삭제하시겠습니까?",
    okText: "예",
    cancelText: "아니오",
    color: "error",
  });
  if (!ok) return;
  isDeleting.value = true;
  try {
    await store.deleteBlock(
      props.block.documentId,
      props.block.blockId,
      store.blocksEtag
    );
    store.clearError();
    emit("deleted", props.block.blockId);
  } catch (err: any) {
    store.setError({ type: "error", message: resolveAxiosError(err) });
  } finally {
    isDeleting.value = false;
  }
};

onBeforeUnmount(() => {
  if (autoSaveTimer.value) {
    clearTimeout(autoSaveTimer.value);
  }
  editor?.value?.destroy();
});
</script>

<style scoped>
.tiptap-editor {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  min-height: 350px;
  padding: 12px;
  position: relative;
  background: #ffffff;
}

.tiptap-editor :deep(.ProseMirror) {
  outline: none;
  min-height: 310px;
  max-width: 860px;
  margin: 0 auto;
  line-height: 1.7;
  font-size: 16px;
}

.tiptap-editor :deep(.ProseMirror blockquote) {
  border-left: 3px solid rgba(0, 0, 0, 0.2);
  margin: 8px 0;
  padding: 6px 12px;
  color: rgba(0, 0, 0, 0.75);
  background: rgba(0, 0, 0, 0.04);
  border-radius: 6px;
}

.tiptap-editor :deep(.ProseMirror pre) {
  background: rgba(0, 0, 0, 0.85);
  color: #f8f8f2;
  padding: 12px 14px;
  border-radius: 8px;
  overflow: auto;
}

.tiptap-editor :deep(.ProseMirror pre[data-theme="github"]) {
  background: #f6f8fa;
  color: #24292e;
}

.tiptap-editor :deep(.ProseMirror pre[data-theme="monokai"]) {
  background: #272822;
  color: #f8f8f2;
}

.tiptap-editor :deep(.ProseMirror pre[data-theme="atom-one-dark"]) {
  background: #282c34;
  color: #e06c75;
}

.tiptap-editor :deep(.ProseMirror pre[data-theme="tokyo-night"]) {
  background: #1a1b26;
  color: #c0caf5;
}

.tiptap-editor :deep(.ProseMirror code) {
  background: rgba(0, 0, 0, 0.06);
  padding: 2px 4px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.92em;
}

.tiptap-editor :deep(.ProseMirror ul),
.tiptap-editor :deep(.ProseMirror ol) {
  padding-left: 1.4rem;
  margin: 6px 0;
}

.tiptap-editor :deep(.ProseMirror li) {
  margin: 4px 0;
}

.tiptap-editor :deep(.ProseMirror hr) {
  border: none;
  border-top: 1px solid rgba(0, 0, 0, 0.12);
  margin: 16px 0;
}

.tiptap-editor :deep(.ProseMirror table) {
  border-collapse: collapse;
  width: 100%;
  margin: 12px 0;
  font-size: 0.95em;
}

.tiptap-editor :deep(.ProseMirror th),
.tiptap-editor :deep(.ProseMirror td) {
  border: 1px solid rgba(0, 0, 0, 0.12);
  padding: 8px 10px;
  vertical-align: top;
}

.tiptap-editor :deep(.ProseMirror th) {
  background: rgba(0, 0, 0, 0.04);
  font-weight: 600;
}

.slash-menu {
  position: absolute;
  z-index: 10;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  min-width: 160px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
}

.slash-item-active {
  background: rgba(25, 118, 210, 0.08);
}

.editor-shell {
  position: relative;
}

.editor-scroll {
  max-height: 520px;
  overflow: auto;
  padding-right: 4px;
}

.editor-toolbar {
  position: sticky;
  top: 0;
  z-index: 5;
  background: #fafafa;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 2px;
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 3px 4px;
  margin-bottom: 4px;
}

.code-block-badge {
  display: flex;
  align-items: center;
  padding: 4px 2px 6px;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  border-right: 1px solid rgba(0, 0, 0, 0.08);
}

.toolbar-group:last-child {
  border-right: none;
}

.toolbar-selects {
  gap: 8px;
}

.toolbar-select {
  min-width: 150px;
}

.auto-save-status {
  font-size: 0.8rem;
  color: rgba(0, 0, 0, 0.55);
  margin-right: 8px;
}

.tiptap-editor :deep(table) {
  width: 100%;
  border-collapse: collapse;
}

.tiptap-editor :deep(td),
.tiptap-editor :deep(th) {
  border: 1px solid rgba(0, 0, 0, 0.15);
  padding: 6px;
}

.tiptap-editor :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  color: rgba(0, 0, 0, 0.35);
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}
</style>
