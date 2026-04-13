import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Box, Stack } from "@mui/material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { GridContent } from "@/react/components/ag-grid";
import type { GridContentHandle } from "@/react/components/ag-grid/types";
import { reactObjectStorageApi } from "@/react/pages/objectstorage/api";
import { objectStorageQueryKeys } from "@/react/pages/objectstorage/queryKeys";
import type { ProviderDto } from "@/types/studio/storage";
import { PageToolbar } from "@/react/components/page/PageToolbar";

export function ObjectStorageListPage() {
  const navigate = useNavigate();
  const gridRef = useRef<GridContentHandle<ProviderDto>>(null);

  const providersQuery = useQuery({
    queryKey: objectStorageQueryKeys.custom("providers"),
    queryFn: () => reactObjectStorageApi.fetchProviders(),
  });

  const columnDefs = useMemo<ColDef<ProviderDto>[]>(
    () => [
      {
        field: "name",
        headerName: "ID",
        flex: 0.7,
        sortable: true,
        filter: false,
        cellRenderer: (params: ICellRendererParams<ProviderDto>) => (
          <Box
            component="button"
            type="button"
            onClick={() => navigate(`/services/object-storage/${params.data?.name}`)}
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
      { field: "type", headerName: "유형", flex: 0.4, sortable: true, filter: false },
      { field: "health", headerName: "상태", flex: 0.35, sortable: true, filter: false },
      { field: "region", headerName: "리전", flex: 0.35, sortable: true, filter: false },
      { field: "endpointMasked", headerName: "엔드포인트", flex: 1.2, filter: false },
    ],
    [navigate]
  );

  return (
    <Stack spacing={0.5}>
      <PageToolbar
        divider={false}
        breadcrumbs={["서비스 관리", "Object Storage"]}
        label="오브젝트 스토리지 provider를 조회합니다."
        onRefresh={() => providersQuery.refetch()}
      />
      {providersQuery.isError ? <Alert severity="error">Provider 목록을 불러오지 못했습니다.</Alert> : null}
      <GridContent<ProviderDto>
        ref={gridRef}
        columns={columnDefs}
        rowData={providersQuery.data ?? []}
        height={320}
      />
    </Stack>
  );
}
