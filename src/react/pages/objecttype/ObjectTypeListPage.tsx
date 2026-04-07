import type { SortModelItem } from "ag-grid-community";
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  IconButton,
  Stack,
  Tooltip,
} from "@mui/material";
import { AddCircleOutlineOutlined } from "@mui/icons-material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { ReactPageDataSource } from "@/react/pages/admin/datasource";
import type { ObjectTypeDto } from "@/types/studio/objecttype";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { CreateObjectTypeDialog } from "./CreateObjectTypeDialog";
import { reactObjectTypeApi } from "./api";

class ObjectTypesDataSource extends ReactPageDataSource<ObjectTypeDto> {
  constructor() {
    super("/api/mgmt/object-types");
  }

  async fetch() {
    this.loading = true;
    this.error = null;
    try {
      const rows = await reactObjectTypeApi.list(this.filter);
      this.dataItems = Array.isArray(rows) ? rows : [];
      this.total = this.dataItems.length;
      this.page = 0;
      this.isLoaded = true;
    } catch (error) {
      this.error = error;
      throw error;
    } finally {
      this.loading = false;
    }
  }

  async fetchForAgGrid({
    startRow,
    endRow,
  }: {
    startRow: number;
    endRow: number;
    sortModel?: SortModelItem[];
    filterModel?: Record<string, unknown>;
  }) {
    await this.fetch();
    return {
      rows: this.dataItems.slice(startRow, endRow),
      total: this.total,
    };
  }
}

export function ObjectTypeListPage() {
  const navigate = useNavigate();
  const gridRef = useRef<PageableGridContentHandle<ObjectTypeDto>>(null);
  const dataSource = useMemo(() => new ObjectTypesDataSource(), []);
  const [createOpen, setCreateOpen] = useState(false);

  const columnDefs = useMemo<ColDef<ObjectTypeDto>[]>(
    () => [
      {
        field: "objectType",
        headerName: "ID",
        type: "number",
        maxWidth: 90,
        sortable: true,
        filter: false,
      },
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
        actions={
          <Tooltip title="새 오브젝트 타입을 생성합니다.">
            <IconButton size="small" onClick={() => setCreateOpen(true)}>
              <AddCircleOutlineOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        }
      />
      <PageableGridContent<ObjectTypeDto>
        ref={gridRef}
        datasource={dataSource}
        columns={columnDefs}
      />
      <CreateObjectTypeDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(objectType) => {
          gridRef.current?.refresh();
          navigate(`/policy/object-types/${objectType.objectType}`);
        }}
      />
    </Stack>
  );
}
