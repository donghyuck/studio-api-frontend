import { useCallback, useMemo, useRef, useState } from "react";
import {
  Avatar,
  Chip,
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
import { API_BASE_URL } from "@/config/backend";
import NO_AVATAR from "@/assets/images/users/no-avatar.png";

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
  const [confirming, setConfirming] = useState(false);
  const [query, setQuery] = useState("");

  const columnDefs = useMemo<ColDef<UserDto>[]>(() => {
    const baseColumns: ColDef<UserDto>[] = [
      {
        field: "username",
        headerName: "아이디",
        flex: 1,
        filter: false,
        cellRenderer: (params: ICellRendererParams<UserDto>) => (
          <Stack direction="row" spacing={1} alignItems="center">
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
            <span>{String(params.value ?? "")}</span>
          </Stack>
        ),
      },
      { field: "name", headerName: "이름", flex: 1, filter: false },
      { field: "email", headerName: "이메일", flex: 1.5, filter: false },
      {
        field: "enabled",
        headerName: "활성화",
        width: 96,
        maxWidth: 96,
        filter: false,
        sortable: true,
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
        colId: "status",
        headerName: "상태",
        width: 100,
        maxWidth: 100,
        filter: false,
        sortable: true,
        valueGetter: (params) =>
          (params.data as UserDto & { status?: string | null } | undefined)?.status ?? "",
        cellStyle: { textAlign: "center" },
      },
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
                setSelectedCount(nextSelectedCount);
              },
            },
            {
              type: "paginationChanged",
              listener: (event: PaginationChangedEvent<UserDto>) => {
                const nextDisplayedCount = event.api.getDisplayedRowCount() ?? 0;
                setDisplayedCount(nextDisplayedCount);
              },
            },
          ]
        : undefined,
    [isMultiple]
  );

  const handleClose = useCallback(() => {
    setSelectedCount(0);
    setDisplayedCount(0);
    setConfirming(false);
    setQuery("");
    dataSource.applyFilter({});
    onClose();
  }, [dataSource, onClose]);

  const handleSearch = useCallback(() => {
    const trimmed = query.trim();
    dataSource.applyFilter(
      trimmed ? { q: trimmed, in: "username,name,email" } : {}
    );
    gridRef.current?.refresh();
    setSelectedCount(0);
    setDisplayedCount(0);
  }, [dataSource, query]);

  const hasSelection = selectedCount > 0;

  const handleToggleSelectAll = useCallback(() => {
    if (hasSelection) {
      gridRef.current?.deselectAll();
      setSelectedCount(0);
      return;
    }
    gridRef.current?.selectAll();
    setSelectedCount(gridRef.current?.selectedRows().length ?? 0);
  }, [hasSelection]);

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
            {hasSelection ? "전체 해제" : "전체 선택"}
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
