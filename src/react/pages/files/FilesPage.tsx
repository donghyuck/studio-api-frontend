import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, Box, IconButton, Stack, TextField, Tooltip } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { ReactPageDataSource } from "@/react/pages/admin/datasource";
import { reactFilesApi } from "@/react/pages/files/api";
import { FileDetailDialog } from "@/react/pages/files/FileDetailDialog";
import { FileUploadDialog } from "@/react/pages/files/FileUploadDialog";
import { filesQueryKeys } from "@/react/pages/files/queryKeys";
import type { AttachmentDto } from "@/types/studio/files";

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

  const columnDefs = useMemo<ColDef<AttachmentDto>[]>(
    () => [
      { field: "attachmentId", headerName: "ID", flex: 0.35, sortable: true, type: "number" },
      {
        field: "name",
        headerName: "파일",
        flex: 1.6,
        sortable: true,
        cellRenderer: (params: ICellRendererParams<AttachmentDto>) => (
          <Box
            component="button"
            type="button"
            onClick={() => setDetailAttachmentId(params.data?.attachmentId ?? null)}
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
        valueFormatter: (params) => formatFileSize(Number(params.value ?? 0)),
      },
      { field: "contentType", headerName: "콘텐츠 타입", flex: 0.8, sortable: true },
      { field: "createdAt", headerName: "생성일시", flex: 0.75, sortable: true, type: "datetime" },
      {
        colId: "actions",
        headerName: "",
        flex: 0.45,
        minWidth: 96,
        sortable: false,
        filter: false,
        cellRenderer: (params: ICellRendererParams<AttachmentDto>) => (
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", height: "100%" }}>
            <Tooltip title="삭제">
              <IconButton
                size="small"
                color="error"
                onClick={() => void handleDelete(params.data?.attachmentId ?? 0)}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="상세">
              <IconButton size="small" onClick={() => setDetailAttachmentId(params.data?.attachmentId ?? null)}>
                <InfoOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ),
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

  const handleDelete = async (attachmentId: number) => {
    if (!attachmentId) return;
    const confirmed = window.confirm(`파일 #${attachmentId} 를 삭제하시겠습니까?`);
    if (!confirmed) {
      return;
    }

    setActionError(null);
    try {
      await reactFilesApi.deleteById(attachmentId);
      await queryClient.invalidateQueries({ queryKey: filesQueryKeys.all });
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
            <Tooltip title="파일을 업로드합니다.">
              <IconButton size="small" onClick={() => setDialogOpen(true)}>
                <UploadFileIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          }
        />

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
