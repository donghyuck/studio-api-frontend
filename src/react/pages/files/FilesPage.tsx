import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, Avatar, Box, IconButton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
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
  const selectedCount = selectedIds.length;

  const columnDefs = useMemo<ColDef<AttachmentDto>[]>(
    () => [
      { field: "attachmentId", headerName: "ID", flex: 0.35, sortable: true, type: "number", filter: false },
      {
        field: "name",
        headerName: "파일",
        flex: 1.6,
        sortable: true,
        filter: false,
        cellRenderer: (params: ICellRendererParams<AttachmentDto>) => (
          <Box
            component="button"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setDetailAttachmentId(params.data?.attachmentId ?? null);
            }}
            sx={{
              border: 0,
              p: 0,
              bgcolor: "transparent",
              color: "primary.main",
              cursor: "pointer",
              font: "inherit",
              textAlign: "left",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            {params.value}
          </Box>
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
    ],
    []
  );

  const gridOptions = useMemo(
    () => ({
      rowSelection: { mode: "multiRow" as const, enableClickSelection: false, checkboxes: true, headerCheckbox: false },
      suppressRowClickSelection: true,
      selectionColumnDef: {
        width: 65,
        minWidth: 65,
        maxWidth: 65,
        pinned: "left" as const,
        sortable: false,
        filter: false,
        resizable: false,
      },
      rowMultiSelectWithClick: true,
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
