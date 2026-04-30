import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  AddOutlined,
  ExpandMoreOutlined,
  GroupAddOutlined,
  ManageAccountsOutlined,
  SaveOutlined,
} from "@mui/icons-material";
import { getProperties, replaceProperties } from "@/react/api/properties";
import { useToast } from "@/react/feedback";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import {
  PropertiesEditor,
  type PropertiesEditorHandle,
} from "@/react/components/properties/PropertiesEditor";
import { diffProperties, normalizeProperties } from "@/react/utils/propertyKeys";
import { reactGroupsApi } from "./api";
import { GroupMembershipDialog } from "./GroupMembershipDialog";
import { GroupRolesDialog } from "./GroupRolesDialog";
import type { GroupDto } from "@/react/pages/admin/datasource";

export function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const propertiesEditorRef = useRef<PropertiesEditorHandle | null>(null);
  const [group, setGroup] = useState<GroupDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [propertiesSaving, setPropertiesSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [propertiesExpanded, setPropertiesExpanded] = useState(false);
  const [propertiesResetKey, setPropertiesResetKey] = useState(0);
  const propertiesSectionRef = useRef<HTMLDivElement | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [initialProperties, setInitialProperties] = useState<Record<string, string>>({});
  const [draftProperties, setDraftProperties] = useState<Record<string, string>>({});

  const loadGroup = useCallback(() => {
    if (!groupId) return;
    setLoading(true);
    Promise.allSettled([
      reactGroupsApi.getGroup(Number(groupId)),
      getProperties("groups", Number(groupId)),
    ])
      .then(([groupResult, propertiesResult]) => {
        if (groupResult.status !== "fulfilled") {
          throw groupResult.reason;
        }

        const nextGroup = groupResult.value;
        setGroup(nextGroup);
        setForm({ name: nextGroup.name, description: nextGroup.description ?? "" });

        const nextProperties =
          propertiesResult.status === "fulfilled"
            ? normalizeProperties(propertiesResult.value)
            : {};
        if (propertiesResult.status !== "fulfilled") {
          toast.error("프로퍼티를 불러오지 못했습니다.");
        }

        setInitialProperties(nextProperties);
        setDraftProperties(nextProperties);
        setPropertiesResetKey((current) => current + 1);
        setError(null);
      })
      .catch(() => setError("그룹을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [groupId, toast]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  useEffect(() => {
    const state = location.state as { openMembers?: boolean; openRoles?: boolean } | null;
    if (state?.openMembers) {
      setMembersOpen(true);
      navigate(".", { replace: true, state: null });
    } else if (state?.openRoles) {
      setRolesOpen(true);
      navigate(".", { replace: true, state: null });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    if (!propertiesExpanded || !propertiesSectionRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      propertiesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [propertiesExpanded]);

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

  async function handleSaveProperties() {
    if (!groupId) return;
    if (propertiesEditorRef.current?.hasErrors()) {
      toast.error("프로퍼티 키 오류를 먼저 수정해 주세요.");
      return;
    }

    setPropertiesSaving(true);
    try {
      const nextProperties = propertiesEditorRef.current?.getValue() ?? draftProperties;
      const saved = await replaceProperties("groups", Number(groupId), nextProperties);
      const normalized = normalizeProperties(saved);
      setInitialProperties(normalized);
      setDraftProperties(normalized);
      setPropertiesResetKey((current) => current + 1);
      toast.success("프로퍼티가 저장되었습니다.");
    } catch {
      toast.error("프로퍼티 저장에 실패했습니다.");
    } finally {
      setPropertiesSaving(false);
    }
  }

  const handleSectionChange = useCallback(() => {
    setPropertiesExpanded((current) => !current);
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!group) return null;

  const propertiesDiff = diffProperties(initialProperties, draftProperties);
  const propertiesChanged =
    Object.keys(propertiesDiff.added).length > 0 ||
    Object.keys(propertiesDiff.updated).length > 0 ||
    propertiesDiff.removed.length > 0;
  const propertiesBusy = saving || propertiesSaving;

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
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 200px" },
          gap: { xs: 0, lg: 3 },
        }}
      >
        <Stack spacing={2}>
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
          <Container maxWidth="md" disableGutters>
            <Box ref={propertiesSectionRef} sx={{ scrollMarginTop: 56 }}>
              <Accordion
                disableGutters
                expanded={propertiesExpanded}
                onChange={(_, expanded) => setPropertiesExpanded(expanded)}
              >
                <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                  프로퍼티
                </AccordionSummary>
                <AccordionDetails>
                  <PageToolbar
                    divider={false}
                    label="그룹에 대한 추가 속성을 관리합니다."
                    actions={
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AddOutlined />}
                        onClick={() => propertiesEditorRef.current?.addRow()}
                        disabled={propertiesBusy}
                      >
                        행 추가
                      </Button>
                    }
                  />
                  <PropertiesEditor
                    ref={propertiesEditorRef}
                    value={draftProperties}
                    onChange={setDraftProperties}
                    type="groups"
                    disabled={propertiesBusy}
                    resetKey={propertiesResetKey}
                  />
                  <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 1.5 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<SaveOutlined />}
                      onClick={() => void handleSaveProperties()}
                      disabled={propertiesBusy || !propertiesChanged}
                    >
                      {propertiesSaving ? <CircularProgress size={16} /> : "저장"}
                    </Button>
                  </Stack>
                </AccordionDetails>
              </Accordion>
            </Box>
          </Container>
        </Stack>
        <Box
          component="aside"
          sx={{
            display: { xs: "none", lg: "block" },
            position: "sticky",
            top: 16,
            alignSelf: "start",
            borderLeft: "1px solid",
            borderColor: "divider",
            pl: 2,
            py: 1,
          }}
        >
          <Typography variant="caption" color="text.secondary" fontWeight={700}>
            Contents
          </Typography>
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            <Button
              size="small"
              variant="text"
              sx={{
                justifyContent: "flex-start",
                color: propertiesExpanded ? "primary.main" : "text.secondary",
                fontWeight: propertiesExpanded ? 700 : 400,
                borderLeft: propertiesExpanded ? "2px solid" : "2px solid transparent",
                borderColor: propertiesExpanded ? "primary.main" : "transparent",
                pl: 1,
              }}
              onClick={handleSectionChange}
            >
              프로퍼티
            </Button>
          </Stack>
        </Box>
      </Box>
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
