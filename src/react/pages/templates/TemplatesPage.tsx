import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Stack,
  IconButton,
  Tooltip,
} from "@mui/material";
import { AddOutlined } from "@mui/icons-material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { ReactPageDataSource } from "@/react/pages/admin/datasource";
import { CreateTemplateDialog } from "@/react/pages/templates/CreateTemplateDialog";
import type { TemplateSummaryDto } from "@/types/studio/template";
import { PageToolbar } from "@/react/components/page/PageToolbar";

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
          <Box
            component="button"
            type="button"
            onClick={() => navigate(`/application/templates/${params.data?.templateId}`)}
            sx={{
              border: 0,
              p: 0,
              bgcolor: "transparent",
              color: "primary.main",
              cursor: "pointer",
              font: "inherit",
              textAlign: "left",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            {params.value}
          </Box>
        ),
      },
      { field: "displayName", headerName: "표시 이름", flex: 1.5, sortable: true, filter: false },
      { field: "objectType", headerName: "오브젝트 타입", flex: 0.8, sortable: false, filter: false },
      { field: "updatedAt", headerName: "수정일시", type: "datetime", flex: 1, sortable: true, filter: false },
    ],
    [navigate]
  );

  return (
    <Stack spacing={0.5}>
      <PageToolbar
        divider={false}
        breadcrumbs={["애플리케이션", "템플릿"]}
        label="템플릿을 조회하고 생성합니다."
        onRefresh={() => gridRef.current?.refresh()}
        actions={
          <Tooltip title="템플릿을 생성합니다.">
            <IconButton size="small" onClick={() => setCreateOpen(true)}>
              <AddOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        }
      />
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
