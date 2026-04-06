import { useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Breadcrumbs,
  Stack,
  Typography,
} from "@mui/material";
import type { ColDef } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { ForumAuditDataSource } from "@/react/pages/forums/admin/ForumAuditDataSource";
import type { ForumAuditEvent } from "@/react/pages/forums/admin/api";

export function ForumAuditLogPage() {
  const { forumSlug } = useParams<{ forumSlug: string }>();

  const gridRef = useRef<PageableGridContentHandle<ForumAuditEvent>>(null);
  const dataSource = useMemo(() => {
    if (!forumSlug) {
      return null;
    }
    return new ForumAuditDataSource(forumSlug);
  }, [forumSlug]);

  const columnDefs = useMemo<ColDef<ForumAuditEvent>[]>(
    () => [
      { field: "auditId", headerName: "ID", sortable: true, flex: 0.5 },
      { field: "actorId", headerName: "행위자", sortable: true, flex: 1 },
      { field: "action", headerName: "액션", sortable: true, flex: 1.5 },
      {
        field: "detail",
        headerName: "세부 정보",
        flex: 2,
        cellRenderer: (params) => (
          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
            {JSON.stringify(params.value)}
          </Typography>
        ),
      },
      {
        field: "at",
        headerName: "시각",
        sortable: true,
        flex: 1.5,
        valueFormatter: (params) =>
          params.value ? new Date(params.value).toLocaleString() : "",
      },
    ],
    []
  );

  if (!forumSlug) {
    return (
      <Stack spacing={2}>
        <Alert severity="error">
          URL에서 포럼 슬러그를 찾을 수 없습니다.
        </Alert>
      </Stack>
    );
  }

  // Handle case where dataSource might be null initially
  if (!dataSource) {
    return (
      <Stack spacing={2}>
        <Typography>데이터 소스 초기화 중...</Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Breadcrumbs separator="›">
        <Typography color="text.secondary">어드민</Typography>
        <Typography color="text.secondary">포럼</Typography>
        <Typography color="text.primary">{forumSlug} 감사 로그</Typography>
      </Breadcrumbs>

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h5">{forumSlug} 포럼 감사 로그</Typography>
      </Box>

      <PageableGridContent<ForumAuditEvent>
        ref={gridRef}
        datasource={dataSource}
        columns={columnDefs}
      />
    </Stack>
  );
}
