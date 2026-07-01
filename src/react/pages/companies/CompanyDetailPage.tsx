import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AccountTreeOutlined,
  AddOutlined,
  DeleteOutlined,
  GroupAddOutlined,
  SaveOutlined,
} from "@mui/icons-material";
import dayjs from "dayjs";
import { API_BASE_URL } from "@/config/backend";
import NO_AVATAR from "@/assets/images/users/no-avatar.png";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { SkeletonPlaceholder } from "@/react/components/common/SkeletonPlaceholder";
import { useConfirm, useToast } from "@/react/feedback";
import { UserSearchDialog } from "@/react/pages/admin/UserSearchDialog";
import { reactUsersApi } from "@/react/pages/admin/users/api";
import { reactCompanyApi } from "@/react/pages/companies/api";
import type {
  CompanyDto,
  CompanyJoinRequestDto,
  CompanyMemberDto,
  CompanyMemberKeyDto,
  CompanyPermissionPolicyDto,
  CompanyPermissionRolePolicyRequest,
  CompanyPermissionSummary,
  CompanyRole,
} from "@/types/studio/company";
import type { UserDto } from "@/types/studio/user";
import { resolveAxiosError } from "@/utils/helpers";

type CompanyTab = "basic" | "members" | "permissions";

const roleOptions: CompanyRole[] = ["MEMBER", "BILLING_ADMIN", "ADMIN", "OWNER"];

type CompanyPermissionPolicyDraft = Record<CompanyRole, string[]>;

function companyRoleLabel(role?: CompanyRole | null) {
  if (role === "MEMBER") return "Member";
  if (role === "BILLING_ADMIN") return "Billing Admin";
  if (role === "ADMIN") return "Admin";
  if (role === "OWNER") return "Owner";
  return role ?? "-";
}

function companyStatusLabel(status?: string | null) {
  if (status === "ACTIVE") return "활성";
  if (status === "ARCHIVED") return "비활성";
  return status ?? "-";
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = dayjs(value);
  return date.isValid() ? date.format("YYYY-MM-DD HH:mm:ss") : value;
}

function defaultCompanyActionsFor(role: CompanyRole) {
  const actions = new Set<string>(["company.read", "company.workspace.read"]);
  if (role === "BILLING_ADMIN" || role === "OWNER") {
    actions.add("company.billing.read");
    actions.add("company.billing.manage");
  }
  if (role === "ADMIN" || role === "OWNER") {
    actions.add("company.update");
    actions.add("company.member.read");
    actions.add("company.member.manage");
    actions.add("company.permission.read");
    actions.add("company.workspace.create");
  }
  if (role === "OWNER") {
    actions.add("company.archive");
    actions.add("company.permission.manage");
  }
  return actions;
}

function createDefaultPermissionDraft(actions: string[]) {
  const actionSet = new Set(actions);
  return roleOptions.reduce<CompanyPermissionPolicyDraft>((acc, role) => {
    acc[role] = actions.filter((action) => defaultCompanyActionsFor(role).has(action) || !actionSet.size);
    return acc;
  }, {} as CompanyPermissionPolicyDraft);
}

function normalizePolicyRoles(policy: CompanyPermissionPolicyDto | null, actions: string[]) {
  const actionSet = new Set(actions);
  const defaults = createDefaultPermissionDraft(actions);
  const policyByRole = new Map((policy?.roles ?? []).map((rolePolicy) => [rolePolicy.role, rolePolicy]));
  return roleOptions.reduce<CompanyPermissionPolicyDraft>((acc, role) => {
    const configured = policyByRole.get(role);
    const configuredActions = configured?.actions ?? configured?.defaultActions;
    acc[role] = Array.isArray(configuredActions)
      ? configuredActions.filter((action) => actionSet.has(action))
      : defaults[role];
    return acc;
  }, {} as CompanyPermissionPolicyDraft);
}

function policyPayload(roles: CompanyPermissionPolicyDraft): CompanyPermissionRolePolicyRequest[] {
  return roleOptions.map((role) => ({
    role,
    actions: roles[role] ?? [],
    override: true,
  }));
}

function parseProperties(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("속성은 JSON object여야 합니다.");
  }
  return parsed as Record<string, unknown>;
}

function formatProperties(properties?: Record<string, unknown> | null) {
  return JSON.stringify(properties ?? {}, null, 2);
}

function StatItem({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2">{value ?? "-"}</Typography>
    </Box>
  );
}

function CompanyMembersTable({
  members,
  totalMembers,
  usersById,
  archived,
  searchValue = "",
  onAdd,
  onSearchChange,
  onRefresh,
  onChangeRole,
  onRemove,
}: {
  members: CompanyMemberDto[];
  totalMembers: number;
  usersById: Record<number, UserDto | undefined>;
  archived: boolean;
  searchValue: string;
  onAdd: () => void;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onChangeRole: (member: CompanyMemberDto, role: CompanyRole) => void;
  onRemove: (member: CompanyMemberDto) => void;
}) {
  return (
    <Stack spacing={1.5}>
      <PageToolbar
        divider={false}
        label={[
          searchValue.trim() ? `${members.length} / ${totalMembers}명` : `${totalMembers}명`,
          "역할은 선택하면 바로 저장됩니다.",
        ].join(" · ")}
        onRefresh={onRefresh}
        searchPlaceholder="아이디, 이름, 메일 검색"
        searchValue={searchValue}
        onSearchValueChange={onSearchChange}
        onSearch={onSearchChange}
        actions={
          <Tooltip title="멤버 추가">
            <span>
              <IconButton size="small" aria-label="멤버 추가" onClick={onAdd} disabled={archived}>
                <GroupAddOutlined fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        }
      />
      <Box sx={{ height: 400, overflow: "auto" }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>사용자</TableCell>
              <TableCell>이름</TableCell>
              <TableCell>메일</TableCell>
              <TableCell width={180}>역할</TableCell>
              <TableCell width={110}>상태</TableCell>
              <TableCell width={64} align="center">
                작업
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {members.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6}>
                <Typography color="text.secondary">표시할 멤버가 없습니다.</Typography>
              </TableCell>
            </TableRow>
          ) : (
            members.map((member) => {
              const user = usersById[member.userId];
              const username = user?.username ?? `User #${member.userId}`;
              return (
                <TableRow key={member.userId} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Avatar
                        alt={username}
                        src={user?.username ? `${API_BASE_URL}/api/profile/${encodeURIComponent(user.username)}/avatar` : NO_AVATAR}
                        imgProps={{
                          onError: (event) => {
                            event.currentTarget.src = NO_AVATAR;
                          },
                        }}
                        sx={{ width: 24, height: 24, bgcolor: "grey.200" }}
                      />
                      <Typography variant="body2">{username}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{user?.name ?? "-"}</TableCell>
                  <TableCell>{user?.email ?? "-"}</TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      select
                      value={member.role}
                      disabled={archived}
                      onChange={(event) => onChangeRole(member, event.target.value as CompanyRole)}
                      sx={{
                        minWidth: 140,
                        "& .MuiInputBase-root": { height: 30, fontSize: 13 },
                        "& .MuiSelect-select": { py: 0.25, pl: 1, pr: 3 },
                      }}
                    >
                      {roleOptions.map((role) => (
                        <MenuItem key={role} value={role}>
                          {companyRoleLabel(role)}
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" label={member.status ?? "-"} sx={{ height: 22 }} />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="멤버 제거">
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          disabled={archived}
                          onClick={() => onRemove(member)}
                        >
                          <DeleteOutlined fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })
            )}
          </TableBody>
        </Table>
      </Box>
    </Stack>
  );
}

function CompanyJoinAdminPanel({
  companyId,
  archived,
  onChanged,
}: {
  companyId: number;
  archived: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [saving, setSaving] = useState(false);
  const [requests, setRequests] = useState<CompanyJoinRequestDto[]>([]);
  const [createdKey, setCreatedKey] = useState<CompanyMemberKeyDto | null>(null);
  const [keyForm, setKeyForm] = useState({ role: "MEMBER" as CompanyRole, expiresAt: "", maxUses: "1" });

  async function handleCreateKey() {
    const maxUses = Number(keyForm.maxUses);
    setSaving(true);
    try {
      const result = await reactCompanyApi.createMemberKey(companyId, {
        role: keyForm.role,
        expiresAt: keyForm.expiresAt || null,
        maxUses: Number.isFinite(maxUses) && maxUses > 0 ? maxUses : null,
      });
      setCreatedKey(result);
      toast.success("초대 코드가 생성되었습니다.");
    } catch (err) {
      toast.error(resolveAxiosError(err) || "초대 코드 생성에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLoadRequests() {
    setLoadingRequests(true);
    try {
      const result = await reactCompanyApi.joinRequests(companyId, {
        status: "PENDING",
        page: 0,
        size: 50,
        sort: "requestedAt,desc",
      });
      setRequests(result.content ?? []);
    } catch (err) {
      toast.error(resolveAxiosError(err) || "가입 요청을 불러오지 못했습니다.");
    } finally {
      setLoadingRequests(false);
    }
  }

  async function handleApprove(request: CompanyJoinRequestDto) {
    setSaving(true);
    try {
      await reactCompanyApi.approveJoinRequest(companyId, request.requestId, {
        role: request.role ?? "MEMBER",
      });
      toast.success("가입 요청을 승인했습니다.");
      await handleLoadRequests();
      onChanged();
    } catch (err) {
      toast.error(resolveAxiosError(err) || "가입 요청 승인에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReject(request: CompanyJoinRequestDto) {
    setSaving(true);
    try {
      await reactCompanyApi.rejectJoinRequest(companyId, request.requestId, {});
      toast.success("가입 요청을 거절했습니다.");
      await handleLoadRequests();
    } catch (err) {
      toast.error(resolveAxiosError(err) || "가입 요청 거절에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <PageToolbar
          divider={false}
          label={`가입 요청 ${requests.length}건 · 초대 코드를 발급하고 사용자가 제출한 가입 요청을 승인합니다.`}
          onRefresh={() => {
            if (!loadingRequests) {
              void handleLoadRequests();
            }
          }}
          actions={
            <Tooltip title="초대 코드 생성">
              <span>
                <IconButton
                  size="small"
                  aria-label="초대 코드 생성"
                  disabled={archived}
                  onClick={() => setKeyDialogOpen(true)}
                >
                  <AddOutlined fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          }
        />

        {createdKey?.memberKey ? (
          <Alert severity="success" variant="outlined">
            생성된 초대 코드: {createdKey.memberKey}
          </Alert>
        ) : null}

        <Box sx={{ height: 400, overflow: "auto" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>요청자</TableCell>
                <TableCell>이메일</TableCell>
                <TableCell>역할</TableCell>
                <TableCell>상태</TableCell>
                <TableCell>요청일시</TableCell>
                <TableCell width={150} align="right">
                  작업
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography color="text.secondary">표시할 가입 요청이 없습니다.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              requests.map((request) => (
                <TableRow key={request.requestId} hover>
                  <TableCell>{request.name ?? `User #${request.userId ?? "-"}`}</TableCell>
                  <TableCell>{request.email ?? "-"}</TableCell>
                  <TableCell>{companyRoleLabel(request.role ?? "MEMBER")}</TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" label={request.status} sx={{ height: 22 }} />
                  </TableCell>
                  <TableCell>{request.requestedAt ?? "-"}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={saving || archived || request.status !== "PENDING"}
                        onClick={() => void handleApprove(request)}
                      >
                        승인
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        disabled={saving || archived || request.status !== "PENDING"}
                        onClick={() => void handleReject(request)}
                      >
                        거절
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
              )}
            </TableBody>
          </Table>
        </Box>
      </Stack>

      <Dialog open={keyDialogOpen} onClose={() => setKeyDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>초대 코드 생성</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <Alert severity="info">
              사용자는 회원 가입 또는 내 프로필에서 이 키를 입력해 회사 가입을 요청합니다. 관리자가 요청을 승인하면
              아래 기본 역할로 회사 멤버가 됩니다.
            </Alert>
            <TextField
              label="기본 역할"
              select
              size="small"
              value={keyForm.role}
              onChange={(event) => setKeyForm((current) => ({ ...current, role: event.target.value as CompanyRole }))}
              fullWidth
              helperText="이 초대 코드로 가입 요청한 사용자가 승인될 때 부여할 회사 역할입니다."
            >
              {roleOptions.map((role) => (
                <MenuItem key={role} value={role}>
                  {companyRoleLabel(role)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="만료 일시"
              type="datetime-local"
              size="small"
              value={keyForm.expiresAt}
              onChange={(event) => setKeyForm((current) => ({ ...current, expiresAt: event.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
              helperText="키를 사용할 수 있는 마지막 일시입니다. 비워두면 서버 기본 정책을 따릅니다."
            />
            <TextField
              label="최대 사용 횟수"
              size="small"
              value={keyForm.maxUses}
              onChange={(event) => setKeyForm((current) => ({ ...current, maxUses: event.target.value }))}
              fullWidth
              helperText="이 초대 코드로 만들 수 있는 가입 요청 수입니다. 1회용 코드가 기본값입니다."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setKeyDialogOpen(false)} disabled={saving}>
            닫기
          </Button>
          <Button variant="contained" onClick={() => void handleCreateKey()} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : "생성"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

function CompanyPermissionPolicyPanel({
  companyId,
  actions,
  summary,
  policy,
  draft,
  loading,
  saving,
  error,
  dirty,
  onChange,
  onReset,
  onReload,
  onSave,
}: {
  companyId: number;
  actions: string[];
  summary: CompanyPermissionSummary | null;
  policy: CompanyPermissionPolicyDto | null;
  draft: CompanyPermissionPolicyDraft;
  loading: boolean;
  saving: boolean;
  error: string | null;
  dirty: boolean;
  onChange: (role: CompanyRole, action: string, checked: boolean) => void;
  onReset: () => void;
  onReload: () => void;
  onSave: () => void;
}) {
  const grantedActionSet = useMemo(() => new Set(summary?.actions ?? []), [summary?.actions]);
  const canManage = grantedActionSet.has("company.permission.manage");
  const overriddenRoles = useMemo(
    () => (policy?.roles ?? []).filter((rolePolicy) => rolePolicy.override).map((rolePolicy) => rolePolicy.role),
    [policy?.roles]
  );

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" useFlexGap flexWrap="wrap">
          <Box>
            <Typography variant="subtitle1">회사별 권한 정책</Typography>
            <Typography variant="caption" color="text.secondary">
              Company #{companyId}의 역할별 허용 action을 관리합니다.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" onClick={onReload} disabled={loading || saving}>
              다시 조회
            </Button>
            <Button size="small" variant="outlined" onClick={onReset} disabled={loading || saving || !dirty}>
              되돌리기
            </Button>
            <Button size="small" variant="contained" onClick={onSave} disabled={loading || saving || !dirty || !canManage}>
              {saving ? <CircularProgress size={18} /> : "정책 저장"}
            </Button>
          </Stack>
        </Stack>

        {error ? (
          <Alert severity="info">
            {error} 현재 화면은 기본 역할 매핑을 기준으로 표시합니다.
          </Alert>
        ) : null}

        {!canManage ? (
          <Alert severity="warning">
            정책 저장에는 <strong>company.permission.manage</strong> 권한이 필요합니다.
          </Alert>
        ) : null}

        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            variant="outlined"
            label={overriddenRoles.length ? `커스텀 정책 ${overriddenRoles.length}개 역할` : "기본 정책"}
          />
          {overriddenRoles.map((role) => (
            <Chip key={role} size="small" color="primary" variant="outlined" label={companyRoleLabel(role)} />
          ))}
        </Stack>

        <Box sx={{ overflowX: "auto" }}>
          <Table
            size="small"
            sx={{
              minWidth: 840,
              "& th": { whiteSpace: "nowrap" },
              "& td": { borderColor: "divider" },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 260, position: "sticky", left: 0, zIndex: 1, bgcolor: "background.paper" }}>
                  Action
                </TableCell>
                {roleOptions.map((role) => (
                  <TableCell key={role} align="center" sx={{ minWidth: 140 }}>
                    <Stack spacing={0.25} alignItems="center">
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {companyRoleLabel(role)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {role}
                      </Typography>
                    </Stack>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {actions.map((action) => (
                <TableRow key={action} hover>
                  <TableCell sx={{ position: "sticky", left: 0, zIndex: 1, bgcolor: "background.paper" }}>
                    <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                      <Chip
                        size="small"
                        color={grantedActionSet.has(action) ? "success" : "default"}
                        variant={grantedActionSet.has(action) ? "filled" : "outlined"}
                        label={grantedActionSet.has(action) ? "내 권한" : "정의됨"}
                      />
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {action}
                      </Typography>
                    </Stack>
                  </TableCell>
                  {roleOptions.map((role) => {
                    const checked = draft[role]?.includes(action) ?? false;
                    return (
                      <TableCell
                        key={`${action}-${role}`}
                        align="center"
                        sx={{
                          bgcolor: checked ? "action.hover" : "transparent",
                        }}
                      >
                        <Checkbox
                          size="small"
                          checked={checked}
                          onChange={(event) => onChange(role, action, event.target.checked)}
                          disabled={loading || saving || !canManage}
                          inputProps={{ "aria-label": `${companyRoleLabel(role)} ${action}` }}
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Stack>
    </Paper>
  );
}

function MyCompanyPermissionMatrix({
  actions,
  summary,
}: {
  actions: string[];
  summary: CompanyPermissionSummary | null;
}) {
  const grantedActionSet = useMemo(() => new Set(summary?.actions ?? []), [summary?.actions]);

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="subtitle1">내 권한</Typography>
          <Chip size="small" color="primary" label={`${summary?.actions?.length ?? 0}개`} />
          <Typography variant="caption" color="text.secondary">
            User #{summary?.userId ?? "-"}
          </Typography>
        </Stack>
        <Box sx={{ overflowX: "auto" }}>
          <Table
            size="small"
            sx={{
              minWidth: 520,
              "& th": { whiteSpace: "nowrap" },
              "& td": { borderColor: "divider" },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 280 }}>Action</TableCell>
                <TableCell align="center" sx={{ width: 160 }}>
                  허용 여부
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {actions.map((action) => {
                const granted = grantedActionSet.has(action);
                return (
                  <TableRow key={action} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {action}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ bgcolor: granted ? "action.hover" : "transparent" }}>
                      <Checkbox
                        size="small"
                        checked={granted}
                        disabled
                        inputProps={{ "aria-label": `내 권한 ${action}` }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      </Stack>
    </Paper>
  );
}

export function CompanyDetailPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const companyIdNumber = Number(companyId);
  const basicInfoRef = useRef<HTMLDivElement | null>(null);
  const workspaceScopeRef = useRef<HTMLDivElement | null>(null);
  const membersRef = useRef<HTMLDivElement | null>(null);
  const joinRequestsRef = useRef<HTMLDivElement | null>(null);
  const myPermissionsRef = useRef<HTMLDivElement | null>(null);
  const permissionPolicyRef = useRef<HTMLDivElement | null>(null);

  const [tab, setTab] = useState<CompanyTab>("basic");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyDto | null>(null);
  const [members, setMembers] = useState<CompanyMemberDto[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [usersById, setUsersById] = useState<Record<number, UserDto | undefined>>({});
  const [permissionSummary, setPermissionSummary] = useState<CompanyPermissionSummary | null>(null);
  const [permissionActions, setPermissionActions] = useState<string[]>([]);
  const [permissionPolicy, setPermissionPolicy] = useState<CompanyPermissionPolicyDto | null>(null);
  const [permissionPolicyDraft, setPermissionPolicyDraft] = useState<CompanyPermissionPolicyDraft>(
    createDefaultPermissionDraft([])
  );
  const [permissionPolicyError, setPermissionPolicyError] = useState<string | null>(null);
  const [permissionPolicyLoading, setPermissionPolicyLoading] = useState(false);
  const [permissionPolicySaving, setPermissionPolicySaving] = useState(false);
  const [permissionPolicyDirty, setPermissionPolicyDirty] = useState(false);
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    domainName: "",
    description: "",
    propertiesText: "{}",
  });

  const archived = company?.status === "ARCHIVED" || Boolean(company?.archivedAt);
  const filteredMembers = useMemo(() => {
    const keyword = memberSearch.trim().toLowerCase();
    if (!keyword) {
      return members;
    }
    return members.filter((member) => {
      const user = usersById[member.userId];
      return [
        String(member.userId),
        user?.username,
        user?.name,
        user?.email,
        member.role,
        member.status,
      ]
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .some((value) => value.toLowerCase().includes(keyword));
    });
  }, [memberSearch, members, usersById]);

  const applyPermissionPolicy = useCallback((policy: CompanyPermissionPolicyDto | null, actions: string[]) => {
    setPermissionPolicy(policy);
    setPermissionPolicyDraft(normalizePolicyRoles(policy, actions));
    setPermissionPolicyDirty(false);
  }, []);

  const loadCompany = useCallback(async () => {
    if (!Number.isFinite(companyIdNumber) || companyIdNumber <= 0) {
      setError("잘못된 Company ID입니다.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [nextCompany, nextMembers, nextPermissions, nextActions, nextPolicyResult] = await Promise.all([
        reactCompanyApi.get(companyIdNumber),
        reactCompanyApi.members(companyIdNumber, { page: 0, size: 200, sort: "userId,asc" }).catch(() => null),
        reactCompanyApi.permissionsMe(companyIdNumber).catch(() => null),
        reactCompanyApi.permissionActions(companyIdNumber).catch(() => []),
        reactCompanyApi.permissionPolicy(companyIdNumber)
          .then((policy) => ({ policy, error: null as string | null }))
          .catch((policyError) => ({
            policy: null,
            error: resolveAxiosError(policyError) || "Company 권한 정책을 불러오지 못했습니다.",
          })),
      ]);
      const nextMemberList: CompanyMemberDto[] = nextMembers?.content ?? [];

      setCompany(nextCompany);
      setForm({
        displayName: nextCompany.displayName ?? "",
        domainName: nextCompany.domainName ?? "",
        description: nextCompany.description ?? "",
        propertiesText: formatProperties(nextCompany.properties),
      });
      setMembers(nextMemberList);
      setPermissionSummary(nextPermissions);
      setPermissionActions(nextActions);
      applyPermissionPolicy(nextPolicyResult.policy, nextActions);
      setPermissionPolicyError(nextPolicyResult.error);

      const userIds = Array.from(
        new Set(
          nextMemberList
            .map((member) => member.userId)
            .filter((userId): userId is number => typeof userId === "number" && userId > 0)
        )
      );
      const userEntries = await Promise.all(
        userIds.map(async (userId) => {
          try {
            return [userId, await reactUsersApi.getUser(userId)] as const;
          } catch {
            return [userId, undefined] as const;
          }
        })
      );
      setUsersById(Object.fromEntries(userEntries));
      setError(null);
    } catch (err) {
      setError(resolveAxiosError(err) || "Company를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [applyPermissionPolicy, companyIdNumber]);

  useEffect(() => {
    void loadCompany();
  }, [loadCompany]);

  async function handleSave() {
    if (!company) return;
    let properties: Record<string, unknown>;
    try {
      properties = parseProperties(form.propertiesText);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "속성 JSON 형식이 올바르지 않습니다.");
      return;
    }

    setSaving(true);
    try {
      const saved = await reactCompanyApi.update(company.companyId, {
        displayName: form.displayName.trim(),
        domainName: form.domainName.trim() || null,
        description: form.description.trim() || null,
        properties,
      });
      setCompany(saved);
      setForm({
        displayName: saved.displayName ?? "",
        domainName: saved.domainName ?? "",
        description: saved.description ?? "",
        propertiesText: formatProperties(saved.properties),
      });
      toast.success("Company가 저장되었습니다.");
    } catch (err) {
      toast.error(resolveAxiosError(err) || "Company 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!company) return;
    const ok = await confirm({
      title: "Company 비활성화",
      message: `${company.displayName ?? company.name} Company를 비활성화하시겠습니까?`,
      okText: "비활성화",
      cancelText: "취소",
    });
    if (!ok) return;

    setSaving(true);
    try {
      await reactCompanyApi.archive(company.companyId);
      toast.success("Company가 비활성화되었습니다.");
      await loadCompany();
    } catch (err) {
      toast.error(resolveAxiosError(err) || "Company 비활성화에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMembers(selectedUsers: UserDto[]) {
    if (!company) return;
    const userIds = Array.from(
      new Set(selectedUsers.map((user) => user.userId).filter((userId): userId is number => typeof userId === "number"))
    );
    if (userIds.length === 0) {
      toast.info("추가할 멤버가 없습니다.");
      return;
    }

    try {
      const addedMembers = await Promise.all(
        userIds.map((userId) => reactCompanyApi.addMember(company.companyId, { userId, role: "MEMBER" }))
      );
      const selectedUsersById = Object.fromEntries(
        selectedUsers
          .filter((user): user is UserDto & { userId: number } => typeof user.userId === "number")
          .map((user) => [user.userId, user])
      );
      setMembers((current) => {
        const byUserId = new Map(current.map((member) => [member.userId, member]));
        addedMembers.forEach((member, index) => {
          const fallbackUserId = userIds[index];
          byUserId.set(member.userId ?? fallbackUserId, {
            ...member,
            companyId: member.companyId ?? company.companyId,
            userId: member.userId ?? fallbackUserId,
            role: member.role ?? "MEMBER",
          });
        });
        return Array.from(byUserId.values()).sort((left, right) => left.userId - right.userId);
      });
      setUsersById((current) => ({
        ...current,
        ...selectedUsersById,
      }));
      toast.success(`${userIds.length}명의 멤버가 추가되었습니다.`);
    } catch (err) {
      toast.error(resolveAxiosError(err) || "멤버 추가에 실패했습니다.");
    }
  }

  async function handleChangeRole(member: CompanyMemberDto, role: CompanyRole) {
    if (!company) return;
    try {
      await reactCompanyApi.changeMemberRole(company.companyId, member.userId, { role });
      toast.success("역할이 변경되었습니다.");
      await loadCompany();
    } catch (err) {
      toast.error(resolveAxiosError(err) || "역할 변경에 실패했습니다.");
    }
  }

  async function handleRemoveMember(member: CompanyMemberDto) {
    if (!company) return;
    const user = usersById[member.userId];
    const ok = await confirm({
      title: "멤버 제거",
      message: `${user?.username ?? `User #${member.userId}`} 멤버를 제거하시겠습니까?`,
      okText: "제거",
      cancelText: "취소",
    });
    if (!ok) return;

    try {
      await reactCompanyApi.removeMember(company.companyId, member.userId);
      toast.success("멤버가 제거되었습니다.");
      await loadCompany();
    } catch (err) {
      toast.error(resolveAxiosError(err) || "멤버 제거에 실패했습니다.");
    }
  }

  async function reloadPermissionPolicy() {
    if (!company) return;
    setPermissionPolicyLoading(true);
    try {
      const policy = await reactCompanyApi.permissionPolicy(company.companyId);
      applyPermissionPolicy(policy, permissionActions);
      setPermissionPolicyError(null);
    } catch (err) {
      applyPermissionPolicy(null, permissionActions);
      setPermissionPolicyError(resolveAxiosError(err) || "Company 권한 정책을 불러오지 못했습니다.");
    } finally {
      setPermissionPolicyLoading(false);
    }
  }

  function handlePermissionPolicyChange(role: CompanyRole, action: string, checked: boolean) {
    setPermissionPolicyDraft((current) => {
      const currentActions = new Set(current[role] ?? []);
      if (checked) {
        currentActions.add(action);
      } else {
        currentActions.delete(action);
      }
      return {
        ...current,
        [role]: permissionActions.filter((candidate) => currentActions.has(candidate)),
      };
    });
    setPermissionPolicyDirty(true);
  }

  function resetPermissionPolicyDraft() {
    setPermissionPolicyDraft(normalizePolicyRoles(permissionPolicy, permissionActions));
    setPermissionPolicyDirty(false);
  }

  async function savePermissionPolicy() {
    if (!company) return;
    setPermissionPolicySaving(true);
    try {
      const saved = await reactCompanyApi.updatePermissionPolicy(company.companyId, {
        roles: policyPayload(permissionPolicyDraft),
      });
      applyPermissionPolicy(saved, permissionActions);
      setPermissionPolicyError(null);
      toast.success("Company 권한 정책이 저장되었습니다.");
    } catch (err) {
      toast.error(resolveAxiosError(err) || "Company 권한 정책 저장에 실패했습니다.");
    } finally {
      setPermissionPolicySaving(false);
    }
  }

  function scrollToCompanySection(nextTab: CompanyTab, ref: React.RefObject<HTMLDivElement | null>) {
    setTab(nextTab);
    window.setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  if (loading) {
    return <SkeletonPlaceholder variant="detail" />;
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!company) return null;

  return (
    <Stack spacing={2}>
      <PageToolbar
        divider
        breadcrumbs={[
          "시스템관리",
          "회사",
          company.displayName && company.displayName !== company.name
            ? `${company.displayName} (${company.name})`
            : company.name,
        ]}
        label="Company 기본 정보와 멤버 권한을 관리합니다."
        previous
        onPrevious={() => navigate("/admin/companies")}
        onRefresh={loadCompany}
        actions={
          <Tooltip title="작업공간 목록 보기">
            <IconButton
              size="small"
              onClick={() => navigate(`/application/workspaces?companyId=${company.companyId}`)}
            >
              <AccountTreeOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        }
      />

      {archived ? <Alert severity="info">비활성화된 Company입니다. 기본 정보와 멤버 변경은 제한됩니다.</Alert> : null}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1080px) 180px" },
          gap: 2,
        }}
      >
        <Stack spacing={2} sx={{ maxWidth: 1080, width: "100%", minWidth: 0 }}>
      <Container ref={basicInfoRef} maxWidth={false} disableGutters sx={{ scrollMarginTop: 56 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={1.5}>
              <TextField label="Name" size="small" value={company.name} disabled fullWidth />
              <TextField
                label="표시 이름"
                size="small"
                value={form.displayName}
                onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                disabled={archived || saving}
                fullWidth
              />
              <TextField
                label="Domain"
                size="small"
                value={form.domainName}
                onChange={(event) => setForm((current) => ({ ...current, domainName: event.target.value }))}
                disabled={archived || saving}
                fullWidth
              />
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack spacing={1.5}>
              <TextField
                label="설명"
                size="small"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                disabled={archived || saving}
                multiline
                minRows={3}
                fullWidth
              />
              <Stack direction="row" spacing={2}>
                <StatItem label="ID" value={company.companyId} />
                <StatItem label="생성일시" value={formatDateTime(company.creationDate)} />
                <StatItem label="수정일시" value={formatDateTime(company.modifiedDate)} />
              </Stack>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Stack spacing={1.5} alignItems="flex-start">
              <Typography variant="caption" color="text.secondary">
                현재 상태
              </Typography>
              <Chip
                size="small"
                color={company.status === "ACTIVE" ? "success" : "default"}
                variant={company.status === "ACTIVE" ? "filled" : "outlined"}
                label={companyStatusLabel(company.status)}
              />
            </Stack>
          </Grid>
          <Grid size={12}>
            <TextField
              label="속성(JSON)"
              size="small"
              value={form.propertiesText}
              onChange={(event) => setForm((current) => ({ ...current, propertiesText: event.target.value }))}
              disabled={archived || saving}
              multiline
              minRows={5}
              fullWidth
            />
          </Grid>
          <Grid size={12}>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                variant="outlined"
                startIcon={<SaveOutlined />}
                disabled={archived || saving || !form.displayName.trim()}
                onClick={() => void handleSave()}
              >
                {saving ? <CircularProgress size={20} /> : "저장"}
              </Button>
              <Tooltip title={archived ? "Company 활성화 API가 서버에 추가되면 연결할 수 있습니다." : "Company 비활성화"}>
                <span>
                  <Button
                    variant="outlined"
                    color={archived ? "primary" : "warning"}
                    disabled={archived || saving}
                    onClick={() => void handleDeactivate()}
                  >
                    {archived ? "활성화" : "비활성화"}
                  </Button>
                </span>
              </Tooltip>
            </Stack>
          </Grid>
        </Grid>
      </Container>

      <Tabs value={tab} onChange={(_, value: CompanyTab) => setTab(value)} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tab value="basic" label="기본 정보" />
        <Tab value="members" label="멤버" />
        <Tab value="permissions" label="권한" />
      </Tabs>

      {tab === "basic" ? (
        <Paper ref={workspaceScopeRef} variant="outlined" sx={{ p: 2, scrollMarginTop: 56 }}>
          <Stack spacing={1}>
            <Typography variant="subtitle1">작업공간 Scope</Typography>
            <Typography variant="body2" color="text.secondary">
              이 Company에 연결된 작업공간을 목록에서 필터링해 확인할 수 있습니다.
            </Typography>
            <Box>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AccountTreeOutlined />}
                onClick={() => navigate(`/application/workspaces?companyId=${company.companyId}`)}
              >
                작업공간 목록 보기
              </Button>
            </Box>
          </Stack>
        </Paper>
      ) : null}

      {tab === "members" ? (
        <Stack spacing={2}>
          <Paper ref={membersRef} variant="outlined" sx={{ p: 2, scrollMarginTop: 56 }}>
            <CompanyMembersTable
              members={filteredMembers}
              totalMembers={members.length}
              usersById={usersById}
              archived={archived}
              searchValue={memberSearch}
              onAdd={() => setUserSearchOpen(true)}
              onSearchChange={setMemberSearch}
              onRefresh={() => void loadCompany()}
              onChangeRole={handleChangeRole}
              onRemove={(member) => void handleRemoveMember(member)}
            />
          </Paper>
          <Box ref={joinRequestsRef} sx={{ scrollMarginTop: 56 }}>
            <CompanyJoinAdminPanel
              companyId={company.companyId}
              archived={archived}
              onChanged={() => void loadCompany()}
            />
          </Box>
        </Stack>
      ) : null}

      {tab === "permissions" ? (
        <Stack spacing={2}>
          <Box ref={myPermissionsRef} sx={{ scrollMarginTop: 56 }}>
            <MyCompanyPermissionMatrix actions={permissionActions} summary={permissionSummary} />
          </Box>
          <Box ref={permissionPolicyRef} sx={{ scrollMarginTop: 56 }}>
            <CompanyPermissionPolicyPanel
              companyId={company.companyId}
              actions={permissionActions}
              summary={permissionSummary}
              policy={permissionPolicy}
              draft={permissionPolicyDraft}
              loading={permissionPolicyLoading}
              saving={permissionPolicySaving}
              error={permissionPolicyError}
              dirty={permissionPolicyDirty}
              onChange={handlePermissionPolicyChange}
              onReset={resetPermissionPolicyDraft}
              onReload={() => void reloadPermissionPolicy()}
              onSave={() => void savePermissionPolicy()}
            />
          </Box>
        </Stack>
      ) : null}
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
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.2 }}>
            Contents
          </Typography>
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            {[
              { label: "기본 정보", tab: "basic" as CompanyTab, ref: basicInfoRef, active: tab === "basic" },
              { label: "멤버", tab: "members" as CompanyTab, ref: membersRef, active: tab === "members" },
              { label: "가입 요청 관리", tab: "members" as CompanyTab, ref: joinRequestsRef, active: tab === "members" },
              { label: "내 권한", tab: "permissions" as CompanyTab, ref: myPermissionsRef, active: tab === "permissions" },
              { label: "권한 정책", tab: "permissions" as CompanyTab, ref: permissionPolicyRef, active: tab === "permissions" },
            ].map((item) => (
              <Button
                key={item.label}
                size="small"
                variant="text"
                sx={{
                  justifyContent: "flex-start",
                  color: item.active ? "primary.main" : "text.secondary",
                  fontWeight: item.active ? 700 : 400,
                  borderLeft: item.active ? "2px solid" : "2px solid transparent",
                  borderColor: item.active ? "primary.main" : "transparent",
                  pl: 1,
                }}
                onClick={() => scrollToCompanySection(item.tab, item.ref)}
              >
                {item.label}
              </Button>
            ))}
          </Stack>
        </Box>
      </Box>

      <UserSearchDialog
        open={userSearchOpen}
        onClose={() => setUserSearchOpen(false)}
        selectionMode="multiple"
        confirmLabel="추가"
        onConfirmSelection={(users) => void handleAddMembers(users)}
      />
    </Stack>
  );
}
