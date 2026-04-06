import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Box, Breadcrumbs, Button, Stack, Typography } from "@mui/material";
import { RefreshOutlined } from "@mui/icons-material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { GridContent } from "@/react/components/ag-grid";
import type { GridContentHandle } from "@/react/components/ag-grid/types";
import { reactObjectStorageApi } from "@/react/pages/objectstorage/api";
import { objectStorageQueryKeys } from "@/react/pages/objectstorage/queryKeys";
import type { ProviderDto } from "@/types/studio/storage";

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
        cellRenderer: (params: ICellRendererParams<ProviderDto>) => (
          <Button
            variant="text"
            size="small"
            onClick={() => navigate(`/services/object-storage/${params.data?.name}`)}
          >
            {params.value}
          </Button>
        ),
      },
      { field: "type", headerName: "유형", flex: 0.4, sortable: true },
      { field: "health", headerName: "상태", flex: 0.35, sortable: true },
      { field: "region", headerName: "리전", flex: 0.35, sortable: true },
      { field: "endpointMasked", headerName: "엔드포인트", flex: 1.2 },
    ],
    [navigate]
  );

  return (
    <Stack spacing={2}>
      <Breadcrumbs separator="›">
        <Typography color="text.secondary">서비스 관리</Typography>
        <Typography color="text.primary">Object Storage</Typography>
      </Breadcrumbs>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h5">Providers</Typography>
        <Button startIcon={<RefreshOutlined />} onClick={() => providersQuery.refetch()}>
          새로고침
        </Button>
      </Box>
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
