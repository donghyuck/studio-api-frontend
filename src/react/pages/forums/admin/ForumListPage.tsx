import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  IconButton,
  Stack,
  Tooltip,
} from "@mui/material";
import {
  AddOutlined,
  ChevronRight,
  SecurityOutlined,
  SettingsOutlined,
  SummarizeOutlined,
} from "@mui/icons-material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { ForumCreateDialog } from "@/react/pages/forums/admin/ForumCreateDialog";
import { ForumListDataSource } from "@/react/pages/forums/admin/ForumListDataSource";
import type { ForumSummaryResponse } from "@/types/studio/forums";
import { PageToolbar } from "@/react/components/page/PageToolbar";

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
          <Box
            component="button"
            type="button"
            onClick={() => navigate(`/admin/forums/${params.data?.slug}/settings`)}
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
        type: "datetime",
        flex: 0.7,
      },
      {
        colId: "actions",
        headerName: "",
        sortable: false,
        flex: 0.85,
        minWidth: 168,
        cellRenderer: (params: ICellRendererParams<ForumSummaryResponse>) => (
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", height: "100%" }}>
            <Tooltip title="설정">
              <IconButton
                size="small"
              onClick={() => navigate(`/admin/forums/${params.data?.slug}/settings`)}
            >
                <SettingsOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="ACL">
              <IconButton
                size="small"
              onClick={() => navigate(`/admin/forums/${params.data?.slug}/acl`)}
            >
                <SecurityOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="감사 로그">
              <IconButton
                size="small"
              onClick={() => navigate(`/admin/forums/${params.data?.slug}/audit`)}
            >
                <SummarizeOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="상세">
              <IconButton
                size="small"
              onClick={() => navigate(`/admin/forums/${params.data?.slug}/settings`)}
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
    dataSource.applyFilter(
      searchInput.trim() ? { q: searchInput.trim(), in: "name,description" } : {}
    );
    gridRef.current?.refresh();
  };

  return (
    <>
      <Stack spacing={0.5}>
        <PageToolbar
          divider={false}
          breadcrumbs={["어드민", "포럼"]}
          label="포럼을 검색하고 설정, ACL, 감사 로그를 관리합니다."
          onRefresh={() => gridRef.current?.refresh()}
          searchPlaceholder="이름 또는 설명 검색"
          searchValue={searchInput}
          onSearchValueChange={setSearchInput}
          onSearch={handleSearch}
          actions={
            <Tooltip title="게시판을 생성합니다.">
              <IconButton size="small" onClick={() => setCreateOpen(true)}>
                <AddOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          }
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
