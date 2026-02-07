<template>
    <PageToolbar :title="titleText" :label="currentVersionLabel!" @deleteCurrent="deleteCurrent"
        @createNewVersion="createNewVersion" @create="createQuickDocument" @refresh="reloadAll" @preview="openPreview"
        :previous="true" :closeable="false" :divider="true" :prepend-items="[
        ]" :items="[
            { icon: 'mdi-file-plus', event: 'create', color: 'blue', text: '새 문서', tooltip: '새 문서 만들기' },
            { icon: 'mdi-source-branch-minus', event: 'deleteCurrent', text: '삭제', color: 'blue', tooltip: '지금 버전을 삭제합니다' },
            { icon: 'mdi-source-branch-plus', event: 'createNewVersion', text: '새 버전', color: 'blue', tooltip: '새 버전 만들기' },
            { icon: 'mdi-eye-outline', event: 'preview', text: '미리보기', color: 'red', tooltip: '전체 문서 미리보기' },
            { icon: 'mdi-refresh', event: 'refresh', }]"></PageToolbar>
    <v-container fluid class="pa-0">
        <v-card density="compact" class="mt-1" variant="text">
            <v-layout>
                <v-app-bar density="compact" flat color="primary">
                    <v-btn icon="mdi-file-tree" variant="text" @click="outlineOpen = !outlineOpen" />
                    <v-chip v-if="currentVersionLabel" class="ml-2" size="small">
                        {{ currentVersionLabel }}, {{ store.selectedBlockId }}
                    </v-chip>
                    <v-switch v-model="store.includeDeleted" label="삭제 포함" density="compact" hide-details class="ml-4"
                        @update:model-value="onIncludeDeletedChange" />
                    <v-spacer />
                </v-app-bar>
                <v-alert v-if="store.error" :type="store.error.type === 'conflict' ? 'warning' : 'error'"
                    density="compact" class="mx-4 mt-2">
                    {{ store.error.message }}
                    <template v-slot:append>
                        <v-btn v-if="store.error.type === 'conflict'" size="small" variant="tonal" class="mr-2"
                            @click="reloadAll">
                            최신으로 새로고침
                        </v-btn>
                        <v-btn v-if="store.error.type === 'conflict' && store.error.draftText" size="small"
                            variant="outlined" @click="copyDraft">
                            내 변경값 복사
                        </v-btn>
                    </template>
                </v-alert>
                <v-navigation-drawer v-model="outlineOpen" width="320" temporary elevation="0" class="border-0">
                    <v-toolbar density="compact" flat class="px-2">
                        <v-btn prepend-icon="mdi-plus" size="small" variant="outlined" @click="createChildBlock"
                            class="mr-1">
                            자식 블록 추가
                        </v-btn>
                        <v-btn prepend-icon="mdi-chevron-up" size="small" variant="outlined" @click="moveSelected('up')"
                            class="mr-1">
                            위로
                        </v-btn>
                        <v-btn prepend-icon="mdi-chevron-down" size="small" variant="outlined"
                            @click="moveSelected('down')" class="mr-1">
                            아래로
                        </v-btn>
                        <v-spacer></v-spacer>
                        <v-btn size="small" variant="text" icon="mdi-refresh" @click="reloadTreeAndBlocks" />
                    </v-toolbar>
                    <v-divider />
                    <v-treeview density="compact" :items="treeItems" item-title="title" item-value="id"
                        item-children="children" activatable activation-strategy="single" open-on-click
                        v-model:opened="store.expandedIds" v-model:activated="treeActivated"
                        @update:activated="onTreeActivated">
                        <template v-slot:prepend="{ item }">
                            <v-icon class="outline-drag-handle mr-1" icon="mdi-drag" draggable="true"
                                @dragstart.stop="onDragStart($event, item.id)" @dragend="onDragEnd" />
                        </template>
                        <template v-slot:title="{ item }">
                            <div class="outline-title" :class="{
                                'outline-drop-target': item.id === dragOverId,
                                'outline-drop-before': dragPosition.id === item.id && dragPosition.position === 'before',
                                'outline-drop-after': dragPosition.id === item.id && dragPosition.position === 'after',
                                'outline-active': item.id === store.selectedBlockId,
                                'outline-dragging': item.id === dragBlockId,
                            }" @click.stop="onActivate(item.id)" @dragenter="onDragEnter(item.id)"
                                @dragover.prevent="onDragOver(item.id, $event)" @dragleave="onDragLeave(item.id)"
                                @drop="onDrop(item.id)">
                                {{ item.title }}
                            </div>
                        </template>
                    </v-treeview>
                </v-navigation-drawer>
                <v-main class="ma-0">
                    <BlockEditor :block="selectedBlock" @saved="onBlockSaved" @deleted="onBlockDeleted" />
                </v-main>
            </v-layout>
        </v-card>
    </v-container>
    <DocumentPreviewDialog v-model="previewDialog" :document-id="documentId"
        :title="store.bundle?.version?.title" />
</template>
<style scoped>
.outline-drop-target {
    background-color: rgba(25, 118, 210, 0.08);
    border: 1px dashed rgba(25, 118, 210, 0.6);
}

.outline-drop-before {
    border-top: 2px solid rgba(25, 118, 210, 0.8);
}

.outline-drop-after {
    border-bottom: 2px solid rgba(25, 118, 210, 0.8);
}

.outline-title {
    display: block;
    width: 100%;
    padding: 2px 6px;
    border-radius: 6px;
}

.outline-active {
    background-color: rgba(25, 118, 210, 0.14);
}

.outline-drag-handle {
    cursor: grab;
    color: rgba(0, 0, 0, 0.45);
}

.outline-drag-handle:active {
    cursor: grabbing;
}

.outline-dragging {
    opacity: 0.6;
}
</style>
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDocumentStore } from "@/stores/studio/mgmt/document.store";
import BlockEditor from "./BlockEditor.vue";
import { resolveAxiosError } from "@/utils/helpers";
import { useToast } from "@/plugins/toast";
import { useConfirm } from "@/plugins/confirm";
import type { DocumentBlock, DocumentBlockNode } from "@/types/studio/document";
import PageToolbar from '@/components/bars/PageToolbar.vue';
import DocumentPreviewDialog from "./DocumentPreviewDialog.vue";

const store = useDocumentStore();
const route = useRoute();
const router = useRouter();
const toast = useToast();
const confirm = useConfirm();
const outlineOpen = ref(false);
const dragBlockId = ref<number | null>(null);
const dragOverId = ref<number | null>(null);
const dragPosition = ref<{ id: number | null; position: "before" | "after" | null }>({
    id: null,
    position: null,
});
const treeActivated = ref<number[]>([]);
const previewDialog = ref(false);

const documentId = computed(() => Number(route.params.documentId));
const queryVersionId = computed(() =>
    route.query.versionId ? Number(route.query.versionId) : null
);

const titleText = computed(() => {
    const name = store.bundle?.document?.name;
    return name ? `문서: ${name}` : "문서 편집기";
});

const currentVersionLabel = computed(() => {
    const versionId = store.bundle?.version?.versionId;
    if (!versionId) return null;
    return queryVersionId.value ? `v${versionId}` : `latest (v${versionId})`;
});

const findBlockInTree = (
    nodes: DocumentBlockNode[],
    blockId: number
): DocumentBlock | null => {
    for (const node of nodes) {
        if (node.block.blockId === blockId) return node.block;
        if (node.children?.length) {
            const found = findBlockInTree(node.children, blockId);
            if (found) return found;
        }
    }
    return null;
};

const selectedBlock = computed(() => {
    if (!store.selectedBlockId) return null;
    const fromList =
        store.blocks.find((b) => b.blockId === store.selectedBlockId) ?? null;
    if (fromList) return fromList;
    return findBlockInTree(store.blockTree, store.selectedBlockId);
});

type TreeItem = {
    id: number;
    title: string;
    block: DocumentBlock;
    children?: TreeItem[];
};

const sortNodes = (nodes: DocumentBlockNode[]) => {
    return nodes.slice().sort((a, b) => {
        const sa = a.block.sortOrder;
        const sb = b.block.sortOrder;
        if (sa == null && sb == null) return a.block.blockId - b.block.blockId;
        if (sa == null) return 1;
        if (sb == null) return -1;
        return sa - sb;
    });
};

const treeItems = computed<TreeItem[]>(() => {
    const walk = (nodes: DocumentBlockNode[]): TreeItem[] => {
        return sortNodes(nodes).map((node) => ({
            id: node.block.blockId,
            title: `${node.block.blockType || "block"} #${node.block.blockId}`,
            block: node.block,
            children: node.children?.length ? walk(node.children) : [],
        }));
    };
    return walk(store.blockTree);
});

const findNodeWithParent = (
    nodes: DocumentBlockNode[],
    blockId: number,
    parent: DocumentBlockNode | null = null
): { node: DocumentBlockNode; parent: DocumentBlockNode | null } | null => {
    for (const node of nodes) {
        if (node.block.blockId === blockId) {
            return { node, parent };
        }
        if (node.children?.length) {
            const found = findNodeWithParent(node.children, blockId, node);
            if (found) return found;
        }
    }
    return null;
};

const onDragStart = (event: DragEvent, blockId: number) => {
    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(blockId));
    }
    dragBlockId.value = blockId;
};

const onDragEnter = (blockId: number) => {
    dragOverId.value = blockId;
};

const onDragOver = (blockId: number, event: DragEvent) => {
    dragOverId.value = blockId;
    const target = event.currentTarget as HTMLElement | null;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const offsetY = event.clientY - rect.top;
    const position = offsetY < rect.height / 2 ? "before" : "after";
    dragPosition.value = { id: blockId, position };
};

const onDragLeave = (blockId: number) => {
    if (dragOverId.value === blockId) {
        dragOverId.value = null;
    }
    if (dragPosition.value.id === blockId) {
        dragPosition.value = { id: null, position: null };
    }
};

const openPreview = () => {
    previewDialog.value = true;
};

const onDrop = async (targetBlockId: number) => {
    if (!dragBlockId.value || dragBlockId.value === targetBlockId) {
        dragBlockId.value = null;
        dragOverId.value = null;
        dragPosition.value = { id: null, position: null };
        return;
    }
    const dragged = findNodeWithParent(store.blockTree, dragBlockId.value);
    const target = findNodeWithParent(store.blockTree, targetBlockId);
    if (!dragged || !target) {
        dragBlockId.value = null;
        dragOverId.value = null;
        return;
    }
    const draggedParentId = dragged.parent?.block.blockId ?? null;
    const targetParentId = target.parent?.block.blockId ?? null;
    if (draggedParentId !== targetParentId) {
        toast.error("같은 부모 안에서만 이동할 수 있습니다.");
        dragBlockId.value = null;
        dragOverId.value = null;
        return;
    }
    const siblings = (dragged.parent?.children ?? store.blockTree).slice();
    siblings.sort((a, b) => {
        const sa = a.block.sortOrder;
        const sb = b.block.sortOrder;
        if (sa == null && sb == null) return a.block.blockId - b.block.blockId;
        if (sa == null) return 1;
        if (sb == null) return -1;
        return sa - sb;
    });
    const orderedIds = siblings.map((node) => node.block.blockId);
    const fromIndex = orderedIds.indexOf(dragBlockId.value);
    const toIndex = orderedIds.indexOf(targetBlockId);
    if (fromIndex === -1 || toIndex === -1) {
        dragBlockId.value = null;
        dragOverId.value = null;
        dragPosition.value = { id: null, position: null };
        return;
    }
    orderedIds.splice(fromIndex, 1);
    let insertAt = toIndex;
    if (fromIndex < toIndex) {
        insertAt -= 1;
    }
    if (dragPosition.value.position === "after") {
        insertAt += 1;
    }
    if (insertAt < 0) insertAt = 0;
    if (insertAt > orderedIds.length) insertAt = orderedIds.length;
    orderedIds.splice(insertAt, 0, dragBlockId.value);
    try {
        await store.reorderBlocks(draggedParentId, orderedIds);
    } catch (err: any) {
        store.setError({ type: "error", message: resolveAxiosError(err) });
    } finally {
        dragBlockId.value = null;
        dragOverId.value = null;
        dragPosition.value = { id: null, position: null };
    }
};

const onDragEnd = () => {
    dragBlockId.value = null;
    dragOverId.value = null;
    dragPosition.value = { id: null, position: null };
};

const expandAll = () => {
    const ids: number[] = [];
    const walk = (nodes: DocumentBlockNode[]) => {
        nodes.forEach((node) => {
            if (node.children?.length) {
                ids.push(node.block.blockId);
                walk(node.children);
            }
        });
    };
    walk(store.blockTree);
    store.setExpandedIds(ids);
};

const onActivate = (id: number | string) => {
    const nextId = Number(id);
    if (!Number.isFinite(nextId)) return;
    treeActivated.value = [nextId];
    if (nextId !== store.selectedBlockId) {
        store.setSelectedBlockId(nextId);
    }
};

const onTreeActivated = (value: unknown) => {
    const raw = Array.isArray(value) ? value[0] : undefined;
    const next = raw != null ? Number(raw) : null;
    if (next !== store.selectedBlockId) {
        store.setSelectedBlockId(Number.isFinite(next) ? next : null);
    }
};

watch(
    () => store.selectedBlockId,
    (value) => {
        treeActivated.value =
            value != null && Number.isFinite(value) ? [value] : [];
    },
    { immediate: true }
);

watch(treeActivated, (value) => {
    const raw = value?.[0];
    const next = raw != null ? Number(raw) : null;
    if (next !== store.selectedBlockId) {
        store.setSelectedBlockId(Number.isFinite(next) ? next : null);
    }
});

const load = async () => {
    const docId = documentId.value;
    if (!Number.isFinite(docId) || docId <= 0) return;
    store.clearError();
    try {
        if (queryVersionId.value) {
            await store.fetchVersion(docId, queryVersionId.value);
            await store.fetchBlocksByVersion(docId, queryVersionId.value, {
                includeDeleted: store.includeDeleted,
            });
            await store.fetchBlocksTree(docId, {
                versionId: queryVersionId.value,
                includeDeleted: store.includeDeleted,
            });
        } else {
            const bundle = await store.fetchLatest(docId);
            const latestVersionId = bundle.version?.versionId;
            if (latestVersionId) {
                await store.fetchBlocksByVersion(docId, latestVersionId, {
                    includeDeleted: store.includeDeleted,
                });
            }
            await store.fetchBlocksTree(docId, {
                versionId: latestVersionId,
                includeDeleted: store.includeDeleted,
            });
        }
        const selectedId = store.selectedBlockId;
        const hasSelected =
            selectedId != null &&
            (store.blocks.some((b) => b.blockId === selectedId) ||
                !!findBlockInTree(store.blockTree, selectedId));
        if (!hasSelected) {
            store.setSelectedBlockId(null);
        }
        if (!store.selectedBlockId && store.blocks.length > 0) {
            store.setSelectedBlockId(store.blocks[0].blockId);
        }
        expandAll();
    } catch (err: any) {
        store.setError({ type: "error", message: resolveAxiosError(err) });
    }
};

const reloadTreeAndBlocks = async () => {
    await store.reloadTree();
    await store.reloadBlocks();
};

const reloadAll = async () => {
    store.clearError();
    await store.reloadBundle();
    await reloadTreeAndBlocks();
};

const onIncludeDeletedChange = async () => {
    await reloadTreeAndBlocks();
};

const onBlockSaved = async () => {
    await reloadTreeAndBlocks();
};

const onBlockDeleted = async () => {
    store.setSelectedBlockId(null);
    await reloadTreeAndBlocks();
};

const createChildBlock = async () => {
    const docId = documentId.value;
    if (!Number.isFinite(docId) || docId <= 0) return;
    const selectedId = store.selectedBlockId;
    const parentId =
        selectedId != null &&
        (store.blocks.some((b) => b.blockId === selectedId) ||
            !!findBlockInTree(store.blockTree, selectedId))
            ? selectedId
            : null;
    const siblings = store.blocks.filter(
        (b) => (b.parentBlockId ?? null) === parentId
    );
    const maxSortOrder = Math.max(
        0,
        ...siblings.map((b) => b.sortOrder ?? 0)
    );
    try {
        await store.createBlock(docId, {
            parentBlockId: parentId,
            blockType: "json",
            blockData: "",
            sortOrder: maxSortOrder + 10,
        });
        await reloadTreeAndBlocks();
    } catch (err: any) {
        store.setError({ type: "error", message: resolveAxiosError(err) });
    }
};

const moveSelected = async (direction: "up" | "down") => {
    try {
        await store.moveSelectedBlock(direction);
    } catch (err: any) {
        store.setError({ type: "error", message: resolveAxiosError(err) });
    }
};

const createQuickDocument = async () => {
    const ok = await confirm({
        title: "확인",
        message: "새 문서를 생성하시겠습니까?",
        okText: "예",
        cancelText: "아니오",
        color: "primary",
    });
    if (!ok) return;
    try {
        const suffix = Date.now().toString(36);
        const created = await store.create({
            objectType: 0,
            objectId: 0,
            name: `document-${suffix}`,
            title: "새 문서",
            bodyType: 1,
            bodyText: "# 새 문서\n",
        });
        await router.push({
            name: "DocumentEditor",
            params: { documentId: created.documentId },
        });
    } catch (err: any) {
        toast.error(resolveAxiosError(err));
    }
};

const createNewVersion = async () => {
    if (!documentId.value || !store.bundle?.version) return;
    const ok = await confirm({
        title: "확인",
        message: "새 버전을 생성하시겠습니까?",
        okText: "예",
        cancelText: "아니오",
        color: "primary",
    });
    if (!ok) return;
    try {
        const payload = {
            title: store.bundle.version.title,
            bodyType: store.bundle.version.bodyType,
            bodyText: store.bundle.version.bodyText,
        };
        const created = await store.newVersion(documentId.value, payload);
        await router.replace({
            query: { versionId: created.versionId },
        });
    } catch (err: any) {
        toast.error(resolveAxiosError(err));
    }
};

const deleteCurrent = async () => {
    if (!documentId.value) return;
    const ok = await confirm({
        title: "확인",
        message: "문서를 삭제하시겠습니까?",
        okText: "예",
        cancelText: "아니오",
        color: "error",
    });
    if (!ok) return;
    try {
        await store.deleteDocument(documentId.value);
        await router.push({ name: "Documents" });
    } catch (err: any) {
        toast.error(resolveAxiosError(err));
    }
};

const copyDraft = async () => {
    if (!store.error?.draftText) return;
    try {
        await navigator.clipboard.writeText(store.error.draftText);
        toast.success("변경값을 복사했습니다.");
    } catch {
        toast.error("클립보드 복사에 실패했습니다.");
    }
};

const goBack = () => {
    router.back();
};

watch(
    [documentId, queryVersionId],
    () => {
        load();
    },
    { immediate: true }
);
</script>
