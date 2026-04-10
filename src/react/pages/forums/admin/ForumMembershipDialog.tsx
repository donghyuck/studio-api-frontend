import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { DeleteOutlined, HelpOutline, PersonAddOutlined, RefreshOutlined, SaveOutlined } from "@mui/icons-material";
import { useConfirm, useToast } from "@/react/feedback";
import { UserSearchDialog } from "@/react/pages/admin/UserSearchDialog";
import { reactForumsAdminApi } from "@/react/pages/forums/admin/api";
import { ForumRoleMatrixGuide } from "@/react/pages/forums/admin/ForumRoleMatrixGuide";
import type { ForumMemberResponse, ForumMemberRole } from "@/types/studio/forums";
import type { UserDto } from "@/types/studio/user";
import { resolveAxiosError } from "@/utils/helpers";

interface Props {
  open: boolean;
  forumSlug: string;
  onClose: () => void;
}

const ROLES: ForumMemberRole[] = ["OWNER", "ADMIN", "MODERATOR", "MEMBER"];

export function ForumMembershipDialog({ open, forumSlug, onClose }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const [members, setMembers] = useState<ForumMemberResponse[]>([]);
  const [draftRoles, setDraftRoles] = useState<Record<number, ForumMemberRole>>({});
  const [addRole, setAddRole] = useState<ForumMemberRole>("MEMBER");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const draftChanged = useMemo(
    () =>
      members.some(
        (member) => draftRoles[member.userId] && draftRoles[member.userId] !== member.role
      ),
    [draftRoles, members]
  );

  async function loadMembers() {
    if (!forumSlug) {
      return;
    }

    setLoading(true);
    try {
      const data = await reactForumsAdminApi.listMembers(forumSlug, { page: 0, size: 200 });
      setMembers(data);
      setDraftRoles(
        Object.fromEntries(data.map((member) => [member.userId, member.role]))
      );
    } catch (error) {
      toast.error(resolveAxiosError(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    void loadMembers();
  }, [open]);

  async function handleAddUser(user: UserDto) {
    setSaving(true);
    try {
      const existing = members.find((member) => member.userId === user.userId);
      if (existing) {
        await reactForumsAdminApi.updateMember(forumSlug, user.userId, {
          userId: user.userId,
          role: addRole,
        });
      } else {
        await reactForumsAdminApi.addMember(forumSlug, {
          userId: user.userId,
          role: addRole,
        });
      }
      toast.success("멤버 권한이 반영되었습니다.");
      await loadMembers();
      setSearchOpen(false);
    } catch (error) {
      toast.error(resolveAxiosError(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMember(member: ForumMemberResponse) {
    const nextRole = draftRoles[member.userId];
    if (!nextRole || nextRole === member.role) {
      return;
    }

    setSaving(true);
    try {
      await reactForumsAdminApi.updateMember(forumSlug, member.userId, {
        userId: member.userId,
        role: nextRole,
      });
      toast.success("멤버 역할이 저장되었습니다.");
      await loadMembers();
    } catch (error) {
      toast.error(resolveAxiosError(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveMember(member: ForumMemberResponse) {
    const ok = await confirm({
      title: "멤버 삭제",
      message: `사용자 #${member.userId} 멤버십을 삭제하시겠습니까?`,
      okText: "삭제",
      cancelText: "취소",
    });
    if (!ok) {
      return;
    }

    setSaving(true);
    try {
      await reactForumsAdminApi.removeMember(forumSlug, member.userId);
      toast.success("멤버가 삭제되었습니다.");
      await loadMembers();
    } catch (error) {
      toast.error(resolveAxiosError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle>멤버 관리</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={1} justifyContent="space-between">
              <Typography variant="subtitle2">
                현재 멤버 {loading ? "불러오는 중..." : `${members.length}명`}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="text"
                  startIcon={<HelpOutline />}
                  onClick={() => setGuideOpen(true)}
                >
                  역할 안내
                </Button>
                <Button
                  variant="text"
                  startIcon={<RefreshOutlined />}
                  onClick={() => void loadMembers()}
                  disabled={loading || saving}
                >
                  새로고침
                </Button>
              </Stack>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel id="forum-member-add-role-label">추가 역할</InputLabel>
                <Select
                  labelId="forum-member-add-role-label"
                  value={addRole}
                  label="추가 역할"
                  onChange={(event) => setAddRole(event.target.value as ForumMemberRole)}
                >
                  {ROLES.map((role) => (
                    <MenuItem key={role} value={role}>
                      {role}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                startIcon={<PersonAddOutlined />}
                onClick={() => setSearchOpen(true)}
                disabled={saving}
              >
                멤버 추가
              </Button>
            </Stack>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>사용자 ID</TableCell>
                  <TableCell>역할</TableCell>
                  <TableCell>생성자</TableCell>
                  <TableCell>생성일</TableCell>
                  <TableCell align="right">작업</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      {loading ? "불러오는 중..." : "멤버가 없습니다."}
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((member) => (
                    <TableRow key={member.userId} hover>
                      <TableCell>{member.userId}</TableCell>
                      <TableCell sx={{ minWidth: 180 }}>
                        <FormControl size="small" fullWidth>
                          <Select
                            value={draftRoles[member.userId] ?? member.role}
                            onChange={(event) =>
                              setDraftRoles((current) => ({
                                ...current,
                                [member.userId]: event.target.value as ForumMemberRole,
                              }))
                            }
                          >
                            {ROLES.map((role) => (
                              <MenuItem key={role} value={role}>
                                {role}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>{member.createdById ?? "-"}</TableCell>
                      <TableCell>{member.createdAt ?? "-"}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => void handleSaveMember(member)}
                          disabled={saving || draftRoles[member.userId] === member.role}
                        >
                          <SaveOutlined fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => void handleRemoveMember(member)}
                          disabled={saving}
                        >
                          <DeleteOutlined fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {draftChanged ? (
              <Typography variant="caption" color="text.secondary">
                역할 변경 후 저장 아이콘을 눌러 반영하세요.
              </Typography>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            닫기
          </Button>
        </DialogActions>
      </Dialog>

      <UserSearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(user) => void handleAddUser(user)}
      />
      <ForumRoleMatrixGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </>
  );
}
