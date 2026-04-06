import { useMemo, useRef } from "react";
import {
  Box,
  Breadcrumbs,
  Stack,
  Typography,
} from "@mui/material";
import type { ColDef } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { LoginFailuresDataSource } from "@/react/pages/audit/LoginFailuresDataSource";
import type { LoginFailureEvent } from "@/react/pages/audit/loginFailuresApi";

export function LoginFailureLogPage() {
  const gridRef = useRef<PageableGridContentHandle<LoginFailureEvent>>(null);
  const dataSource = useMemo(() => new LoginFailuresDataSource(), []);

  const columnDefs = useMemo<ColDef<LoginFailureEvent>[]>(
    () => [
      { field: "id", headerName: "ID", sortable: true, flex: 0.5 },
      { field: "username", headerName: "사용자명", sortable: true, flex: 1 },
      { field: "ipAddress", headerName: "IP 주소", sortable: true, flex: 1 },
      { field: "reason", headerName: "실패 사유", sortable: true, flex: 2 },
      {
        field: "timestamp",
        headerName: "시각",
        sortable: true,
        flex: 1.5,
        valueFormatter: (params) =>
          params.value ? new Date(params.value).toLocaleString() : "",
      },
    ],
    []
  );

  return (
    <Stack spacing={2}>
      <Breadcrumbs separator="›">
        <Typography color="text.secondary">시스템관리</Typography>
        <Typography color="text.secondary">감사</Typography>
        <Typography color="text.primary">로그인 실패</Typography>
      </Breadcrumbs>

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h5">로그인 실패 로그</Typography>
      </Box>

      <PageableGridContent<LoginFailureEvent>
        ref={gridRef}
        datasource={dataSource}
        columns={columnDefs}
      />
    </Stack>
  );
}
