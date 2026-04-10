import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { SearchOutlined } from "@mui/icons-material";
import type {
  ColDef,
  ICellRendererParams,
  SelectionChangedEvent,
} from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type {
  AgGridCompatibleDataSource,
  PageableGridContentHandle,
} from "@/react/components/ag-grid/types";
import { useConfirm, useToast } from "@/react/feedback";
import { reactRolesApi } from "./api";
import type { UserDto } from "@/types/studio/user";
import { API_BASE_URL } from "@/config/backend";
import NO_AVATAR from "@/assets/images/users/no-avatar.png";

interface Props {
  open: boolean;
  onClose: () => void;
  roleId: number;
  roleName: string;
}

const GRID_HEIGHT = 240;

class CandidateUsersDataSource implements AgGridCompatibleDataSource<UserDto> {
  isLoaded = false;
  loading = false;
  error: unknown = null;
  dataItems: UserDto[] = [];
  total = 0;
  pageSize = 15;
  page = 0;
  private q = "";

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
      const response = await reactRolesApi.searchUsers({
        q: this.q || undefined,
        page: this.page,
        size: this.pageSize,
      });
      this.dataItems = response.content ?? [];
      this.total = response.totalElements ?? 0;
      this.isLoaded = true;
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
    const response = await reactRolesApi.searchUsers({
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

class GrantedUsersDataSource implements AgGridCompatibleDataSource<UserDto> {
  isLoaded = false;
  loading = false;
  error: unknown = null;
  dataItems: UserDto[] = [];
  total = 0;
  pageSize = 15;
  page = 0;

  constructor(
    private readonly users: UserDto[],
    private readonly q: string
  ) {}

  setPage(page: number) {
    this.page = page;
  }

  setPageSize(size: number) {
    this.pageSize = size;
  }

  setSort() {}
  setSearch() {}
  setFilter() {}
  applyFilter() {}

  private filterUsers() {
    const keyword = this.q.trim().toLowerCase();
    if (!keyword) {
      return this.users;
    }

    return this.users.filter((user) =>
      [user.username, user.name, user.email]
        .filter((value): value is string => typeof value === "string")
        .some((value) => value.toLowerCase().includes(keyword))
    );
  }

  async fetch() {
    const filtered = this.filterUsers();
    const start = this.page * this.pageSize;
    const end = start + this.pageSize;
    this.dataItems = filtered.slice(start, end);
    this.total = filtered.length;
    this.isLoaded = true;
  }

  async fetchForAgGrid({
    startRow,
    endRow,
  }: {
    startRow: number;
    endRow: number;
  }) {
    const filtered = this.filterUsers();
    return {
      rows: filtered.slice(startRow, endRow),
      total: filtered.length,
    };
  }
}

function UsersGridSkeleton() {
  return (
    <Stack spacing={1}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} variant="rounded" height={40} />
      ))}
    </Stack>
  );
}

function renderUserChip(params: ICellRendererParams<UserDto>) {
  return (
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
  );
}

export function RoleGrantedUsersDialog({
  open,
  onClose,
  roleId,
  roleName,
}: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const candidatesGridRef = useRef<PageableGridContentHandle<UserDto>>(null);
  const grantedGridRef = useRef<PageableGridContentHandle<UserDto>>(null);
  const candidatesDataSource = useMemo(() => new CandidateUsersDataSource(), []);
  const [grantedUsers, setGrantedUsers] = useState<UserDto[]>([]);
  const [loadingGranted, setLoadingGranted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [candidateSearchInput, setCandidateSearchInput] = useState("");
  const [grantedSearchInput, setGrantedSearchInput] = useState("");
  const [candidateGridKey, setCandidateGridKey] = useState(0);
  const [grantedGridKey, setGrantedGridKey] = useState(0);
  const [selectedCandidateCount, setSelectedCandidateCount] = useState(0);
  const [selectedGrantedCount, setSelectedGrantedCount] = useState(0);

  const grantedUserIds = useMemo(
    () => new Set(grantedUsers.map((user) => user.userId)),
    [grantedUsers]
  );

  const grantedDataSource = useMemo(
    () => new GrantedUsersDataSource(grantedUsers, grantedSearchInput),
    [grantedUsers, grantedSearchInput]
  );

  const userColumns = useMemo<ColDef<UserDto>[]>(
    () => [
      {
        field: "username",
        headerName: "아이디",
        flex: 0.9,
        filter: false,
        sortable: false,
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
      { field: "name", headerName: "이름", flex: 0.8, filter: false, sortable: false },
      { field: "email", headerName: "메일", flex: 1.1, filter: false, sortable: false },
      {
        field: "enabled",
        headerName: "활성화",
        width: 96,
        maxWidth: 96,
        filter: false,
        sortable: false,
        cellRenderer: renderUserChip,
        cellStyle: { textAlign: "center" },
      },
    ],
    []
  );

  const grantedEvents = useMemo(
    () => [
      {
        type: "selectionChanged",
        listener: (event: SelectionChangedEvent<UserDto>) =>
          setSelectedGrantedCount(event.api.getSelectedRows().length ?? 0),
      },
    ],
    []
  );

  const candidateEvents = useMemo(
    () => [
      {
        type: "selectionChanged",
        listener: (event: SelectionChangedEvent<UserDto>) =>
          setSelectedCandidateCount(event.api.getSelectedRows().length ?? 0),
      },
    ],
    []
  );

  const resetSelection = useCallback(() => {
    setSelectedCandidateCount(0);
    setSelectedGrantedCount(0);
    candidatesGridRef.current?.deselectAll();
    grantedGridRef.current?.deselectAll();
  }, []);

  const loadGrantedUsers = useCallback(async () => {
    setLoadingGranted(true);
    try {
      const data = await reactRolesApi.getGrantedUsers(roleId);
      setGrantedUsers(Array.isArray(data) ? data : []);
      setGrantedGridKey((current) => current + 1);
    } catch {
      toast.error("부여된 사용자 목록 로딩 실패");
    } finally {
      setLoadingGranted(false);
    }
  }, [roleId, toast]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setCandidateSearchInput("");
    setGrantedSearchInput("");
    setCandidateGridKey(0);
    resetSelection();
    void loadGrantedUsers();
  }, [open, loadGrantedUsers, resetSelection]);

  const handleCandidateSearch = useCallback(() => {
    const trimmed = candidateSearchInput.trim();
    candidatesDataSource.applyFilter(trimmed ? { q: trimmed } : {});
    setSelectedCandidateCount(0);
    setCandidateGridKey((current) => current + 1);
  }, [candidateSearchInput, candidatesDataSource]);

  const handleGrantedSearch = useCallback(() => {
    setSelectedGrantedCount(0);
    setGrantedGridKey((current) => current + 1);
  }, []);

  async function handleAssign() {
    const selectedUsers = candidatesGridRef.current?.selectedRows() ?? [];
    const userIds = Array.from(
      new Set(
        selectedUsers
          .map((user) => user.userId)
          .filter(
            (userId): userId is number =>
              typeof userId === "number" && !grantedUserIds.has(userId)
          )
      )
    );

    if (userIds.length === 0) {
      toast.info("부여할 사용자가 없습니다.");
      return;
    }

    const ok = await confirm({
      title: "권한 부여 확인",
      message: `선택된 사용자 ${userIds.length}명에게 "${roleName}" 권한을 부여하시겠습니까?`,
      okText: "확인",
      cancelText: "취소",
    });
    if (!ok) {
      return;
    }

    setSaving(true);
    try {
      await reactRolesApi.assignUsers(roleId, userIds);
      toast.success(`${userIds.length}명의 사용자에게 권한을 부여했습니다.`);
      resetSelection();
      await loadGrantedUsers();
      setCandidateGridKey((current) => current + 1);
    } catch {
      toast.error("사용자 권한 부여에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke() {
    const selectedUsers = grantedGridRef.current?.selectedRows() ?? [];
    const userIds = Array.from(
      new Set(
        selectedUsers
          .map((user) => user.userId)
          .filter((userId): userId is number => typeof userId === "number")
      )
    );

    if (userIds.length === 0) {
      return;
    }

    const ok = await confirm({
      title: "권한 회수 확인",
      message: `선택된 사용자 ${userIds.length}명에게서 "${roleName}" 권한을 회수하시겠습니까?`,
      okText: "확인",
      cancelText: "취소",
    });
    if (!ok) {
      return;
    }

    setSaving(true);
    try {
      await reactRolesApi.revokeUsers(roleId, userIds);
      toast.success(`${userIds.length}명의 사용자 권한을 회수했습니다.`);
      resetSelection();
      await loadGrantedUsers();
      setCandidateGridKey((current) => current + 1);
    } catch {
      toast.error("사용자 권한 회수에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="lg"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3 } } }}
    >
      <DialogTitle>사용자 권한 관리 — {roleName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="info">
            검색 결과에서 사용자를 선택해 현재 역할을 부여하고, 아래 목록에서 현재 권한이 부여된 사용자를 선택해 회수할 수 있습니다.
          </Alert>

          <Stack spacing={1}>
            <Typography variant="subtitle2">권한 부여 대상 검색</Typography>
            <TextField
              label="이름, 아이디, 이메일 검색"
              size="small"
              value={candidateSearchInput}
              onChange={(event) => setCandidateSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleCandidateSearch();
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
                      onClick={handleCandidateSearch}
                    >
                      검색
                    </Button>
                  ),
                },
              }}
            />
            <PageableGridContent<UserDto>
              key={candidateGridKey}
              ref={candidatesGridRef}
              datasource={candidatesDataSource}
              columns={userColumns}
              events={candidateEvents}
              rowSelection="multiple"
              height={GRID_HEIGHT}
            />
          </Stack>

          <Stack spacing={1}>
            <Typography variant="subtitle2">현재 권한이 부여된 사용자</Typography>
            <TextField
              label="현재 부여 사용자 검색"
              size="small"
              value={grantedSearchInput}
              onChange={(event) => setGrantedSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleGrantedSearch();
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
                      onClick={handleGrantedSearch}
                    >
                      검색
                    </Button>
                  ),
                },
              }}
            />
            {loadingGranted ? (
              <UsersGridSkeleton />
            ) : (
              <PageableGridContent<UserDto>
                key={grantedGridKey}
                ref={grantedGridRef}
                datasource={grantedDataSource}
                columns={userColumns}
                events={grantedEvents}
                rowSelection="multiple"
                height={GRID_HEIGHT}
              />
            )}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Box sx={{ display: "flex", gap: 1, mr: "auto" }}>
          <Button
            variant="outlined"
            onClick={() => void handleAssign()}
            disabled={saving || selectedCandidateCount === 0}
          >
            Assign Role
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={() => void handleRevoke()}
            disabled={saving || selectedGrantedCount === 0}
          >
            Revoke Role
          </Button>
        </Box>
        <Button variant="outlined" onClick={onClose} disabled={saving}>
          닫기
        </Button>
      </DialogActions>
    </Dialog>
  );
}
