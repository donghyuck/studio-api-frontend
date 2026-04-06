import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Stack,
  Breadcrumbs,
  Typography,
  Button,
} from "@mui/material";
import { AddOutlined, RefreshOutlined } from "@mui/icons-material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { ReactPageDataSource } from "@/react/pages/admin/datasource";
import { CreateTemplateDialog } from "@/react/pages/templates/CreateTemplateDialog";
import { reactTemplatesApi } from "./api";
import type { TemplateSummaryDto } from "@/types/studio/template";

class TemplatesDataSource extends ReactPageDataSource<TemplateSummaryDto> {
  constructor() {
    super("/api/mgmt/templates");
  }
}

export function TemplatesPage() {
  const navigate = useNavigate();
  const gridRef = useRef<PageableGridContentHandle<TemplateSummaryDto>>(null);
  const dataSource = useMemo(() => new TemplatesDataSource(), []);
  const [createOpen, setCreateOpen] = useState(false);

  const columnDefs = useMemo<ColDef<TemplateSummaryDto>[]>(
    () => [
      {
        field: "name",
        headerName: "이름",
        flex: 1.5,
        sortable: true,
        filter: false,
        cellRenderer: (params: ICellRendererParams<TemplateSummaryDto>) => (
          <Button
            variant="text"
            size="small"
            onClick={() => navigate(`/application/templates/${params.data?.templateId}`)}
          >
            {params.value}
          </Button>
        ),
      },
      { field: "displayName", headerName: "표시 이름", flex: 1.5, sortable: true, filter: false },
      { field: "objectType", headerName: "오브젝트 타입", flex: 0.8, sortable: false, filter: false },
      { field: "updatedAt", headerName: "수정일시", flex: 1, sortable: true, filter: false },
    ],
    [navigate]
  );

  return (
    <Stack spacing={2}>
      <Breadcrumbs separator="›">
        <Typography color="text.secondary">애플리케이션</Typography>
        <Typography color="text.primary">템플릿</Typography>
      </Breadcrumbs>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h5">템플릿 목록</Typography>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<AddOutlined />} onClick={() => setCreateOpen(true)}>
            템플릿 생성
          </Button>
          <Button startIcon={<RefreshOutlined />} onClick={() => gridRef.current?.refresh()}>
            새로고침
          </Button>
        </Stack>
      </Box>
      <PageableGridContent<TemplateSummaryDto>
        ref={gridRef}
        datasource={dataSource}
        columns={columnDefs}
      />
      <CreateTemplateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => gridRef.current?.refresh()}
      />
    </Stack>
  );
}
