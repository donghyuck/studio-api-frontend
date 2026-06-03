import { useCallback, useEffect, useState, useMemo, useRef, memo } from "react";
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AddOutlined,
  DeleteOutlined,
  RefreshOutlined,
  InsertDriveFileOutlined,
} from "@mui/icons-material";
import type { ColDef, SelectionChangedEvent } from "ag-grid-community";
import { GridContent } from "@/react/components/ag-grid";
import type { GridContentHandle } from "@/react/components/ag-grid/types";
import { useConfirm, useToast } from "@/react/feedback";
import { reactFilesApi } from "@/react/pages/files/api";
import { FileUploadDialog } from "@/react/pages/files/FileUploadDialog";
import { FileDetailDialog } from "@/react/pages/files/FileDetailDialog";
import type { AttachmentDto } from "@/types/studio/files";
import { resolveAxiosError } from "@/utils/helpers";

const WORKSPACE_OBJECT_TYPE = 2103;

type ThumbnailCacheEntry = {
  url?: string | null;
  promise?: Promise<string | null>;
  unavailableUntil?: number;
};

const thumbnailCache = new Map<number, ThumbnailCacheEntry>();
const THUMBNAIL_RETRY_INTERVAL_MS = 1500;
const THUMBNAIL_RETRY_LIMIT = 6;
const THUMBNAIL_MISSING_TTL_MS = 30_000;

function getCachedThumbnailUrl(attachmentId: number) {
  const entry = thumbnailCache.get(attachmentId);
  if (!entry) {
    return undefined;
  }
  if (entry.url === null && entry.unavailableUntil && entry.unavailableUntil < Date.now()) {
    thumbnailCache.delete(attachmentId);
    return undefined;
  }
  return entry.url;
}

async function requestThumbnail(attachmentId: number) {
  const cached = getCachedThumbnailUrl(attachmentId);
  if (cached !== undefined) {
    return cached;
  }

  const existing = thumbnailCache.get(attachmentId);
  if (existing?.promise) {
    return existing.promise;
  }

  const promise = new Promise<string | null>((resolve) => {
    let attempt = 0;

    function markUnavailable() {
      thumbnailCache.set(attachmentId, {
        url: null,
        unavailableUntil: Date.now() + THUMBNAIL_MISSING_TTL_MS,
      });
      resolve(null);
    }

    function load() {
      reactFilesApi
        .fetchThumbnail(attachmentId, 128)
        .then((blob) => {
          if (blob.size === 0) {
            if (attempt < THUMBNAIL_RETRY_LIMIT) {
              attempt += 1;
              window.setTimeout(load, THUMBNAIL_RETRY_INTERVAL_MS);
            } else {
              markUnavailable();
            }
            return;
          }
          const nextUrl = URL.createObjectURL(blob);
          thumbnailCache.set(attachmentId, { url: nextUrl });
          resolve(nextUrl);
        })
        .catch(() => {
          if (attempt < THUMBNAIL_RETRY_LIMIT) {
            attempt += 1;
            window.setTimeout(load, THUMBNAIL_RETRY_INTERVAL_MS);
          } else {
            markUnavailable();
          }
        });
    }

    load();
  });

  thumbnailCache.set(attachmentId, { promise });
  return promise;
}

const FileThumbnail = memo(function FileThumbnail({ attachmentId, name }: { attachmentId: number; name: string }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null | undefined>(() =>
    getCachedThumbnailUrl(attachmentId)
  );

  useEffect(() => {
    const node = rootRef.current;
    if (!node || visible) {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "160px" });
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [visible]);

  useEffect(() => {
    let ignore = false;
    const cached = getCachedThumbnailUrl(attachmentId);
    setThumbnailUrl(cached);

    if (!attachmentId || !visible || cached !== undefined) {
      return;
    }

    requestThumbnail(attachmentId).then((nextUrl) => {
      if (!ignore) {
        setThumbnailUrl(nextUrl);
      }
    });

    return () => {
      ignore = true;
    };
  }, [attachmentId, visible]);

  useEffect(() => {
    setVisible(false);
    setThumbnailUrl(getCachedThumbnailUrl(attachmentId));
  }, [attachmentId]);

  return (
    <Box
      ref={rootRef}
      sx={{
        width: 32,
        height: 32,
        borderRadius: "6px",
        flex: "0 0 auto",
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "transparent",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {thumbnailUrl ? (
        <Box
          component="img"
          src={thumbnailUrl}
          alt={`${name} 썸네일`}
          sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <InsertDriveFileOutlined sx={{ fontSize: 18, color: "text.secondary" }} />
      )}
    </Box>
  );
});

function FileNameCell({
  file,
  onOpen,
}: {
  file: AttachmentDto;
  onOpen: (attachmentId: number) => void;
}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen(file.attachmentId);
      }}
      sx={{
        width: "100%",
        height: "100%",
        border: 0,
        p: 0,
        bgcolor: "transparent",
        color: "primary.main",
        cursor: "pointer",
        font: "inherit",
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        gap: 1,
        minWidth: 0,
        "&:hover .file-name-text": { textDecoration: "underline" },
      }}
    >
      <FileThumbnail attachmentId={file.attachmentId} name={file.name} />
      <Typography
        className="file-name-text"
        variant="body2"
        noWrap
        sx={{ minWidth: 0, color: "primary.main" }}
        title={file.name}
      >
        {file.name}
      </Typography>
    </Box>
  );
}

function SelectionCheckbox({
  checked,
  indeterminate = false,
  ariaLabel,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  ariaLabel: string;
  onChange: (checked: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={inputRef}
      type="checkbox"
      aria-label={ariaLabel}
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      onClick={(event) => event.stopPropagation()}
      style={{
        width: 16,
        height: 16,
        margin: 0,
        accentColor: "#1565c0",
        cursor: "pointer",
        transform: ariaLabel === "행 선택" ? "translateY(2px)" : "none",
      }}
    />
  );
}

function getDisplayedSelectionState(api: {
  getLastDisplayedRowIndex: () => number;
  getDisplayedRowAtIndex: (index: number) => { isSelected: () => boolean; setSelected: (selected: boolean) => void } | undefined;
}) {
  const lastIndex = api.getLastDisplayedRowIndex();
  if (lastIndex < 0) {
    return { displayedCount: 0, selectedCount: 0 };
  }

  let displayedCount = 0;
  let selectedCount = 0;
  for (let index = 0; index <= lastIndex; index += 1) {
    const row = api.getDisplayedRowAtIndex(index);
    if (!row) continue;
    displayedCount += 1;
    if (row.isSelected()) selectedCount += 1;
  }
  return { displayedCount, selectedCount };
}

function toggleDisplayedRows(
  api: {
    getLastDisplayedRowIndex: () => number;
    getDisplayedRowAtIndex: (index: number) => { isSelected: () => boolean; setSelected: (selected: boolean) => void } | undefined;
  },
  selected: boolean
) {
  const lastIndex = api.getLastDisplayedRowIndex();
  for (let index = 0; index <= lastIndex; index += 1) {
    api.getDisplayedRowAtIndex(index)?.setSelected(selected);
  }
}

interface Props {
  workspaceId: number;
  archived?: boolean;
}

export function WorkspaceFilesPanel({ workspaceId, archived = false }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const gridRef = useRef<GridContentHandle<AttachmentDto>>(null);
  const [files, setFiles] = useState<AttachmentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  const [selectedCount, setSelectedCount] = useState(0);
  const [selectedRows, setSelectedRows] = useState<AttachmentDto[]>([]);
  const [displayedCount, setDisplayedCount] = useState(0);

  const loadFiles = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const res = await reactFilesApi.list({
        page: 0,
        size: 500,
        objectType: WORKSPACE_OBJECT_TYPE,
        objectId: workspaceId,
      });
      setFiles(res.content ?? []);
      setSelectedCount(0);
      setSelectedRows([]);
    } catch (err) {
      toast.error(resolveAxiosError(err) || "파일 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, toast]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const handleDeleteSelected = async () => {
    if (selectedRows.length === 0) return;
    const ok = await confirm({
      title: "파일 삭제",
      message: `선택한 ${selectedRows.length}개의 파일을 삭제하시겠습니까?`,
      okText: "삭제",
      cancelText: "취소",
    });
    if (!ok) return;

    setLoading(true);
    try {
      await Promise.all(selectedRows.map((file) => reactFilesApi.deleteById(file.attachmentId)));
      toast.success("파일이 삭제되었습니다.");
      await loadFiles();
    } catch (err) {
      toast.error(resolveAxiosError(err) || "파일 삭제에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  function renderHeaderCheckbox(api?: {
    getLastDisplayedRowIndex: () => number;
    getDisplayedRowAtIndex: (index: number) => { isSelected: () => boolean; setSelected: (selected: boolean) => void } | undefined;
  }) {
    const currentState = api
      ? getDisplayedSelectionState(api)
      : { displayedCount, selectedCount };
    const allDisplayedSelected =
      currentState.displayedCount > 0 &&
      currentState.selectedCount === currentState.displayedCount;
    const partiallySelected =
      currentState.selectedCount > 0 &&
      currentState.selectedCount < currentState.displayedCount;

    return (
      <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <SelectionCheckbox
          ariaLabel="전체 선택"
          checked={allDisplayedSelected}
          indeterminate={partiallySelected}
          onChange={() => {
            if (api) {
              toggleDisplayedRows(api, !allDisplayedSelected);
            }
          }}
        />
      </Box>
    );
  }

  const columns = useMemo<ColDef<AttachmentDto>[]>(
    () => [
      {
        colId: "rowSelect",
        headerName: "",
        width: 40,
        minWidth: 40,
        maxWidth: 40,
        pinned: "left" as const,
        sortable: false,
        resizable: false,
        suppressMovable: true,
        lockPosition: true,
        cellClass: "selection-column-centered",
        headerClass: "selection-column-centered",
        headerComponent: (props: {
          api: {
            getLastDisplayedRowIndex: () => number;
            getDisplayedRowAtIndex: (
              index: number
            ) => { isSelected: () => boolean; setSelected: (selected: boolean) => void } | undefined;
          };
        }) => renderHeaderCheckbox(props.api),
        cellRenderer: (params: { node: { isSelected: () => boolean; setSelected: (selected: boolean) => void } }) => (
          <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <SelectionCheckbox
              ariaLabel="행 선택"
              checked={params.node.isSelected()}
              onChange={(nextChecked) => params.node.setSelected(nextChecked)}
            />
          </Box>
        ),
      } satisfies ColDef<AttachmentDto>,
      {
        headerName: "파일명",
        field: "name",
        flex: 1.5,
        minWidth: 200,
        cellRenderer: (params: { data?: AttachmentDto }) =>
          params.data ? (
            <FileNameCell
              file={params.data}
              onOpen={(attachmentId) => setSelectedFileId(attachmentId)}
            />
          ) : null,
      },
      {
        headerName: "크기",
        field: "size",
        width: 100,
        type: "numericColumn",
        valueFormatter: (params) => {
          const size = params.value;
          if (size == null) return "-";
          if (size < 1024) return `${size} B`;
          if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
          return `${(size / (1024 * 1024)).toFixed(1)} MB`;
        },
      },
      {
        headerName: "Content Type",
        field: "contentType",
        width: 150,
      },
      {
        headerName: "등록일시",
        field: "createdAt",
        width: 180,
        valueFormatter: (params) => (params.value ? new Date(params.value).toLocaleString() : "-"),
      },
    ],
    [displayedCount, selectedCount]
  );

  const gridOptions = useMemo(
    () => ({
      rowHeight: 52,
    }),
    []
  );

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1">작업공간 파일 목록</Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="새로고침">
            <IconButton size="small" onClick={() => void loadFiles()}>
              <RefreshOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddOutlined />}
            onClick={() => setUploadOpen(true)}
            disabled={archived}
          >
            파일 업로드
          </Button>
          <Button
            variant="outlined"
            size="small"
            color="error"
            startIcon={<DeleteOutlined />}
            onClick={() => void handleDeleteSelected()}
            disabled={archived || selectedCount === 0}
          >
            선택 삭제
          </Button>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 0, overflow: "hidden" }}>
        <GridContent<AttachmentDto>
          ref={gridRef}
          rowData={files}
          columns={columns}
          options={gridOptions}
          height={320}
          loading={loading}
          rowSelection={{
            mode: "multiRow",
            enableClickSelection: false,
            checkboxes: false,
            headerCheckbox: false,
          }}
          events={[
            {
              type: "selectionChanged",
              listener: (event: SelectionChangedEvent<AttachmentDto>) => {
                const rows = event.api.getSelectedRows();
                setSelectedCount(rows.length);
                setSelectedRows(rows);
                setDisplayedCount(event.api.getDisplayedRowCount());
                event.api.refreshHeader?.();
              },
            },
            {
              type: "modelUpdated",
              listener: (event: {
                api: { getDisplayedRowCount: () => number; refreshHeader?: () => void };
              }) => {
                setDisplayedCount(event.api.getDisplayedRowCount());
                event.api.refreshHeader?.();
              },
            },
          ]}
        />
      </Paper>

      <FileUploadDialog
        open={uploadOpen}
        initialObjectType={WORKSPACE_OBJECT_TYPE}
        initialObjectId={workspaceId}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          setUploadOpen(false);
          void loadFiles();
        }}
      />

      <FileDetailDialog
        open={selectedFileId !== null}
        attachmentId={selectedFileId ?? 0}
        onClose={() => setSelectedFileId(null)}
      />
    </Stack>
  );
}
