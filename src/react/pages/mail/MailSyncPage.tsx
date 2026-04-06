import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { EmailOutlined, RefreshOutlined } from "@mui/icons-material";
import type { ColDef } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { reactMailApi } from "@/react/pages/mail/api";
import { MailSyncLogDataSource } from "@/react/pages/mail/datasource";
import { toast } from "@/react/feedback";
import type { MailSyncLogDto } from "@/types/studio/mail";
import { resolveAxiosError } from "@/utils/helpers";

export function MailSyncPage() {
  const gridRef = useRef<PageableGridContentHandle<MailSyncLogDto>>(null);
  const dataSource = useMemo(() => new MailSyncLogDataSource(), []);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const columnDefs = useMemo<ColDef<MailSyncLogDto>[]>(
    () => [
      { field: "logId", headerName: "ID", flex: 0.25, sortable: true },
      { field: "processed", headerName: "처리건수", flex: 0.3, sortable: true },
      { field: "succeeded", headerName: "성공건수", flex: 0.3, sortable: true },
      { field: "failed", headerName: "실패건수", flex: 0.3, sortable: true },
      {
        field: "startedAt",
        headerName: "시작일",
        flex: 0.55,
        sortable: true,
        valueFormatter: (params) => (params.value ? new Date(params.value).toLocaleString() : ""),
      },
      {
        field: "finishedAt",
        headerName: "종료일",
        flex: 0.55,
        sortable: true,
        valueFormatter: (params) => (params.value ? new Date(params.value).toLocaleString() : ""),
      },
      { field: "status", headerName: "상태", flex: 0.3, sortable: true },
      { field: "message", headerName: "메시지", flex: 1 },
      { field: "triggeredBy", headerName: "방법", flex: 0.45 },
    ],
    []
  );

  useEffect(() => {
    const unsubscribe = reactMailApi.subscribeSync(
      (payload) => {
        if (payload.status === "completed") {
          toast.success(`메일 동기화 완료 (#${payload.logId})`);
          gridRef.current?.refresh();
          setSyncing(false);
        } else if (payload.status === "failed") {
          toast.error(payload.message || `메일 동기화 실패 (#${payload.logId})`);
          gridRef.current?.refresh();
          setSyncing(false);
        }
      },
      () => {
        setError("메일 동기화 SSE 연결에 실패했습니다.");
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  async function handleSync() {
    setError(null);
    setSyncing(true);
    try {
      await reactMailApi.startSync();
      toast.info("메일 동기화를 요청했습니다.");
    } catch (syncError) {
      const message = resolveAxiosError(syncError);
      setError(message);
      toast.error(message);
      setSyncing(false);
    }
  }

  return (
    <Stack spacing={2}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h6">메일 동기화</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={<EmailOutlined />}
            variant="contained"
            onClick={() => void handleSync()}
            disabled={syncing}
          >
            메일 동기화 요청
          </Button>
          <Button startIcon={<RefreshOutlined />} onClick={() => gridRef.current?.refresh()}>
            새로고침
          </Button>
        </Stack>
      </Box>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <PageableGridContent<MailSyncLogDto>
        ref={gridRef}
        datasource={dataSource}
        columns={columnDefs}
      />
    </Stack>
  );
}
