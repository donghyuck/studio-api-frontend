import { useCallback, useMemo, useRef, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import type {
  ColDef,
  ICellRendererParams,
  SelectionChangedEvent,
} from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { UsersDataSource } from "@/react/pages/admin/datasource";
import type { UserDto } from "@/types/studio/user";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect?: (user: UserDto) => void;
  selectionMode?: "single" | "multiple";
  onConfirmSelection?: (users: UserDto[]) => void;
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

  const columnDefs = useMemo<ColDef<UserDto>[]>(() => {
    const baseColumns: ColDef<UserDto>[] = [
      { field: "username", headerName: "아이디", flex: 1 },
      { field: "name", headerName: "이름", flex: 1 },
      { field: "email", headerName: "이메일", flex: 1.5 },
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

  function handleConfirmSelection() {
    const users = gridRef.current?.selectedRows() ?? [];
    if (users.length === 0) {
      return;
    }
    onConfirmSelection?.(users);
    handleClose();
  }

  const gridEvents = useMemo(
    () =>
      isMultiple
        ? [
            {
              type: "selectionChanged",
              listener: (event: SelectionChangedEvent<UserDto>) =>
                setSelectedCount(event.api.getSelectedRows().length ?? 0),
            },
          ]
        : undefined,
    [isMultiple]
  );

  const handleClose = useCallback(() => {
    setSelectedCount(0);
    onClose();
  }, [onClose]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>사용자 검색</DialogTitle>
      <DialogContent sx={{ height: 400 }}>
        <PageableGridContent<UserDto>
          ref={gridRef}
          datasource={dataSource}
          columns={columnDefs}
          events={gridEvents}
          rowSelection={isMultiple ? "multiple" : undefined}
        />
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={handleClose}>닫기</Button>
        {isMultiple ? (
          <Button
            variant="outlined"
            onClick={handleConfirmSelection}
            disabled={selectedCount === 0}
          >
            {confirmLabel}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
