import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
} from "@mui/material";
import { DeleteOutlined, GroupAddOutlined } from "@mui/icons-material";
import type { ColDef } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { useConfirm, useToast } from "@/react/feedback";
import { reactGroupsApi, type GroupMemberDto } from "./api";
import { UserSearchDialog } from "@/react/pages/admin/UserSearchDialog";
import type { UserDto } from "@/types/studio/user";

interface Props {
  open: boolean;
  onClose: () => void;
  groupId: number;
  groupName: string;
}

class GroupMembersDialogDataSource {
  isLoaded = true;
  loading = false;
  error: unknown = null;
  dataItems: GroupMemberDto[] = [];
  total = 0;
  pageSize = 15;
  page = 0;

  setItems(items: GroupMemberDto[]) {
    this.dataItems = items;
    this.total = items.length;
  }

  setPage(page: number) {
    this.page = page;
  }

  setPageSize(size: number) {
    this.pageSize = size;
  }

  setSort() {}

  setFilter() {}

  setSearch() {}

  applyFilter() {}

  async fetch() {}

  async fetchForAgGrid({
    startRow,
    endRow,
  }: {
    startRow: number;
    endRow: number;
  }) {
    return {
      rows: this.dataItems.slice(startRow, endRow),
      total: this.total,
    };
  }
}

export function GroupMembershipDialog({ open, onClose, groupId, groupName }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const gridRef = useRef<PageableGridContentHandle<GroupMemberDto>>(null);
  const [members, setMembers] = useState<GroupMemberDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const dataSource = useMemo(() => new GroupMembersDialogDataSource(), []);

  dataSource.setItems(members);

  const memberIds = useMemo(() => new Set(members.map((member) => member.userId)), [members]);

  const columnDefs = useMemo<ColDef<GroupMemberDto>[]>(
    () => [
      {
        field: "userId",
        headerName: "ID",
        maxWidth: 90,
        filter: false,
        sortable: false,
        type: "number",
      },
      {
        field: "name",
        headerName: "이름",
        flex: 1,
        filter: false,
        sortable: false,
      },
      {
        field: "username",
        headerName: "아이디",
        flex: 1,
        filter: false,
        sortable: false,
      },
      {
        field: "email",
        headerName: "이메일",
        flex: 1.2,
        filter: false,
        sortable: false,
      },
    ],
    []
  );

  async function loadMembers() {
    setLoading(true);
    try {
      const data = await reactGroupsApi.getMembers(groupId);
      setMembers(Array.isArray(data) ? data : []);
    } catch {
      toast.error("멤버 목록 로딩 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      void loadMembers();
    }
  }, [open, groupId]);

  async function handleAdd(selectedUsers: UserDto[]) {
    const usersToAdd = selectedUsers.filter((user) => !memberIds.has(user.userId));

    if (usersToAdd.length === 0) {
      toast.info("추가할 멤버가 없습니다.");
      return;
    }

    setSaving(true);
    try {
      await reactGroupsApi.addMembers(
        groupId,
        usersToAdd.map((user) => user.userId)
      );
      await loadMembers();
      toast.success(`${usersToAdd.length}명의 멤버가 추가되었습니다.`);
    } catch {
      toast.error("멤버 추가에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveSelected() {
    const selectedRows = gridRef.current?.selectedRows() ?? [];
    const userIds = selectedRows
      .map((member) => member.userId)
      .filter((userId): userId is number => typeof userId === "number");

    if (userIds.length === 0) {
      return;
    }

    const ok = await confirm({
      title: "삭제 확인",
      message: "선택된 사용자를 그룹에서 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
      okText: "확인",
      cancelText: "취소",
    });
    if (!ok) {
      return;
    }

    setSaving(true);
    try {
      await Promise.all(userIds.map((userId) => reactGroupsApi.removeMember(groupId, userId)));
      await loadMembers();
      toast.success(`${userIds.length}명의 멤버가 제거되었습니다.`);
    } catch {
      toast.error("멤버 제거에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
        <DialogTitle>멤버 관리 — {groupName}</DialogTitle>
        <DialogContent sx={{ height: 520 }}>
          <Stack spacing={1} sx={{ mt: 1, height: "100%" }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<GroupAddOutlined />}
              onClick={() => setUserSearchOpen(true)}
              sx={{ alignSelf: "flex-start" }}
            >
              멤버 추가
            </Button>
            {loading ? (
              <CircularProgress size={24} />
            ) : (
              <PageableGridContent<GroupMemberDto>
                ref={gridRef}
                datasource={dataSource}
                columns={columnDefs}
                rowSelection="multiple"
                height={420}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteOutlined />}
            onClick={() => void handleRemoveSelected()}
            disabled={saving || (gridRef.current?.selectedRows().length ?? 0) === 0}
          >
            선택 멤버 제거
          </Button>
          <Button variant="outlined" onClick={onClose} disabled={saving}>
            닫기
          </Button>
        </DialogActions>
      </Dialog>
      <UserSearchDialog
        open={userSearchOpen}
        onClose={() => setUserSearchOpen(false)}
        selectionMode="multiple"
        confirmLabel={saving ? "추가 중..." : "추가"}
        onConfirmSelection={(users) => void handleAdd(users)}
      />
    </>
  );
}
