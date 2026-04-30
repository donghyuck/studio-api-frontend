import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, Avatar, Box, IconButton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import type { SelectionChangedEvent } from "ag-grid-community";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { ReactPageDataSource } from "@/react/pages/admin/datasource";
import { reactFilesApi } from "@/react/pages/files/api";
import { FileDetailDialog } from "@/react/pages/files/FileDetailDialog";
import { FileUploadDialog } from "@/react/pages/files/FileUploadDialog";
import { filesQueryKeys } from "@/react/pages/files/queryKeys";
import type { AttachmentDto } from "@/types/studio/files";
import { API_BASE_URL } from "@/config/backend";

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

class FilesDataSource extends ReactPageDataSource<AttachmentDto> {
  constructor() {
    super("/api/mgmt/files");
  }
}

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
        <InsertDriveFileOutlinedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
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
    if (row.isSelected()) {
      selectedCount += 1;
    }
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

export function FilesPage() {
  const queryClient = useQueryClient();
  const gridRef = useRef<PageableGridContentHandle<AttachmentDto>>(null);
  const dataSource = useMemo(() => new FilesDataSource(), []);
  const [keyword, setKeyword] = useState("");
  const [objectType, setObjectType] = useState("");
  const [objectId, setObjectId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailAttachmentId, setDetailAttachmentId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [displayedCount, setDisplayedCount] = useState(0);
  const selectedCount = selectedIds.length;

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

  const columnDefs = useMemo<ColDef<AttachmentDto>[]>(
    () => [
      {
        colId: "rowSelect",
        headerName: "",
        width: 40,
        minWidth: 40,
        maxWidth: 40,
        pinned: "left",
        sortable: false,
        resizable: false,
        suppressMovable: true,
        lockPosition: true,
        cellClass: "selection-column-centered",
        headerClass: "selection-column-centered",
        headerComponent: (props: {
          api: {
            getLastDisplayedRowIndex: () => number;
            getDisplayedRowAtIndex: (index: number) => { isSelected: () => boolean; setSelected: (selected: boolean) => void } | undefined;
          };
        }) => renderHeaderCheckbox(props.api),
        cellRenderer: (params: ICellRendererParams<AttachmentDto>) => {
          const checked = params.node.isSelected();

          return (
            <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <SelectionCheckbox
                ariaLabel="행 선택"
                checked={checked}
                onChange={(nextChecked) => params.node.setSelected(nextChecked)}
              />
            </Box>
          );
        },
      },
      {
        field: "attachmentId",
        headerName: "ID",
        width: 64,
        minWidth: 64,
        maxWidth: 64,
        sortable: true,
        type: "number",
        filter: false,
        cellStyle: { textAlign: "center" },
        headerClass: "id-column-centered",
        cellClass: "id-column-centered",
      },
      {
        field: "name",
        headerName: "파일",
        flex: 1.6,
        sortable: true,
        filter: false,
        cellRenderer: (params: ICellRendererParams<AttachmentDto>) =>
          params.data ? (
            <FileNameCell
              file={params.data}
              onOpen={(attachmentId) => setDetailAttachmentId(attachmentId)}
            />
          ) : null,
      },
      {
        field: "size",
        headerName: "크기",
        flex: 0.45,
        sortable: true,
        type: "number",
        filter: false,
        valueFormatter: (params) => formatFileSize(Number(params.value ?? 0)),
      },
      { field: "contentType", headerName: "콘텐츠 타입", flex: 0.8, sortable: true, filter: false },
      {
        field: "createdBy",
        headerName: "생성자",
        flex: 0.8,
        filter: false,
        cellRenderer: (params: ICellRendererParams<AttachmentDto>) => (
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", minWidth: 0, height: "100%" }}>
            <Avatar
              src={
                params.value?.username
                  ? `${API_BASE_URL}/api/profile/${encodeURIComponent(params.value.username)}/avatar`
                  : undefined
              }
              sx={{ width: 24, height: 24, fontSize: 12 }}
            >
              {params.value?.username?.slice(0, 1).toUpperCase() ?? "?"}
            </Avatar>
            <Typography variant="body2" noWrap>
              {params.value?.username ?? "-"}
            </Typography>
          </Box>
        ),
      },
      { field: "createdAt", headerName: "생성일시", flex: 0.75, sortable: true, type: "datetime", filter: false },
    ],
    [displayedCount, selectedCount]
  );

  const gridOptions = useMemo(
    () => ({
      rowSelection: {
        mode: "multiRow" as const,
        enableClickSelection: false,
        checkboxes: false,
        headerCheckbox: false,
      },
      suppressRowClickSelection: true,
      rowMultiSelectWithClick: true,
      rowHeight: 48,
    }),
    []
  );

  const gridEvents = useMemo(
    () => [
      {
        type: "selectionChanged",
        listener: (event: unknown) => {
          const rows = (event as SelectionChangedEvent<AttachmentDto>).api.getSelectedRows();
          setSelectedIds(
            rows
              .map((row) => Number(row.attachmentId))
              .filter((id) => Number.isFinite(id) && id > 0)
          );
          setDisplayedCount((event as SelectionChangedEvent<AttachmentDto>).api.getDisplayedRowCount());
        },
      },
      {
        type: "modelUpdated",
        listener: (event: { api: { getDisplayedRowCount: () => number; refreshHeader?: () => void } }) => {
          setDisplayedCount(event.api.getDisplayedRowCount());
          event.api.refreshHeader?.();
        },
      },
    ],
    []
  );

  function applyFilters() {
    dataSource.applyFilter({
      ...(keyword.trim() ? { keyword: keyword.trim() } : {}),
      ...(objectType.trim() ? { objectType: Number(objectType) } : {}),
      ...(objectId.trim() ? { objectId: Number(objectId) } : {}),
    });
    gridRef.current?.refresh();
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = window.confirm(`선택한 ${selectedIds.length}개의 파일을 삭제하시겠습니까?`);
    if (!confirmed) {
      return;
    }

    setActionError(null);
    try {
      await Promise.all(selectedIds.map((attachmentId) => reactFilesApi.deleteById(attachmentId)));
      await queryClient.invalidateQueries({ queryKey: filesQueryKeys.all });
      gridRef.current?.deselectAll();
      setSelectedIds([]);
      gridRef.current?.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "파일 삭제에 실패했습니다.");
    }
  };

  return (
    <>
      <Stack spacing={0.5}>
        <PageToolbar
          divider={false}
          breadcrumbs={["애플리케이션", "파일"]}
          label="파일을 검색하고 업로드 경로를 관리합니다."
          onRefresh={() => gridRef.current?.refresh()}
          searchPlaceholder="파일 검색"
          searchValue={keyword}
          onSearchValueChange={setKeyword}
          onSearch={applyFilters}
          actions={
            <>
              <Tooltip title="새로운 파일 업로드">
                <IconButton size="small" onClick={() => setDialogOpen(true)}>
                  <UploadFileIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={selectedCount > 0 ? "선택 삭제" : "삭제할 파일을 선택하세요"}>
                <span>
                  <IconButton
                    size="small"
                    color="error"
                    disabled={selectedCount === 0}
                    onClick={() => void handleDeleteSelected()}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </>
          }
        />

        <Alert severity="info">
          객체 유형은 모듈 식별 아이디 값입니다. 객체 식별자는 해당 모듈에 속하는 객체 아이디
          값입니다. 예를 들어 객체 유형이 문서(1)라면 각 문서의 고유한 ID 값이 객체 식별자가
          됩니다.
        </Alert>

        <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ py: 0.5 }}>
          <TextField
            label="객체 유형"
            type="number"
            value={objectType}
            onChange={(event) => setObjectType(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") applyFilters();
            }}
            size="small"
          />
          <TextField
            label="객체 식별자"
            type="number"
            value={objectId}
            onChange={(event) => setObjectId(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") applyFilters();
            }}
            size="small"
          />
        </Stack>

        {actionError ? <Alert severity="error">{actionError}</Alert> : null}

        <PageableGridContent<AttachmentDto>
          ref={gridRef}
          datasource={dataSource}
          columns={columnDefs}
          options={gridOptions}
          events={gridEvents}
        />
      </Stack>

      <FileUploadDialog
        open={dialogOpen}
        initialObjectId={objectId.trim() === "" ? null : Number(objectId)}
        initialObjectType={objectType.trim() === "" ? null : Number(objectType)}
        onClose={() => setDialogOpen(false)}
        onUploaded={async () => {
          await queryClient.invalidateQueries({ queryKey: filesQueryKeys.all });
          gridRef.current?.refresh();
        }}
      />
      {detailAttachmentId ? (
        <FileDetailDialog
          open={detailAttachmentId !== null}
          onClose={() => setDetailAttachmentId(null)}
          attachmentId={detailAttachmentId}
        />
      ) : null}
    </>
  );
}
