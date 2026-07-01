import { useState } from "react";
import { alpha, Avatar, Box, Divider, IconButton, Popover, Stack, Tooltip, Typography, Chip } from "@mui/material";
import { ContentCopyOutlined, DescriptionOutlined, RefreshOutlined, SyncOutlined } from "@mui/icons-material";
import type { ChatMessage, ChatResponseMetadataDto } from "@/react/pages/ai/components/chatTypes";
import type { RagReferenceDto } from "@/types/studio/ai";

const numberFormatter = new Intl.NumberFormat("ko-KR");

function formatNumber(value?: number) {
  return typeof value === "number" ? numberFormatter.format(value) : "-";
}

interface NormalizedRagReference {
  index?: number;
  title?: string;
  chunk?: string;
  score?: number;
  content?: string;
  raw?: RagReferenceDto;
}

function stringifyValue(value: unknown) {
  if (value == null || value === "") {
    return "";
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function metadataValue(reference: RagReferenceDto, keys: string[]) {
  for (const key of keys) {
    const value = reference.metadata?.[key];
    if (value != null && value !== "") {
      return stringifyValue(value);
    }
  }
  return "";
}

function formatLocationFromSourceRef(sourceRef: string) {
  const pageMatch = sourceRef.match(/page\[(\d+)]/i) ?? sourceRef.match(/\bpage\s*[:#-]?\s*(\d+)/i);
  if (pageMatch?.[1]) {
    return `페이지 ${pageMatch[1]}`;
  }
  const slideMatch = sourceRef.match(/slide\[(\d+)]/i) ?? sourceRef.match(/\bslide\s*[:#-]?\s*(\d+)/i);
  if (slideMatch?.[1]) {
    return `슬라이드 ${slideMatch[1]}`;
  }
  return "";
}

function normalizeReference(reference: RagReferenceDto, fallbackIndex: number): NormalizedRagReference {
  const title =
    reference.sourceName ||
    metadataValue(reference, ["sourceName", "fileName", "filename", "originalFilename", "documentName", "title"]) ||
    reference.documentId ||
    `근거 ${reference.index ?? fallbackIndex}`;
  const page = reference.page ?? reference.pageNumber ?? metadataValue(reference, ["page", "pageNumber", "page_number"]);
  const slide = reference.slide ?? reference.slideNumber ?? metadataValue(reference, ["slide", "slideNumber", "slide_number"]);
  const sourceRef = reference.sourceRef || reference.sourceRefs || metadataValue(reference, ["sourceRef", "sourceRefs"]);
  const chunk =
    (page != null && page !== "" ? `페이지 ${stringifyValue(page)}` : "") ||
    (slide != null && slide !== "" ? `슬라이드 ${stringifyValue(slide)}` : "") ||
    (sourceRef ? formatLocationFromSourceRef(sourceRef) : "");

  return {
    index: reference.index ?? fallbackIndex,
    title,
    chunk,
    score: reference.score,
    content: reference.content,
    raw: reference,
  };
}

function getRagReferences(metadata?: ChatResponseMetadataDto): NormalizedRagReference[] {
  const references = metadata?.ragReferences;
  return Array.isArray(references)
    ? references
        .slice(0, 5)
        .filter((reference): reference is RagReferenceDto => typeof reference === "object" && reference !== null)
        .map((reference, index) => normalizeReference(reference, index + 1))
    : [];
}

function formatReferenceTitle(reference: NormalizedRagReference) {
  return [reference.title || `근거 ${reference.index ?? ""}`, reference.chunk].filter(Boolean).join(" · ");
}

function formatReferenceSummary(reference: NormalizedRagReference) {
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

function renderRetrievalPolicy(metadata?: ChatResponseMetadataDto) {
  const policy = metadata?.retrievalPolicy as any;
  if (!policy) return null;

  const hitRate = policy.hitRate;
  const mrr = policy.mrr;
  
  return (
    <Box sx={{ mt: 1, pt: 1, borderTop: "1px dashed", borderColor: "divider" }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 10.5, color: "success.main" }}>
          검색 전략: {policy.retrievalStrategy || "-"}
        </Typography>
        <Chip label="정책 적용됨" size="small" color="success" sx={{ height: 16, fontSize: 8.5, fontWeight: 700 }} />
      </Stack>
      {(hitRate != null || mrr != null) && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: 9.5 }}>
          평가 기준: {hitRate != null ? `HitRate ${(hitRate * 100).toFixed(0)}%` : ""}{hitRate != null && mrr != null ? ", " : ""}{mrr != null ? `MRR ${mrr.toFixed(2)}` : ""}
        </Typography>
      )}
    </Box>
  );
}

function renderRetrievalDebug(metadata?: ChatResponseMetadataDto) {
  const retrieval = metadata?.retrieval as any;
  if (!retrieval) return null;

  return (
    <Box sx={{ mt: 1.25, pt: 1, borderTop: "1px dashed", borderColor: "divider" }}>
      <Typography variant="caption" sx={{ fontWeight: 600, display: "block", fontSize: 10, color: "primary.main", mb: 0.5 }}>
        [RAG 검색 진단 디버그]
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: 10, mb: 0.5 }}>
        전략: {retrieval.requestedStrategy ?? "-"} (실제: {retrieval.resolvedStrategy ?? "-"}) · 최종 컨텍스트 Chunk 수: {retrieval.finalCount ?? 0}
      </Typography>
      {Array.isArray(retrieval.legs) && retrieval.legs.length > 0 && (
        <Stack spacing={0.25}>
          {retrieval.legs.map((leg: any, idx: number) => (
            <Typography key={idx} variant="caption" color="text.secondary" sx={{ display: "block", fontSize: 9.5, pl: 0.5 }}>
              · {leg.strategy === "structure" ? "구조 기반" : leg.strategy.includes("ideaBlock") ? "IdeaBlock" : leg.strategy}: topK {leg.topK ?? 0} / 후보 {leg.candidateCount ?? 0} / 반환 {leg.returnedCount ?? 0}
            </Typography>
          ))}
        </Stack>
      )}
    </Box>
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
      <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ maxWidth: { xs: "100%", md: "82%" } }}>
        <Avatar
          sx={{
            width: 28,
            height: 28,
            fontSize: 12,
            fontWeight: 800,
            bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.32 : 0.12),
            color: "primary.main",
          }}
        >
          AI
        </Avatar>
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderRadius: "8px",
            bgcolor: "background.paper",
            color: "text.primary",
            border: "1px solid",
            borderColor: "divider",
            boxShadow: (theme) => `0 8px 24px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.22 : 0.06)}`,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Assistant{message.model ? ` · ${message.model}` : ""}
          </Typography>
          <Typography component="div" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 14, lineHeight: 1.75 }}>
            {message.content ? renderInlineMarkdown(message.content) : (sending ? "응답 생성 중..." : "")}
          </Typography>
          {renderTokenUsage(message.metadata)}
          {renderRetrievalDebug(message.metadata)}
          {renderRetrievalPolicy(message.metadata)}
        </Box>
      </Stack>
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ pl: 5 }}>
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
                          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere", fontSize: 12.5 }}>
                            {formatReferenceSummary(reference)}
                          </Typography>
                        ) : null}

                        {/* IdeaBlock 특정 필드 노출 */}
                        {(() => {
                          const meta = reference.raw?.metadata || {};
                          const chunkType = meta.chunkType || (reference.raw as any)?.chunkType;
                          const hasIdeaFields = chunkType === "ideaBlock" || meta.criticalQuestion || meta.trustedAnswer;
                          if (!hasIdeaFields && !meta.fallbackReason) return null;

                          const fallbackLabels: Record<string, string> = {
                            ANSWER_TOO_SHORT: "생성 답변이 너무 짧음",
                            ANSWER_HAS_NO_BODY: "답변 본문 없음",
                            ANSWER_EQUALS_TITLE: "답변이 제목만 반복",
                            HEADING_ONLY: "제목만 있는 block",
                            EVIDENCE_NOT_FOUND: "원문 evidence 없음",
                            TRUSTED_ANSWER_FACT_MISMATCH: "숫자/날짜/기간/비율이 원문과 불일치",
                            GENERIC_QUESTION: "질문이 너무 일반적",
                            TABLE_SECTION: "표 섹션 fallback",
                            COVERAGE_GAP: "누락 보존 fallback",
                          };

                          return (
                            <Box sx={{ mt: 1, p: 1, borderRadius: 1, bgcolor: "action.hover", border: "1px solid", borderColor: "divider" }}>
                              <Stack spacing={0.5}>
                                <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mb: 0.5 }}>
                                  {chunkType && (
                                    <Chip label={`유형: ${chunkType}`} size="small" variant="outlined" sx={{ fontSize: 10, height: 18 }} />
                                  )}
                                  {meta.fallbackReason && (
                                    <Chip
                                      label={`Fallback: ${fallbackLabels[String(meta.fallbackReason)] || String(meta.fallbackReason)}`}
                                      size="small"
                                      color="warning"
                                      variant="outlined"
                                      sx={{ fontSize: 10, height: 18 }}
                                    />
                                  )}
                                  {meta.confidence != null && (
                                    <Chip label={`신뢰도: ${meta.confidence}`} size="small" variant="outlined" sx={{ fontSize: 10, height: 18 }} />
                                  )}
                                </Stack>

                                {meta.criticalQuestion && (
                                  <Typography variant="body2" sx={{ fontSize: 11.5, fontWeight: 600 }}>
                                    <span style={{ color: "#7C3AED" }}>Q.</span> {String(meta.criticalQuestion)}
                                  </Typography>
                                )}
                                {meta.trustedAnswer && (
                                  <Typography variant="body2" sx={{ fontSize: 11.5 }}>
                                    <span style={{ color: "#059669" }}>A.</span> {String(meta.trustedAnswer)}
                                  </Typography>
                                )}
                                {meta.sourceEvidence && (
                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.5, fontStyle: "italic", mt: 0.25, display: "block" }}>
                                    원문 근거: {String(meta.sourceEvidence)}
                                  </Typography>
                                )}
                                {(meta.entityName || meta.keywords || meta.tags) && (
                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                                    {[
                                      meta.entityName ? `엔티티: ${meta.entityName} (${meta.entityType ?? ""})` : "",
                                      meta.keywords ? `키워드: ${JSON.stringify(meta.keywords)}` : "",
                                      meta.tags ? `태그: ${JSON.stringify(meta.tags)}` : "",
                                    ].filter(Boolean).join(" | ")}
                                  </Typography>
                                )}
                              </Stack>
                            </Box>
                          );
                        })()}
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
