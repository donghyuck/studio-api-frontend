import { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, List, ListItem, ListItemText, IconButton, Stack, TextField, CircularProgress, Typography, Divider,
} from "@mui/material";
import { DeleteOutlined, AddOutlined } from "@mui/icons-material";
import { useToast } from "@/react/feedback";
import { reactRolesApi } from "./api";

interface Props {
  open: boolean;
  onClose: () => void;
  roleId: number;
  roleName: string;
}

export function RoleGrantedGroupsDialog({ open, onClose, roleId, roleName }: Props) {
  const toast = useToast();
  const [groups, setGroups] = useState<{ groupId: number; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [groupIdInput, setGroupIdInput] = useState("");

  async function loadGroups() {
    setLoading(true);
    try {
      const data = await reactRolesApi.getGrantedGroups(roleId);
      setGroups(Array.isArray(data) ? data : []);
    } catch {
      toast.error("그룹 목록 로딩 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (open) { setGroupIdInput(""); loadGroups(); } }, [open, roleId]);

  async function handleAdd() {
    const groupId = parseInt(groupIdInput, 10);
    if (!groupId) return;
    try {
      await reactRolesApi.addGroup(roleId, groupId);
      toast.success("그룹이 부여되었습니다.");
      setGroupIdInput(""); loadGroups();
    } catch {
      toast.error("그룹 부여에 실패했습니다.");
    }
  }

  async function handleRemove(groupId: number) {
    try {
      await reactRolesApi.removeGroup(roleId, groupId);
      toast.success("그룹이 제거되었습니다.");
      loadGroups();
    } catch {
      toast.error("그룹 제거에 실패했습니다.");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <DialogTitle>그룹 부여 — {roleName}</DialogTitle>
      <DialogContent>
        <Stack spacing={1} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={1}>
            <TextField label="그룹 ID" size="small" value={groupIdInput}
              onChange={e => setGroupIdInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()} />
            <Button startIcon={<AddOutlined />} variant="outlined" onClick={handleAdd} disabled={!groupIdInput}>추가</Button>
          </Stack>
          <Divider />
          {loading ? <CircularProgress size={24} /> : (
            <List dense>
              {groups.length === 0 && <Typography color="text.secondary" variant="body2">부여된 그룹 없음</Typography>}
              {groups.map(g => (
                <ListItem key={g.groupId} secondaryAction={
                  <IconButton size="small" color="error" onClick={() => handleRemove(g.groupId)}><DeleteOutlined fontSize="small" /></IconButton>
                }>
                  <ListItemText primary={g.name} secondary={`ID: ${g.groupId}`} />
                </ListItem>
              ))}
            </List>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>닫기</Button>
      </DialogActions>
    </Dialog>
  );
}
