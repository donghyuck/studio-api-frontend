import { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, List, ListItem, ListItemText, IconButton, Stack, CircularProgress, Typography,
} from "@mui/material";
import { DeleteOutlined } from "@mui/icons-material";
import { useToast } from "@/react/feedback";
import { reactRolesApi } from "./api";
import { UserSearchDialog } from "@/react/pages/admin/UserSearchDialog";
import type { UserDto } from "@/types/studio/user";

interface Props {
  open: boolean;
  onClose: () => void;
  roleId: number;
  roleName: string;
}

export function RoleGrantedUsersDialog({ open, onClose, roleId, roleName }: Props) {
  const toast = useToast();
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [userSearchOpen, setUserSearchOpen] = useState(false);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await reactRolesApi.getGrantedUsers(roleId);
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      toast.error("사용자 목록 로딩 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (open) loadUsers(); }, [open, roleId]);

  async function handleAdd(user: UserDto) {
    try {
      await reactRolesApi.addUser(roleId, user.userId);
      toast.success("사용자가 부여되었습니다.");
      loadUsers();
    } catch {
      toast.error("사용자 부여에 실패했습니다.");
    }
  }

  async function handleRemove(userId: number) {
    try {
      await reactRolesApi.removeUser(roleId, userId);
      toast.success("사용자가 제거되었습니다.");
      loadUsers();
    } catch {
      toast.error("사용자 제거에 실패했습니다.");
    }
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>사용자 부여 — {roleName}</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ mt: 1 }}>
            <Button variant="outlined" size="small" onClick={() => setUserSearchOpen(true)} sx={{ alignSelf: "flex-start" }}>사용자 추가</Button>
            {loading ? <CircularProgress size={24} /> : (
              <List dense>
                {users.length === 0 && <Typography color="text.secondary" variant="body2">부여된 사용자 없음</Typography>}
                {users.map(u => (
                  <ListItem key={u.userId} secondaryAction={
                    <IconButton size="small" color="error" onClick={() => handleRemove(u.userId)}><DeleteOutlined fontSize="small" /></IconButton>
                  }>
                    <ListItemText primary={u.name} secondary={`@${u.username}`} />
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
