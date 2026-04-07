import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { DeleteOutlined, SelectAllOutlined, SyncOutlined } from "@mui/icons-material";
import DOMPurify from "dompurify";
import type { ColDef, ICellRendererParams, SelectionChangedEvent } from "ag-grid-community";
import { useNavigate } from "react-router-dom";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { confirm, toast } from "@/react/feedback";
import { MailInboxDataSource } from "@/react/pages/mail/datasource";
import { reactMailApi } from "@/react/pages/mail/api";
import type { MailMessageDto } from "@/types/studio/mail";
import { resolveAxiosError } from "@/utils/helpers";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { parseEmailHeader } from "@/utils/mail";

function formatBytes(bytes?: number) {
  if (bytes == null) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size < 10 ? 1 : 0)} ${units[unitIndex]}`;
}

function AddressChips({ value }: { value?: string | null }) {
  const chips = parseEmailHeader(value, { dedupe: true });
  if (chips.length === 0) return <Typography variant="body2">-</Typography>;
  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap">
      {chips.map((chip) => (
        <Chip
          key={chip.email ?? chip.raw}
          size="small"
          variant="outlined"
          label={chip.email ? `${chip.label} <${chip.email}>` : chip.label}
        />
      ))}
    </Stack>
  );
}

function MailAddressCell({ value }: { value?: string | null }) {
  const first = parseEmailHeader(value, { dedupe: true })[0];
  if (!first) return null;

  const label = first.name || first.email || first.raw;
  const tooltip = first.email && first.name ? `${first.name} <${first.email}>` : first.raw;

  return (
    <Tooltip title={tooltip} placement="bottom-start">
      <Box
        sx={{
          height: "100%",
          display: "inline-flex",
          alignItems: "center",
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </Box>
    </Tooltip>
  );
}

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
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {message.folder ? <Chip size="small" variant="outlined" label={message.folder} /> : null}
              <Chip size="small" variant="outlined" label={`Message-Id: ${message.messageId || "-"}`} />
              <Chip size="small" variant="outlined" label={`발신: ${message.sentAt ? new Date(message.sentAt).toLocaleString() : "-"}`} />
              <Chip size="small" variant="outlined" label={`수신: ${message.receivedAt ? new Date(message.receivedAt).toLocaleString() : "-"}`} />
            </Stack>
            <Stack spacing={1}>
              <Typography variant="caption" color="text.secondary">보낸 사람</Typography>
              <AddressChips value={message.fromAddress} />
              <Typography variant="caption" color="text.secondary">받는 사람</Typography>
              <AddressChips value={message.toAddress} />
              {message.ccAddress ? (
                <>
                  <Typography variant="caption" color="text.secondary">참조</Typography>
                  <AddressChips value={message.ccAddress} />
                </>
              ) : null}
              {message.bccAddress ? (
                <>
                  <Typography variant="caption" color="text.secondary">숨은 참조</Typography>
                  <AddressChips value={message.bccAddress} />
                </>
              ) : null}
            </Stack>
            <Box
              sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 2 }}
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(message.body || "<p>메일 본문이 없습니다.</p>"),
              }}
            />
            {message.attachments?.length ? (
              <Stack spacing={1}>
                <Typography variant="caption" color="text.secondary">첨부파일</Typography>
                {message.attachments.map((attachment) => (
                  <Chip
                    key={attachment.attachmentId}
                    size="small"
                    variant="outlined"
                    label={`${attachment.filename} · ${formatBytes(attachment.size)}`}
                  />
                ))}
              </Stack>
            ) : null}
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
  const navigate = useNavigate();
  const gridRef = useRef<PageableGridContentHandle<MailMessageDto>>(null);
  const dataSource = useMemo(() => new MailInboxDataSource(), []);
  const [searchInput, setSearchInput] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<MailMessageDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCount, setSelectedCount] = useState(0);

  const columnDefs = useMemo<ColDef<MailMessageDto>[]>(
    () => [
      {
        field: "fromAddress",
        headerName: "보낸 사람",
        flex: 0.65,
        minWidth: 160,
        maxWidth: 240,
        sortable: true,
        cellRenderer: (params: ICellRendererParams<MailMessageDto>) => (
          <MailAddressCell value={params.value} />
        ),
      },
      {
        field: "subject",
        headerName: "제목",
        flex: 2.4,
        minWidth: 360,
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
        flex: 0.38,
        minWidth: 150,
        maxWidth: 190,
        sortable: true,
        type: "datetime",
      },
      {
        field: "receivedAt",
        headerName: "수신일",
        flex: 0.38,
        minWidth: 150,
        maxWidth: 190,
        sortable: true,
        type: "datetime",
      },
    ],
    []
  );

  const gridEvents = useMemo(
    () => [
      {
        type: "selectionChanged",
        listener: (event: SelectionChangedEvent<MailMessageDto>) => {
          setSelectedCount(event.api.getSelectedRows().length);
        },
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
      setSelectedCount(0);
      gridRef.current?.refresh();
    } catch (deleteError) {
      const message = resolveAxiosError(deleteError);
      setError(message);
      toast.error(message);
    }
  }

  function handleSelectAllToggle() {
    const selected = gridRef.current?.selectedRows() ?? [];
    if (selected.length > 0) {
      gridRef.current?.deselectAll();
      setSelectedCount(0);
      return;
    }
    gridRef.current?.selectAll();
  }

  return (
    <>
      <Stack spacing={2}>
        <PageToolbar
          // title={"받은 편지함"}
          divider={false}
          // breadcrumbs={["애플리케이션", "메일", "Inbox"]}
          label="수신 메일을 검색하고 선택 삭제할 수 있습니다."
          onRefresh={() => gridRef.current?.refresh()}
          searchPlaceholder="메일 검색"
          searchValue={searchInput}
          onSearchValueChange={setSearchInput}
          onSearch={handleSearch}
          actions={
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="전체 선택 / 선택 해제">
                <IconButton size="small" onClick={handleSelectAllToggle}>
                  <SelectAllOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="메일 동기화 화면으로 이동합니다.">
                <IconButton size="small" onClick={() => navigate("/application/mail/sync")}>
                  <SyncOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="선택한 메일을 삭제합니다.">
                <span>
                  <IconButton
                    size="small"
                    color="error"
                    disabled={selectedCount === 0}
                    onClick={() => void handleDeleteSelected()}
                  >
                  <DeleteOutlined fontSize="small" />
                </IconButton>
                </span>
              </Tooltip>
            </Stack>
          }
        />

        {error ? <Alert severity="error">{error}</Alert> : null}

        <PageableGridContent<MailMessageDto>
          ref={gridRef}
          datasource={dataSource}
          columns={columnDefs}
          events={gridEvents}
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
