import { defineStore } from "pinia";
import { ref } from "vue";
import { documentApi } from "@/data/studio/mgmt/document";
import type {
  DocumentBlock,
  DocumentBlockNode,
  DocumentCreateRequest,
  DocumentCreateResponse,
  DocumentVersionBundle,
} from "@/types/studio/document";

type DocumentStoreErrorType = "conflict" | "error";
interface DocumentStoreError {
  type: DocumentStoreErrorType;
  message: string;
  draftText?: string;
}

export const useDocumentStore = defineStore(
  "mgmt-document-editor-store",
  () => {
    const latest = ref<DocumentVersionBundle | null>(null);
    const latestEtag = ref<string | undefined>(undefined);
    const version = ref<DocumentVersionBundle | null>(null);
    const versionEtag = ref<string | undefined>(undefined);
    const bundle = ref<DocumentVersionBundle | null>(null);
    const bundleEtag = ref<string | undefined>(undefined);
    const blocks = ref<DocumentBlock[]>([]);
    const blocksEtag = ref<string | undefined>(undefined);
    const blockTree = ref<DocumentBlockNode[]>([]);
    const selectedBlockId = ref<number | null>(null);
    const includeDeleted = ref(false);
    const expandedIds = ref<number[]>([]);
    const isLoading = ref(false);
    const error = ref<DocumentStoreError | null>(null);
    const currentDocumentId = ref<number | null>(null);
    const currentVersionId = ref<number | null>(null);
    const isLatestMode = ref(true);

    const reset = () => {
      latest.value = null;
      latestEtag.value = undefined;
      version.value = null;
      versionEtag.value = undefined;
      bundle.value = null;
      bundleEtag.value = undefined;
      blocks.value = [];
      blocksEtag.value = undefined;
      blockTree.value = [];
      selectedBlockId.value = null;
      expandedIds.value = [];
      error.value = null;
      currentDocumentId.value = null;
      currentVersionId.value = null;
      isLatestMode.value = true;
    };

    const fetchLatest = async (documentId: number) => {
      isLoading.value = true;
      try {
        const res = await documentApi.getLatest(documentId);
        currentDocumentId.value = documentId;
        currentVersionId.value = res.data.version?.versionId ?? null;
        isLatestMode.value = true;
        latest.value = res.data;
        latestEtag.value = res.etag;
        bundle.value = res.data;
        bundleEtag.value = res.etag;
        return res.data;
      } finally {
        isLoading.value = false;
      }
    };

    const fetchVersion = async (documentId: number, versionId: number) => {
      isLoading.value = true;
      try {
        const res = await documentApi.getVersion(documentId, versionId);
        currentDocumentId.value = documentId;
        currentVersionId.value = versionId;
        isLatestMode.value = false;
        version.value = res.data;
        versionEtag.value = res.etag;
        bundle.value = res.data;
        bundleEtag.value = res.etag;
        return res.data;
      } finally {
        isLoading.value = false;
      }
    };

    const updateMeta = async (
      documentId: number,
      payload: { name: string; pattern?: string | null },
      ifMatch?: string
    ) => {
      return documentApi.updateMeta(
        documentId,
        payload,
        ifMatch ?? bundleEtag.value
      );
    };

    const fetchBlocksTree = async (
      documentId: number,
      params?: { versionId?: number; includeDeleted?: boolean }
    ) => {
      isLoading.value = true;
      try {
        const res = await documentApi.listBlocksTree(documentId, params);
        blockTree.value = res.data;
        currentDocumentId.value = documentId;
        return res.data;
      } finally {
        isLoading.value = false;
      }
    };

    const fetchBlocksByVersion = async (
      documentId: number,
      versionId: number,
      params?: { includeDeleted?: boolean; parentBlockId?: number }
    ) => {
      isLoading.value = true;
      try {
        const res = await documentApi.listBlocksByVersion(
          documentId,
          versionId,
          params
        );
        blocks.value = res.data;
        blocksEtag.value = res.etag;
        currentDocumentId.value = documentId;
        currentVersionId.value = versionId;
        return res.data;
      } finally {
        isLoading.value = false;
      }
    };

    const createBlock = async (documentId: number, payload: any) => {
      return documentApi.createBlock(documentId, payload);
    };

    const updateBlock = async (
      documentId: number,
      blockId: number,
      payload: any,
      ifMatch?: string
    ) => {
      return documentApi.updateBlock(documentId, blockId, payload, ifMatch);
    };

    const moveBlock = async (
      documentId: number,
      blockId: number,
      payload: any,
      ifMatch?: string
    ) => {
      return documentApi.moveBlock(documentId, blockId, payload, ifMatch);
    };

    const deleteBlock = async (
      documentId: number,
      blockId: number,
      ifMatch?: string
    ) => {
      return documentApi.deleteBlock(documentId, blockId, ifMatch);
    };

    const newVersion = async (documentId: number, payload: any) => {
      return documentApi.newVersion(documentId, payload);
    };

    const create = async (
      payload: DocumentCreateRequest
    ): Promise<DocumentCreateResponse> => {
      return documentApi.createDocument(payload);
    };

    const deleteDocument = async (documentId: number, ifMatch?: string) => {
      return documentApi.deleteDocument(
        documentId,
        ifMatch ?? bundleEtag.value
      );
    };

    const setSelectedBlockId = (blockId: number | null) => {
      selectedBlockId.value = blockId;
    };

    const setIncludeDeleted = (value: boolean) => {
      includeDeleted.value = value;
    };

    const setExpandedIds = (ids: number[]) => {
      expandedIds.value = ids;
    };

    const setError = (value: DocumentStoreError | null) => {
      error.value = value;
    };

    const setConflictError = (message: string, draftText?: string) => {
      error.value = { type: "conflict", message, draftText };
    };

    const clearError = () => {
      error.value = null;
    };

    const reloadBundle = async () => {
      if (!currentDocumentId.value) return;
      if (
        !isLatestMode.value &&
        currentVersionId.value &&
        currentVersionId.value > 0
      ) {
        await fetchVersion(currentDocumentId.value, currentVersionId.value);
      } else {
        await fetchLatest(currentDocumentId.value);
      }
    };

    const reloadBlocks = async () => {
      if (!currentDocumentId.value || !currentVersionId.value) return;
      await fetchBlocksByVersion(
        currentDocumentId.value,
        currentVersionId.value,
        {
          includeDeleted: includeDeleted.value,
        }
      );
    };

    const reloadTree = async () => {
      if (!currentDocumentId.value) return;
      await fetchBlocksTree(currentDocumentId.value, {
        versionId: currentVersionId.value ?? undefined,
        includeDeleted: includeDeleted.value,
      });
    };

    const compareSortOrder = (a: DocumentBlockNode, b: DocumentBlockNode) => {
      const sa = a.block.sortOrder;
      const sb = b.block.sortOrder;
      if (sa == null && sb == null) return a.block.blockId - b.block.blockId;
      if (sa == null) return 1;
      if (sb == null) return -1;
      return sa - sb;
    };

    const findNode = (
      nodes: DocumentBlockNode[],
      blockId: number,
      parent: DocumentBlockNode | null = null
    ): { node: DocumentBlockNode; parent: DocumentBlockNode | null } | null => {
      for (const node of nodes) {
        if (node.block.blockId === blockId) {
          return { node, parent };
        }
        if (node.children?.length) {
          const found = findNode(node.children, blockId, node);
          if (found) return found;
        }
      }
      return null;
    };

    const moveSelectedBlock = async (direction: "up" | "down") => {
      if (!currentDocumentId.value || !selectedBlockId.value) return;
      const found = findNode(blockTree.value, selectedBlockId.value);
      if (!found) return;
      const siblings = (found.parent?.children ?? blockTree.value).slice();
      siblings.sort(compareSortOrder);
      const index = siblings.findIndex(
        (node) => node.block.blockId === selectedBlockId.value
      );
      if (index < 0) return;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= siblings.length) return;
      const reordered = siblings.slice();
      const [moved] = reordered.splice(index, 1);
      reordered.splice(targetIndex, 0, moved);

      const parentBlockId = found.parent?.block.blockId ?? null;
      try {
        for (let i = 0; i < reordered.length; i += 1) {
          const node = reordered[i];
          const nextSortOrder = (i + 1) * 10;
          if (node.block.sortOrder === nextSortOrder) continue;
          await documentApi.moveBlock(
            currentDocumentId.value,
            node.block.blockId,
            { parentBlockId, sortOrder: nextSortOrder },
            blocksEtag.value
          );
        }
      } catch (err) {
        await reloadTree();
        await reloadBlocks();
        throw err;
      }
      await reloadTree();
      await reloadBlocks();
    };

    const reorderBlocks = async (
      parentBlockId: number | null,
      orderedIds: number[]
    ) => {
      if (!currentDocumentId.value || orderedIds.length === 0) return;
      try {
        for (let i = 0; i < orderedIds.length; i += 1) {
          const blockId = orderedIds[i];
          const nextSortOrder = (i + 1) * 10;
          await documentApi.moveBlock(
            currentDocumentId.value,
            blockId,
            { parentBlockId, sortOrder: nextSortOrder },
            blocksEtag.value
          );
        }
      } catch (err) {
        await reloadTree();
        await reloadBlocks();
        throw err;
      }
      await reloadTree();
      await reloadBlocks();
    };

    return {
      latest,
      latestEtag,
      version,
      versionEtag,
      bundle,
      bundleEtag,
      blocks,
      blocksEtag,
      blockTree,
      selectedBlockId,
      includeDeleted,
      expandedIds,
      isLoading,
      error,
      currentDocumentId,
      currentVersionId,
      isLatestMode,
      reset,
      fetchLatest,
      fetchVersion,
      updateMeta,
      fetchBlocksTree,
      fetchBlocksByVersion,
      createBlock,
      updateBlock,
      moveBlock,
      deleteBlock,
      newVersion,
      create,
      deleteDocument,
      setSelectedBlockId,
      setIncludeDeleted,
      setExpandedIds,
      setError,
      setConflictError,
      clearError,
      reloadBundle,
      reloadBlocks,
      reloadTree,
      moveSelectedBlock,
      reorderBlocks,
    };
  }
);
