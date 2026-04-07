import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, IconButton, Stack, Tooltip } from "@mui/material";
import { EmailOutlined } from "@mui/icons-material";
import type { ColDef } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { reactMailApi } from "@/react/pages/mail/api";
import { MailSyncLogDataSource } from "@/react/pages/mail/datasource";
import { toast } from "@/react/feedback";
import type { MailSyncLogDto } from "@/types/studio/mail";
import { resolveAxiosError } from "@/utils/helpers";
import { PageToolbar } from "@/react/components/page/PageToolbar";

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
        type: "datetime",
      },
      {
        field: "finishedAt",
        headerName: "종료일",
        flex: 0.55,
        sortable: true,
        type: "datetime",
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
        setSyncing(false);
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
      gridRef.current?.refresh();
    } catch (syncError) {
      const message = resolveAxiosError(syncError);
      setError(message);
      toast.error(message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Stack spacing={0.5}>
      <PageToolbar
        divider={false}
        breadcrumbs={["애플리케이션", "메일", "Sync"]}
        label="메일 동기화를 요청하고 처리 로그를 확인합니다."
        onRefresh={() => gridRef.current?.refresh()}
        actions={
          <Tooltip title="메일 동기화를 요청합니다.">
            <span>
              <IconButton size="small" onClick={() => void handleSync()} disabled={syncing}>
                <EmailOutlined fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        }
      />
      {error ? <Alert severity="error">{error}</Alert> : null}

      <PageableGridContent<MailSyncLogDto>
        ref={gridRef}
        datasource={dataSource}
        columns={columnDefs}
      />
    </Stack>
  );
}
