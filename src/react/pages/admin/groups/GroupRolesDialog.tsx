import { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, List, ListItem, ListItemText, IconButton, Stack, TextField, CircularProgress, Typography, Divider,
} from "@mui/material";
import { DeleteOutlined, AddOutlined } from "@mui/icons-material";
import { useToast } from "@/react/feedback";
import { reactGroupsApi } from "./api";

interface Props {
  open: boolean;
  onClose: () => void;
  groupId: number;
  groupName: string;
}

export function GroupRolesDialog({ open, onClose, groupId, groupName }: Props) {
  const toast = useToast();
  const [roles, setRoles] = useState<{ roleId: number; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [roleIdInput, setRoleIdInput] = useState("");

  async function loadRoles() {
    setLoading(true);
    try {
      const data = await reactGroupsApi.getGroupRoles(groupId);
      setRoles(Array.isArray(data) ? data : []);
    } catch {
      toast.error("역할 목록 로딩 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (open) { setRoleIdInput(""); loadRoles(); } }, [open, groupId]);

  async function handleAdd() {
    const roleId = parseInt(roleIdInput, 10);
    if (!roleId) return;
    try {
      await reactGroupsApi.addGroupRole(groupId, roleId);
      toast.success("역할이 부여되었습니다.");
      setRoleIdInput(""); loadRoles();
    } catch {
      toast.error("역할 부여에 실패했습니다.");
    }
  }

  async function handleRemove(roleId: number) {
    try {
      await reactGroupsApi.removeGroupRole(groupId, roleId);
      toast.success("역할이 제거되었습니다.");
      loadRoles();
    } catch {
      toast.error("역할 제거에 실패했습니다.");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>역할 관리 — {groupName}</DialogTitle>
      <DialogContent>
        <Stack spacing={1} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={1}>
            <TextField label="역할 ID" size="small" value={roleIdInput}
              onChange={e => setRoleIdInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()} />
            <Button startIcon={<AddOutlined />} variant="outlined" onClick={handleAdd} disabled={!roleIdInput}>추가</Button>
          </Stack>
          <Divider />
          {loading ? <CircularProgress size={24} /> : (
            <List dense>
              {roles.length === 0 && <Typography color="text.secondary" variant="body2">부여된 역할 없음</Typography>}
              {roles.map(r => (
                <ListItem key={r.roleId} secondaryAction={
                  <IconButton size="small" color="error" onClick={() => handleRemove(r.roleId)}><DeleteOutlined fontSize="small" /></IconButton>
                }>
                  <ListItemText primary={r.name} secondary={`ID: ${r.roleId}`} />
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
  );
}
