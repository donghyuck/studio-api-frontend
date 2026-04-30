import { useEffect, useRef, useState } from "react";
import { ArrowDownwardOutlined } from "@mui/icons-material";
import { Box, CircularProgress, Fab, Stack, Typography } from "@mui/material";
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
  emptyTitle?: string;
  emptyDescription?: string;
}

function EmptyChatIllustration() {
  return (
    <Box
      component="svg"
      viewBox="0 0 160 120"
      role="img"
      aria-label="질문과 답변"
      sx={{ width: 120, height: 90 }}
    >
      <rect x="18" y="18" width="78" height="72" rx="10" fill="#F9FAFB" stroke="#D6E0F0" strokeWidth="2" />
      <path d="M34 38h46M34 52h34M34 66h42" stroke="#6B7280" strokeWidth="5" strokeLinecap="round" />
      <circle cx="104" cy="72" r="24" fill="#EDE9FE" stroke="#7C3AED" strokeWidth="2.5" />
      <path d="M96 69a9 9 0 1 1 15 7c-3 2-5 4-5 8" fill="none" stroke="#7C3AED" strokeWidth="5" strokeLinecap="round" />
      <circle cx="106" cy="92" r="3" fill="#7C3AED" />
      <path d="M121 89l17 17" stroke="#2563EB" strokeWidth="6" strokeLinecap="round" />
      <path d="M45 99c10 6 31 6 42 0" stroke="#93C5FD" strokeWidth="4" strokeLinecap="round" />
    </Box>
  );
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
  emptyTitle = "궁금한 내용을 입력해 보세요.",
  emptyDescription = "AI가 질문에 맞춰 답변합니다.",
}: Props) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const lastAssistantId = [...messages].reverse().find((item) => item.role === "assistant")?.id;
  const hasStreamingPlaceholder = messages.some(
    (message) => message.role === "assistant" && !message.content
  );

  function checkNearBottom(container: HTMLDivElement) {
    return container.scrollHeight - container.scrollTop - container.clientHeight < 96;
  }

  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }
    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  }

  function handleScroll() {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }
    setIsNearBottom(checkNearBottom(container));
  }

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }
    if (isNearBottom) {
      scrollToBottom("smooth");
    }
  }, [messages.length, sending, isNearBottom]);

  return (
    <Box sx={{ flex: 1, minHeight: 0, position: "relative" }}>
      <Box
        ref={scrollContainerRef}
        onScroll={handleScroll}
        sx={{ height: "100%", minHeight: 0, overflowY: "auto", px: { xs: 1, md: 4 }, py: 3 }}
      >
        <Stack spacing={2}>
          {summaryVisible ? (
            <SummaryCard
              collapsedMessageCount={collapsedMessageCount}
              summaryText={summaryText}
              onToggle={onToggleSummary ?? (() => {})}
            />
          ) : null}
          {messages.length === 0 ? (
            <Stack spacing={1.25} alignItems="center" justifyContent="center" sx={{ minHeight: 260, textAlign: "center" }}>
              <EmptyChatIllustration />
              <Typography variant="body1" color="text.primary" sx={{ fontWeight: 600 }}>
                {emptyTitle}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {emptyDescription}
              </Typography>
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
      {!isNearBottom && messages.length > 0 ? (
        <Fab
          size="small"
          color="primary"
          aria-label="최신 메시지로 이동"
          onClick={() => {
            scrollToBottom("smooth");
            setIsNearBottom(true);
          }}
          sx={{
            position: "absolute",
            right: { xs: 16, md: 40 },
            bottom: 16,
            width: 34,
            height: 34,
            minHeight: 34,
            boxShadow: 3,
          }}
        >
          <ArrowDownwardOutlined fontSize="small" />
        </Fab>
      ) : null}
    </Box>
  );
}
