import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Avatar,
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
import type { ColDef, SelectionChangedEvent } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { AgGridCompatibleDataSource, PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { useConfirm, useToast } from "@/react/feedback";
import { reactGroupsApi, type GroupMemberDto } from "./api";
import { UserSearchDialog } from "@/react/pages/admin/UserSearchDialog";
import type { UserDto } from "@/types/studio/user";
import { API_BASE_URL } from "@/config/backend";
import NO_AVATAR from "@/assets/images/users/no-avatar.png";

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

function SelectionCheckbox({
  checked,
  indeterminate = false,
  ariaLabel,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  ariaLabel: string;
  onChange: (checked: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={inputRef}
      type="checkbox"
      aria-label={ariaLabel}
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      onClick={(event) => event.stopPropagation()}
      style={{
        width: 16,
        height: 16,
        margin: 0,
        accentColor: "#1565c0",
        cursor: "pointer",
      }}
    />
  );
}

function getDisplayedSelectionState(api: {
  getLastDisplayedRowIndex: () => number;
  getDisplayedRowAtIndex: (index: number) => { isSelected: () => boolean; setSelected: (selected: boolean) => void } | undefined;
}) {
  const lastIndex = api.getLastDisplayedRowIndex();
  if (lastIndex < 0) {
    return { displayedCount: 0, selectedCount: 0 };
  }

  let displayedCount = 0;
  let selectedCount = 0;
  for (let index = 0; index <= lastIndex; index += 1) {
    const row = api.getDisplayedRowAtIndex(index);
    if (!row) continue;
    displayedCount += 1;
    if (row.isSelected()) selectedCount += 1;
  }
  return { displayedCount, selectedCount };
}

function toggleDisplayedRows(
  api: {
    getLastDisplayedRowIndex: () => number;
    getDisplayedRowAtIndex: (index: number) => { isSelected: () => boolean; setSelected: (selected: boolean) => void } | undefined;
  },
  selected: boolean
) {
  const lastIndex = api.getLastDisplayedRowIndex();
  for (let index = 0; index <= lastIndex; index += 1) {
    api.getDisplayedRowAtIndex(index)?.setSelected(selected);
  }
}

export function GroupMembershipDialog({ open, onClose, groupId, groupName }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const gridRef = useRef<PageableGridContentHandle<GroupMemberDto>>(null);
  const [saving, setSaving] = useState(false);
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [gridKey, setGridKey] = useState(0);
  const [selectedCount, setSelectedCount] = useState(0);
  const [displayedCount, setDisplayedCount] = useState(0);
  const dataSource = useMemo(() => new GroupMemberSummariesDataSource(groupId), [groupId]);

  function renderHeaderCheckbox(api?: {
    getLastDisplayedRowIndex: () => number;
    getDisplayedRowAtIndex: (index: number) => { isSelected: () => boolean; setSelected: (selected: boolean) => void } | undefined;
  }) {
    const currentState = api
      ? getDisplayedSelectionState(api)
      : { displayedCount, selectedCount };
    const allDisplayedSelected =
      currentState.displayedCount > 0 &&
      currentState.selectedCount === currentState.displayedCount;
    const partiallySelected =
      currentState.selectedCount > 0 &&
      currentState.selectedCount < currentState.displayedCount;

    return (
      <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <SelectionCheckbox
          ariaLabel="전체 선택"
          checked={allDisplayedSelected}
          indeterminate={partiallySelected}
          onChange={() => {
            if (api) {
              toggleDisplayedRows(api, !allDisplayedSelected);
            }
          }}
        />
      </Box>
    );
  }

  const columnDefs = useMemo<ColDef<GroupMemberDto>[]>(
    () => [
      {
        colId: "rowSelect",
        headerName: "",
        width: 40,
        minWidth: 40,
        maxWidth: 40,
        pinned: "left",
        sortable: false,
        resizable: false,
        suppressMovable: true,
        lockPosition: true,
        cellClass: "selection-column-centered",
        headerClass: "selection-column-centered",
        headerComponent: (props: {
          api: {
            getLastDisplayedRowIndex: () => number;
            getDisplayedRowAtIndex: (index: number) => { isSelected: () => boolean; setSelected: (selected: boolean) => void } | undefined;
          };
        }) => renderHeaderCheckbox(props.api),
        cellRenderer: (params) => {
          const checked = params.node.isSelected();

          return (
            <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
              <SelectionCheckbox
                ariaLabel="행 선택"
                checked={checked}
                onChange={(nextChecked) => params.node.setSelected(nextChecked)}
              />
            </Box>
          );
        },
      },
      {
        field: "username",
        headerName: "아이디",
        flex: 1,
        filter: false,
        sortable: false,
        cellRenderer: (params) => (
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
      {
        field: "name",
        headerName: "이름",
        flex: 1,
        filter: false,
        sortable: false,
      },
      {
        field: "email",
        headerName: "메일",
        flex: 1.2,
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
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    borderColor: "primary.dark",
                  }
                : {}),
            }}
          />
        ),
        cellStyle: { textAlign: "center" },
      },
    ],
    [displayedCount, selectedCount]
  );

  const handleSearch = useCallback(() => {
    dataSource.applyFilter(
      searchInput.trim() ? { q: searchInput.trim() } : {}
    );
    setSelectedCount(0);
    setGridKey((current) => current + 1);
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
      setSelectedCount(0);
      setGridKey((current) => current + 1);
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
      await reactGroupsApi.removeMembers(groupId, userIds);
      setSelectedCount(0);
      setGridKey((current) => current + 1);
      toast.success(`${userIds.length}명의 멤버가 제거되었습니다.`);
    } catch {
      toast.error("멤버 제거에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle>멤버 관리 — {groupName}</DialogTitle>
        <DialogContent
          sx={{
            height: "min(70vh, 620px)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Stack spacing={1} sx={{ mt: 1, minHeight: 0, flex: 1 }}>
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
              key={gridKey}
              ref={gridRef}
              datasource={dataSource}
              columns={columnDefs}
              events={[
                {
                  type: "selectionChanged",
                  listener: (event: SelectionChangedEvent<GroupMemberDto>) => {
                    setSelectedCount(event.api.getSelectedRows().length ?? 0);
                    setDisplayedCount(event.api.getDisplayedRowCount());
                    event.api.refreshHeader?.();
                  },
                },
                {
                  type: "modelUpdated",
                  listener: (event: {
                    api: { getDisplayedRowCount: () => number; refreshHeader?: () => void };
                  }) => {
                    setDisplayedCount(event.api.getDisplayedRowCount());
                    event.api.refreshHeader?.();
                  },
                },
              ]}
              rowSelection={{
                mode: "multiRow",
                enableClickSelection: false,
                checkboxes: false,
                headerCheckbox: false,
              }}
              options={{ suppressRowClickSelection: true }}
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
              disabled={saving || selectedCount === 0}
            >
              선택 멤버 제거
            </Button>
          </Box>
          <Button
            variant="outlined"
            onClick={onClose}
            disabled={saving}
          >
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
