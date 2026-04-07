import { useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Stack,
} from "@mui/material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { ReactPageDataSource } from "@/react/pages/admin/datasource";
import type { ObjectTypeDto } from "@/types/studio/objecttype";
import { PageToolbar } from "@/react/components/page/PageToolbar";

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
          <Box
            component="button"
            type="button"
            onClick={() => navigate(`/policy/object-types/${params.data?.objectType}`)}
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
      { field: "name", headerName: "이름", flex: 1.2, sortable: true, filter: false },
      { field: "domain", headerName: "도메인", flex: 1, sortable: true, filter: false },
      { field: "status", headerName: "상태", flex: 0.8, sortable: true, filter: false },
      { field: "description", headerName: "설명", flex: 2, sortable: false, filter: false },
    ],
    [navigate]
  );

  return (
    <Stack spacing={0.5}>
      <PageToolbar
        divider={false}
        breadcrumbs={["정책", "오브젝트 타입"]}
        label="데이터 타입 정의를 조회하고 관리합니다."
        onRefresh={() => gridRef.current?.refresh()}
      />
      <PageableGridContent<ObjectTypeDto>
        ref={gridRef}
        datasource={dataSource}
        columns={columnDefs}
      />
    </Stack>
  );
}
