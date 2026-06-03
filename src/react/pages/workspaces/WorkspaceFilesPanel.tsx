import { useCallback, useEffect, useState, useMemo, useRef } from "react";
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

  const columns = useMemo<ColDef<AttachmentDto>[]>(
    () => [
      {
        headerName: "파일명",
        field: "name",
        flex: 1.5,
        minWidth: 200,
        cellRenderer: (params: { data?: AttachmentDto }) => {
          if (!params.data) return "-";
          const file = params.data;
          return (
            <Box
              component="button"
              type="button"
              onClick={() => setSelectedFileId(file.attachmentId)}
              sx={{
                border: 0,
                p: 0,
                bgcolor: "transparent",
                color: "primary.main",
                cursor: "pointer",
                textAlign: "left",
                font: "inherit",
                textDecoration: "underline",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                width: "100%",
              }}
            >
              {file.name}
            </Box>
          );
        },
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
          height={320}
          loading={loading}
          rowSelection={{
            mode: "multiRow",
            enableClickSelection: false,
            checkboxes: true,
            headerCheckbox: true,
          }}
          events={[
            {
              type: "selectionChanged",
              listener: (event: SelectionChangedEvent<AttachmentDto>) => {
                const rows = event.api.getSelectedRows();
                setSelectedCount(rows.length);
                setSelectedRows(rows);
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
