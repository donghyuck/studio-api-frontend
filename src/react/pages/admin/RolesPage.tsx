import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  IconButton,
  Stack,
  Tooltip,
} from "@mui/material";
import {
  ChevronRight,
  DeleteOutlined,
  GroupOutlined,
  PersonOutlined,
  AddOutlined,
} from "@mui/icons-material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import type { RoleDto } from "@/react/pages/admin/datasource";
import { RolesDataSource } from "@/react/pages/admin/datasource";
import { RoleDialog } from "@/react/pages/admin/roles/RoleDialog";
import { PageToolbar } from "@/react/components/page/PageToolbar";

export function RolesPage() {
  const navigate = useNavigate();
  const gridRef = useRef<PageableGridContentHandle<RoleDto>>(null);
  const dataSource = useMemo(() => new RolesDataSource(), []);
  const [searchInput, setSearchInput] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const columnDefs = useMemo<ColDef<RoleDto>[]>(
    () => [
      {
        field: "name",
        headerName: "이름",
        filter: false,
        sortable: true,
        flex: 0.8,
        cellRenderer: (params: ICellRendererParams<RoleDto>) => (
          <Box
            component="button"
            type="button"
            onClick={() => navigate(`/admin/roles/${params.data?.roleId}`)}
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
      {
        field: "description",
        headerName: "설명",
        filter: false,
        sortable: false,
        flex: 1.2,
      },
      {
        field: "creationDate",
        headerName: "생성일",
        filter: false,
        sortable: true,
        type: "datetime",
        flex: 0.8,
      },
      {
        field: "modifiedDate",
        headerName: "수정일",
        filter: false,
        sortable: true,
        type: "datetime",
        flex: 0.8,
      },
      {
        colId: "actions",
        headerName: "",
        filter: false,
        sortable: false,
        flex: 0.85,
        minWidth: 168,
        cellRenderer: (params: ICellRendererParams<RoleDto>) => (
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", height: "100%" }}>
            <Tooltip title="롤 사용자 관리는 아직 연결되지 않았습니다.">
              <IconButton size="small" disabled>
                <PersonOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="롤 그룹 관리는 아직 연결되지 않았습니다.">
              <IconButton size="small" disabled>
                <GroupOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="롤 삭제는 아직 연결되지 않았습니다.">
              <IconButton size="small" color="error" disabled>
                <DeleteOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="상세보기">
              <IconButton
                size="small"
                onClick={() => navigate(`/admin/roles/${params.data?.roleId}`)}
              >
                <ChevronRight fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ),
      },
    ],
    [navigate]
  );

  const handleSearch = () => {
    setSearchError(null);
    dataSource.applyFilter(
      searchInput.trim()
        ? { q: searchInput.trim(), in: "name,description" }
        : {}
    );
    gridRef.current?.refresh();
  };

  const handleRefresh = () => {
    setSearchError(null);
    gridRef.current?.refresh();
  };

  return (
    <Stack spacing={0.5}>
      <PageToolbar
        divider={false}
        breadcrumbs={["시스템관리", "보안관리", "역할"]}
        label="역할을 검색하고 사용자/그룹 할당을 관리합니다."
        onRefresh={handleRefresh}
        searchPlaceholder="이름, 설명 검색"
        searchValue={searchInput}
        onSearchValueChange={setSearchInput}
        onSearch={handleSearch}
        actions={
          <Tooltip title="새로운 역할을 생성합니다.">
            <IconButton size="small" onClick={() => setCreateOpen(true)}>
              <AddOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        }
      />

      {searchError && <Alert severity="error">{searchError}</Alert>}

      <PageableGridContent<RoleDto>
        ref={gridRef}
        datasource={dataSource}
        columns={columnDefs}
      />
      <RoleDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => gridRef.current?.refresh()}
      />
    </Stack>
  );
}
