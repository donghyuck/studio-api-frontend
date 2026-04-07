import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Stack,
  IconButton,
  Tooltip,
} from "@mui/material";
import { AddOutlined } from "@mui/icons-material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { ReactPageDataSource } from "@/react/pages/admin/datasource";
import { CreateDocumentDialog } from "@/react/pages/documents/CreateDocumentDialog";
import { PageToolbar } from "@/react/components/page/PageToolbar";

interface DocumentSummaryDto {
  documentId: number;
  title: string;
  objectType?: number;
  objectId?: number;
  createdAt?: string;
  updatedAt?: string;
}

class DocumentsDataSource extends ReactPageDataSource<DocumentSummaryDto> {
  constructor() {
    super("/api/mgmt/documents");
  }
}

export function DocumentListPage() {
  const navigate = useNavigate();
  const gridRef = useRef<PageableGridContentHandle<DocumentSummaryDto>>(null);
  const dataSource = useMemo(() => new DocumentsDataSource(), []);
  const [searchInput, setSearchInput] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const columnDefs = useMemo<ColDef<DocumentSummaryDto>[]>(
    () => [
      {
        field: "title",
        headerName: "제목",
        flex: 2,
        sortable: true,
        filter: false,
        cellRenderer: (params: ICellRendererParams<DocumentSummaryDto>) => (
          <Box
            component="button"
            type="button"
            onClick={() => navigate(`/application/documents/${params.data?.documentId}`)}
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
      { field: "objectType", headerName: "오브젝트 타입", flex: 0.8, sortable: false, filter: false },
      { field: "createdAt", headerName: "생성일시", type: "datetime", flex: 1, sortable: true, filter: false },
      { field: "updatedAt", headerName: "수정일시", type: "datetime", flex: 1, sortable: true, filter: false },
    ],
    [navigate]
  );

  function handleSearch() {
    dataSource.applyFilter(searchInput.trim() ? { q: searchInput.trim() } : {});
    gridRef.current?.refresh();
  }

  return (
    <Stack spacing={0.5}>
      <PageToolbar
        divider={false}
        breadcrumbs={["애플리케이션", "문서"]}
        label="문서를 검색하고 생성합니다."
        onRefresh={() => gridRef.current?.refresh()}
        searchPlaceholder="문서 검색"
        searchValue={searchInput}
        onSearchValueChange={setSearchInput}
        onSearch={handleSearch}
        actions={
          <Tooltip title="문서를 생성합니다.">
            <IconButton size="small" onClick={() => setCreateOpen(true)}>
              <AddOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        }
      />
      <PageableGridContent<DocumentSummaryDto>
        ref={gridRef}
        datasource={dataSource}
        columns={columnDefs}
      />
      <CreateDocumentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          setCreateOpen(false);
          navigate(`/application/documents/${id}`);
        }}
      />
    </Stack>
  );
}
