import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { ArchiveOutlined, DeleteOutlined, SaveOutlined } from "@mui/icons-material";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { useAuthStore } from "@/react/auth/store";
import { useConfirm, useToast } from "@/react/feedback";
import { reactAiApi } from "@/react/pages/ai/api";
import { reactTeamApi } from "@/react/pages/teams/api";
import { TeamChatPanel } from "@/react/pages/teams/TeamChatPanel";
import { TeamJoinPanel } from "@/react/pages/teams/TeamJoinPanel";
import { WorkspaceListPage } from "@/react/pages/workspaces/WorkspaceListPage";
import type { RagChatCapabilitiesDto } from "@/types/studio/ai";
import type {
  TeamDto,
  TeamJoinPolicy,
  TeamKnowledgeSourceDto,
  TeamMemberDto,
  TeamRagReplyMode,
  TeamRole,
  TeamUpdateRequest,
  TeamVisibility,
} from "@/types/studio/team";
import type { WorkspaceTreeNode } from "@/types/studio/workspace";
import { resolveAxiosError } from "@/utils/helpers";

type TeamTab = "overview" | "chat" | "workspaces" | "sources" | "members" | "settings";

function visibilityLabel(value: TeamVisibility) {
  if (value === "PUBLIC") return "공용";
  if (value === "UNLISTED") return "링크 전용";
  return "비공개";
}

function joinPolicyLabel(value: TeamJoinPolicy) {
  if (value === "OPEN") return "바로 가입";
  if (value === "APPROVAL") return "승인 필요";
  return "초대 전용";
}

function replyModeLabel(value: TeamRagReplyMode) {
  if (value === "AUTO") return "질문 자동 응답";
  if (value === "MENTION") return "@AI 호출";
  return "수동 질문";
}

function sourceTypeLabel(value: string) {
  if (value === "ATTACHMENT") return "첨부파일";
  if (value === "WIKI") return "Wiki";
  if (value === "WEB_SOURCE") return "외부 URL";
  if (value === "TEXT") return "텍스트";
  if (value === "TEST") return "테스트";
  return value;
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value}</Typography>
    </Box>
  );
}

export function TeamDetailPage() {
  const { teamId: teamIdParam } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const currentUserId = useAuthStore((state) => state.user?.userId);
  const teamId = Number(teamIdParam);
  const [tab, setTab] = useState<TeamTab>("overview");
  const [team, setTeam] = useState<TeamDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaceTrees, setWorkspaceTrees] = useState<WorkspaceTreeNode[]>([]);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [sources, setSources] = useState<TeamKnowledgeSourceDto[]>([]);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMemberDto[]>([]);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [teamAccessConfirmed, setTeamAccessConfirmed] = useState(false);
  const [managementAccessConfirmed, setManagementAccessConfirmed] = useState(false);
  const [currentTeamRole, setCurrentTeamRole] = useState<TeamRole | null>(null);
  const [capabilities, setCapabilities] = useState<RagChatCapabilitiesDto | null>(null);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(true);
  const [capabilitiesError, setCapabilitiesError] = useState<string | null>(null);
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState<TeamRole>("MEMBER");
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<TeamUpdateRequest>({});
  const [companyId, setCompanyId] = useState("");

  const invalidTeamId = !Number.isInteger(teamId) || teamId <= 0;

  const loadTeam = useCallback(async () => {
    if (invalidTeamId) return;
    setLoading(true);
    try {
      const value = await reactTeamApi.get(teamId);
      setTeam(value);
      setSettings({
        name: value.name,
        description: value.description ?? "",
        visibility: value.visibility,
        joinPolicy: value.joinPolicy,
        ragEnabled: value.ragEnabled,
        ragReplyMode: value.ragReplyMode,
      });
      setCompanyId(value.companyId ? String(value.companyId) : "");
      setError(null);
    } catch (loadError) {
      setError(resolveAxiosError(loadError) || "Team 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [invalidTeamId, teamId]);

  const loadWorkspaceTree = useCallback(async () => {
    if (invalidTeamId) return;
    try {
      setWorkspaceTrees(await reactTeamApi.workspaceTree(teamId));
      setWorkspaceError(null);
    } catch (loadError) {
      setWorkspaceError(resolveAxiosError(loadError) || "Team Workspace 트리를 불러오지 못했습니다.");
    }
  }, [invalidTeamId, teamId]);

  const loadSources = useCallback(async () => {
    if (invalidTeamId) return;
    try {
      setSources(await reactTeamApi.knowledgeSources(teamId));
      setSourcesError(null);
    } catch (loadError) {
      setSourcesError(resolveAxiosError(loadError) || "Team 자료를 불러오지 못했습니다.");
    }
  }, [invalidTeamId, teamId]);

  const loadMembers = useCallback(async () => {
    if (invalidTeamId) return;
    try {
      const response = await reactTeamApi.members(teamId);
      setMembers(response.content ?? []);
      setCurrentTeamRole(response.content.find((member) => member.userId === currentUserId)?.role ?? null);
      setTeamAccessConfirmed(true);
      setMembersError(null);
    } catch (loadError) {
      setMembers([]);
      setCurrentTeamRole(null);
      setTeamAccessConfirmed(false);
      setManagementAccessConfirmed(false);
      setMembersError(resolveAxiosError(loadError) || "Team 멤버를 불러오지 못했습니다.");
    }
  }, [currentUserId, invalidTeamId, teamId]);

  useEffect(() => {
    void loadTeam();
    void loadMembers();
  }, [loadMembers, loadTeam]);

  useEffect(() => {
    if (!teamAccessConfirmed) return;
    void loadWorkspaceTree();
    void loadSources();
  }, [loadSources, loadWorkspaceTree, teamAccessConfirmed]);

  useEffect(() => {
    setCapabilitiesLoading(true);
    reactAiApi.fetchRagCapabilities()
      .then((value) => {
        setCapabilities(value);
        setCapabilitiesError(null);
      })
      .catch((loadError) => setCapabilitiesError(resolveAxiosError(loadError) || "RAG capability 조회 실패"))
      .finally(() => setCapabilitiesLoading(false));
  }, []);

  const sourceCounts = useMemo(() => {
    return sources.reduce<Record<string, number>>((counts, source) => {
      counts[source.sourceType] = (counts[source.sourceType] ?? 0) + 1;
      return counts;
    }, {});
  }, [sources]);

  async function handleAddMember() {
    if (!memberUserId) return;
    setSaving(true);
    try {
      await reactTeamApi.addMember(teamId, { userId: Number(memberUserId), role: memberRole });
      toast.success("Team 멤버가 추가되었습니다.");
      setMemberUserId("");
      await loadMembers();
    } catch (requestError) {
      toast.error(resolveAxiosError(requestError) || "Team 멤버 추가에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeRole(member: TeamMemberDto, role: TeamRole) {
    try {
      await reactTeamApi.changeMemberRole(teamId, member.userId, { role });
      toast.success("Team 역할이 변경되었습니다.");
      await loadMembers();
    } catch (requestError) {
      toast.error(resolveAxiosError(requestError) || "Team 역할 변경에 실패했습니다.");
    }
  }

  async function handleRemoveMember(member: TeamMemberDto) {
    const accepted = await confirm({
      title: "Team 멤버 제거",
      message: `${member.username ?? `User #${member.userId}`} 멤버를 제거하시겠습니까?`,
      okText: "제거",
      cancelText: "취소",
    });
    if (!accepted) return;
    try {
      await reactTeamApi.removeMember(teamId, member.userId);
      toast.success("Team 멤버가 제거되었습니다.");
      await loadMembers();
    } catch (requestError) {
      toast.error(resolveAxiosError(requestError) || "Team 멤버 제거에 실패했습니다.");
    }
  }

  async function handleSaveSettings() {
    setSaving(true);
    try {
      const updated = await reactTeamApi.update(teamId, {
        ...settings,
        name: settings.name?.trim(),
        companyId: companyId ? Number(companyId) : undefined,
        clearCompanyAssignment: !companyId,
        description: settings.description?.trim() || null,
      });
      setTeam(updated);
      toast.success("Team 설정이 저장되었습니다.");
    } catch (requestError) {
      toast.error(resolveAxiosError(requestError) || "Team 설정 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    const accepted = await confirm({
      title: "Team 보관",
      message: "Workspace와 자료는 유지되지만 신규 채팅과 수정이 중단됩니다. 계속하시겠습니까?",
      okText: "보관",
      cancelText: "취소",
    });
    if (!accepted) return;
    try {
      const updated = await reactTeamApi.archive(teamId);
      setTeam(updated);
      toast.success("Team이 보관되었습니다.");
    } catch (requestError) {
      toast.error(resolveAxiosError(requestError) || "Team 보관에 실패했습니다.");
    }
  }

  if (invalidTeamId) {
    return <Container sx={{ py: 4 }}><Alert severity="error">올바른 Team ID가 아닙니다.</Alert></Container>;
  }

  if (loading && !team) {
    return <Container sx={{ py: 4 }}><Typography color="text.secondary">Team 정보를 불러오는 중...</Typography></Container>;
  }

  if (!team) {
    return <Container sx={{ py: 4 }}><Alert severity="error">{error ?? "Team을 찾을 수 없습니다."}</Alert></Container>;
  }

  return (
    <Container maxWidth={false} sx={{ py: 3 }}>
      <PageToolbar
        breadcrumbs={["Application", "Teams", team.name]}
        previous
        onPrevious={() => navigate("/admin/teams")}
        title={team.name}
        label={`Team #${team.teamId} · ${team.slug}`}
        onRefresh={() => {
          void loadTeam();
          void loadMembers();
          if (teamAccessConfirmed) {
            void loadWorkspaceTree();
            void loadSources();
          }
        }}
        prepend={<Chip size="small" color={team.status === "ACTIVE" ? "success" : "default"} label={team.status === "ACTIVE" ? "활성" : "보관"} />}
      />

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      <Paper variant="outlined">
        <Tabs value={tab} onChange={(_, value: TeamTab) => setTab(value)} variant="scrollable" scrollButtons="auto">
          <Tab value="overview" label="개요" />
          {teamAccessConfirmed ? <Tab value="chat" label="Team Chat" /> : null}
          {teamAccessConfirmed ? <Tab value="workspaces" label="Workspace" /> : null}
          {teamAccessConfirmed ? <Tab value="sources" label="자료" /> : null}
          {teamAccessConfirmed ? <Tab value="members" label="멤버" /> : null}
          {managementAccessConfirmed ? <Tab value="settings" label="설정" /> : null}
        </Tabs>
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          {tab === "overview" ? (
            <Stack spacing={3}>
              <Box>
                <Typography variant="h6" fontWeight={700}>{team.name}</Typography>
                <Typography variant="body2" color="text.secondary">{team.description || "설명이 없습니다."}</Typography>
              </Box>
              <Stack direction="row" spacing={4} flexWrap="wrap" useFlexGap>
                <Stat label="공개 범위" value={visibilityLabel(team.visibility)} />
                <Stat label="가입 정책" value={joinPolicyLabel(team.joinPolicy)} />
                <Stat label="Company" value={team.companyId ? `#${team.companyId}` : "공용 Team"} />
                <Stat label="Workspace 루트" value={`${workspaceTrees.length}개`} />
                <Stat label="RAG" value={team.ragEnabled ? replyModeLabel(team.ragReplyMode) : "사용 안 함"} />
              </Stack>
              <Alert severity="info">
                Team 공개 범위와 자료 공개 범위는 다릅니다. 공용 Team도 멤버 권한을 통과한 자료만 RAG 검색과 인용에 사용합니다.
              </Alert>
              <TeamJoinPanel
                team={team}
                accessConfirmed={teamAccessConfirmed}
                currentRole={currentTeamRole}
                tryManageRequests={teamAccessConfirmed}
                onJoined={() => {
                  setTeamAccessConfirmed(true);
                  void loadMembers();
                }}
                onManagementAccessChange={setManagementAccessConfirmed}
              />
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {Object.entries(sourceCounts).map(([type, count]) => <Chip key={type} label={`${sourceTypeLabel(type)} ${count}`} />)}
                {sources.length === 0 ? <Chip label="등록 자료 0" /> : null}
              </Stack>
            </Stack>
          ) : null}

          {tab === "chat" ? (
            <TeamChatPanel
              team={team}
              workspaceTrees={workspaceTrees}
              capabilities={capabilities}
              capabilitiesLoading={capabilitiesLoading}
              capabilitiesError={capabilitiesError}
            />
          ) : null}

          {tab === "workspaces" ? (
            <Stack spacing={2}>
              {workspaceError ? <Alert severity="warning">{workspaceError}</Alert> : null}
              <WorkspaceListPage teamId={team.teamId} embedded />
            </Stack>
          ) : null}

          {tab === "sources" ? (
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>Team 자료</Typography>
                <Typography variant="body2" color="text.secondary">기존 첨부파일·Wiki·외부 URL의 ID와 RAG 색인을 재사용합니다.</Typography>
              </Box>
              {sourcesError ? <Alert severity="warning">{sourcesError}</Alert> : null}
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead><TableRow><TableCell>유형</TableCell><TableCell>자료</TableCell><TableCell>Workspace</TableCell><TableCell>Revision</TableCell><TableCell>상태</TableCell></TableRow></TableHead>
                  <TableBody>
                    {sources.map((source) => (
                      <TableRow key={`${source.sourceType}-${source.sourceId}`} hover>
                        <TableCell><Chip size="small" variant="outlined" label={sourceTypeLabel(source.sourceType)} /></TableCell>
                        <TableCell>{source.title || source.sourceId}</TableCell>
                        <TableCell><Button size="small" onClick={() => navigate(`/application/workspaces/${source.workspaceId}`)}>#{source.workspaceId}</Button></TableCell>
                        <TableCell>{source.revisionId ?? "-"}</TableCell>
                        <TableCell>{source.status ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                    {sources.length === 0 ? <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6 }}>등록된 자료가 없습니다.</TableCell></TableRow> : null}
                  </TableBody>
                </Table>
              </Box>
            </Stack>
          ) : null}

          {tab === "members" ? (
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="flex-end">
                <TextField size="small" label="User ID" value={memberUserId} onChange={(event) => setMemberUserId(event.target.value.replace(/\D/g, ""))} />
                <TextField select size="small" label="역할" value={memberRole} onChange={(event) => setMemberRole(event.target.value as TeamRole)} sx={{ minWidth: 150 }}>
                  <MenuItem value="MEMBER">Member</MenuItem><MenuItem value="ADMIN">Admin</MenuItem><MenuItem value="OWNER">Owner</MenuItem>
                </TextField>
                <Button variant="contained" onClick={() => void handleAddMember()} disabled={!managementAccessConfirmed || !memberUserId || saving || team.status === "ARCHIVED"}>멤버 추가</Button>
              </Stack>
              {membersError ? <Alert severity="warning">{membersError}</Alert> : null}
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead><TableRow><TableCell>사용자</TableCell><TableCell>메일</TableCell><TableCell width={180}>역할</TableCell><TableCell width={90}>상태</TableCell><TableCell width={70}>작업</TableCell></TableRow></TableHead>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.userId} hover>
                        <TableCell>{member.name || member.username || `User #${member.userId}`}</TableCell>
                        <TableCell>{member.email ?? "-"}</TableCell>
                        <TableCell>
                          <TextField select size="small" value={member.role} disabled={!managementAccessConfirmed || team.status === "ARCHIVED"} onChange={(event) => void handleChangeRole(member, event.target.value as TeamRole)}>
                            <MenuItem value="MEMBER">Member</MenuItem><MenuItem value="ADMIN">Admin</MenuItem><MenuItem value="OWNER">Owner</MenuItem>
                          </TextField>
                        </TableCell>
                        <TableCell>{member.status}</TableCell>
                        <TableCell><Button color="error" aria-label={`멤버 ${member.userId} 제거`} onClick={() => void handleRemoveMember(member)} disabled={!managementAccessConfirmed || team.status === "ARCHIVED"}><DeleteOutlined fontSize="small" /></Button></TableCell>
                      </TableRow>
                    ))}
                    {members.length === 0 ? <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6 }}>표시할 멤버가 없습니다.</TableCell></TableRow> : null}
                  </TableBody>
                </Table>
              </Box>
            </Stack>
          ) : null}

          {tab === "settings" ? (
            <Stack spacing={2} sx={{ maxWidth: 760 }}>
              <TextField size="small" label="이름" value={settings.name ?? ""} onChange={(event) => setSettings((current) => ({ ...current, name: event.target.value }))} />
              <TextField size="small" label="Slug" value={team.slug} disabled helperText="초기 Team 계약에서 slug는 생성 후 변경할 수 없습니다." />
              <TextField size="small" label="Company ID (선택)" value={companyId} onChange={(event) => setCompanyId(event.target.value.replace(/\D/g, ""))} helperText="비워 두면 Company에 속하지 않는 공용 Team입니다." />
              <TextField size="small" label="설명" multiline minRows={3} value={settings.description ?? ""} onChange={(event) => setSettings((current) => ({ ...current, description: event.target.value }))} />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField select size="small" label="공개 범위" value={settings.visibility ?? "PRIVATE"} onChange={(event) => setSettings((current) => ({ ...current, visibility: event.target.value as TeamVisibility }))} fullWidth>
                  <MenuItem value="PUBLIC">공용</MenuItem><MenuItem value="UNLISTED">링크 전용</MenuItem><MenuItem value="PRIVATE">비공개</MenuItem>
                </TextField>
                <TextField select size="small" label="가입 정책" value={settings.joinPolicy ?? "INVITE_ONLY"} onChange={(event) => setSettings((current) => ({ ...current, joinPolicy: event.target.value as TeamJoinPolicy }))} fullWidth>
                  <MenuItem value="OPEN">바로 가입</MenuItem><MenuItem value="APPROVAL">승인 필요</MenuItem><MenuItem value="INVITE_ONLY">초대 전용</MenuItem>
                </TextField>
                <TextField select size="small" label="RAG 응답" value={settings.ragReplyMode ?? "MENTION"} onChange={(event) => setSettings((current) => ({ ...current, ragReplyMode: event.target.value as TeamRagReplyMode }))} fullWidth>
                  <MenuItem value="MANUAL">수동</MenuItem><MenuItem value="MENTION">@AI 호출</MenuItem><MenuItem value="AUTO">질문 자동</MenuItem>
                </TextField>
              </Stack>
              <FormControlLabel control={<Switch checked={settings.ragEnabled === true} onChange={(event) => setSettings((current) => ({ ...current, ragEnabled: event.target.checked }))} />} label="Team RAG 답변 사용" />
              <Stack direction="row" spacing={1}>
                <Button variant="contained" startIcon={<SaveOutlined />} onClick={() => void handleSaveSettings()} disabled={saving || team.status === "ARCHIVED"}>설정 저장</Button>
                <Button color="warning" startIcon={<ArchiveOutlined />} onClick={() => void handleArchive()} disabled={team.status === "ARCHIVED"}>Team 보관</Button>
              </Stack>
            </Stack>
          ) : null}
        </Box>
      </Paper>
    </Container>
  );
}
