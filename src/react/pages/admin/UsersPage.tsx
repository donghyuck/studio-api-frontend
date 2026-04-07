import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Chip,
  IconButton,
  Stack,
  Tooltip,
} from "@mui/material";
import {
  ChevronRight,
  DeleteOutlined,
  ManageAccountsOutlined,
  PersonAddAlt1Outlined,
} from "@mui/icons-material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import type { UserDto } from "@/types/studio/user";
import { UsersDataSource } from "@/react/pages/admin/datasource";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { API_BASE_URL } from "@/config/backend";
import NO_AVATAR from "@/assets/images/users/no-avatar.png";

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
        flex: 0.75,
        cellRenderer: (params: ICellRendererParams<UserDto>) => (
          <Box
            component="button"
            type="button"
            onClick={() => navigate(`/admin/users/${params.data?.userId}`)}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 1,
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
            <Avatar
              alt={String(params.value ?? "")}
              src={
                params.value
                  ? `${API_BASE_URL}/api/profile/${encodeURIComponent(String(params.value))}/avatar`
                  : NO_AVATAR
              }
              imgProps={{
                onError: (event) => {
                  event.currentTarget.src = NO_AVATAR;
                },
              }}
              sx={{ width: 24, height: 24, bgcolor: "grey.200" }}
            />
            {params.value}
          </Box>
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
          <Chip
            size="small"
            label={params.value ? "활성" : "비활성"}
            variant={params.value ? "filled" : "outlined"}
            sx={{
              height: 22,
              fontSize: 11,
              ...(params.value
                ? {
                    bgcolor: "#2563eb",
                    color: "#ffffff",
                    borderColor: "#1d4ed8",
                  }
                : {}),
            }}
          />
        ),
        cellStyle: { textAlign: "center" },
      },
      {
        field: "creationDate",
        headerName: "생성일시",
        filter: false,
        sortable: true,
        type: "datetime",
        flex: 0.8,
      },
      {
        field: "modifiedDate",
        headerName: "수정일시",
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
        cellRenderer: (params: ICellRendererParams<UserDto>) => (
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", height: "100%" }}>
            <Tooltip title="권한 관리는 아직 연결되지 않았습니다.">
              <IconButton
                size="small"
                disabled
              >
                <ManageAccountsOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="사용자 삭제는 아직 연결되지 않았습니다.">
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
                onClick={() => navigate(`/admin/users/${params.data?.userId}`)}
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
        ? { q: searchInput.trim(), in: "username,name,email" }
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
        breadcrumbs={["시스템관리", "보안관리", "회원"]}
        // title="회원 목록"
        label="회원을 검색하고 계정 상태를 관리합니다."
        onRefresh={handleRefresh}
        searchPlaceholder="아이디, 이름, 메일 검색"
        searchValue={searchInput}
        onSearchValueChange={setSearchInput}
        onSearch={handleSearch}
        actions={
          <Tooltip title="새로운 사용자를 생성합니다.">
            <IconButton
              size="small"
              disabled
            >
              <PersonAddAlt1Outlined fontSize="small" />
            </IconButton>
          </Tooltip>
        }
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
