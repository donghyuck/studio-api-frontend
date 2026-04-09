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
import {
  ArrowBackOutlined,
  ArrowForwardOutlined,
} from "@mui/icons-material";
import { useConfirm, useToast } from "@/react/feedback";
import { reactUsersApi } from "./api";
import type { UserRoleDto } from "./api";
import type { RoleDto } from "@/react/pages/admin/datasource";

interface Props {
  open: boolean;
  onClose: () => void;
  userId: number;
  username: string;
}

const INHERITED_SECTION_MIN_HEIGHT = 120;
const TRANSFER_SECTION_MIN_HEIGHT = 300;
const ROLE_LIST_MAX_HEIGHT = 220;

function byName(left: { name: string }, right: { name: string }) {
  return left.name.localeCompare(right.name);
}

function RolesListSkeleton({ rows = 4 }: { rows?: number }) {
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

function ReadOnlyListSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <Stack spacing={0.75}>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} variant="rounded" height={48} />
      ))}
    </Stack>
  );
}

export function UserRolesDialog({ open, onClose, userId, username }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allRoles, setAllRoles] = useState<RoleDto[]>([]);
  const [grantedRolesByGroup, setGrantedRolesByGroup] = useState<UserRoleDto[]>([]);
  const [grantedRolesByUser, setGrantedRolesByUser] = useState<UserRoleDto[]>([]);
  const [initialGrantedRolesByUser, setInitialGrantedRolesByUser] = useState<UserRoleDto[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<number[]>([]);
  const [selectedRight, setSelectedRight] = useState<number[]>([]);
  const [searchLeft, setSearchLeft] = useState("");
  const [searchRight, setSearchRight] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const [rolesResponse, groupRoles, userRoles] = await Promise.all([
        reactUsersApi.getAvailableRoles(),
        reactUsersApi.getUserGroupRoles(userId),
        reactUsersApi.getUserDirectRoles(userId),
      ]);
      const roles = (rolesResponse.content ?? []).slice().sort(byName);
      const directRoles = (Array.isArray(userRoles) ? userRoles : []).slice().sort(byName);
      const inheritedRoles = (Array.isArray(groupRoles) ? groupRoles : []).slice().sort(byName);
      setAllRoles(roles);
      setGrantedRolesByGroup(inheritedRoles);
      setGrantedRolesByUser(directRoles);
      setInitialGrantedRolesByUser(directRoles);
      setSelectedLeft([]);
      setSelectedRight([]);
      setSearchLeft("");
      setSearchRight("");
    } catch {
      toast.error("역할 목록 로딩에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    void loadData();
  }, [open, userId]);

  const inheritedRoleIds = useMemo(
    () => new Set(grantedRolesByGroup.map((role) => role.roleId)),
    [grantedRolesByGroup]
  );
  const directRoleIds = useMemo(
    () => new Set(grantedRolesByUser.map((role) => role.roleId)),
    [grantedRolesByUser]
  );

  const availableRoles = useMemo(
    () =>
      allRoles
        .filter((role) => !inheritedRoleIds.has(role.roleId) && !directRoleIds.has(role.roleId))
        .filter((role) => {
          const keyword = searchLeft.trim().toLowerCase();
          if (!keyword) return true;
          return (
            role.name.toLowerCase().includes(keyword) ||
            String(role.roleId).includes(keyword) ||
            (role.description ?? "").toLowerCase().includes(keyword)
          );
        }),
    [allRoles, inheritedRoleIds, directRoleIds, searchLeft]
  );

  const filteredGrantedRolesByUser = useMemo(
    () =>
      grantedRolesByUser.filter((role) => {
        const keyword = searchRight.trim().toLowerCase();
        if (!keyword) return true;
        return (
          role.name.toLowerCase().includes(keyword) ||
          String(role.roleId).includes(keyword) ||
          (role.description ?? "").toLowerCase().includes(keyword)
        );
      }),
    [grantedRolesByUser, searchRight]
  );

  function toggleSelected(
    selected: number[],
    setter: (value: number[]) => void,
    roleId: number
  ) {
    setter(
      selected.includes(roleId)
        ? selected.filter((value) => value !== roleId)
        : [...selected, roleId]
    );
  }

  function moveToGranted() {
    const nextRoles = allRoles
      .filter((role) => selectedLeft.includes(role.roleId))
      .map((role) => ({
        roleId: role.roleId,
        name: role.name,
        description: role.description,
      }));

    setGrantedRolesByUser((current) =>
      [...current, ...nextRoles]
        .filter(
          (role, index, roles) =>
            roles.findIndex((candidate) => candidate.roleId === role.roleId) === index
        )
        .sort(byName)
    );
    setSelectedLeft([]);
  }

  function moveToAvailable() {
    setGrantedRolesByUser((current) =>
      current.filter((role) => !selectedRight.includes(role.roleId))
    );
    setSelectedRight([]);
  }

  async function handleSave() {
    const initialIds = new Set(initialGrantedRolesByUser.map((role) => role.roleId));
    const currentIds = new Set(grantedRolesByUser.map((role) => role.roleId));

    const toAdd = grantedRolesByUser.filter((role) => !initialIds.has(role.roleId));
    const toRemove = initialGrantedRolesByUser.filter((role) => !currentIds.has(role.roleId));

    if (toAdd.length === 0 && toRemove.length === 0) {
      toast.info("변경된 역할이 없습니다.");
      onClose();
      return;
    }

    const ok = await confirm({
      title: "역할 변경 저장",
      message: `역할 ${toAdd.length}개 추가, ${toRemove.length}개 제거를 저장하시겠습니까?`,
      okText: "저장",
      cancelText: "취소",
    });
    if (!ok) return;

    setSaving(true);
    try {
      await Promise.all([
        ...toAdd.map((role) => reactUsersApi.addUserRole(userId, role.roleId)),
        ...toRemove.map((role) => reactUsersApi.removeUserRole(userId, role.roleId)),
      ]);
      toast.success("사용자 역할이 저장되었습니다.");
      onClose();
    } catch {
      toast.error("사용자 역할 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>역할 관리 — {username}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="info">
            그룹에서 상속된 역할은 읽기 전용입니다. 여기서는 사용자에게 직접 부여한 역할만 추가하거나 제거할 수 있습니다.
          </Alert>

          <Card variant="outlined">
            <CardContent>
              <Stack spacing={1} sx={{ minHeight: INHERITED_SECTION_MIN_HEIGHT }}>
                <Typography variant="subtitle2">그룹에서 부여된 역할</Typography>
                {loading ? (
                  <ReadOnlyListSkeleton />
                ) : grantedRolesByGroup.length === 0 ? (
                  <Typography color="text.secondary" variant="body2">
                    그룹 상속 역할 없음
                  </Typography>
                ) : (
                  <List dense>
                    {grantedRolesByGroup.map((role) => (
                      <ListItemButton key={role.roleId} disabled>
                        <ListItemText
                          primary={role.name}
                          secondary={`ID: ${role.roleId}`}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                )}
              </Stack>
            </CardContent>
          </Card>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="stretch">
            <Card variant="outlined" sx={{ flex: 1, minWidth: 0 }}>
              <CardContent>
                <Stack spacing={1} sx={{ minHeight: TRANSFER_SECTION_MIN_HEIGHT }}>
                  <Typography variant="subtitle2">부여 가능한 역할</Typography>
                  {loading ? (
                    <RolesListSkeleton />
                  ) : availableRoles.length === 0 ? (
                    <>
                      <TextField
                        label="역할 검색"
                        size="small"
                        value={searchLeft}
                        onChange={(event) => setSearchLeft(event.target.value)}
                        fullWidth
                      />
                      <Divider />
                      <Typography color="text.secondary" variant="body2">
                        선택 가능한 역할 없음
                      </Typography>
                    </>
                  ) : (
                    <>
                      <TextField
                        label="역할 검색"
                        size="small"
                        value={searchLeft}
                        onChange={(event) => setSearchLeft(event.target.value)}
                        fullWidth
                      />
                      <Divider />
                      <List dense sx={{ maxHeight: ROLE_LIST_MAX_HEIGHT, overflowY: "auto" }}>
                        {availableRoles.map((role) => (
                          <ListItemButton
                            key={role.roleId}
                            selected={selectedLeft.includes(role.roleId)}
                            onClick={() =>
                              toggleSelected(selectedLeft, setSelectedLeft, role.roleId)
                            }
                          >
                            <ListItemText
                              primary={role.name}
                              secondary={`ID: ${role.roleId}${role.description ? ` · ${role.description}` : ""}`}
                            />
                          </ListItemButton>
                        ))}
                      </List>
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
                disabled={loading || selectedLeft.length === 0}
              >
                추가
              </Button>
              <Button
                variant="outlined"
                startIcon={<ArrowBackOutlined />}
                onClick={moveToAvailable}
                disabled={loading || selectedRight.length === 0}
              >
                제거
              </Button>
            </Stack>

            <Card variant="outlined" sx={{ flex: 1, minWidth: 0 }}>
              <CardContent>
                <Stack spacing={1} sx={{ minHeight: TRANSFER_SECTION_MIN_HEIGHT }}>
                  <Typography variant="subtitle2">사용자에게 직접 부여한 역할</Typography>
                  {loading ? (
                    <RolesListSkeleton />
                  ) : filteredGrantedRolesByUser.length === 0 ? (
                    <>
                      <TextField
                        label="역할 검색"
                        size="small"
                        value={searchRight}
                        onChange={(event) => setSearchRight(event.target.value)}
                        fullWidth
                      />
                      <Divider />
                      <Typography color="text.secondary" variant="body2">
                        직접 부여 역할 없음
                      </Typography>
                    </>
                  ) : (
                    <>
                      <TextField
                        label="역할 검색"
                        size="small"
                        value={searchRight}
                        onChange={(event) => setSearchRight(event.target.value)}
                        fullWidth
                      />
                      <Divider />
                      <List dense sx={{ maxHeight: ROLE_LIST_MAX_HEIGHT, overflowY: "auto" }}>
                        {filteredGrantedRolesByUser.map((role) => (
                          <ListItemButton
                            key={role.roleId}
                            selected={selectedRight.includes(role.roleId)}
                            onClick={() =>
                              toggleSelected(selectedRight, setSelectedRight, role.roleId)
                            }
                          >
                            <ListItemText
                              primary={role.name}
                              secondary={`ID: ${role.roleId}${role.description ? ` · ${role.description}` : ""}`}
                            />
                          </ListItemButton>
                        ))}
                      </List>
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
        <Button variant="outlined" onClick={() => void handleSave()} disabled={saving}>
          {saving ? <CircularProgress size={20} /> : "저장"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
