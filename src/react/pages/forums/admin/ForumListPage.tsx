import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Breadcrumbs,
  Button,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  AddOutlined,
  ChevronRight,
  RefreshOutlined,
  SearchOutlined,
} from "@mui/icons-material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { ForumCreateDialog } from "@/react/pages/forums/admin/ForumCreateDialog";
import { ForumListDataSource } from "@/react/pages/forums/admin/ForumListDataSource";
import type { ForumSummaryResponse } from "@/types/studio/forums";
import { formatDateTime } from "@/react/pages/community/format";

export function ForumListPage() {
  const navigate = useNavigate();
  const gridRef = useRef<PageableGridContentHandle<ForumSummaryResponse>>(null);
  const dataSource = useMemo(() => new ForumListDataSource(), []);
  const [searchInput, setSearchInput] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const columnDefs = useMemo<ColDef<ForumSummaryResponse>[]>(
    () => [
      {
        field: "name",
        headerName: "게시판",
        sortable: true,
        flex: 1,
        cellRenderer: (params: ICellRendererParams<ForumSummaryResponse>) => (
          <Button
            variant="text"
            size="small"
            onClick={() => navigate(`/admin/forums/${params.data?.slug}/settings`)}
          >
            {params.value}
          </Button>
        ),
      },
      { field: "slug", headerName: "슬러그", sortable: true, flex: 0.8 },
      { field: "type", headerName: "유형", sortable: true, flex: 0.5 },
      { field: "viewType", headerName: "보기", sortable: true, flex: 0.5 },
      {
        field: "topicCount",
        headerName: "토픽",
        sortable: true,
        flex: 0.4,
        cellStyle: { textAlign: "right" },
      },
      {
        field: "postCount",
        headerName: "댓글",
        sortable: true,
        flex: 0.4,
        cellStyle: { textAlign: "right" },
      },
      {
        field: "updatedAt",
        headerName: "수정일",
        sortable: true,
        flex: 0.7,
        valueFormatter: (params) => formatDateTime(params.value),
      },
      {
        colId: "actions",
        headerName: "",
        sortable: false,
        flex: 1.1,
        minWidth: 280,
        cellRenderer: (params: ICellRendererParams<ForumSummaryResponse>) => (
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", height: "100%" }}>
            <Button
              variant="text"
              size="small"
              onClick={() => navigate(`/admin/forums/${params.data?.slug}/settings`)}
            >
              설정
            </Button>
            <Button
              variant="text"
              size="small"
              onClick={() => navigate(`/admin/forums/${params.data?.slug}/acl`)}
            >
              ACL
            </Button>
            <Button
              variant="text"
              size="small"
              onClick={() => navigate(`/admin/forums/${params.data?.slug}/audit`)}
            >
              감사
            </Button>
            <Button
              variant="text"
              size="small"
              endIcon={<ChevronRight fontSize="small" />}
              onClick={() => navigate(`/admin/forums/${params.data?.slug}/settings`)}
            >
              상세
            </Button>
          </Box>
        ),
      },
    ],
    [navigate]
  );

  const handleSearch = () => {
    dataSource.applyFilter(
      searchInput.trim() ? { q: searchInput.trim(), in: "name,description" } : {}
    );
    gridRef.current?.refresh();
  };

  return (
    <>
      <Stack spacing={2}>
        <Breadcrumbs separator="›">
          <Typography color="text.secondary">어드민</Typography>
          <Typography color="text.primary">포럼</Typography>
        </Breadcrumbs>

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h5">포럼 목록</Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="text"
              startIcon={<AddOutlined />}
              onClick={() => setCreateOpen(true)}
            >
              게시판 생성
            </Button>
            <Button
              variant="text"
              startIcon={<RefreshOutlined />}
              onClick={() => gridRef.current?.refresh()}
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
          onChange={(event) => setSearchInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleSearch();
            }
          }}
          InputProps={{
            endAdornment: (
              <Button onClick={handleSearch} startIcon={<SearchOutlined />} size="small">
                검색
              </Button>
            ),
          }}
        />

        <PageableGridContent<ForumSummaryResponse>
          ref={gridRef}
          datasource={dataSource}
          columns={columnDefs}
        />
      </Stack>

      <ForumCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(slug) => {
          setCreateOpen(false);
          gridRef.current?.refresh();
          navigate(`/admin/forums/${slug}/settings`);
        }}
      />
    </>
  );
}
