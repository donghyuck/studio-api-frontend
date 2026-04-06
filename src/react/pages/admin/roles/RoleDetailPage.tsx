import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Stack, Breadcrumbs, Typography, Button, TextField, Divider, CircularProgress, Alert,
} from "@mui/material";
import { ArrowBackOutlined, SaveOutlined, PersonAddOutlined, GroupAddOutlined } from "@mui/icons-material";
import { useToast } from "@/react/feedback";
import { reactRolesApi } from "./api";
import { RoleGrantedUsersDialog } from "./RoleGrantedUsersDialog";
import { RoleGrantedGroupsDialog } from "./RoleGrantedGroupsDialog";
import type { RoleDto } from "@/react/pages/admin/datasource";

export function RoleDetailPage() {
  const { roleId } = useParams<{ roleId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [role, setRole] = useState<RoleDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usersOpen, setUsersOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  useEffect(() => {
    if (!roleId) return;
    setLoading(true);
    reactRolesApi.getRole(Number(roleId))
      .then(r => { setRole(r); setForm({ name: r.name, description: r.description ?? "" }); setError(null); })
      .catch(() => setError("역할을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [roleId]);

  async function handleSave() {
    if (!roleId) return;
    setSaving(true);
    try {
      await reactRolesApi.updateRole(Number(roleId), form);
      toast.success("저장되었습니다.");
    } catch {
      toast.error("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!role) return null;

  return (
    <Stack spacing={2}>
      <Breadcrumbs separator="›">
        <Typography color="text.secondary">시스템관리</Typography>
        <Typography color="text.secondary" sx={{ cursor: "pointer" }} onClick={() => navigate("/admin/roles")}>역할</Typography>
        <Typography color="text.primary">{role.name}</Typography>
      </Breadcrumbs>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h5">역할 상세</Typography>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<PersonAddOutlined />} onClick={() => setUsersOpen(true)}>사용자 관리</Button>
          <Button startIcon={<GroupAddOutlined />} onClick={() => setGroupsOpen(true)}>그룹 관리</Button>
          <Button variant="outlined" startIcon={<ArrowBackOutlined />} onClick={() => navigate("/admin/roles")}>목록</Button>
          <Button variant="contained" startIcon={<SaveOutlined />} onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : "저장"}
          </Button>
        </Stack>
      </Box>
      <Divider />
      <Stack spacing={2} sx={{ maxWidth: 600 }}>
        <TextField label="역할명" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} size="small" />
        <TextField label="설명" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} size="small" multiline rows={2} />
      </Stack>
      <RoleGrantedUsersDialog open={usersOpen} onClose={() => setUsersOpen(false)} roleId={role.roleId} roleName={role.name} />
      <RoleGrantedGroupsDialog open={groupsOpen} onClose={() => setGroupsOpen(false)} roleId={role.roleId} roleName={role.name} />
    </Stack>
  );
}
