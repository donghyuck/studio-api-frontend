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
import { reactRolesApi } from "@/react/pages/admin/roles/api";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { useConfirm, useToast } from "@/react/feedback";

export function RolesPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
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
            aria-label={`${params.value} 상세보기`}
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
        headerName: "작업",
        filter: false,
        sortable: false,
        width: 144,
        minWidth: 144,
        maxWidth: 144,
        pinned: "right",
        cellStyle: { display: "flex", alignItems: "center", justifyContent: "center" },
        cellRenderer: (params: ICellRendererParams<RoleDto>) => (
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", height: "100%" }}>
            <Tooltip title="사용자 관리">
              <IconButton
                size="small"
                aria-label="사용자 관리"
                onClick={() =>
                  params.data?.roleId &&
                  navigate(`/admin/roles/${params.data.roleId}`, { state: { openUsers: true } })
                }
              >
                <PersonOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="그룹 관리">
              <IconButton
                size="small"
                aria-label="그룹 관리"
                onClick={() =>
                  params.data?.roleId &&
                  navigate(`/admin/roles/${params.data.roleId}`, { state: { openGroups: true } })
                }
              >
                <GroupOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="삭제">
              <IconButton
                size="small"
                color="error"
                aria-label="삭제"
                onClick={() => params.data && void handleDeleteRole(params.data)}
              >
                <DeleteOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="상세보기">
              <IconButton
                size="small"
                aria-label="상세보기"
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

  async function handleDeleteRole(role: RoleDto) {
    const ok = await confirm({
      title: "역할 삭제",
      message: `${role.name} 역할을 삭제하시겠습니까?`,
      okText: "삭제",
      cancelText: "취소",
    });
    if (!ok) {
      return;
    }

    try {
      await reactRolesApi.deleteRole(role.roleId);
      toast.success("역할이 삭제되었습니다.");
      gridRef.current?.refresh();
    } catch {
      toast.error("역할 삭제에 실패했습니다.");
    }
  }

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
          <Tooltip title="역할 생성">
            <IconButton size="small" aria-label="역할 생성" onClick={() => setCreateOpen(true)}>
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
