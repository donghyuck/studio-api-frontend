import { useEffect, useMemo, useState } from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import { DeleteOutlined, GroupAddOutlined } from "@mui/icons-material";
import { useToast } from "@/react/feedback";
import { reactGroupsApi, type GroupMemberDto } from "./api";
import { UserSearchDialog } from "@/react/pages/admin/UserSearchDialog";
import type { UserDto } from "@/types/studio/user";

interface Props {
  open: boolean;
  onClose: () => void;
  groupId: number;
  groupName: string;
}

export function GroupMembershipDialog({ open, onClose, groupId, groupName }: Props) {
  const toast = useToast();
  const [members, setMembers] = useState<GroupMemberDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userSearchOpen, setUserSearchOpen] = useState(false);

  const memberIds = useMemo(() => new Set(members.map((member) => member.userId)), [members]);

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

  async function handleRemove(userId: number) {
    try {
      await reactGroupsApi.removeMember(groupId, userId);
      toast.success("멤버가 제거되었습니다.");
      await loadMembers();
    } catch {
      toast.error("멤버 제거에 실패했습니다.");
    }
  }

  return (
    <>
      <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
        <DialogTitle>멤버 관리 — {groupName}</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ mt: 1 }}>
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
              <List dense>
                {members.length === 0 ? (
                  <Typography color="text.secondary" variant="body2">
                    멤버 없음
                  </Typography>
                ) : (
                  members.map((member) => (
                    <ListItem
                      key={member.userId}
                      secondaryAction={
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => void handleRemove(member.userId)}
                        >
                          <DeleteOutlined fontSize="small" />
                        </IconButton>
                      }
                    >
                      <ListItemText
                        primary={member.name}
                        secondary={`@${member.username}`}
                      />
                    </ListItem>
                  ))
                )}
              </List>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
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
