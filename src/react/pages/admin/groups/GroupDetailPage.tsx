import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Stack, Breadcrumbs, Typography, Button, TextField, Divider, CircularProgress, Alert,
} from "@mui/material";
import { ArrowBackOutlined, SaveOutlined, GroupAddOutlined, ManageAccountsOutlined } from "@mui/icons-material";
import { useToast } from "@/react/feedback";
import { reactGroupsApi } from "./api";
import { GroupMembershipDialog } from "./GroupMembershipDialog";
import { GroupRolesDialog } from "./GroupRolesDialog";
import type { GroupDto } from "@/react/pages/admin/datasource";

export function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [group, setGroup] = useState<GroupDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  useEffect(() => {
    if (!groupId) return;
    setLoading(true);
    reactGroupsApi.getGroup(Number(groupId))
      .then(g => { setGroup(g); setForm({ name: g.name, description: g.description ?? "" }); setError(null); })
      .catch(() => setError("그룹을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [groupId]);

  async function handleSave() {
    if (!groupId) return;
    setSaving(true);
    try {
      await reactGroupsApi.updateGroup(Number(groupId), form);
      toast.success("저장되었습니다.");
    } catch {
      toast.error("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!group) return null;

  return (
    <Stack spacing={2}>
      <Breadcrumbs separator="›">
        <Typography color="text.secondary">시스템관리</Typography>
        <Typography color="text.secondary" sx={{ cursor: "pointer" }} onClick={() => navigate("/admin/groups")}>그룹</Typography>
        <Typography color="text.primary">{group.name}</Typography>
      </Breadcrumbs>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h5">그룹 상세</Typography>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<GroupAddOutlined />} onClick={() => setMembersOpen(true)}>멤버 관리</Button>
          <Button startIcon={<ManageAccountsOutlined />} onClick={() => setRolesOpen(true)}>역할 관리</Button>
          <Button variant="outlined" startIcon={<ArrowBackOutlined />} onClick={() => navigate("/admin/groups")}>목록</Button>
          <Button variant="contained" startIcon={<SaveOutlined />} onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : "저장"}
          </Button>
        </Stack>
      </Box>
      <Divider />
      <Stack spacing={2} sx={{ maxWidth: 600 }}>
        <TextField label="그룹명" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} size="small" />
        <TextField label="설명" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} size="small" multiline rows={2} />
      </Stack>
      <GroupMembershipDialog open={membersOpen} onClose={() => setMembersOpen(false)} groupId={group.groupId} groupName={group.name} />
      <GroupRolesDialog open={rolesOpen} onClose={() => setRolesOpen(false)} groupId={group.groupId} groupName={group.name} />
    </Stack>
  );
}
