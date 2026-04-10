import { useMemo, useRef } from "react";
import {
  Stack,
} from "@mui/material";
import { RefreshOutlined } from "@mui/icons-material";
import type { ColDef } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { LoginFailuresDataSource } from "@/react/pages/audit/LoginFailuresDataSource";
import type { LoginFailureEvent } from "@/react/pages/audit/loginFailuresApi";
import { PageToolbar } from "@/react/components/page/PageToolbar";

export function LoginFailureLogPage() {
  const gridRef = useRef<PageableGridContentHandle<LoginFailureEvent>>(null);
  const dataSource = useMemo(() => new LoginFailuresDataSource(), []);

  const columnDefs = useMemo<ColDef<LoginFailureEvent>[]>(
    () => [
      { field: "id", headerName: "ID", sortable: true, flex: 0.5 },
      { field: "username", headerName: "사용자명", sortable: true, flex: 1 },
      { field: "remoteIp", headerName: "IP 주소", sortable: true, flex: 1 },
      { field: "failureType", headerName: "예외 유형", sortable: true, flex: 1.25 },
      { field: "message", headerName: "메시지", sortable: true, flex: 1.75 },
      { field: "userAgent", headerName: "User-Agent", sortable: true, flex: 2.5 },
      {
        field: "occurredAt",
        headerName: "시각",
        sortable: true,
        flex: 1.5,
        valueFormatter: (params) =>
          params.value ? new Date(params.value).toLocaleString() : "",
      },
    ],
    []
  );

  const handleRefresh = () => {
    gridRef.current?.refresh();
  };

  return (
    <Stack spacing={0.5}>
      <PageToolbar
        breadcrumbs={["시스템관리", "감사", "로그인 실패"]}
        label="로그인 실패 이력을 조회합니다."
        onRefresh={handleRefresh}
        divider={false}
      />

      <PageableGridContent<LoginFailureEvent>
        ref={gridRef}
        datasource={dataSource}
        columns={columnDefs}
      />
    </Stack>
  );
}
