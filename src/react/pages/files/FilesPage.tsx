import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  IconButton,
  Pagination,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import RefreshIcon from "@mui/icons-material/Refresh";
import dayjs from "dayjs";
import { reactFilesApi } from "@/react/pages/files/api";
import { FileUploadDialog } from "@/react/pages/files/FileUploadDialog";
import { filesQueryKeys } from "@/react/pages/files/queryKeys";

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilesPage() {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState("");
  const [objectType, setObjectType] = useState("");
  const [objectId, setObjectId] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const filesQuery = useQuery({
    queryKey: filesQueryKeys.list({
      page,
      size: pageSize,
      keyword: keyword.trim() || null,
      objectType: objectType.trim() === "" ? null : Number(objectType),
      objectId: objectId.trim() === "" ? null : Number(objectId),
    }),
    queryFn: () =>
      reactFilesApi.list({
        page,
        size: pageSize,
        keyword: keyword.trim() || undefined,
        objectType: objectType.trim() === "" ? undefined : Number(objectType),
        objectId: objectId.trim() === "" ? undefined : Number(objectId),
      }),
  });

  const handleDelete = async (attachmentId: number) => {
    const confirmed = window.confirm(`파일 #${attachmentId} 를 삭제하시겠습니까?`);
    if (!confirmed) {
      return;
    }

    setActionError(null);
    try {
      await reactFilesApi.deleteById(attachmentId);
      await queryClient.invalidateQueries({ queryKey: filesQueryKeys.all });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "파일 삭제에 실패했습니다.");
    }
  };

  return (
    <>
      <Stack spacing={3}>
        <Breadcrumbs>
          <Typography color="text.secondary">응용프로그램</Typography>
          <Typography color="text.secondary">자원</Typography>
          <Typography color="text.primary">파일</Typography>
        </Breadcrumbs>

        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "center" }}
          spacing={2}
        >
          <Box>
            <Typography variant="h5">파일</Typography>
            <Typography variant="body2" color="text.secondary">
              React 런타임에서 파일 목록과 업로드 경로를 제공합니다.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => void filesQuery.refetch()}>
              새로고침
            </Button>
            <Button variant="contained" startIcon={<UploadFileIcon />} onClick={() => setDialogOpen(true)}>
              업로드
            </Button>
          </Stack>
        </Stack>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="검색어"
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(0);
              }}
              fullWidth
            />
            <TextField
              label="객체 유형"
              type="number"
              value={objectType}
              onChange={(event) => {
                setObjectType(event.target.value);
                setPage(0);
              }}
            />
            <TextField
              label="객체 식별자"
              type="number"
              value={objectId}
              onChange={(event) => {
                setObjectId(event.target.value);
                setPage(0);
              }}
            />
          </Stack>
        </Paper>

        {actionError ? <Alert severity="error">{actionError}</Alert> : null}
        {filesQuery.isError ? <Alert severity="error">파일 목록을 불러오지 못했습니다.</Alert> : null}

        <Paper variant="outlined">
          {filesQuery.isLoading ? (
            <Box display="flex" justifyContent="center" py={8}>
              <CircularProgress />
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>파일</TableCell>
                  <TableCell>크기</TableCell>
                  <TableCell>콘텐츠 타입</TableCell>
                  <TableCell>생성일시</TableCell>
                  <TableCell align="right">동작</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(filesQuery.data?.content ?? []).map((file) => (
                  <TableRow key={file.attachmentId}>
                    <TableCell>{file.attachmentId}</TableCell>
                    <TableCell>{file.name}</TableCell>
                    <TableCell>{formatFileSize(file.size)}</TableCell>
                    <TableCell>{file.contentType}</TableCell>
                    <TableCell>
                      {file.createdAt ? dayjs(file.createdAt).format("YYYY-MM-DD HH:mm") : "-"}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="삭제">
                        <IconButton onClick={() => void handleDelete(file.attachmentId)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {(filesQuery.data?.content.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography color="text.secondary">조건에 맞는 파일이 없습니다.</Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}
        </Paper>

        <Box display="flex" justifyContent="flex-end">
          <Pagination
            count={Math.max(1, Math.ceil((filesQuery.data?.totalElements ?? 0) / pageSize))}
            page={page + 1}
            onChange={(_event, value) => setPage(value - 1)}
          />
        </Box>
      </Stack>

      <FileUploadDialog
        open={dialogOpen}
        initialObjectId={objectId.trim() === "" ? null : Number(objectId)}
        initialObjectType={objectType.trim() === "" ? null : Number(objectType)}
        onClose={() => setDialogOpen(false)}
        onUploaded={async () => {
          await queryClient.invalidateQueries({ queryKey: filesQueryKeys.all });
        }}
      />
    </>
  );
}
