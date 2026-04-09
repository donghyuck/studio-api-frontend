import { useCallback, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Stack,
  TextField,
} from "@mui/material";
import type {
  ColDef,
  ICellRendererParams,
  PaginationChangedEvent,
  SelectionChangedEvent,
} from "ag-grid-community";
import { SearchOutlined } from "@mui/icons-material";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { UsersDataSource } from "@/react/pages/admin/datasource";
import type { UserDto } from "@/types/studio/user";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect?: (user: UserDto) => void;
  selectionMode?: "single" | "multiple";
  onConfirmSelection?: (users: UserDto[]) => void | Promise<void>;
  confirmLabel?: string;
}

export function UserSearchDialog({
  open,
  onClose,
  onSelect,
  selectionMode = "single",
  onConfirmSelection,
  confirmLabel = "추가",
}: Props) {
  const gridRef = useRef<PageableGridContentHandle<UserDto>>(null);
  const dataSource = useMemo(() => new UsersDataSource(), []);
  const isMultiple = selectionMode === "multiple";
  const [selectedCount, setSelectedCount] = useState(0);
  const [displayedCount, setDisplayedCount] = useState(0);
  const [allSelected, setAllSelected] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [query, setQuery] = useState("");

  const columnDefs = useMemo<ColDef<UserDto>[]>(() => {
    const baseColumns: ColDef<UserDto>[] = [
      { field: "username", headerName: "아이디", flex: 1, filter: false },
      { field: "name", headerName: "이름", flex: 1, filter: false },
      { field: "email", headerName: "이메일", flex: 1.5, filter: false },
    ];

    if (isMultiple) {
      return baseColumns;
    }

    return [
      ...baseColumns,
      {
        colId: "select",
        headerName: "",
        flex: 0.5,
        cellRenderer: (params: ICellRendererParams<UserDto>) => (
          <Button
            size="small"
            onClick={() => {
              onSelect?.(params.data!);
              onClose();
            }}
          >
            선택
          </Button>
        ),
      },
    ];
  }, [isMultiple, onClose, onSelect]);

  async function handleConfirmSelection() {
    const users = gridRef.current?.selectedRows() ?? [];
    if (users.length === 0) {
      return;
    }
    setConfirming(true);
    try {
      await onConfirmSelection?.(users);
      handleClose();
    } finally {
      setConfirming(false);
    }
  }

  const gridEvents = useMemo(
    () =>
      isMultiple
        ? [
            {
              type: "selectionChanged",
              listener: (event: SelectionChangedEvent<UserDto>) => {
                const nextSelectedCount = event.api.getSelectedRows().length ?? 0;
                const nextDisplayedCount = event.api.getDisplayedRowCount() ?? 0;
                setSelectedCount(nextSelectedCount);
                setAllSelected(
                  nextDisplayedCount > 0 && nextSelectedCount === nextDisplayedCount
                );
              },
            },
            {
              type: "paginationChanged",
              listener: (event: PaginationChangedEvent<UserDto>) => {
                const nextDisplayedCount = event.api.getDisplayedRowCount() ?? 0;
                const nextSelectedCount = event.api.getSelectedRows().length ?? 0;
                setDisplayedCount(nextDisplayedCount);
                setAllSelected(nextDisplayedCount > 0 && nextSelectedCount === nextDisplayedCount);
              },
            },
          ]
        : undefined,
    [isMultiple]
  );

  const handleClose = useCallback(() => {
    setSelectedCount(0);
    setDisplayedCount(0);
    setAllSelected(false);
    setConfirming(false);
    setQuery("");
    dataSource.setSearch("");
    onClose();
  }, [dataSource, onClose]);

  const handleSearch = useCallback(() => {
    dataSource.setSearch(query);
    gridRef.current?.refresh();
    setSelectedCount(0);
    setDisplayedCount(0);
    setAllSelected(false);
  }, [dataSource, query]);

  const handleToggleSelectAll = useCallback(() => {
    if (allSelected) {
      gridRef.current?.deselectAll();
      setSelectedCount(0);
      setAllSelected(false);
      return;
    }
    gridRef.current?.selectAll();
    setSelectedCount(gridRef.current?.selectedRows().length ?? 0);
    setAllSelected(true);
  }, [allSelected]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>사용자 검색</DialogTitle>
      <DialogContent sx={{ height: 420 }}>
        <Stack spacing={1} sx={{ mt: 1 }}>
          <TextField
            label="이름, 아이디, 이메일 검색"
            size="small"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleSearch();
              }
            }}
            fullWidth
            slotProps={{
              input: {
                endAdornment: (
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<SearchOutlined />}
                    onClick={handleSearch}
                  >
                    검색
                  </Button>
                ),
              },
            }}
          />
          <PageableGridContent<UserDto>
            ref={gridRef}
            datasource={dataSource}
            columns={columnDefs}
            events={gridEvents}
            height={320}
            rowSelection={isMultiple ? "multiple" : undefined}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        {isMultiple ? (
          <Button
            variant="outlined"
            onClick={handleToggleSelectAll}
            disabled={displayedCount === 0 || confirming}
          >
            {allSelected ? "전체 해제" : "전체 선택"}
            <Typography component="span" sx={{ ml: 0.5 }}>
              ({selectedCount})
            </Typography>
          </Button>
        ) : null}
        <Button variant="outlined" onClick={handleClose}>닫기</Button>
        {isMultiple ? (
          <Button
            variant="outlined"
            onClick={() => void handleConfirmSelection()}
            disabled={selectedCount === 0 || confirming}
          >
            {confirming ? "추가 중..." : confirmLabel}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
