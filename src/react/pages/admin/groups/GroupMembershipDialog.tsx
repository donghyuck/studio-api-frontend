import { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, List, ListItem, ListItemText, IconButton, Stack, CircularProgress, Typography,
} from "@mui/material";
import { DeleteOutlined } from "@mui/icons-material";
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
  const [userSearchOpen, setUserSearchOpen] = useState(false);

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

  useEffect(() => { if (open) loadMembers(); }, [open, groupId]);

  async function handleAdd(user: UserDto) {
    try {
      await reactGroupsApi.addMember(groupId, user.userId);
      toast.success("멤버가 추가되었습니다.");
      loadMembers();
    } catch {
      toast.error("멤버 추가에 실패했습니다.");
    }
  }

  async function handleRemove(userId: number) {
    try {
      await reactGroupsApi.removeMember(groupId, userId);
      toast.success("멤버가 제거되었습니다.");
      loadMembers();
    } catch {
      toast.error("멤버 제거에 실패했습니다.");
    }
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>멤버 관리 — {groupName}</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ mt: 1 }}>
            <Button variant="outlined" size="small" onClick={() => setUserSearchOpen(true)} sx={{ alignSelf: "flex-start" }}>멤버 추가</Button>
            {loading ? <CircularProgress size={24} /> : (
              <List dense>
                {members.length === 0 && <Typography color="text.secondary" variant="body2">멤버 없음</Typography>}
                {members.map(m => (
                  <ListItem key={m.userId} secondaryAction={
                    <IconButton size="small" color="error" onClick={() => handleRemove(m.userId)}><DeleteOutlined fontSize="small" /></IconButton>
                  }>
                    <ListItemText primary={m.name} secondary={`@${m.username}`} />
                  </ListItem>
                ))}
              </List>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>닫기</Button>
        </DialogActions>
      </Dialog>
      <UserSearchDialog open={userSearchOpen} onClose={() => setUserSearchOpen(false)} onSelect={handleAdd} />
    </>
  );
}
