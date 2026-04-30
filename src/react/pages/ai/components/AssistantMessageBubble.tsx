import { useState } from "react";
import { Box, Divider, IconButton, Popover, Stack, Tooltip, Typography } from "@mui/material";
import { ContentCopyOutlined, DescriptionOutlined, RefreshOutlined, SyncOutlined } from "@mui/icons-material";
import type { ChatMessage, ChatResponseMetadataDto } from "@/react/pages/ai/components/chatTypes";

const numberFormatter = new Intl.NumberFormat("ko-KR");

function formatNumber(value?: number) {
  return typeof value === "number" ? numberFormatter.format(value) : "-";
}

interface RagReference {
  index?: number;
  title?: string;
  chunk?: string;
  score?: number;
  content?: string;
}

function getRagReferences(metadata?: ChatResponseMetadataDto): RagReference[] {
  const references = metadata?.ragReferences;
  return Array.isArray(references) ? references.slice(0, 5) as RagReference[] : [];
}

function formatReferenceTitle(reference: RagReference) {
  return [reference.title || `근거 ${reference.index ?? ""}`, reference.chunk].filter(Boolean).join(" · ");
}

function formatReferenceSummary(reference: RagReference) {
  return (reference.content ?? "").replace(/\s+/g, " ").trim();
}

function scorePercent(score?: number) {
  if (typeof score !== "number") {
    return undefined;
  }
  return Math.max(0, Math.min(100, Math.round(score * 100)));
}

function scoreLabel(percent?: number) {
  if (percent == null) {
    return "";
  }
  if (percent >= 80) {
    return "높음";
  }
  if (percent >= 60) {
    return "보통";
  }
  return "낮음";
}

function scoreColor(percent?: number) {
  if (percent == null) {
    return "text.secondary";
  }
  if (percent >= 80) {
    return "success.main";
  }
  if (percent >= 60) {
    return "primary.main";
  }
  return "warning.main";
}

function renderTokenUsage(metadata?: ChatResponseMetadataDto) {
  const usage = metadata?.tokenUsage;
  if (!usage) return null;

  return (
    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: "block", fontSize: 11 }}>
      tokens · input {formatNumber(usage.inputTokens)} · output {formatNumber(usage.outputTokens)} · total{" "}
      {formatNumber(usage.totalTokens)}
      {metadata?.latencyMs ? ` · ${formatNumber(metadata.latencyMs)}ms` : ""}
    </Typography>
  );
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <Box component="strong" key={`${part}-${index}`} sx={{ fontWeight: 700 }}>
          {part.slice(2, -2)}
        </Box>
      );
    }
    return part;
  });
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
  const [sourceAnchorEl, setSourceAnchorEl] = useState<HTMLElement | null>(null);
  const isErrorMessage =
    message.metadata?.finishReason === "error" || message.content.startsWith("오류:");
  const ragReferences = getRagReferences(message.metadata);
  const sourcePopoverOpen = Boolean(sourceAnchorEl);

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
        <Typography component="div" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 13 }}>
          {message.content ? renderInlineMarkdown(message.content) : (sending ? "응답 생성 중..." : "")}
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
        {ragReferences.length > 0 ? (
          <>
            <Box
              component="button"
              type="button"
              onClick={(event) => setSourceAnchorEl(event.currentTarget)}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                border: 0,
                px: 1,
                py: 0.45,
                ml: 0.5,
                borderRadius: "999px",
                bgcolor: "transparent",
                color: "text.secondary",
                cursor: "pointer",
                font: "inherit",
                transition: "background-color 120ms ease, color 120ms ease",
                "&:hover": {
                  bgcolor: "action.selected",
                  color: "text.primary",
                },
              }}
            >
              <Stack direction="row" spacing={-0.55} alignItems="center">
                {ragReferences.slice(0, 4).map((reference) => (
                  <Box
                    key={`${reference.index}-${reference.title}-${reference.chunk}`}
                    sx={{
                      width: 19,
                      height: 19,
                      borderRadius: "50%",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: "background.paper",
                      border: "1px solid",
                      borderColor: "divider",
                      boxShadow: 0.5,
                    }}
                  >
                    <DescriptionOutlined sx={{ fontSize: 13 }} />
                  </Box>
                ))}
              </Stack>
              <Typography variant="caption" color="inherit" sx={{ fontWeight: 600 }}>
                출처
              </Typography>
            </Box>
            <Popover
              open={sourcePopoverOpen}
              anchorEl={sourceAnchorEl}
              onClose={() => setSourceAnchorEl(null)}
              anchorOrigin={{ vertical: "top", horizontal: "center" }}
              transformOrigin={{ vertical: "bottom", horizontal: "center" }}
              slotProps={{
                paper: {
                  sx: {
                    width: 520,
                    maxWidth: "calc(100vw - 32px)",
                    maxHeight: 520,
                    borderRadius: "8px",
                    boxShadow: 8,
                    overflow: "hidden",
                  },
                },
              }}
            >
              <Box sx={{ px: 2, py: 1.25, borderBottom: "1px solid", borderColor: "divider" }}>
                <Typography variant="subtitle2" color="text.secondary">
                  출처
                </Typography>
              </Box>
              <Stack divider={<Divider />} sx={{ maxHeight: 460, overflowY: "auto" }}>
                {ragReferences.map((reference) => {
                  const percent = scorePercent(reference.score);
                  return (
                    <Stack key={`${reference.index}-${reference.title}-${reference.chunk}`} direction="row" spacing={1.5} sx={{ px: 2, py: 1.75 }}>
                      <Box
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor: "action.hover",
                          flex: "0 0 auto",
                        }}
                      >
                        <DescriptionOutlined sx={{ fontSize: 17 }} />
                      </Box>
                      <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {reference.index ? `근거 ${reference.index}` : "근거"}
                          </Typography>
                          {percent != null ? (
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              <Typography variant="caption" sx={{ color: scoreColor(percent), fontWeight: 700 }}>
                                관련도 {percent}%
                              </Typography>
                              <Box
                                sx={{
                                  width: 54,
                                  height: 5,
                                  borderRadius: 999,
                                  bgcolor: "action.hover",
                                  overflow: "hidden",
                                }}
                              >
                                <Box
                                  sx={{
                                    width: `${percent}%`,
                                    height: "100%",
                                    borderRadius: 999,
                                    bgcolor: scoreColor(percent),
                                  }}
                                />
                              </Box>
                              <Typography variant="caption" color="text.secondary">
                                {scoreLabel(percent)}
                              </Typography>
                            </Stack>
                          ) : null}
                        </Stack>
                        <Typography variant="body2" sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>
                          {formatReferenceTitle(reference)}
                        </Typography>
                        {formatReferenceSummary(reference) ? (
                          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                            {formatReferenceSummary(reference)}
                          </Typography>
                        ) : null}
                      </Stack>
                    </Stack>
                  );
                })}
              </Stack>
            </Popover>
          </>
        ) : null}
      </Stack>
    </Stack>
  );
}
