import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { ContentCopyOutlined, RefreshOutlined, SyncOutlined } from "@mui/icons-material";
import type { ChatMessage, ChatResponseMetadataDto } from "@/react/pages/ai/components/chatTypes";

function renderTokenUsage(metadata?: ChatResponseMetadataDto) {
  const usage = metadata?.tokenUsage;
  if (!usage) return null;

  return (
    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: "block", fontSize: 11 }}>
      tokens · input {usage.inputTokens ?? "-"} · output {usage.outputTokens ?? "-"} · total{" "}
      {usage.totalTokens ?? "-"}
      {metadata?.latencyMs ? ` · ${metadata.latencyMs}ms` : ""}
    </Typography>
  );
}

function formatMessageTime(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  message: ChatMessage;
  sending: boolean;
  isLastAssistant: boolean;
  onCopy: (content: string) => void;
  onRegenerate: () => void;
  onRetryLastUser: () => void;
}

export function AssistantMessageBubble({
  message,
  sending,
  isLastAssistant,
  onCopy,
  onRegenerate,
  onRetryLastUser,
}: Props) {
  const isErrorMessage =
    message.metadata?.finishReason === "error" || message.content.startsWith("오류:");

  return (
    <Stack spacing={0.5} alignItems="flex-start" sx={{ width: "100%" }}>
      <Box
        sx={{
          maxWidth: { xs: "92%", md: "72%" },
          px: 2,
          py: 1.5,
          borderRadius: "18px 18px 18px 4px",
          bgcolor: "background.paper",
          color: "text.primary",
          border: "none",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Assistant{message.model ? ` · ${message.model}` : ""}
        </Typography>
        <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 13 }}>
          {message.content || (sending ? "응답 생성 중..." : "")}
        </Typography>
        {renderTokenUsage(message.metadata)}
      </Box>
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ pl: 0.25 }}>
        {message.createdAt ? (
          <Typography variant="caption" color="text.secondary">
            {formatMessageTime(message.createdAt)}
          </Typography>
        ) : null}
        <Tooltip title="복사">
          <IconButton size="small" onClick={() => onCopy(message.content)}>
            <ContentCopyOutlined fontSize="inherit" />
          </IconButton>
        </Tooltip>
        {isLastAssistant ? (
          <Tooltip title="답변 다시 생성">
            <span>
              <IconButton size="small" disabled={sending} onClick={onRegenerate}>
                <SyncOutlined fontSize="inherit" />
              </IconButton>
            </span>
          </Tooltip>
        ) : null}
        {isErrorMessage ? (
          <Tooltip title="마지막 질문 다시 보내기">
            <IconButton size="small" onClick={onRetryLastUser}>
              <RefreshOutlined fontSize="inherit" />
            </IconButton>
          </Tooltip>
        ) : null}
      </Stack>
    </Stack>
  );
}
