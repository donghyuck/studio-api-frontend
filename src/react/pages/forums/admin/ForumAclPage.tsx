import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Breadcrumbs,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  DeleteOutlined,
  HelpOutline,
  PersonSearchOutlined,
  RefreshOutlined,
} from "@mui/icons-material";
import { useConfirm, useToast } from "@/react/feedback";
import { UserSearchDialog } from "@/react/pages/admin/UserSearchDialog";
import {
  ForumRoleMatrixGuide,
} from "@/react/pages/forums/admin/ForumRoleMatrixGuide";
import { reactForumsAdminApi } from "@/react/pages/forums/admin/api";
import {
  IDENTIFIER_TYPES,
  OWNERSHIP_SCOPES,
  PERMISSION_EFFECTS,
  SUBJECT_TYPES,
  type ForumAclRuleRequest,
  type ForumAclRuleResponse,
  type ForumPermissionDecision,
  type PermissionAction,
  type PermissionIdentifierType,
  type PermissionOwnership,
  type PermissionSubjectType,
} from "@/types/studio/forums";
import type { UserDto } from "@/types/studio/user";
import { resolveAxiosError } from "@/utils/helpers";

type RuleFormState = {
  role: string;
  subjectType: PermissionSubjectType;
  identifierType: PermissionIdentifierType;
  subjectId: string;
  subjectName: string;
  action: PermissionAction | "";
  effect: "ALLOW" | "DENY";
  ownership: PermissionOwnership;
  priority: string;
  enabled: boolean;
  description: string;
};

const INITIAL_FORM: RuleFormState = {
  role: "MEMBER",
  subjectType: "ROLE",
  identifierType: "ID",
  subjectId: "",
  subjectName: "",
  action: "",
  effect: "ALLOW",
  ownership: "ANY",
  priority: "100",
  enabled: true,
  description: "",
};

export function ForumAclPage() {
  const navigate = useNavigate();
  const { forumSlug = "" } = useParams();
  const toast = useToast();
  const confirm = useConfirm();
  const [actions, setActions] = useState<Array<{ action: PermissionAction; description: string; displayName: string }>>([]);
  const [rules, setRules] = useState<ForumAclRuleResponse[]>([]);
  const [form, setForm] = useState<RuleFormState>(INITIAL_FORM);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [simulation, setSimulation] = useState<ForumPermissionDecision | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const canSubmit = useMemo(() => {
    if (!form.action) {
      return false;
    }
    if (form.subjectType === "ROLE") {
      return form.role.trim().length > 0;
    }
    if (form.identifierType === "ID") {
      return Number.isFinite(Number(form.subjectId)) && Number(form.subjectId) > 0;
    }
    return form.subjectName.trim().length > 0;
  }, [form]);

  async function loadAcl() {
    if (!forumSlug) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [loadedActions, loadedRules] = await Promise.all([
        reactForumsAdminApi.listPermissionActions(forumSlug),
        reactForumsAdminApi.listPermissionRules(forumSlug),
      ]);
      setActions(loadedActions);
      setRules(loadedRules);
      setForm((current) => ({
        ...current,
        action: current.action || loadedActions[0]?.action || "",
      }));
    } catch (loadError) {
      const message = resolveAxiosError(loadError);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAcl();
  }, [forumSlug]);

  function resetForm() {
    setEditingRuleId(null);
    setSimulation(null);
    setForm({
      ...INITIAL_FORM,
      action: actions[0]?.action || "",
    });
  }

  function buildPayload(): ForumAclRuleRequest {
    return {
      role: form.subjectType === "ROLE" ? form.role.trim() : undefined,
      subjectType: form.subjectType,
      identifierType: form.subjectType === "USER" ? form.identifierType : "ID",
      subjectId:
        form.subjectType === "USER" && form.identifierType === "ID"
          ? Number(form.subjectId)
          : undefined,
      subjectName:
        form.subjectType === "USER" && form.identifierType === "NAME"
          ? form.subjectName.trim()
          : undefined,
      action: form.action as PermissionAction,
      effect: form.effect,
      ownership: form.ownership,
      priority: Number(form.priority) || 100,
      enabled: form.enabled,
      description: form.description.trim() || undefined,
    };
  }

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      if (editingRuleId) {
        await reactForumsAdminApi.updatePermissionRule(forumSlug, editingRuleId, payload);
        toast.success("ACL 룰이 수정되었습니다.");
      } else {
        await reactForumsAdminApi.createPermissionRule(forumSlug, payload);
        toast.success("ACL 룰이 추가되었습니다.");
      }
      resetForm();
      await loadAcl();
    } catch (submitError) {
      const message = resolveAxiosError(submitError);
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(rule: ForumAclRuleResponse) {
    setEditingRuleId(rule.ruleId);
    setSimulation(null);
    setForm({
      role: rule.role ?? "MEMBER",
      subjectType: rule.subjectType,
      identifierType: rule.identifierType,
      subjectId: rule.subjectId ? String(rule.subjectId) : "",
      subjectName: rule.subjectName ?? "",
      action: rule.action,
      effect: rule.effect,
      ownership: rule.ownership,
      priority: String(rule.priority),
      enabled: rule.enabled,
      description: rule.description ?? "",
    });
  }

  async function handleDelete(rule: ForumAclRuleResponse) {
    const ok = await confirm({
      title: "ACL 삭제",
      message: `룰 #${rule.ruleId} 을 삭제하시겠습니까?`,
      okText: "삭제",
      cancelText: "취소",
    });
    if (!ok) {
      return;
    }

    setSaving(true);
    try {
      await reactForumsAdminApi.deletePermissionRule(forumSlug, rule.ruleId);
      toast.success("ACL 룰이 삭제되었습니다.");
      await loadAcl();
    } catch (deleteError) {
      const message = resolveAxiosError(deleteError);
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSimulate() {
    if (!form.action) {
      return;
    }

    try {
      const result = await reactForumsAdminApi.simulatePermission(forumSlug, {
        action: form.action,
        role: form.subjectType === "ROLE" ? form.role.trim() : undefined,
        subjectType: form.subjectType,
        identifierType: form.subjectType === "USER" ? form.identifierType : undefined,
        subjectId:
          form.subjectType === "USER" && form.identifierType === "ID"
            ? Number(form.subjectId)
            : undefined,
        subjectName:
          form.subjectType === "USER" && form.identifierType === "NAME"
            ? form.subjectName.trim()
            : undefined,
        ownership: form.ownership,
      });
      setSimulation(result);
    } catch (simulateError) {
      const message = resolveAxiosError(simulateError);
      setError(message);
      toast.error(message);
    }
  }

  function handleUserSelect(user: UserDto) {
    setForm((current) => ({
      ...current,
      subjectType: "USER",
      identifierType: "ID",
      subjectId: String(user.userId),
      subjectName: user.username,
    }));
    setUserSearchOpen(false);
  }

  return (
    <>
      <Stack spacing={2}>
        <Breadcrumbs separator="›">
          <Typography
            color="text.secondary"
            sx={{ cursor: "pointer" }}
            onClick={() => navigate("/admin/forums")}
          >
            포럼
          </Typography>
          <Typography
            color="text.secondary"
            sx={{ cursor: "pointer" }}
            onClick={() => navigate(`/admin/forums/${forumSlug}`)}
          >
            {forumSlug}
          </Typography>
          <Typography color="text.primary">ACL</Typography>
        </Breadcrumbs>

        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h5">포럼 ACL 관리</Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="text"
              startIcon={<HelpOutline />}
              onClick={() => setGuideOpen(true)}
            >
              역할 안내
            </Button>
            <Button
              variant="text"
              startIcon={<RefreshOutlined />}
              onClick={() => void loadAcl()}
            >
              새로고침
            </Button>
          </Stack>
        </Stack>

        {error ? <Alert severity="error">{error}</Alert> : null}
        {simulation ? (
          <Alert severity={simulation.allowed ? "success" : "warning"}>
            {simulation.action}: {simulation.policyDecision}
            {simulation.aclDecision ? ` / ${simulation.aclDecision}` : ""}
            {simulation.denyReason ? ` / ${simulation.denyReason}` : ""}
          </Alert>
        ) : null}

        <Stack spacing={2} sx={{ maxWidth: 860 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="forum-acl-subject-type-label">대상 타입</InputLabel>
              <Select
                labelId="forum-acl-subject-type-label"
                value={form.subjectType}
                label="대상 타입"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    subjectType: event.target.value as PermissionSubjectType,
                  }))
                }
              >
                {SUBJECT_TYPES.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {form.subjectType === "ROLE" ? (
              <TextField
                label="역할"
                value={form.role}
                onChange={(event) =>
                  setForm((current) => ({ ...current, role: event.target.value }))
                }
                size="small"
                fullWidth
              />
            ) : (
              <FormControl fullWidth size="small">
                <InputLabel id="forum-acl-identifier-type-label">식별자 타입</InputLabel>
                <Select
                  labelId="forum-acl-identifier-type-label"
                  value={form.identifierType}
                  label="식별자 타입"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      identifierType: event.target.value as PermissionIdentifierType,
                    }))
                  }
                >
                  {IDENTIFIER_TYPES.map((item) => (
                    <MenuItem key={item} value={item}>
                      {item}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Stack>

          {form.subjectType === "USER" ? (
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              {form.identifierType === "ID" ? (
                <TextField
                  label="사용자 ID"
                  value={form.subjectId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, subjectId: event.target.value }))
                  }
                  size="small"
                  fullWidth
                  InputProps={{
                    endAdornment: (
                      <Button
                        size="small"
                        startIcon={<PersonSearchOutlined />}
                        onClick={() => setUserSearchOpen(true)}
                      >
                        검색
                      </Button>
                    ),
                  }}
                />
              ) : (
                <TextField
                  label="사용자 이름"
                  value={form.subjectName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, subjectName: event.target.value }))
                  }
                  size="small"
                  fullWidth
                />
              )}
            </Stack>
          ) : null}

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="forum-acl-action-label">액션</InputLabel>
              <Select
                labelId="forum-acl-action-label"
                value={form.action}
                label="액션"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    action: event.target.value as PermissionAction,
                  }))
                }
              >
                {actions.map((item) => (
                  <MenuItem key={item.action} value={item.action}>
                    {item.action} - {item.displayName || item.description}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel id="forum-acl-effect-label">효과</InputLabel>
              <Select
                labelId="forum-acl-effect-label"
                value={form.effect}
                label="효과"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    effect: event.target.value as "ALLOW" | "DENY",
                  }))
                }
              >
                {PERMISSION_EFFECTS.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel id="forum-acl-ownership-label">Ownership</InputLabel>
              <Select
                labelId="forum-acl-ownership-label"
                value={form.ownership}
                label="Ownership"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    ownership: event.target.value as PermissionOwnership,
                  }))
                }
              >
                {OWNERSHIP_SCOPES.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="우선순위"
              type="number"
              value={form.priority}
              onChange={(event) =>
                setForm((current) => ({ ...current, priority: event.target.value }))
              }
              size="small"
              sx={{ width: 180 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.enabled}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, enabled: event.target.checked }))
                  }
                />
              }
              label="활성화"
            />
          </Stack>

          <TextField
            label="설명"
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
            size="small"
            fullWidth
            multiline
            minRows={2}
          />

          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={() => void handleSubmit()} disabled={saving || !canSubmit}>
              {editingRuleId ? "ACL 수정" : "ACL 추가"}
            </Button>
            <Button variant="outlined" onClick={() => void handleSimulate()} disabled={saving || !form.action}>
              시뮬레이션
            </Button>
            {editingRuleId ? (
              <Button variant="text" onClick={resetForm}>
                편집 취소
              </Button>
            ) : null}
          </Stack>
        </Stack>

        <Typography variant="subtitle1">현재 ACL 룰</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>대상</TableCell>
              <TableCell>액션</TableCell>
              <TableCell>효과</TableCell>
              <TableCell>Ownership</TableCell>
              <TableCell>우선순위</TableCell>
              <TableCell>활성</TableCell>
              <TableCell>설명</TableCell>
              <TableCell align="right">작업</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  {loading ? "불러오는 중..." : "ACL 룰이 없습니다."}
                </TableCell>
              </TableRow>
            ) : (
              rules.map((rule) => (
                <TableRow key={rule.ruleId} hover>
                  <TableCell>{rule.ruleId}</TableCell>
                  <TableCell>
                    {rule.subjectType === "ROLE"
                      ? `ROLE:${rule.role ?? "-"}`
                      : rule.identifierType === "ID"
                        ? `USER ID:${rule.subjectId ?? "-"}`
                        : `USER NAME:${rule.subjectName ?? "-"}`}
                  </TableCell>
                  <TableCell>{rule.action}</TableCell>
                  <TableCell>{rule.effect}</TableCell>
                  <TableCell>{rule.ownership}</TableCell>
                  <TableCell>{rule.priority}</TableCell>
                  <TableCell>{rule.enabled ? "Y" : "N"}</TableCell>
                  <TableCell>{rule.description || "-"}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => handleEdit(rule)}>
                      편집
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteOutlined fontSize="small" />}
                      onClick={() => void handleDelete(rule)}
                    >
                      삭제
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Stack>

      <UserSearchDialog
        open={userSearchOpen}
        onClose={() => setUserSearchOpen(false)}
        onSelect={handleUserSelect}
      />
      <ForumRoleMatrixGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </>
  );
}
