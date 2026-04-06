import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Stack,
  Breadcrumbs,
  Typography,
  Button,
  TextField,
} from "@mui/material";
import { AddOutlined, RefreshOutlined, SearchOutlined } from "@mui/icons-material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { ReactPageDataSource } from "@/react/pages/admin/datasource";
import { CreateDocumentDialog } from "@/react/pages/documents/CreateDocumentDialog";

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
          <Button
            variant="text"
            size="small"
            onClick={() => navigate(`/application/documents/${params.data?.documentId}`)}
          >
            {params.value}
          </Button>
        ),
      },
      { field: "objectType", headerName: "오브젝트 타입", flex: 0.8, sortable: false, filter: false },
      { field: "createdAt", headerName: "생성일시", flex: 1, sortable: true, filter: false },
      { field: "updatedAt", headerName: "수정일시", flex: 1, sortable: true, filter: false },
    ],
    [navigate]
  );

  function handleSearch() {
    dataSource.applyFilter(searchInput.trim() ? { q: searchInput.trim() } : {});
    gridRef.current?.refresh();
  }

  return (
    <Stack spacing={2}>
      <Breadcrumbs separator="›">
        <Typography color="text.secondary">애플리케이션</Typography>
        <Typography color="text.primary">문서</Typography>
      </Breadcrumbs>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h5">문서 목록</Typography>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<AddOutlined />} onClick={() => setCreateOpen(true)}>
            문서 생성
          </Button>
          <Button startIcon={<RefreshOutlined />} onClick={() => gridRef.current?.refresh()}>
            새로고침
          </Button>
        </Stack>
      </Box>
      <TextField
        label="검색어"
        variant="outlined"
        size="small"
        fullWidth
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        InputProps={{
          endAdornment: (
            <Button onClick={handleSearch} startIcon={<SearchOutlined />} size="small">
              검색
            </Button>
          ),
        }}
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
