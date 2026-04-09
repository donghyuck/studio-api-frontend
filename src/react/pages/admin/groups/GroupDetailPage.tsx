import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Grid,
  TextField,
  Stack,
} from "@mui/material";
import { GroupAddOutlined, ManageAccountsOutlined, SaveOutlined } from "@mui/icons-material";
import { useToast } from "@/react/feedback";
import { reactGroupsApi } from "./api";
import { GroupMembershipDialog } from "./GroupMembershipDialog";
import { GroupRolesDialog } from "./GroupRolesDialog";
import type { GroupDto } from "@/react/pages/admin/datasource";
import { PageToolbar } from "@/react/components/page/PageToolbar";

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

  const loadGroup = useCallback(() => {
    if (!groupId) return;
    setLoading(true);
    reactGroupsApi
      .getGroup(Number(groupId))
      .then((g) => {
        setGroup(g);
        setForm({ name: g.name, description: g.description ?? "" });
        setError(null);
      })
      .catch(() => setError("그룹을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [groupId]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

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

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!group) return null;

  return (
    <Stack spacing={2}>
      <PageToolbar
        divider
        breadcrumbs={["시스템관리", "보안관리", "그룹", group.name]}
        label="그룹 정보를 조회하고 멤버와 역할을 관리합니다."
        previous
        onPrevious={() => navigate("/admin/groups")}
        onRefresh={loadGroup}
      />
      <Container maxWidth="md" disableGutters>
        <Grid container spacing={1} alignItems="center">
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="그룹명"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              size="small"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="설명"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              size="small"
              multiline
              rows={2}
              fullWidth
            />
          </Grid>
          <Grid size={12} sx={{ mt: 2 }}>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                variant="outlined"
                startIcon={<GroupAddOutlined />}
                onClick={() => setMembersOpen(true)}
              >
                멤버 관리
              </Button>
              <Button
                variant="outlined"
                startIcon={<ManageAccountsOutlined />}
                onClick={() => setRolesOpen(true)}
              >
                역할 관리
              </Button>
              <Button
                variant="outlined"
                startIcon={<SaveOutlined />}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <CircularProgress size={20} /> : "저장"}
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Container>
      <GroupMembershipDialog
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        groupId={group.groupId}
        groupName={group.name}
      />
      <GroupRolesDialog
        open={rolesOpen}
        onClose={() => setRolesOpen(false)}
        groupId={group.groupId}
        groupName={group.name}
      />
    </Stack>
  );
}
