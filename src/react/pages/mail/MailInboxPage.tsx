import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DeleteOutlined, RefreshOutlined, SearchOutlined } from "@mui/icons-material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { confirm, toast } from "@/react/feedback";
import { MailInboxDataSource } from "@/react/pages/mail/datasource";
import { reactMailApi } from "@/react/pages/mail/api";
import type { MailMessageDto } from "@/types/studio/mail";
import { resolveAxiosError } from "@/utils/helpers";

function MailDetailDialog({
  open,
  onClose,
  message,
}: {
  open: boolean;
  onClose: () => void;
  message: MailMessageDto | null;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{message?.subject || "(제목 없음)"}</DialogTitle>
      <DialogContent dividers>
        {message ? (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              보낸 사람: {message.fromAddress || "-"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              받는 사람: {message.toAddress || "-"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              수신일: {message.receivedAt ? new Date(message.receivedAt).toLocaleString() : "-"}
            </Typography>
            <Box
              sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 2 }}
              dangerouslySetInnerHTML={{ __html: message.body || "<p>메일 본문이 없습니다.</p>" }}
            />
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>닫기</Button>
      </DialogActions>
    </Dialog>
  );
}

export function MailInboxPage() {
  const gridRef = useRef<PageableGridContentHandle<MailMessageDto>>(null);
  const dataSource = useMemo(() => new MailInboxDataSource(), []);
  const [searchInput, setSearchInput] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<MailMessageDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const columnDefs = useMemo<ColDef<MailMessageDto>[]>(
    () => [
      { field: "fromAddress", headerName: "보낸 사람", flex: 0.8, sortable: true },
      { field: "folder", headerName: "폴더", flex: 0.35, sortable: true },
      {
        field: "subject",
        headerName: "제목",
        flex: 1.2,
        sortable: true,
        cellRenderer: (params: ICellRendererParams<MailMessageDto>) => (
          <Button
            variant="text"
            size="small"
            onClick={() => {
              setSelectedMessage(params.data ?? null);
              setDetailOpen(true);
            }}
          >
            {params.value || "(제목 없음)"}
          </Button>
        ),
      },
      {
        field: "sentAt",
        headerName: "발송일",
        flex: 0.45,
        sortable: true,
        valueFormatter: (params) => (params.value ? new Date(params.value).toLocaleString() : ""),
      },
      {
        field: "receivedAt",
        headerName: "수신일",
        flex: 0.45,
        sortable: true,
        valueFormatter: (params) => (params.value ? new Date(params.value).toLocaleString() : ""),
      },
    ],
    []
  );

  function handleSearch() {
    setError(null);
    dataSource.applyFilter(
      searchInput.trim()
        ? { q: searchInput.trim(), fields: "fromAddress,toAddress,subject,body" }
        : {}
    );
    gridRef.current?.refresh();
  }

  async function handleDeleteSelected() {
    const rows = gridRef.current?.selectedRows() ?? [];
    const ids = rows
      .map((row) => Number(row.mailId))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (ids.length === 0) {
      return;
    }
    const ok = await confirm({
      title: "메일 삭제",
      message: `선택한 ${ids.length}개의 메일을 삭제하시겠습니까?`,
      okText: "삭제",
      cancelText: "취소",
    });
    if (!ok) {
      return;
    }
    try {
      await Promise.all(ids.map((id) => reactMailApi.deleteMessage(id)));
      toast.success("선택한 메일을 삭제했습니다.");
      gridRef.current?.deselectAll();
      gridRef.current?.refresh();
    } catch (deleteError) {
      const message = resolveAxiosError(deleteError);
      setError(message);
      toast.error(message);
    }
  }

  return (
    <>
      <Stack spacing={2}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6">메일 Inbox</Typography>
          <Stack direction="row" spacing={1}>
            <Button startIcon={<DeleteOutlined />} color="error" onClick={() => void handleDeleteSelected()}>
              선택 삭제
            </Button>
            <Button startIcon={<RefreshOutlined />} onClick={() => gridRef.current?.refresh()}>
              새로고침
            </Button>
          </Stack>
        </Box>

        <TextField
          label="검색어"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleSearch();
            }
          }}
          InputProps={{
            endAdornment: (
              <Button size="small" startIcon={<SearchOutlined />} onClick={handleSearch}>
                검색
              </Button>
            ),
          }}
        />

        {error ? <Alert severity="error">{error}</Alert> : null}

        <PageableGridContent<MailMessageDto>
          ref={gridRef}
          datasource={dataSource}
          columns={columnDefs}
          rowSelection="multiple"
        />
      </Stack>

      <MailDetailDialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        message={selectedMessage}
      />
    </>
  );
}
