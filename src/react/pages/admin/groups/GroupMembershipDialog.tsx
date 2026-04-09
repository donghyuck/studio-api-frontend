import { useCallback, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import { DeleteOutlined, GroupAddOutlined, SearchOutlined } from "@mui/icons-material";
import type { ColDef } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { AgGridCompatibleDataSource, PageableGridContentHandle } from "@/react/components/ag-grid/types";
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

class GroupMemberSummariesDataSource implements AgGridCompatibleDataSource<GroupMemberDto> {
  isLoaded = false;
  loading = false;
  error: unknown = null;
  dataItems: GroupMemberDto[] = [];
  total = 0;
  pageSize = 20;
  page = 0;
  private q = "";

  constructor(private readonly groupId: number) {}

  setPage(page: number) {
    this.page = page;
  }

  setPageSize(size: number) {
    this.pageSize = size;
  }

  setSort() {}

  setSearch(q?: string) {
    this.q = (q ?? "").trim();
  }

  setFilter(q?: string) {
    this.setSearch(q);
  }

  applyFilter(filter?: Record<string, unknown>) {
    this.q = String(filter?.q ?? "").trim();
  }

  async fetch() {
    this.loading = true;
    try {
      const response = await reactGroupsApi.getMemberSummaries(this.groupId, {
        q: this.q || undefined,
        page: this.page,
        size: this.pageSize,
      });
      this.dataItems = response.content ?? [];
      this.total = response.totalElements ?? 0;
      this.isLoaded = true;
    } catch (error) {
      this.error = error;
      throw error;
    } finally {
      this.loading = false;
    }
  }

  async fetchForAgGrid({
    startRow,
    endRow,
  }: {
    startRow: number;
    endRow: number;
  }) {
    const size = endRow - startRow || this.pageSize;
    const page = Math.floor(startRow / size);
    const response = await reactGroupsApi.getMemberSummaries(this.groupId, {
      q: this.q || undefined,
      page,
      size,
    });

    return {
      rows: response.content ?? [],
      total: response.totalElements ?? 0,
    };
  }
}

export function GroupMembershipDialog({ open, onClose, groupId, groupName }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const gridRef = useRef<PageableGridContentHandle<GroupMemberDto>>(null);
  const [saving, setSaving] = useState(false);
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const dataSource = useMemo(() => new GroupMemberSummariesDataSource(groupId), [groupId]);

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
        field: "enabled",
        headerName: "활성화",
        width: 96,
        maxWidth: 96,
        filter: false,
        sortable: false,
        cellRenderer: (params) => (
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
    ],
    []
  );

  const handleSearch = useCallback(() => {
    dataSource.applyFilter(
      searchInput.trim() ? { q: searchInput.trim() } : {}
    );
    gridRef.current?.refresh();
  }, [dataSource, searchInput]);

  async function handleAdd(selectedUsers: UserDto[]) {
    const userIds = Array.from(
      new Set(
        selectedUsers
          .map((user) => user.userId)
          .filter((userId): userId is number => typeof userId === "number")
      )
    );

    if (userIds.length === 0) {
      toast.info("추가할 멤버가 없습니다.");
      return;
    }

    setSaving(true);
    try {
      await reactGroupsApi.addMembers(groupId, userIds);
      gridRef.current?.refresh();
      toast.success(`${userIds.length}명의 멤버가 추가되었습니다.`);
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
      gridRef.current?.refresh();
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
        <DialogContent sx={{ height: 560 }}>
          <Stack spacing={1} sx={{ mt: 1, height: "100%" }}>
            <TextField
              label="이름, 아이디, 이메일 검색"
              size="small"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
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
            <PageableGridContent<GroupMemberDto>
              ref={gridRef}
              datasource={dataSource}
              columns={columnDefs}
              rowSelection="multiple"
              height={430}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Box sx={{ display: "flex", gap: 1, mr: "auto" }}>
            <Button
              variant="outlined"
              startIcon={<GroupAddOutlined />}
              onClick={() => setUserSearchOpen(true)}
              disabled={saving}
            >
              멤버 추가
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteOutlined />}
              onClick={() => void handleRemoveSelected()}
              disabled={saving || (gridRef.current?.selectedRows().length ?? 0) === 0}
            >
              선택 멤버 제거
            </Button>
          </Box>
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
