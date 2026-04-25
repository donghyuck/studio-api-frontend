import { Avatar, Box, CircularProgress, Stack, Typography } from "@mui/material";
import { SmartToyOutlined } from "@mui/icons-material";
import type { ChatMessage } from "@/react/pages/ai/components/chatTypes";
import { SummaryCard } from "@/react/pages/ai/components/SummaryCard";
import { UserMessageBubble } from "@/react/pages/ai/components/UserMessageBubble";
import { AssistantMessageBubble } from "@/react/pages/ai/components/AssistantMessageBubble";

interface Props {
  messages: ChatMessage[];
  sending: boolean;
  collapsedMessageCount?: number;
  summaryText?: string;
  summaryVisible?: boolean;
  onToggleSummary?: () => void;
  onCopy: (content: string) => void;
  onEditUser: (messageId: string | undefined, content: string) => void;
  onRegenerate: () => void;
  onRetryLastUser: () => void;
}

export function ChatMessageList({
  messages,
  sending,
  collapsedMessageCount = 0,
  summaryText,
  summaryVisible = false,
  onToggleSummary,
  onCopy,
  onEditUser,
  onRegenerate,
  onRetryLastUser,
}: Props) {
  const lastAssistantId = [...messages].reverse().find((item) => item.role === "assistant")?.id;
  const hasStreamingPlaceholder = messages.some(
    (message) => message.role === "assistant" && !message.content
  );

  return (
    <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: { xs: 1, md: 4 }, py: 3 }}>
      <Stack spacing={2}>
        {summaryVisible ? (
          <SummaryCard
            collapsedMessageCount={collapsedMessageCount}
            summaryText={summaryText}
            onToggle={onToggleSummary ?? (() => {})}
          />
        ) : null}
        {messages.length === 0 ? (
          <Stack spacing={1} alignItems="center" justifyContent="center" sx={{ minHeight: 260 }}>
            <Avatar sx={{ bgcolor: "primary.main" }}>
              <SmartToyOutlined />
            </Avatar>
            <Typography color="text.secondary">메시지를 입력해 AI와 대화를 시작하세요.</Typography>
          </Stack>
        ) : (
          messages.map((message, index) => (
            <Stack
              key={`${message.role}-${message.id ?? index}`}
              direction="row"
              justifyContent={message.role === "user" ? "flex-end" : "flex-start"}
              sx={{
                "& .user-message-actions": { opacity: 0 },
                "&:hover .user-message-actions": { opacity: 1 },
              }}
            >
              {message.role === "user" ? (
                <UserMessageBubble
                  message={message}
                  onCopy={onCopy}
                  onEdit={onEditUser}
                />
              ) : (
                <AssistantMessageBubble
                  message={message}
                  sending={sending}
                  isLastAssistant={message.id === lastAssistantId}
                  onCopy={onCopy}
                  onRegenerate={onRegenerate}
                  onRetryLastUser={onRetryLastUser}
                />
              )}
            </Stack>
          ))
        )}
        {sending && !hasStreamingPlaceholder ? (
          <Stack direction="row" justifyContent="flex-start">
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                p: 1.5,
                borderRadius: 2,
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                응답 생성 중...
              </Typography>
            </Box>
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}
