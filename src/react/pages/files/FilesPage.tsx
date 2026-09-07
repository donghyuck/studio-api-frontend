import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, Avatar, Box, Button, Chip, CircularProgress, IconButton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import type { ColDef, ICellRendererParams, SortModelItem } from "ag-grid-community";
import type { SelectionChangedEvent } from "ag-grid-community";
import { useNavigate } from "react-router-dom";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { ReactPageDataSource } from "@/react/pages/admin/datasource";
import { reactFilesApi } from "@/react/pages/files/api";
import { reactAiApi } from "@/react/pages/ai/api";
import { FileUploadDialog } from "@/react/pages/files/FileUploadDialog";
import { FileDetailDialog } from "@/react/pages/files/FileDetailDialog";
import { filesQueryKeys } from "@/react/pages/files/queryKeys";
import { useToast } from "@/react/feedback";
import type { AttachmentDto } from "@/types/studio/files";
import type { RagObjectIndexStatusDto } from "@/types/studio/ai";
import { API_BASE_URL } from "@/config/backend";
import { ObjectTypeSelect } from "@/react/components/objecttype/ObjectTypeSelect";
import { resolveAxiosError } from "@/utils/helpers";

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

async function copyTextToClipboard(value: string) {
  if (!navigator.clipboard?.writeText) {
    throw new Error("현재 브라우저에서는 클립보드 복사를 지원하지 않습니다.");
  }
  await navigator.clipboard.writeText(value);
}

export class FilesDataSource extends ReactPageDataSource<AttachmentDto> {
  constructor(
    private readonly onActiveStatusChange: (active: boolean) => void,
    private readonly onStatusError: (message: string | null) => void,
  ) {
    super("/api/mgmt/files");
  }

  async fetchForAgGrid(params: {
    startRow: number;
    endRow: number;
    sortModel?: SortModelItem[];
    filterModel?: Record<string, unknown>;
  }) {
    const page = await super.fetchForAgGrid(params);
    const objectIds = page.rows.map((file) => String(file.attachmentId));
    if (objectIds.length === 0) {
      this.onActiveStatusChange(false);
      this.onStatusError(null);
      return page;
    }

    try {
      const statuses = await reactAiApi.getRagObjectIndexStatuses("attachment", objectIds);
      const statusByObjectId = new Map(statuses.map((status) => [status.objectId, status]));
      this.onActiveStatusChange(statuses.some((status) => status.status === "PENDING" || status.status === "RUNNING"));
      this.onStatusError(null);
      return {
        ...page,
        rows: page.rows.map((file) => ({
          ...file,
          ragIndexStatus: statusByObjectId.get(String(file.attachmentId)) ?? null,
        })),
      };
    } catch (error) {
      this.onActiveStatusChange(false);
      this.onStatusError(resolveAxiosError(error) || "RAG 진행 상태를 불러오지 못했습니다.");
      return {
        ...page,
        rows: page.rows.map((file) => ({
          ...file,
          ragIndexStatus: unavailableRagStatus(file.attachmentId),
        })),
      };
    }
  }
}

function unavailableRagStatus(attachmentId: number): RagObjectIndexStatusDto {
  return {
    objectType: "attachment",
    objectId: String(attachmentId),
    status: "UNAVAILABLE",
    chunkCount: 0,
    embeddedCount: 0,
    indexedCount: 0,
    warningCount: 0,
  };
}

export function ragStatusView(status: string | null | undefined, progress?: number | null) {
  switch (status) {
    case "PENDING": return { label: "색인 대기", color: "info" as const };
    case "RUNNING": return {
      label: progress == null ? "색인 중" : `색인 중 ${Math.round(progress * 100)}%`,
      color: "info" as const,
    };
    case "SUCCEEDED": return { label: "색인 완료", color: "success" as const };
    case "WARNING": return { label: "색인 완료 · 경고", color: "warning" as const };
    case "FAILED": return { label: "색인 실패", color: "error" as const };
    case "CANCELLED": return { label: "색인 취소", color: "default" as const };
    case "NOT_REQUESTED": return { label: "미진행", color: "default" as const };
    default: return { label: "확인 불가", color: "default" as const };
  }
}

function RagIndexStatusCell({ status }: { status?: RagObjectIndexStatusDto | null }) {
  const view = ragStatusView(status?.status, status?.progress);
  const detail = status?.status === "NOT_REQUESTED"
    ? "RAG 색인이 아직 요청되지 않았습니다."
    : status?.status === "UNAVAILABLE" || !status
      ? "RAG 진행 상태를 확인할 수 없습니다."
      : [
          status.currentStep ? `단계: ${status.currentStep}` : null,
          `청크 ${status.indexedCount}/${status.chunkCount}`,
          status.warningCount > 0 ? `경고 ${status.warningCount}` : null,
        ].filter(Boolean).join(" · ");
  return (
    <Tooltip title={detail}>
      <Chip
        size="small"
        color={view.color}
        variant={status?.status === "SUCCEEDED" ? "filled" : "outlined"}
        label={view.label}
        icon={status?.status === "RUNNING" ? <CircularProgress size={13} color="inherit" /> : undefined}
        sx={{ height: 24 }}
      />
    </Tooltip>
  );
}

type ThumbnailCacheEntry = {
  url?: string | null;
  unavailableUntil?: number;
};

const thumbnailCache = new Map<number, ThumbnailCacheEntry>();
const THUMBNAIL_RETRY_INTERVAL_MS = 1500;
const THUMBNAIL_RETRY_LIMIT = 6;
const THUMBNAIL_MISSING_TTL_MS = 30_000;

function shouldRetryThumbnail(status?: string) {
  return status === "pending";
}

function isReadyThumbnail(status?: string) {
  return status !== "pending" && status !== "unavailable";
}

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

const FileThumbnail = memo(function FileThumbnail({
  attachmentId,
  name,
  contentType,
}: {
  attachmentId: number;
  name: string;
  contentType?: string | null;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const transientUrlRef = useRef<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null | undefined>(() =>
    getCachedThumbnailUrl(attachmentId)
  );
  const [thumbnailLoading, setThumbnailLoading] = useState(false);

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
    let timer: number | undefined;
    const cached = getCachedThumbnailUrl(attachmentId);
    setThumbnailUrl(cached);
    setThumbnailLoading(false);

    if (!attachmentId || !visible || cached !== undefined) {
      return;
    }

    function markUnavailable() {
      thumbnailCache.set(attachmentId, {
        url: null,
        unavailableUntil: Date.now() + THUMBNAIL_MISSING_TTL_MS,
      });
      setThumbnailUrl(null);
      setThumbnailLoading(false);
    }

    function loadThumbnail(attempt: number) {
      reactFilesApi
        .fetchThumbnail(attachmentId, 128)
        .then(({ blob, status, retryAfterMs }) => {
          if (ignore) {
            return;
          }
          if (blob.size > 0) {
            const nextUrl = URL.createObjectURL(blob);
            if (isReadyThumbnail(status)) {
              if (transientUrlRef.current) {
                URL.revokeObjectURL(transientUrlRef.current);
              }
              thumbnailCache.set(attachmentId, { url: nextUrl });
              transientUrlRef.current = null;
              setThumbnailLoading(false);
            } else {
              if (transientUrlRef.current) {
                URL.revokeObjectURL(transientUrlRef.current);
              }
              transientUrlRef.current = nextUrl;
            }
            setThumbnailUrl(nextUrl);
          }
          if (isReadyThumbnail(status) && blob.size > 0) {
            return;
          }
          if (shouldRetryThumbnail(status) && attempt < THUMBNAIL_RETRY_LIMIT) {
            setThumbnailLoading(true);
            timer = window.setTimeout(() => loadThumbnail(attempt + 1), retryAfterMs ?? THUMBNAIL_RETRY_INTERVAL_MS);
            return;
          }
          markUnavailable();
        })
        .catch(() => {
          if (ignore) {
            return;
          }
          if (attempt < THUMBNAIL_RETRY_LIMIT) {
            setThumbnailLoading(true);
            timer = window.setTimeout(() => loadThumbnail(attempt + 1), THUMBNAIL_RETRY_INTERVAL_MS);
          } else {
            markUnavailable();
          }
        });
    }

    setThumbnailLoading(true);
    loadThumbnail(0);

    return () => {
      ignore = true;
      if (timer) {
        window.clearTimeout(timer);
      }
      if (transientUrlRef.current) {
        URL.revokeObjectURL(transientUrlRef.current);
        transientUrlRef.current = null;
      }
    };
  }, [attachmentId, contentType, visible]);

  useEffect(() => {
    setVisible(false);
    setThumbnailUrl(getCachedThumbnailUrl(attachmentId));
    setThumbnailLoading(false);
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
          sx={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        />
      ) : thumbnailLoading ? (
        <CircularProgress size={16} thickness={4} />
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
      <FileThumbnail attachmentId={file.attachmentId} name={file.name} contentType={file.contentType} />
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
        accentColor: "#2563eb",
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
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const gridRef = useRef<PageableGridContentHandle<AttachmentDto>>(null);
  const [keyword, setKeyword] = useState("");
  const [objectType, setObjectType] = useState("");
  const [objectId, setObjectId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [issuingDownloadLinkIds, setIssuingDownloadLinkIds] = useState<number[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [displayedCount, setDisplayedCount] = useState(0);
  const [hasActiveRagJobs, setHasActiveRagJobs] = useState(false);
  const [ragStatusError, setRagStatusError] = useState<string | null>(null);
  const dataSource = useMemo(
    () => new FilesDataSource(setHasActiveRagJobs, setRagStatusError),
    [],
  );
  const selectedCount = selectedIds.length;

  useEffect(() => {
    if (!hasActiveRagJobs) return;
    const timer = window.setInterval(() => gridRef.current?.refresh(), 3_000);
    return () => window.clearInterval(timer);
  }, [hasActiveRagJobs]);

  async function handleIssueDownloadLink(attachmentId: number) {
    setActionError(null);
    setIssuingDownloadLinkIds((current) =>
      current.includes(attachmentId) ? current : [...current, attachmentId]
    );
    try {
      const issued = await reactFilesApi.issueDownloadUrl(attachmentId, { ttlSeconds: 300 });
      await copyTextToClipboard(issued.url);
      toast.success("다운로드 링크를 생성하고 클립보드에 복사했습니다.");
    } catch (error) {
      const message = resolveAxiosError(error);
      setActionError(message);
      toast.error(message);
    } finally {
      setIssuingDownloadLinkIds((current) => current.filter((id) => id !== attachmentId));
    }
  }

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
              onOpen={(attachmentId) => setSelectedAttachmentId(attachmentId)}
            />
          ) : null,
      },
      {
        field: "ragIndexStatus",
        headerName: "RAG 진행",
        width: 128,
        minWidth: 128,
        sortable: false,
        filter: false,
        cellRenderer: (params: ICellRendererParams<AttachmentDto>) => (
          <RagIndexStatusCell status={params.data?.ragIndexStatus} />
        ),
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
      {
        colId: "actions",
        headerName: "",
        width: 56,
        minWidth: 56,
        maxWidth: 56,
        sortable: false,
        filter: false,
        resizable: false,
        cellRenderer: (params: ICellRendererParams<AttachmentDto>) => {
          const attachmentId = Number(params.data?.attachmentId);
          const issuing = issuingDownloadLinkIds.includes(attachmentId);
          return (
            <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Tooltip title="다운로드 링크 생성 후 복사">
                <span>
                  <IconButton
                    size="small"
                    disabled={!attachmentId || issuing}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (attachmentId) {
                        void handleIssueDownloadLink(attachmentId);
                      }
                    }}
                  >
                    {issuing ? <CircularProgress size={16} /> : <LinkOutlinedIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          );
        },
      },
    ],
    [displayedCount, issuingDownloadLinkIds, selectedCount]
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
      rowHeight: 52,
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

  const isMounted = useRef(false);
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    applyFilters();
  }, [objectType]);

  function applyFilters() {
    gridRef.current?.deselectAll();
    setSelectedIds([]);
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
          hasGrid
          breadcrumbs={["애플리케이션", "파일"]}
          label="파일을 검색하고 업로드 경로를 관리합니다."
          onRefresh={() => gridRef.current?.refresh()}
          searchPlaceholder="파일 검색"
          searchValue={keyword}
          onSearchValueChange={setKeyword}
          onSearch={applyFilters}
          createButton={
            <Button
              variant="contained"
              size="small"
              startIcon={<UploadFileIcon fontSize="small" />}
              onClick={() => setDialogOpen(true)}
              sx={{
                height: 32,
                px: 1.5,
                borderRadius: "6px",
                textTransform: "none",
                fontSize: 12.5,
                fontWeight: 600,
              }}
            >
              업로드
            </Button>
          }
          actions={
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
          }
        />

        <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ py: 0.5 }}>
          <ObjectTypeSelect
            label="객체 유형"
            value={objectType}
            onChange={setObjectType}
            fullWidth
            size="small"
            includeAll
            allLabel="전체"
            helperText="객체 유형 필터는 활성 객체 유형만 조회 대상입니다."
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
        {ragStatusError ? (
          <Alert severity="warning">
            {ragStatusError} 파일 목록은 정상적으로 사용할 수 있습니다.
          </Alert>
        ) : null}

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
      <FileDetailDialog
        open={selectedAttachmentId !== null}
        attachmentId={selectedAttachmentId || 0}
        onClose={() => setSelectedAttachmentId(null)}
      />
    </>
  );
}
