import { useMemo, useRef } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { UsersDataSource } from "@/react/pages/admin/datasource";
import type { UserDto } from "@/types/studio/user";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (user: UserDto) => void;
}

export function UserSearchDialog({ open, onClose, onSelect }: Props) {
  const gridRef = useRef<PageableGridContentHandle<UserDto>>(null);
  const dataSource = useMemo(() => new UsersDataSource(), []);

  const columnDefs = useMemo<ColDef<UserDto>[]>(() => [
    { field: "username", headerName: "아이디", flex: 1 },
    { field: "name", headerName: "이름", flex: 1 },
    { field: "email", headerName: "이메일", flex: 1.5 },
    {
      colId: "select", headerName: "", flex: 0.5,
      cellRenderer: (params: ICellRendererParams<UserDto>) => (
        <Button size="small" onClick={() => { onSelect(params.data!); onClose(); }}>선택</Button>
      ),
    },
  ], [onClose, onSelect]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>사용자 검색</DialogTitle>
      <DialogContent sx={{ height: 400 }}>
        <PageableGridContent<UserDto> ref={gridRef} datasource={dataSource} columns={columnDefs} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>닫기</Button>
      </DialogActions>
    </Dialog>
  );
}
