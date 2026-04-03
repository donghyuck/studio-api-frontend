import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  CircularProgress,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PreviewIcon from "@mui/icons-material/Preview";
import SaveIcon from "@mui/icons-material/Save";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import CodeIcon from "@mui/icons-material/Code";
import ImageIcon from "@mui/icons-material/Image";
import LinkIcon from "@mui/icons-material/Link";
import HorizontalRuleIcon from "@mui/icons-material/HorizontalRule";
import YouTubeIcon from "@mui/icons-material/YouTube";
import {
  EditorContent,
  useEditor,
  type Editor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Youtube from "@tiptap/extension-youtube";
import { createLowlight, common } from "lowlight";
import { reactDocumentsApi } from "@/react/pages/documents/api";
import { DocumentPreviewDialog } from "@/react/pages/documents/DocumentPreviewDialog";
import { documentQueryKeys } from "@/react/pages/documents/queryKeys";
import type {
  DocumentBlock,
  DocumentBlockNode,
  DocumentBlockUpdateRequest,
} from "@/types/studio/document";

const lowlight = createLowlight(common);
const emptyDoc = { type: "doc", content: [] };

const editorExtensions = [
  StarterKit.configure({ codeBlock: false }),
  Link.configure({
    openOnClick: false,
    HTMLAttributes: {
      rel: "noopener noreferrer",
      target: "_blank",
    },
  }),
  Image,
  Placeholder.configure({
    placeholder: "/ 를 눌러 새 블록 유형을 고민하기 전에 먼저 내용을 작성하세요.",
  }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  CodeBlockLowlight.configure({
    lowlight,
    defaultLanguage: "javascript",
  }),
  Youtube.configure({
    controls: true,
    modestBranding: true,
  }),
];

function parseBlockData(raw?: string | null) {
  if (!raw) {
    return emptyDoc;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: raw }],
        },
      ],
    };
  }
}

function findBlockInTree(nodes: DocumentBlockNode[], blockId: number): DocumentBlock | null {
  for (const node of nodes) {
    if (node.block.blockId === blockId) {
      return node.block;
    }
    const child = findBlockInTree(node.children, blockId);
    if (child) {
      return child;
    }
  }
  return null;
}

function flattenTree(nodes: DocumentBlockNode[]) {
  const items: DocumentBlockNode[] = [];
  const walk = (list: DocumentBlockNode[]) => {
    const sorted = [...list].sort((a, b) => {
      const left = a.block.sortOrder;
      const right = b.block.sortOrder;
      if (left == null && right == null) return a.block.blockId - b.block.blockId;
      if (left == null) return 1;
      if (right == null) return -1;
      return left - right;
    });

    for (const node of sorted) {
      items.push(node);
      if (node.children.length > 0) {
        walk(node.children);
      }
    }
  };

  walk(nodes);
  return items;
}

function nextSortOrder(nodes: DocumentBlockNode[], parentBlockId: number | null) {
  const siblings = nodes.filter((node) => (node.block.parentBlockId ?? null) === parentBlockId);
  const maxSortOrder = siblings.reduce((current, node) => {
    return Math.max(current, node.block.sortOrder ?? 0);
  }, 0);

  return maxSortOrder + 10;
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip title={label}>
      <IconButton size="small" onClick={onClick}>
        {children}
      </IconButton>
    </Tooltip>
  );
}

function isValidUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function RichTextToolbar({
  editor,
  onOpenLinkDialog,
  onOpenImageDialog,
  onOpenYoutubeDialog,
}: {
  editor: Editor | null;
  onOpenLinkDialog: () => void;
  onOpenImageDialog: () => void;
  onOpenYoutubeDialog: () => void;
}) {
  if (!editor) {
    return null;
  }

  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap">
      <ToolbarButton label="굵게" onClick={() => editor.chain().focus().toggleBold().run()}>
        <FormatBoldIcon fontSize="small" />
      </ToolbarButton>
      <ToolbarButton label="기울임" onClick={() => editor.chain().focus().toggleItalic().run()}>
        <FormatItalicIcon fontSize="small" />
      </ToolbarButton>
      <ToolbarButton
        label="불릿 목록"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <FormatListBulletedIcon fontSize="small" />
      </ToolbarButton>
      <ToolbarButton
        label="번호 목록"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <FormatListNumberedIcon fontSize="small" />
      </ToolbarButton>
      <ToolbarButton
        label="인용"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <FormatQuoteIcon fontSize="small" />
      </ToolbarButton>
      <ToolbarButton
        label="코드 블록"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <CodeIcon fontSize="small" />
      </ToolbarButton>
      <ToolbarButton
        label="가로선"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <HorizontalRuleIcon fontSize="small" />
      </ToolbarButton>
      <ToolbarButton
        label="링크"
        onClick={onOpenLinkDialog}
      >
        <LinkIcon fontSize="small" />
      </ToolbarButton>
      <ToolbarButton label="이미지" onClick={onOpenImageDialog}>
        <ImageIcon fontSize="small" />
      </ToolbarButton>
      <ToolbarButton label="YouTube" onClick={onOpenYoutubeDialog}>
        <YouTubeIcon fontSize="small" />
      </ToolbarButton>
    </Stack>
  );
}

export function DocumentEditorPage() {
  const { documentId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const parsedDocumentId = Number(documentId);
  const parsedVersionId = searchParams.get("versionId");
  const versionId = parsedVersionId ? Number(parsedVersionId) : null;
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null);
  const [blockType, setBlockType] = useState("paragraph");
  const [editorError, setEditorError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageError, setImageError] = useState<string | null>(null);
  const [youtubeDialogOpen, setYoutubeDialogOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeStart, setYoutubeStart] = useState("0");
  const [youtubeError, setYoutubeError] = useState<string | null>(null);

  const bundleQuery = useQuery({
    queryKey: documentQueryKeys.custom("bundle", parsedDocumentId, versionId),
    queryFn: () =>
      versionId == null
        ? reactDocumentsApi.getLatest(parsedDocumentId)
        : reactDocumentsApi.getVersion(parsedDocumentId, versionId),
    enabled: Number.isFinite(parsedDocumentId) && parsedDocumentId > 0,
  });

  const resolvedVersionId = bundleQuery.data?.data.version.versionId ?? versionId ?? null;

  const treeQuery = useQuery({
    queryKey: documentQueryKeys.custom(
      "tree",
      parsedDocumentId,
      resolvedVersionId,
      includeDeleted
    ),
    queryFn: () =>
      reactDocumentsApi.listBlocksTree(parsedDocumentId, {
        versionId: resolvedVersionId ?? undefined,
        includeDeleted,
      }),
    enabled:
      Number.isFinite(parsedDocumentId) &&
      parsedDocumentId > 0 &&
      resolvedVersionId != null,
  });

  const blocksQuery = useQuery({
    queryKey: documentQueryKeys.custom(
      "blocks",
      parsedDocumentId,
      resolvedVersionId,
      includeDeleted
    ),
    queryFn: () =>
      reactDocumentsApi.listBlocksByVersion(parsedDocumentId, resolvedVersionId as number, {
        includeDeleted,
      }),
    enabled:
      Number.isFinite(parsedDocumentId) &&
      parsedDocumentId > 0 &&
      resolvedVersionId != null,
  });

  const selectedBlockQuery = useQuery({
    queryKey: documentQueryKeys.custom("block", parsedDocumentId, selectedBlockId),
    queryFn: () =>
      reactDocumentsApi.getBlock(parsedDocumentId, selectedBlockId as number),
    enabled:
      Number.isFinite(parsedDocumentId) &&
      parsedDocumentId > 0 &&
      selectedBlockId != null,
  });

  const editor = useEditor({
    extensions: editorExtensions,
    content: emptyDoc,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "react-document-editor",
      },
    },
    onUpdate: () => {
      setEditorError(null);
    },
  });

  const selectedBlock =
    selectedBlockQuery.data?.data ??
    (selectedBlockId == null
      ? null
      : blocksQuery.data?.data.find((block) => block.blockId === selectedBlockId) ??
        findBlockInTree(treeQuery.data?.data ?? [], selectedBlockId));

  useEffect(() => {
    const flattened = flattenTree(treeQuery.data?.data ?? []);
    if (flattened.length === 0) {
      setSelectedBlockId(null);
      return;
    }

    setSelectedBlockId((current) => {
      if (current && flattened.some((node) => node.block.blockId === current)) {
        return current;
      }
      return flattened[0]?.block.blockId ?? null;
    });
  }, [treeQuery.data]);

  useEffect(() => {
    if (!selectedBlock) {
      setBlockType("paragraph");
      editor?.commands.setContent(emptyDoc);
      return;
    }

    setBlockType(selectedBlock.blockType || "paragraph");
    editor?.commands.setContent(parseBlockData(selectedBlock.blockData));
    setEditorError(null);
  }, [editor, selectedBlock]);

  const refreshDocument = async () => {
    await queryClient.invalidateQueries({
      queryKey: documentQueryKeys.all,
    });
  };

  const handleSave = async () => {
    if (!selectedBlock || !editor) {
      return;
    }

    setIsSaving(true);
    setEditorError(null);
    try {
      const payload: DocumentBlockUpdateRequest = {
        blockType,
        blockData: JSON.stringify(editor.getJSON()),
        parentBlockId: selectedBlock.parentBlockId ?? null,
        sortOrder: selectedBlock.sortOrder ?? null,
      };
      await reactDocumentsApi.updateBlock(
        parsedDocumentId,
        selectedBlock.blockId,
        payload,
        selectedBlockQuery.data?.etag
      );
      await refreshDocument();
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : "블록 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedBlock) {
      return;
    }

    const confirmed = window.confirm(`블록 #${selectedBlock.blockId} 를 삭제하시겠습니까?`);
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setEditorError(null);
    try {
      await reactDocumentsApi.deleteBlock(
        parsedDocumentId,
        selectedBlock.blockId,
        selectedBlockQuery.data?.etag
      );
      await refreshDocument();
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : "블록 삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateBlock = async () => {
    setIsSaving(true);
    setEditorError(null);
    try {
      const flattened = flattenTree(treeQuery.data?.data ?? []);
      const parentBlockId = selectedBlock?.parentBlockId ?? null;
      await reactDocumentsApi.createBlock(parsedDocumentId, {
        parentBlockId,
        blockType: "paragraph",
        blockData: JSON.stringify(emptyDoc),
        sortOrder: nextSortOrder(flattened, parentBlockId),
      });
      await refreshDocument();
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : "블록 생성에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = bundleQuery.isLoading || treeQuery.isLoading || blocksQuery.isLoading;
  const hasError =
    bundleQuery.isError ||
    treeQuery.isError ||
    blocksQuery.isError ||
    selectedBlockQuery.isError;

  const openLinkDialog = () => {
    setLinkUrl(editor?.getAttributes("link").href ?? "");
    setLinkError(null);
    setLinkDialogOpen(true);
  };

  const openImageDialog = () => {
    setImageUrl("");
    setImageError(null);
    setImageDialogOpen(true);
  };

  const openYoutubeDialog = () => {
    setYoutubeUrl("");
    setYoutubeStart("0");
    setYoutubeError(null);
    setYoutubeDialogOpen(true);
  };

  const handleLinkConfirm = () => {
    if (!editor) {
      return;
    }

    const nextUrl = linkUrl.trim();
    if (!isValidUrl(nextUrl)) {
      setLinkError("유효한 URL을 입력하세요.");
      return;
    }

    const chain = editor.chain().focus();
    if (editor.state.selection.empty) {
      chain
        .insertContent({
          type: "text",
          text: nextUrl,
          marks: [{ type: "link", attrs: { href: nextUrl } }],
        })
        .run();
    } else {
      chain.extendMarkRange("link").setLink({ href: nextUrl }).run();
    }
    setLinkDialogOpen(false);
  };

  const handleImageConfirm = () => {
    if (!editor) {
      return;
    }

    const nextUrl = imageUrl.trim();
    if (!isValidUrl(nextUrl)) {
      setImageError("유효한 URL을 입력하세요.");
      return;
    }

    editor.chain().focus().setImage({ src: nextUrl }).run();
    setImageDialogOpen(false);
  };

  const handleYoutubeConfirm = () => {
    if (!editor) {
      return;
    }

    const nextUrl = youtubeUrl.trim();
    if (!isValidUrl(nextUrl)) {
      setYoutubeError("유효한 URL을 입력하세요.");
      return;
    }

    const nextStart = Number(youtubeStart || 0);
    editor
      .chain()
      .focus()
      .setYoutubeVideo({
        src: nextUrl,
        start: Number.isFinite(nextStart) ? nextStart : 0,
      })
      .run();
    setYoutubeDialogOpen(false);
  };

  return (
    <>
      <Stack spacing={3}>
        <Breadcrumbs>
          <Typography color="text.secondary">응용프로그램</Typography>
          <Typography color="text.secondary">문서</Typography>
          <Typography color="text.primary">
            {bundleQuery.data?.data.document.name ?? `문서 #${documentId}`}
          </Typography>
        </Breadcrumbs>

        <Card variant="outlined">
          <CardHeader
            title={bundleQuery.data?.data.document.name ?? "문서 편집기"}
            subheader={
              bundleQuery.data?.data.version.title
                ? `버전 ${bundleQuery.data.data.version.versionId} · ${bundleQuery.data.data.version.title}`
                : undefined
            }
            action={
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => void handleCreateBlock()}
                  disabled={isSaving || parsedDocumentId <= 0}
                >
                  새 블록
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<PreviewIcon />}
                  onClick={() => setPreviewOpen(true)}
                  disabled={(treeQuery.data?.data.length ?? 0) === 0}
                >
                  미리보기
                </Button>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={() => void handleSave()}
                  disabled={!selectedBlock || isSaving || selectedBlockQuery.isLoading}
                >
                  저장
                </Button>
                <Button
                  color="error"
                  variant="text"
                  startIcon={<DeleteOutlineIcon />}
                  onClick={() => void handleDelete()}
                  disabled={!selectedBlock || isDeleting || selectedBlockQuery.isLoading}
                >
                  삭제
                </Button>
              </Stack>
            }
          />
          <Divider />
          <CardContent>
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeDeleted}
                  onChange={(event) => setIncludeDeleted(event.target.checked)}
                />
              }
              label="삭제 포함"
            />
          </CardContent>
        </Card>

        {isLoading ? (
          <Box display="flex" justifyContent="center" py={8}>
            <CircularProgress />
          </Box>
        ) : null}

        {hasError ? (
          <Alert severity="error">문서 편집 데이터를 불러오지 못했습니다.</Alert>
        ) : null}

        {editorError ? <Alert severity="error">{editorError}</Alert> : null}

        {!isLoading && !hasError ? (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardHeader title="블록 목록" />
                <Divider />
                <List dense disablePadding>
                  {flattenTree(treeQuery.data?.data ?? []).map((node) => (
                    <ListItemButton
                      key={node.block.blockId}
                      selected={node.block.blockId === selectedBlockId}
                      onClick={() => setSelectedBlockId(node.block.blockId)}
                    >
                      <ListItemText
                        primary={`${node.block.blockType || "block"} #${node.block.blockId}`}
                        secondary={
                          node.block.sortOrder != null
                            ? `sort ${node.block.sortOrder}`
                            : undefined
                        }
                      />
                    </ListItemButton>
                  ))}
                  {(treeQuery.data?.data.length ?? 0) === 0 ? (
                    <Box px={2} py={3}>
                      <Typography color="text.secondary">편집할 블록이 없습니다.</Typography>
                    </Box>
                  ) : null}
                </List>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <Card variant="outlined">
                <CardHeader title="블록 편집기" />
                <Divider />
                <CardContent>
                  {selectedBlock ? (
                    <Stack spacing={2}>
                      <TextField
                        label="blockType"
                        value={blockType}
                        onChange={(event) => setBlockType(event.target.value)}
                        size="small"
                      />
                      <RichTextToolbar
                        editor={editor}
                        onOpenLinkDialog={openLinkDialog}
                        onOpenImageDialog={openImageDialog}
                        onOpenYoutubeDialog={openYoutubeDialog}
                      />
                      <Box
                        sx={{
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 1,
                          minHeight: 360,
                          p: 2,
                          "& .ProseMirror": {
                            minHeight: 320,
                            outline: "none",
                          },
                          "& .ProseMirror img": {
                            maxWidth: "100%",
                          },
                          "& .ProseMirror table": {
                            width: "100%",
                            borderCollapse: "collapse",
                          },
                          "& .ProseMirror td, & .ProseMirror th": {
                            border: "1px solid",
                            borderColor: "divider",
                            padding: 1,
                          },
                          "& .ProseMirror pre": {
                            backgroundColor: "grey.100",
                            borderRadius: 1,
                            padding: 2,
                          },
                        }}
                      >
                        <EditorContent editor={editor} />
                      </Box>
                    </Stack>
                  ) : (
                    <Typography color="text.secondary">선택된 블록이 없습니다.</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        ) : null}
      </Stack>

      <DocumentPreviewDialog
        blocks={treeQuery.data?.data ?? []}
        open={previewOpen}
        title={bundleQuery.data?.data.version.title}
        onClose={() => setPreviewOpen(false)}
      />
      <Dialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>링크 추가</DialogTitle>
        <DialogContent dividers>
          <TextField
            autoFocus
            fullWidth
            label="링크 URL"
            value={linkUrl}
            onChange={(event) => {
              setLinkUrl(event.target.value);
              setLinkError(null);
            }}
          />
          {linkError ? <Alert severity="error" sx={{ mt: 2 }}>{linkError}</Alert> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkDialogOpen(false)}>취소</Button>
          <Button variant="contained" onClick={handleLinkConfirm}>추가</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={imageDialogOpen} onClose={() => setImageDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>이미지 추가</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              autoFocus
              fullWidth
              label="이미지 URL"
              value={imageUrl}
              onChange={(event) => {
                setImageUrl(event.target.value);
                setImageError(null);
              }}
            />
            {imageUrl.trim() ? (
              <Box
                component="img"
                src={imageUrl}
                alt="이미지 미리보기"
                sx={{ maxWidth: "100%", maxHeight: 240, borderRadius: 1 }}
              />
            ) : null}
            {imageError ? <Alert severity="error">{imageError}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImageDialogOpen(false)}>취소</Button>
          <Button variant="contained" onClick={handleImageConfirm}>추가</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={youtubeDialogOpen}
        onClose={() => setYoutubeDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>YouTube 추가</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              autoFocus
              fullWidth
              label="YouTube URL"
              value={youtubeUrl}
              onChange={(event) => {
                setYoutubeUrl(event.target.value);
                setYoutubeError(null);
              }}
            />
            <TextField
              fullWidth
              label="시작 시간(초)"
              type="number"
              value={youtubeStart}
              onChange={(event) => setYoutubeStart(event.target.value)}
            />
            {youtubeError ? <Alert severity="error">{youtubeError}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setYoutubeDialogOpen(false)}>취소</Button>
          <Button variant="contained" onClick={handleYoutubeConfirm}>추가</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
