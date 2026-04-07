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
  GroupAddOutlined,
  GroupOutlined,
} from "@mui/icons-material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import type { GroupDto } from "@/react/pages/admin/datasource";
import { GroupsDataSource } from "@/react/pages/admin/datasource";
import { GroupDialog } from "@/react/pages/admin/groups/GroupDialog";
import { PageToolbar } from "@/react/components/page/PageToolbar";

export function GroupsPage() {
  const navigate = useNavigate();
  const gridRef = useRef<PageableGridContentHandle<GroupDto>>(null);
  const dataSource = useMemo(() => new GroupsDataSource(), []);
  const [searchInput, setSearchInput] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const columnDefs = useMemo<ColDef<GroupDto>[]>(
    () => [
      {
        field: "name",
        headerName: "이름",
        filter: false,
        sortable: true,
        flex: 0.8,
        cellRenderer: (params: ICellRendererParams<GroupDto>) => (
          <Box
            component="button"
            type="button"
            onClick={() => navigate(`/admin/groups/${params.data?.groupId}`)}
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
        field: "memberCount",
        headerName: "맴버",
        filter: false,
        sortable: false,
        flex: 0.4,
        cellStyle: { textAlign: "right" },
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
        flex: 0.65,
        minWidth: 132,
        cellRenderer: (params: ICellRendererParams<GroupDto>) => (
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", height: "100%" }}>
            <Tooltip title="멤버 관리는 아직 연결되지 않았습니다.">
              <IconButton
                size="small"
                disabled
              >
                <GroupOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="그룹 삭제는 아직 연결되지 않았습니다.">
              <IconButton
                size="small"
                color="error"
                disabled
              >
                <DeleteOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="상세보기">
              <IconButton
                size="small"
                onClick={() => navigate(`/admin/groups/${params.data?.groupId}`)}
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
        breadcrumbs={["시스템관리", "보안관리", "그룹"]}
        label="그룹을 검색하고 멤버십과 역할을 관리합니다."
        onRefresh={handleRefresh}
        searchPlaceholder="이름, 설명 검색"
        searchValue={searchInput}
        onSearchValueChange={setSearchInput}
        onSearch={handleSearch}
        actions={
          <Tooltip title="새로운 그룹을 생성합니다.">
            <IconButton size="small" onClick={() => setCreateOpen(true)}>
              <GroupAddOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        }
      />

      {searchError && <Alert severity="error">{searchError}</Alert>}

      <PageableGridContent<GroupDto>
        ref={gridRef}
        datasource={dataSource}
        columns={columnDefs}
      />
      <GroupDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => gridRef.current?.refresh()}
      />
    </Stack>
  );
}
