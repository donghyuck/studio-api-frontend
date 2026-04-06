import { useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Stack,
  Breadcrumbs,
  Typography,
  Button,
} from "@mui/material";
import { RefreshOutlined } from "@mui/icons-material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { ReactPageDataSource } from "@/react/pages/admin/datasource";
import type { ObjectTypeDto } from "@/types/studio/objecttype";

class ObjectTypesDataSource extends ReactPageDataSource<ObjectTypeDto> {
  constructor() {
    super("/api/mgmt/object-types");
  }
}

export function ObjectTypeListPage() {
  const navigate = useNavigate();
  const gridRef = useRef<PageableGridContentHandle<ObjectTypeDto>>(null);
  const dataSource = useMemo(() => new ObjectTypesDataSource(), []);

  const columnDefs = useMemo<ColDef<ObjectTypeDto>[]>(
    () => [
      {
        field: "code",
        headerName: "코드",
        flex: 1.2,
        sortable: true,
        filter: false,
        cellRenderer: (params: ICellRendererParams<ObjectTypeDto>) => (
          <Button
            variant="text"
            size="small"
            onClick={() => navigate(`/policy/object-types/${params.data?.objectType}`)}
          >
            {params.value}
          </Button>
        ),
      },
      { field: "name", headerName: "이름", flex: 1.2, sortable: true, filter: false },
      { field: "domain", headerName: "도메인", flex: 1, sortable: true, filter: false },
      { field: "status", headerName: "상태", flex: 0.8, sortable: true, filter: false },
      { field: "description", headerName: "설명", flex: 2, sortable: false, filter: false },
    ],
    [navigate]
  );

  return (
    <Stack spacing={2}>
      <Breadcrumbs separator="›">
        <Typography color="text.secondary">정책</Typography>
        <Typography color="text.primary">오브젝트 타입</Typography>
      </Breadcrumbs>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h5">오브젝트 타입</Typography>
        <Button startIcon={<RefreshOutlined />} onClick={() => gridRef.current?.refresh()}>
          새로고침
        </Button>
      </Box>
      <PageableGridContent<ObjectTypeDto>
        ref={gridRef}
        datasource={dataSource}
        columns={columnDefs}
      />
    </Stack>
  );
}
