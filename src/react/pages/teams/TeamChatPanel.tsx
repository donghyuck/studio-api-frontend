import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { ArrowUpwardOutlined } from "@mui/icons-material";
import { alpha } from "@mui/material/styles";
import { reactAiApi } from "@/react/pages/ai/api";
import type { ChatMessageDto, RagChatCapabilitiesDto } from "@/types/studio/ai";
import { ChatMessageList } from "@/react/pages/ai/components/ChatMessageList";
import type { ChatMessage } from "@/react/pages/ai/components/chatTypes";
import type { TeamDto } from "@/types/studio/team";
import type { WorkspaceTreeNode } from "@/types/studio/workspace";
import { resolveAxiosError } from "@/utils/helpers";

type WorkspaceOption = { id: number; label: string };

export function flattenTeamWorkspaces(node?: WorkspaceTreeNode | null): WorkspaceOption[] {
  if (!node) return [];
  return [
    { id: node.workspace.id, label: `${"  ".repeat(node.workspace.depth)}${node.workspace.name}` },
    ...node.children.flatMap(flattenTeamWorkspaces),
  ];
}

function replyModeLabel(mode: TeamDto["ragReplyMode"]) {
  if (mode === "AUTO") return "질문 자동 응답";
  if (mode === "MENTION") return "@AI 호출";
  return "수동 질문";
}

export interface TeamChatPanelProps {
  team: TeamDto;
  workspaceTrees?: WorkspaceTreeNode[];
  capabilities: RagChatCapabilitiesDto | null;
  capabilitiesLoading: boolean;
  capabilitiesError?: string | null;
}

export function TeamChatPanel({
  team,
  workspaceTrees = [],
  capabilities,
  capabilitiesLoading,
  capabilitiesError,
}: TeamChatPanelProps) {
  const [workspaceId, setWorkspaceId] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workspaces = useMemo(
    () => workspaceTrees.flatMap(flattenTeamWorkspaces),
    [workspaceTrees],
  );
  const teamRagAvailable = capabilities?.teamRag?.enabled === true;
  const disabled =
    capabilitiesLoading ||
    !teamRagAvailable ||
    !team.ragEnabled ||
    team.status === "ARCHIVED" ||
    sending;

  async function submitQuestion(
    question: string,
    baseMessages: ChatMessage[],
    appendUserMessage: boolean,
  ) {
    if (!question || disabled) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
      createdAt: new Date().toISOString(),
    };
    const requestMessages = appendUserMessage ? [...baseMessages, userMessage] : baseMessages;
    setMessages(requestMessages);
    setInput("");
    setSending(true);
    setStreamStatus("Team 자료에서 관련 근거를 검색하고 있습니다.");
    setError(null);
    try {
      await reactAiApi.sendRagChatStream({
        teamId: team.teamId,
        workspaceId: workspaceId ? Number(workspaceId) : undefined,
        chat: {
          messages: requestMessages.map(({ role, content }) => ({ role, content } satisfies ChatMessageDto)),
        },
        ragQuery: question,
      }, {
        onRagStatus: (status) => {
          if (status.stage === "retrieval_complete") {
            setStreamStatus(`근거 ${status.resultCount ?? 0}건을 확인했습니다. 답변을 생성하고 있습니다.`);
          } else if (status.stage === "generation_started") {
            setStreamStatus("확보한 근거로 답변을 생성하고 인용을 검증하고 있습니다.");
          } else {
            setStreamStatus("Team 자료에서 관련 근거를 검색하고 있습니다.");
          }
        },
        onDelta: () => setStreamStatus("답변의 근거와 인용을 검증하고 있습니다."),
        onComplete: (complete) => {
          const metadata = complete.metadata ?? {};
          const content = metadata.canonicalContent || "응답 내용이 없습니다.";
          setMessages([
            ...requestMessages,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content,
              createdAt: new Date().toISOString(),
              model: complete.resolvedModel || metadata.resolvedModel || complete.model,
              metadata,
            },
          ]);
          setStreamStatus(null);
        },
        onError: (streamError) => {
          throw new Error(streamError.errorMessage || "Team RAG 스트림 처리 중 오류가 발생했습니다.");
        },
      });
    } catch (requestError) {
      setError(resolveAxiosError(requestError) || "Team 자료 기반 답변을 생성하지 못했습니다.");
    } finally {
      setSending(false);
      setStreamStatus(null);
    }
  }

  async function handleSubmit() {
    const question = input.trim();
    if (!question) return;
    await submitQuestion(question, messages, true);
  }

  function retryLastQuestion() {
    let lastUserIndex = -1;
    for (let index = messages.length - 1; index >= 0; index--) {
      if (messages[index].role === "user") {
        lastUserIndex = index;
        break;
      }
    }
    if (lastUserIndex < 0) return;
    const question = messages[lastUserIndex].content.trim();
    if (!question) return;
    void submitQuestion(question, messages.slice(0, lastUserIndex + 1), false);
  }

  function copyMessage(content: string) {
    void navigator.clipboard?.writeText(content);
  }

  return (
    <Stack spacing={1.5} sx={{ minHeight: 560 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" fontWeight={700}>Team Chat</Typography>
          <Typography variant="body2" color="text.secondary">
            Team의 Workspace 트리에서 현재 사용자가 읽을 수 있는 자료만 자동으로 검색합니다.
          </Typography>
        </Box>
      </Stack>

      {capabilitiesLoading ? <Alert severity="info">Team RAG 지원 여부를 확인하고 있습니다.</Alert> : null}
      {!capabilitiesLoading && capabilitiesError ? (
        <Alert severity="warning">Team RAG capability를 확인하지 못했습니다: {capabilitiesError}</Alert>
      ) : null}
      {!capabilitiesLoading && !capabilitiesError && !teamRagAvailable ? (
        <Alert severity="warning">
          현재 서버가 Team RAG 계약을 제공하지 않습니다. 서버의 `teamRag` capability가 활성화되면 채팅을 사용할 수 있습니다.
        </Alert>
      ) : null}
      {!team.ragEnabled ? <Alert severity="info">이 Team은 RAG 답변이 비활성화되어 있습니다.</Alert> : null}
      {team.status === "ARCHIVED" ? <Alert severity="info">보관된 Team에서는 새 질문을 보낼 수 없습니다.</Alert> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          minHeight: 520,
          height: "calc(100vh - 330px)",
          maxHeight: 760,
          overflow: "hidden",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          bgcolor: "background.default",
        }}
      >
        <ChatMessageList
          messages={messages}
          sending={sending}
          onCopy={copyMessage}
          onEditUser={(_messageId, content) => setInput(content)}
          onRegenerate={retryLastQuestion}
          onRetryLastUser={retryLastQuestion}
          emptyTitle="이 Team에서 무엇을 찾을까요?"
          emptyDescription="첨부파일, Wiki, 외부 URL을 권한 범위 안에서 함께 검색합니다."
          sendingLabel={streamStatus || "Team 자료에서 근거를 찾고 답변을 작성하는 중..."}
          assistantMetadataDensity="compact"
        />

        <Box
          sx={{
            px: { xs: 1.5, md: 5 },
            pt: 1,
            pb: 2,
            background: (theme) =>
              `linear-gradient(180deg, ${alpha(theme.palette.background.default, 0)} 0%, ${theme.palette.background.default} 22%)`,
          }}
        >
          <Paper
            elevation={0}
            sx={{
              maxWidth: 920,
              mx: "auto",
              p: 1.25,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
              boxShadow: (theme) =>
                `0 10px 28px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.24 : 0.08)}`,
              transition: "border-color 120ms ease, box-shadow 120ms ease",
              "&:focus-within": {
                borderColor: "text.secondary",
                boxShadow: (theme) =>
                  `0 10px 30px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.3 : 0.11)}`,
              },
            }}
          >
            <Box
              component="textarea"
              aria-label="Team 질문"
              value={input}
              onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setInput(event.target.value)}
              disabled={disabled}
              placeholder="Team 자료에 대해 질문하세요"
              rows={2}
              onKeyDown={(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
              sx={{
                width: "100%",
                minHeight: 54,
                maxHeight: 150,
                resize: "none",
                border: 0,
                outline: 0,
                px: 0.5,
                py: 0.25,
                bgcolor: "transparent",
                color: "text.primary",
                font: "inherit",
                fontSize: 14.5,
                lineHeight: 1.65,
                "&::placeholder": { color: "text.secondary", opacity: 1 },
              }}
            />

            <Stack direction="row" spacing={0.75} alignItems="center">
              <TextField
                select
                variant="standard"
                size="small"
                aria-label="검색 범위"
                value={workspaceId}
                onChange={(event) => setWorkspaceId(event.target.value)}
                disabled={!capabilities?.teamRag?.workspaceSubtreeSupported || disabled}
                slotProps={{ input: { disableUnderline: true } }}
                SelectProps={{
                  displayEmpty: true,
                  inputProps: { "aria-label": "검색 범위" },
                  renderValue: (selected) => {
                    if (!selected) return "Team 전체";
                    return workspaces.find((workspace) => String(workspace.id) === selected)?.label.trim() || "Team 전체";
                  },
                }}
                sx={{
                  minWidth: { xs: 130, sm: 190 },
                  maxWidth: 240,
                  px: 1,
                  py: 0.25,
                  borderRadius: 1.5,
                  bgcolor: "action.hover",
                  "& .MuiSelect-select": { py: 0.5, fontSize: 12.5, fontWeight: 700 },
                }}
              >
                <MenuItem value="">Team 전체</MenuItem>
                {workspaces.map((workspace) => (
                  <MenuItem key={workspace.id} value={String(workspace.id)}>{workspace.label}</MenuItem>
                ))}
              </TextField>
              <Chip
                size="small"
                variant="outlined"
                color="primary"
                label={replyModeLabel(team.ragReplyMode)}
                sx={{ display: { xs: "none", sm: "inline-flex" }, height: 26 }}
              />
              <Box sx={{ flex: 1 }} />
              <Tooltip title="보내기 (Enter)">
                <span>
                  <IconButton
                    aria-label="질문 보내기"
                    onClick={() => void handleSubmit()}
                    disabled={disabled || !input.trim()}
                    sx={{
                      width: 34,
                      height: 34,
                      bgcolor: "text.primary",
                      color: "background.paper",
                      "&:hover": { bgcolor: "text.secondary" },
                      "&.Mui-disabled": {
                        bgcolor: "action.disabledBackground",
                        color: "action.disabled",
                      },
                    }}
                  >
                    {sending ? <CircularProgress size={18} color="inherit" /> : <ArrowUpwardOutlined />}
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Paper>
        </Box>
      </Box>
    </Stack>
  );
}
