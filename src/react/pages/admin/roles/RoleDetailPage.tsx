import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
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
import { GroupAddOutlined, PersonAddOutlined, SaveOutlined } from "@mui/icons-material";
import { useToast } from "@/react/feedback";
import { reactRolesApi } from "./api";
import { RoleGrantedUsersDialog } from "./RoleGrantedUsersDialog";
import { RoleGrantedGroupsDialog } from "./RoleGrantedGroupsDialog";
import type { RoleDto } from "@/react/pages/admin/datasource";
import { PageToolbar } from "@/react/components/page/PageToolbar";

export function RoleDetailPage() {
  const { roleId } = useParams<{ roleId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const [role, setRole] = useState<RoleDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usersOpen, setUsersOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  const loadRole = useCallback(() => {
    if (!roleId) return;
    setLoading(true);
    reactRolesApi
      .getRole(Number(roleId))
      .then((r) => {
        setRole(r);
        setForm({ name: r.name, description: r.description ?? "" });
        setError(null);
      })
      .catch(() => setError("역할을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [roleId]);

  useEffect(() => {
    loadRole();
  }, [loadRole]);

  useEffect(() => {
    const state = location.state as { openUsers?: boolean; openGroups?: boolean } | null;
    if (state?.openUsers) {
      setUsersOpen(true);
      navigate(".", { replace: true, state: null });
    } else if (state?.openGroups) {
      setGroupsOpen(true);
      navigate(".", { replace: true, state: null });
    }
  }, [location.state, navigate]);

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

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!role) return null;

  return (
    <Stack spacing={2}>
      <PageToolbar
        divider
        breadcrumbs={["시스템관리", "보안관리", "역할", role.name]}
        label="역할 정보를 조회하고 사용자 및 그룹 할당을 관리합니다."
        previous
        onPrevious={() => navigate("/admin/roles")}
        onRefresh={loadRole}
      />
      <Container maxWidth="md" disableGutters>
        <Grid container spacing={1} alignItems="center">
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="역할명"
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
                startIcon={<PersonAddOutlined />}
                onClick={() => setUsersOpen(true)}
              >
                사용자 관리
              </Button>
              <Button
                variant="outlined"
                startIcon={<GroupAddOutlined />}
                onClick={() => setGroupsOpen(true)}
              >
                그룹 관리
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
      <RoleGrantedUsersDialog
        open={usersOpen}
        onClose={() => setUsersOpen(false)}
        roleId={role.roleId}
        roleName={role.name}
      />
      <RoleGrantedGroupsDialog
        open={groupsOpen}
        onClose={() => setGroupsOpen(false)}
        roleId={role.roleId}
        roleName={role.name}
      />
    </Stack>
  );
}
