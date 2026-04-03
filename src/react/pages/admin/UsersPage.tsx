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
  ManageAccountsOutlined,
  PersonAddAlt1Outlined,
  RefreshOutlined,
  SearchOutlined,
} from "@mui/icons-material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import type { UserDto } from "@/types/studio/user";
import { UsersDataSource } from "@/react/pages/admin/datasource";

export function UsersPage() {
  const navigate = useNavigate();
  const gridRef = useRef<PageableGridContentHandle<UserDto>>(null);
  const dataSource = useMemo(() => new UsersDataSource(), []);
  const [searchInput, setSearchInput] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);

  const columnDefs = useMemo<ColDef<UserDto>[]>(
    () => [
      {
        field: "username",
        headerName: "아이디",
        filter: false,
        sortable: true,
        flex: 0.6,
        cellRenderer: (params: ICellRendererParams<UserDto>) => (
          <Button
            variant="text"
            size="small"
            onClick={() => navigate(`/admin/users/${params.data?.userId}`)}
          >
            {params.value}
          </Button>
        ),
      },
      {
        field: "name",
        headerName: "이름",
        filter: false,
        sortable: true,
        flex: 0.5,
      },
      {
        field: "email",
        headerName: "메일",
        filter: false,
        sortable: true,
        flex: 1,
      },
      {
        field: "enabled",
        headerName: "활성화",
        filter: false,
        sortable: true,
        flex: 0.4,
        cellRenderer: (params: ICellRendererParams<UserDto>) => (
          <input type="checkbox" checked={!!params.value} readOnly />
        ),
        cellStyle: { textAlign: "center" },
      },
      {
        field: "creationDate",
        headerName: "생성일시",
        filter: false,
        sortable: true,
        flex: 0.8,
      },
      {
        field: "modifiedDate",
        headerName: "수정일시",
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
        cellRenderer: (params: ICellRendererParams<UserDto>) => (
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", height: "100%" }}>
            <Button
              variant="text"
              size="small"
              startIcon={<ManageAccountsOutlined fontSize="small" />}
              onClick={() => {
                // TODO: 실제 구현 - 사용자 권한 관리 다이얼로그 열기
                alert("구현 예정");
              }}
            >
              권한
            </Button>
            <Button
              variant="outlined"
              size="small"
              color="error"
              startIcon={<DeleteOutlined fontSize="small" />}
              onClick={() => {
                // TODO: 실제 구현 - 사용자 삭제 API 호출
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
              onClick={() => navigate(`/admin/users/${params.data?.userId}`)}
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
        ? { q: searchInput.trim(), in: "username,name,email" }
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
        <Typography color="text.primary">회원</Typography>
      </Breadcrumbs>

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h5">회원 목록</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="text"
            startIcon={<PersonAddAlt1Outlined />}
            onClick={() => {
              // TODO: 실제 구현 - 회원 등록 다이얼로그 또는 페이지 이동
              alert("구현 예정");
            }}
          >
            회원 등록
          </Button>
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
        label="검색어 (아이디 또는 이름 또는 메일)"
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

      <PageableGridContent<UserDto>
        ref={gridRef}
        datasource={dataSource}
        columns={columnDefs}
      />
    </Stack>
  );
}
