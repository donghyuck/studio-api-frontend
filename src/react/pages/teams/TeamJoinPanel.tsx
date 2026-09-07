import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { CheckOutlined, CloseOutlined, GroupAddOutlined } from "@mui/icons-material";
import { reactTeamApi } from "@/react/pages/teams/api";
import type { TeamDto, TeamJoinRequestDto, TeamJoinResultDto, TeamRole } from "@/types/studio/team";
import { resolveAxiosError } from "@/utils/helpers";

function joinPolicyDescription(team: TeamDto) {
  if (team.joinPolicy === "OPEN") return "가입하면 즉시 Team 멤버가 됩니다.";
  if (team.joinPolicy === "APPROVAL") return "가입 요청 후 Team 관리자 승인이 필요합니다.";
  return "초대받은 사용자만 가입할 수 있습니다.";
}

export interface TeamJoinPanelProps {
  team: TeamDto;
  accessConfirmed: boolean;
  currentRole?: TeamRole | null;
  tryManageRequests: boolean;
  onJoined: (result: TeamJoinResultDto) => void;
  onManagementAccessChange?: (allowed: boolean) => void;
}

export function TeamJoinPanel({
  team,
  accessConfirmed,
  currentRole,
  tryManageRequests,
  onJoined,
  onManagementAccessChange,
}: TeamJoinPanelProps) {
  const [joining, setJoining] = useState(false);
  const [joinResult, setJoinResult] = useState<TeamJoinResultDto | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [requests, setRequests] = useState<TeamJoinRequestDto[]>([]);
  const [canManageRequests, setCanManageRequests] = useState(false);
  const [resolvingRequestId, setResolvingRequestId] = useState<number | null>(null);
  const [managementError, setManagementError] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    if (!tryManageRequests) return;
    try {
      const response = await reactTeamApi.joinRequests(team.teamId, "PENDING");
      setRequests(response);
      setCanManageRequests(true);
      setManagementError(null);
      onManagementAccessChange?.(true);
    } catch {
      // 권한이 없는 사용자의 관리 endpoint 실패는 상세 내용 없이 fail-closed 처리합니다.
      setRequests([]);
      setCanManageRequests(false);
      onManagementAccessChange?.(false);
    }
  }, [onManagementAccessChange, team.teamId, tryManageRequests]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  async function handleJoin() {
    if (team.joinPolicy === "INVITE_ONLY" || team.status === "ARCHIVED") return;
    setJoining(true);
    setJoinError(null);
    try {
      const result = await reactTeamApi.join(team.teamId);
      setJoinResult(result);
      if (result.outcome === "JOINED" || result.outcome === "ALREADY_MEMBER") {
        onJoined(result);
      }
    } catch (error) {
      setJoinError(resolveAxiosError(error) || "Team 가입 요청을 처리하지 못했습니다.");
    } finally {
      setJoining(false);
    }
  }

  async function resolveRequest(request: TeamJoinRequestDto, decision: "approve" | "reject") {
    setResolvingRequestId(request.requestId);
    setManagementError(null);
    try {
      if (decision === "approve") {
        await reactTeamApi.approveJoinRequest(team.teamId, request.requestId);
      } else {
        await reactTeamApi.rejectJoinRequest(team.teamId, request.requestId);
      }
      await loadRequests();
    } catch (error) {
      setManagementError(resolveAxiosError(error) || "가입 요청을 처리하지 못했습니다.");
    } finally {
      setResolvingRequestId(null);
    }
  }

  return (
    <Stack spacing={2}>
      {accessConfirmed ? (
        <Alert severity="success" icon={<CheckOutlined />}>
          Team 멤버로 접근 중입니다{currentRole ? ` · ${currentRole}` : ""}.
        </Alert>
      ) : team.visibility === "PUBLIC" ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
            <Stack spacing={0.5} sx={{ flex: 1 }}>
              <Typography variant="subtitle2" fontWeight={700}>이 Team에 참여하기</Typography>
              <Typography variant="body2" color="text.secondary">{joinPolicyDescription(team)}</Typography>
              {joinResult?.outcome === "PENDING" ? (
                <Typography variant="body2" color="warning.main">가입 요청이 승인 대기 중입니다.</Typography>
              ) : null}
              {joinError ? <Alert severity="error">{joinError}</Alert> : null}
            </Stack>
            <Button
              variant="contained"
              startIcon={<GroupAddOutlined />}
              onClick={() => void handleJoin()}
              disabled={joining || team.joinPolicy === "INVITE_ONLY" || team.status === "ARCHIVED" || joinResult?.outcome === "PENDING"}
            >
              {team.joinPolicy === "OPEN" ? "Team 가입" : team.joinPolicy === "APPROVAL" ? "가입 요청" : "초대 필요"}
            </Button>
          </Stack>
        </Paper>
      ) : null}

      {canManageRequests ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle2" fontWeight={700}>가입 요청 관리</Typography>
              <Chip size="small" label={`${requests.length}건 대기`} />
            </Stack>
            {managementError ? <Alert severity="error">{managementError}</Alert> : null}
            <Table size="small" aria-label="Team 가입 요청">
              <TableHead><TableRow><TableCell>사용자</TableCell><TableCell>요청 시각</TableCell><TableCell width={170}>처리</TableCell></TableRow></TableHead>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.requestId}>
                    <TableCell>User #{request.userId}</TableCell>
                    <TableCell>{request.requestedAt ?? "-"}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        <Button size="small" startIcon={<CheckOutlined />} disabled={resolvingRequestId === request.requestId} onClick={() => void resolveRequest(request, "approve")}>승인</Button>
                        <Button size="small" color="error" startIcon={<CloseOutlined />} disabled={resolvingRequestId === request.requestId} onClick={() => void resolveRequest(request, "reject")}>거절</Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {requests.length === 0 ? <TableRow><TableCell colSpan={3} align="center">대기 중인 가입 요청이 없습니다.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  );
}
