import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  ChevronRight,
  DeleteOutlined,
  GroupOutlined,
  RefreshOutlined,
  SearchOutlined,
} from "@mui/icons-material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import type { GroupDto } from "@/react/pages/admin/datasource";
import { GroupsDataSource } from "@/react/pages/admin/datasource";

export function GroupsPage() {
  const navigate = useNavigate();
  const gridRef = useRef<PageableGridContentHandle<GroupDto>>(null);
  const dataSource = useMemo(() => new GroupsDataSource(), []);
  const [searchInput, setSearchInput] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);

  const columnDefs = useMemo<ColDef<GroupDto>[]>(
    () => [
      {
        field: "name",
        headerName: "이름",
        filter: false,
        sortable: true,
        flex: 0.8,
        cellRenderer: (params: ICellRendererParams<GroupDto>) => (
          <Button
            variant="text"
            size="small"
            onClick={() => navigate(`/admin/groups/${params.data?.groupId}`)}
          >
            {params.value}
          </Button>
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
        flex: 0.8,
      },
      {
        field: "modifiedDate",
        headerName: "수정일",
        filter: false,
        sortable: true,
        flex: 0.8,
      },
      {
        colId: "actions",
        headerName: "",
        filter: false,
        sortable: false,
        flex: 1.4,
        minWidth: 210,
        cellRenderer: (params: ICellRendererParams<GroupDto>) => (
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", height: "100%" }}>
            <Button
              variant="text"
              size="small"
              startIcon={<GroupOutlined fontSize="small" />}
              onClick={() => {
                // TODO: 실제 구현 - 멤버 관리 다이얼로그 열기
                alert("구현 예정");
              }}
            >
              멤버관리
            </Button>
            <Button
              variant="outlined"
              size="small"
              color="error"
              startIcon={<DeleteOutlined fontSize="small" />}
              onClick={() => {
                // TODO: 실제 구현 - 그룹 삭제 API 호출
                if (window.confirm(`'${params.data?.name}' 을 삭제할까요?`)) {
                  alert("구현 예정");
                }
              }}
            >
              삭제
            </Button>
            <Button
              variant="text"
              size="small"
              endIcon={<ChevronRight fontSize="small" />}
              onClick={() => navigate(`/admin/groups/${params.data?.groupId}`)}
            >
              상세보기
            </Button>
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleRefresh = () => {
    setSearchError(null);
    gridRef.current?.refresh();
  };

  return (
    <Stack spacing={2}>
      <Breadcrumbs separator="›">
        <Typography color="text.secondary">시스템관리</Typography>
        <Typography color="text.secondary">보안관리</Typography>
        <Typography color="text.primary">그룹</Typography>
      </Breadcrumbs>

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h5">그룹 목록</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="text"
            startIcon={<RefreshOutlined />}
            onClick={handleRefresh}
          >
            새로고침
          </Button>
        </Stack>
      </Box>

      <TextField
        label="검색어 (이름 또는 설명)"
        variant="outlined"
        size="small"
        fullWidth
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        onKeyDown={handleKeyDown}
        InputProps={{
          endAdornment: (
            <Button
              onClick={handleSearch}
              startIcon={<SearchOutlined />}
              size="small"
            >
              검색
            </Button>
          ),
        }}
      />

      {searchError && <Alert severity="error">{searchError}</Alert>}

      <PageableGridContent<GroupDto>
        ref={gridRef}
        datasource={dataSource}
        columns={columnDefs}
      />
    </Stack>
  );
}
