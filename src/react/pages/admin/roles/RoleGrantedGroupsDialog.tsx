import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowBackOutlined, ArrowForwardOutlined } from "@mui/icons-material";
import type { GroupDto } from "@/react/pages/admin/datasource";
import { useConfirm, useToast } from "@/react/feedback";
import { reactRolesApi, type GrantedGroupDto } from "./api";

interface Props {
  open: boolean;
  onClose: () => void;
  roleId: number;
  roleName: string;
}

const TRANSFER_SECTION_MIN_HEIGHT = 300;
const GROUP_LIST_MAX_HEIGHT = 220;

type TransferGroup = {
  groupId: number;
  name: string;
  description?: string | null;
  memberCount?: number;
};

function byName(left: { name: string }, right: { name: string }) {
  return left.name.localeCompare(right.name);
}

function GroupsListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Stack spacing={1}>
      <Skeleton variant="rounded" height={40} />
      <Divider />
      <Stack spacing={0.75}>
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} variant="rounded" height={48} />
        ))}
      </Stack>
    </Stack>
  );
}

function toTransferGroup(group: GroupDto | GrantedGroupDto): TransferGroup {
  return {
    groupId: group.groupId,
    name: group.name,
    description: group.description,
    memberCount: group.memberCount,
  };
}

function sameIds(left: TransferGroup[], right: TransferGroup[]) {
  const leftIds = left.map((group) => group.groupId).sort((a, b) => a - b);
  const rightIds = right.map((group) => group.groupId).sort((a, b) => a - b);
  return (
    leftIds.length === rightIds.length &&
    leftIds.every((groupId, index) => groupId === rightIds[index])
  );
}

export function RoleGrantedGroupsDialog({ open, onClose, roleId, roleName }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [allGroups, setAllGroups] = useState<TransferGroup[]>([]);
  const [grantedGroups, setGrantedGroups] = useState<TransferGroup[]>([]);
  const [initialGrantedGroups, setInitialGrantedGroups] = useState<TransferGroup[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<number[]>([]);
  const [selectedRight, setSelectedRight] = useState<number[]>([]);
  const [searchLeft, setSearchLeft] = useState("");
  const [searchRight, setSearchRight] = useState("");

  function resetTransferState() {
    setLoaded(false);
    setAllGroups([]);
    setGrantedGroups([]);
    setInitialGrantedGroups([]);
    setSelectedLeft([]);
    setSelectedRight([]);
    setSearchLeft("");
    setSearchRight("");
  }

  async function loadData() {
    resetTransferState();
    setLoading(true);
    try {
      const [groupsResponse, grantedResponse] = await Promise.all([
        reactRolesApi.searchGroups({ page: 0, size: 200 }),
        reactRolesApi.getGrantedGroups(roleId),
      ]);
      const groups = (groupsResponse.content ?? []).map(toTransferGroup).sort(byName);
      const granted = (Array.isArray(grantedResponse) ? grantedResponse : [])
        .map((group) => {
          const groupDetail = groups.find((candidate) => candidate.groupId === group.groupId);
          return {
            ...toTransferGroup(group),
            description: group.description ?? groupDetail?.description,
            memberCount: group.memberCount ?? groupDetail?.memberCount,
          };
        })
        .sort(byName);

      setAllGroups(groups);
      setGrantedGroups(granted);
      setInitialGrantedGroups(granted);
      setSelectedLeft([]);
      setSelectedRight([]);
      setSearchLeft("");
      setSearchRight("");
      setLoaded(true);
    } catch {
      resetTransferState();
      toast.error("그룹 권한 목록 로딩 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      void loadData();
    }
  }, [open, roleId]);

  const grantedGroupIds = useMemo(
    () => new Set(grantedGroups.map((group) => group.groupId)),
    [grantedGroups]
  );

  const availableGroups = useMemo(
    () =>
      allGroups
        .filter((group) => !grantedGroupIds.has(group.groupId))
        .filter((group) => {
          const keyword = searchLeft.trim().toLowerCase();
          if (!keyword) return true;
          return (
            group.name.toLowerCase().includes(keyword) ||
            String(group.groupId).includes(keyword) ||
            (group.description ?? "").toLowerCase().includes(keyword)
          );
        }),
    [allGroups, grantedGroupIds, searchLeft]
  );

  const filteredGrantedGroups = useMemo(
    () =>
      grantedGroups.filter((group) => {
        const keyword = searchRight.trim().toLowerCase();
        if (!keyword) return true;
        return (
          group.name.toLowerCase().includes(keyword) ||
          String(group.groupId).includes(keyword) ||
          (group.description ?? "").toLowerCase().includes(keyword)
        );
      }),
    [grantedGroups, searchRight]
  );

  function toggleSelected(
    selected: number[],
    setter: (value: number[]) => void,
    groupId: number
  ) {
    if (loading || saving || !loaded) return;
    setter(
      selected.includes(groupId)
        ? selected.filter((value) => value !== groupId)
        : [...selected, groupId]
    );
  }

  function moveToGranted() {
    if (loading || saving || !loaded) return;
    const nextGroups = allGroups.filter((group) => selectedLeft.includes(group.groupId));

    setGrantedGroups((current) =>
      [...current, ...nextGroups]
        .filter(
          (group, index, groups) =>
            groups.findIndex((candidate) => candidate.groupId === group.groupId) === index
        )
        .sort(byName)
    );
    setSelectedLeft([]);
  }

  function moveToAvailable() {
    if (loading || saving || !loaded) return;
    setGrantedGroups((current) =>
      current.filter((group) => !selectedRight.includes(group.groupId))
    );
    setSelectedRight([]);
  }

  async function handleSave() {
    if (loading || saving) return;
    if (!loaded) {
      toast.error("그룹 권한 목록을 먼저 불러와야 합니다.");
      return;
    }

    if (sameIds(initialGrantedGroups, grantedGroups)) {
      toast.info("변경된 그룹 권한이 없습니다.");
      onClose();
      return;
    }

    const initialIds = new Set(initialGrantedGroups.map((group) => group.groupId));
    const currentIds = new Set(grantedGroups.map((group) => group.groupId));
    const toAdd = grantedGroups.filter((group) => !initialIds.has(group.groupId));
    const toRemove = initialGrantedGroups.filter((group) => !currentIds.has(group.groupId));

    const ok = await confirm({
      title: "그룹 권한 변경 저장",
      message: `그룹 ${toAdd.length}곳에 권한을 부여하고, ${toRemove.length}곳에서 권한을 회수하시겠습니까?`,
      okText: "저장",
      cancelText: "취소",
    });
    if (!ok) return;

    setSaving(true);
    try {
      await Promise.all([
        reactRolesApi.assignGroups(roleId, toAdd.map((group) => group.groupId)),
        reactRolesApi.revokeGroups(roleId, toRemove.map((group) => group.groupId)),
      ]);
      toast.success("그룹 권한이 저장되었습니다.");
      onClose();
    } catch {
      toast.error("그룹 권한 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const interactionDisabled = loading || saving || !loaded;

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="md"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3 } } }}
    >
      <DialogTitle>그룹 권한 관리 — {roleName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="info">
            그룹에 현재 역할을 부여하거나 회수합니다. 변경 내용은 저장 시점에 반영됩니다.
          </Alert>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="stretch">
            <Card variant="outlined" sx={{ flex: 1, minWidth: 0 }}>
              <CardContent>
                <Stack spacing={1} sx={{ minHeight: TRANSFER_SECTION_MIN_HEIGHT }}>
                  <Typography variant="subtitle2">부여 가능한 그룹</Typography>
                  {loading ? (
                    <GroupsListSkeleton />
                  ) : (
                    <>
                      <TextField
                        label="그룹 검색"
                        size="small"
                        value={searchLeft}
                        onChange={(event) => setSearchLeft(event.target.value)}
                        disabled={saving || !loaded}
                        fullWidth
                      />
                      <Divider />
                      {availableGroups.length === 0 ? (
                        <Typography color="text.secondary" variant="body2">
                          선택 가능한 그룹 없음
                        </Typography>
                      ) : (
                        <List dense sx={{ maxHeight: GROUP_LIST_MAX_HEIGHT, overflowY: "auto" }}>
                          {availableGroups.map((group) => (
                            <ListItemButton
                              key={group.groupId}
                              selected={selectedLeft.includes(group.groupId)}
                              disabled={interactionDisabled}
                              onClick={() =>
                                toggleSelected(selectedLeft, setSelectedLeft, group.groupId)
                              }
                            >
                              <ListItemText
                                primary={group.name}
                                secondary={`ID: ${group.groupId}${group.description ? ` · ${group.description}` : ""}`}
                              />
                            </ListItemButton>
                          ))}
                        </List>
                      )}
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>

            <Stack
              direction={{ xs: "row", md: "column" }}
              spacing={1}
              justifyContent="center"
              alignItems="center"
            >
              <Button
                variant="outlined"
                startIcon={<ArrowForwardOutlined />}
                onClick={moveToGranted}
                disabled={interactionDisabled || selectedLeft.length === 0}
              >
                추가
              </Button>
              <Button
                variant="outlined"
                startIcon={<ArrowBackOutlined />}
                onClick={moveToAvailable}
                disabled={interactionDisabled || selectedRight.length === 0}
              >
                제거
              </Button>
            </Stack>

            <Card variant="outlined" sx={{ flex: 1, minWidth: 0 }}>
              <CardContent>
                <Stack spacing={1} sx={{ minHeight: TRANSFER_SECTION_MIN_HEIGHT }}>
                  <Typography variant="subtitle2">현재 권한이 부여된 그룹</Typography>
                  {loading ? (
                    <GroupsListSkeleton />
                  ) : (
                    <>
                      <TextField
                        label="부여 그룹 검색"
                        size="small"
                        value={searchRight}
                        onChange={(event) => setSearchRight(event.target.value)}
                        disabled={saving || !loaded}
                        fullWidth
                      />
                      <Divider />
                      {filteredGrantedGroups.length === 0 ? (
                        <Typography color="text.secondary" variant="body2">
                          부여된 그룹 없음
                        </Typography>
                      ) : (
                        <List dense sx={{ maxHeight: GROUP_LIST_MAX_HEIGHT, overflowY: "auto" }}>
                          {filteredGrantedGroups.map((group) => (
                            <ListItemButton
                              key={group.groupId}
                              selected={selectedRight.includes(group.groupId)}
                              disabled={interactionDisabled}
                              onClick={() =>
                                toggleSelected(selectedRight, setSelectedRight, group.groupId)
                              }
                            >
                              <ListItemText
                                primary={group.name}
                                secondary={`ID: ${group.groupId}${group.description ? ` · ${group.description}` : ""}`}
                              />
                            </ListItemButton>
                          ))}
                        </List>
                      )}
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={saving}>
          취소
        </Button>
        <Button
          variant="outlined"
          onClick={() => void handleSave()}
          disabled={saving || loading || !loaded}
        >
          {saving ? <CircularProgress size={20} /> : "저장"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
