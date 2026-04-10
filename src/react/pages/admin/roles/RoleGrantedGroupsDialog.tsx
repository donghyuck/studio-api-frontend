import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
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
import type { ColDef, SelectionChangedEvent } from "ag-grid-community";
import type { GroupDto } from "@/react/pages/admin/datasource";
import { PageableGridContent } from "@/react/components/ag-grid";
import type {
  AgGridCompatibleDataSource,
  PageableGridContentHandle,
} from "@/react/components/ag-grid/types";
import { useConfirm, useToast } from "@/react/feedback";
import { reactRolesApi, type GrantedGroupDto } from "./api";

interface Props {
  open: boolean;
  onClose: () => void;
  roleId: number;
  roleName: string;
}

const GRID_HEIGHT = 240;

class CandidateGroupsDataSource implements AgGridCompatibleDataSource<GroupDto> {
  isLoaded = false;
  loading = false;
  error: unknown = null;
  dataItems: GroupDto[] = [];
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
      const response = await reactRolesApi.searchGroups({
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
    const response = await reactRolesApi.searchGroups({
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

class GrantedGroupsDataSource implements AgGridCompatibleDataSource<GrantedGroupDto> {
  isLoaded = false;
  loading = false;
  error: unknown = null;
  dataItems: GrantedGroupDto[] = [];
  total = 0;
  pageSize = 15;
  page = 0;

  constructor(
    private readonly groups: GrantedGroupDto[],
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

  private filterGroups() {
    const keyword = this.q.trim().toLowerCase();
    if (!keyword) {
      return this.groups;
    }

    return this.groups.filter((group) =>
      [group.name, group.description]
        .filter((value): value is string => typeof value === "string")
        .some((value) => value.toLowerCase().includes(keyword))
    );
  }

  async fetch() {
    const filtered = this.filterGroups();
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
    const filtered = this.filterGroups();
    return {
      rows: filtered.slice(startRow, endRow),
      total: filtered.length,
    };
  }
}

function GroupsGridSkeleton() {
  return (
    <Stack spacing={1}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} variant="rounded" height={40} />
      ))}
    </Stack>
  );
}

export function RoleGrantedGroupsDialog({
  open,
  onClose,
  roleId,
  roleName,
}: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const candidatesGridRef = useRef<PageableGridContentHandle<GroupDto>>(null);
  const grantedGridRef = useRef<PageableGridContentHandle<GrantedGroupDto>>(null);
  const candidatesDataSource = useMemo(() => new CandidateGroupsDataSource(), []);
  const [grantedGroups, setGrantedGroups] = useState<GrantedGroupDto[]>([]);
  const [loadingGranted, setLoadingGranted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [candidateSearchInput, setCandidateSearchInput] = useState("");
  const [grantedSearchInput, setGrantedSearchInput] = useState("");
  const [candidateGridKey, setCandidateGridKey] = useState(0);
  const [grantedGridKey, setGrantedGridKey] = useState(0);
  const [selectedCandidateCount, setSelectedCandidateCount] = useState(0);
  const [selectedGrantedCount, setSelectedGrantedCount] = useState(0);

  const grantedGroupIds = useMemo(
    () => new Set(grantedGroups.map((group) => group.groupId)),
    [grantedGroups]
  );

  const grantedDataSource = useMemo(
    () => new GrantedGroupsDataSource(grantedGroups, grantedSearchInput),
    [grantedGroups, grantedSearchInput]
  );

  const groupColumns = useMemo<ColDef<GroupDto | GrantedGroupDto>[]>(
    () => [
      { field: "name", headerName: "이름", flex: 0.8, filter: false, sortable: false },
      {
        field: "description",
        headerName: "설명",
        flex: 1.1,
        filter: false,
        sortable: false,
        valueGetter: (params) => params.data?.description ?? "",
      },
      {
        field: "memberCount",
        headerName: "멤버",
        width: 90,
        maxWidth: 90,
        filter: false,
        sortable: false,
        valueGetter: (params) => params.data?.memberCount ?? "",
        cellStyle: { textAlign: "center" },
      },
    ],
    []
  );

  const candidateEvents = useMemo(
    () => [
      {
        type: "selectionChanged",
        listener: (event: SelectionChangedEvent<GroupDto>) =>
          setSelectedCandidateCount(event.api.getSelectedRows().length ?? 0),
      },
    ],
    []
  );

  const grantedEvents = useMemo(
    () => [
      {
        type: "selectionChanged",
        listener: (event: SelectionChangedEvent<GrantedGroupDto>) =>
          setSelectedGrantedCount(event.api.getSelectedRows().length ?? 0),
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

  const loadGrantedGroups = useCallback(async () => {
    setLoadingGranted(true);
    try {
      const data = await reactRolesApi.getGrantedGroups(roleId);
      setGrantedGroups(Array.isArray(data) ? data : []);
      setGrantedGridKey((current) => current + 1);
    } catch {
      toast.error("부여된 그룹 목록 로딩 실패");
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
    void loadGrantedGroups();
  }, [open, loadGrantedGroups, resetSelection]);

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
    const selectedGroups = candidatesGridRef.current?.selectedRows() ?? [];
    const groupIds = Array.from(
      new Set(
        selectedGroups
          .map((group) => group.groupId)
          .filter(
            (groupId): groupId is number =>
              typeof groupId === "number" && !grantedGroupIds.has(groupId)
          )
      )
    );

    if (groupIds.length === 0) {
      toast.info("부여할 그룹이 없습니다.");
      return;
    }

    const ok = await confirm({
      title: "권한 부여 확인",
      message: `선택된 그룹 ${groupIds.length}곳에 "${roleName}" 권한을 부여하시겠습니까?`,
      okText: "확인",
      cancelText: "취소",
    });
    if (!ok) {
      return;
    }

    setSaving(true);
    try {
      await reactRolesApi.assignGroups(roleId, groupIds);
      toast.success(`${groupIds.length}개 그룹에 권한을 부여했습니다.`);
      resetSelection();
      await loadGrantedGroups();
      setCandidateGridKey((current) => current + 1);
    } catch {
      toast.error("그룹 권한 부여에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke() {
    const selectedGroups = grantedGridRef.current?.selectedRows() ?? [];
    const groupIds = Array.from(
      new Set(
        selectedGroups
          .map((group) => group.groupId)
          .filter((groupId): groupId is number => typeof groupId === "number")
      )
    );

    if (groupIds.length === 0) {
      return;
    }

    const ok = await confirm({
      title: "권한 회수 확인",
      message: `선택된 그룹 ${groupIds.length}곳에서 "${roleName}" 권한을 회수하시겠습니까?`,
      okText: "확인",
      cancelText: "취소",
    });
    if (!ok) {
      return;
    }

    setSaving(true);
    try {
      await reactRolesApi.revokeGroups(roleId, groupIds);
      toast.success(`${groupIds.length}개 그룹의 권한을 회수했습니다.`);
      resetSelection();
      await loadGrantedGroups();
      setCandidateGridKey((current) => current + 1);
    } catch {
      toast.error("그룹 권한 회수에 실패했습니다.");
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
      <DialogTitle>그룹 권한 관리 — {roleName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="info">
            검색 결과에서 그룹을 선택해 현재 역할을 부여하고, 아래 목록에서 현재 권한이 부여된 그룹을 선택해 회수할 수 있습니다.
          </Alert>

          <Stack spacing={1}>
            <Typography variant="subtitle2">권한 부여 대상 그룹 검색</Typography>
            <TextField
              label="이름, 설명 검색"
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
            <PageableGridContent<GroupDto>
              key={candidateGridKey}
              ref={candidatesGridRef}
              datasource={candidatesDataSource}
              columns={groupColumns as ColDef<GroupDto>[]}
              events={candidateEvents}
              rowSelection="multiple"
              height={GRID_HEIGHT}
            />
          </Stack>

          <Stack spacing={1}>
            <Typography variant="subtitle2">현재 권한이 부여된 그룹</Typography>
            <TextField
              label="현재 부여 그룹 검색"
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
              <GroupsGridSkeleton />
            ) : (
              <PageableGridContent<GrantedGroupDto>
                key={grantedGridKey}
                ref={grantedGridRef}
                datasource={grantedDataSource}
                columns={groupColumns as ColDef<GrantedGroupDto>[]}
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
