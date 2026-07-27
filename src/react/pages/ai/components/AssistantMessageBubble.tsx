import { useMemo, useState } from "react";
import { alpha, Avatar, Box, Chip, Divider, IconButton, Paper, Popover, Stack, Tooltip, Typography } from "@mui/material";
import { CloseOutlined, ContentCopyOutlined, DescriptionOutlined, RefreshOutlined, SyncOutlined } from "@mui/icons-material";
import type { ChatMessage, ChatResponseMetadataDto } from "@/react/pages/ai/components/chatTypes";
import type { RagReferenceDto } from "@/types/studio/ai";
import katex from "katex";
import "katex/dist/katex.min.css";

const numberFormatter = new Intl.NumberFormat("ko-KR");

function formatNumber(value?: number) {
  return typeof value === "number" ? numberFormatter.format(value) : "-";
}

interface NormalizedRagReference {
  index?: number;
  evidenceId?: string;
  title?: string;
  chunk?: string;
  score?: number;
  content?: string;
  supportStatus?: string;
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
  if (!sourceRef) return "";
  const pageMatch =
    sourceRef.match(/page[=\s[:#-]?\s*(\d+)/i) ??
    sourceRef.match(/#p(?:age)?=?(\d+)/i) ??
    sourceRef.match(/[\/_.-]p(?:age)?[-_]?(\d+)/i) ??
    sourceRef.match(/:(\d+)$/);
  if (pageMatch?.[1]) {
    return `페이지 ${pageMatch[1]}`;
  }
  const slideMatch = sourceRef.match(/slide[=\s[:#-]?\s*(\d+)/i);
  if (slideMatch?.[1]) {
    return `슬라이드 ${slideMatch[1]}`;
  }
  return "";
}

function extractReferenceContent(reference: RagReferenceDto): string {
  if (!reference) return "";
  if (typeof reference.exactText === "string" && reference.exactText.trim()) {
    return reference.exactText;
  }
  const exactSpan = reference.spans?.find((span) => typeof span.exactText === "string" && span.exactText.length > 0);
  if (exactSpan) {
    return exactSpan.exactText;
  }

  const directKeys = [
    "content",
    "page_content",
    "pageContent",
    "text",
    "chunkText",
    "chunk_text",
    "chunkContent",
    "chunk_content",
    "textContent",
    "text_content",
    "snippet",
    "excerpt",
    "body",
    "document",
    "documentText",
    "document_text",
    "matchedText",
    "rawText",
    "raw_text",
    "passage",
    "sentence",
    "description",
    "sourceEvidence",
    "trustedAnswer",
    "criticalQuestion",
  ];

  for (const key of directKeys) {
    const val = (reference as any)[key];
    if (typeof val === "string" && val.trim()) {
      return val.trim();
    }
  }

  const subObjects = [
    reference.metadata,
    (reference as any).raw,
    (reference as any).payload,
    (reference as any).data,
  ].filter(Boolean);

  for (const sub of subObjects) {
    for (const key of directKeys) {
      const val = (sub as any)[key];
      if (typeof val === "string" && val.trim()) {
        return val.trim();
      }
    }
  }

  if (reference.metadata && typeof reference.metadata === "object") {
    for (const [k, v] of Object.entries(reference.metadata)) {
      if (
        typeof v === "string" &&
        v.length > 15 &&
        !k.toLowerCase().includes("id") &&
        !k.toLowerCase().includes("name") &&
        !k.toLowerCase().includes("path") &&
        !k.toLowerCase().includes("url")
      ) {
        return v.trim();
      }
    }
  }

  return "";
}

function normalizeReference(reference: RagReferenceDto, fallbackIndex: number): NormalizedRagReference {
  const title =
    reference.sourceName ||
    metadataValue(reference, [
      "sourceName",
      "fileName",
      "filename",
      "originalFilename",
      "documentName",
      "title",
      "name",
      "file_name",
    ]) ||
    reference.documentId ||
    `근거 ${reference.index ?? fallbackIndex}`;

  const page =
    reference.page ??
    reference.pageNumber ??
    metadataValue(reference, ["page", "pageNumber", "page_number", "pageNo", "page_no", "pageNum", "page_index", "pageIndex"]);
  const slide =
    reference.slide ??
    reference.slideNumber ??
    metadataValue(reference, ["slide", "slideNumber", "slide_number", "slideNo", "slideIndex"]);
  const chunkOrder =
    reference.chunkOrder ??
    metadataValue(reference, ["chunkOrder", "chunk_order", "chunkIndex", "chunk_index", "chunkNo", "order"]);
  const section =
    reference.section ??
    reference.heading ??
    metadataValue(reference, ["section", "heading", "header", "topic"]);
  const sourceRef =
    reference.sourceRef ||
    reference.sourceRefs ||
    metadataValue(reference, ["sourceRef", "sourceRefs", "location", "path", "url"]);

  const locationParts: string[] = [];
  if (page != null && page !== "") {
    locationParts.push(`페이지 ${stringifyValue(page)}`);
  } else if (slide != null && slide !== "") {
    locationParts.push(`슬라이드 ${stringifyValue(slide)}`);
  } else if (sourceRef) {
    const loc = formatLocationFromSourceRef(sourceRef);
    if (loc) locationParts.push(loc);
  }

  if (section != null && section !== "") {
    locationParts.push(`섹션 ${stringifyValue(section)}`);
  }

  const chunk = locationParts.join(" · ");
  const content = extractReferenceContent(reference);

  return {
    index: reference.citationIndex ?? reference.index ?? fallbackIndex,
    evidenceId: reference.evidenceId,
    title,
    chunk,
    score: reference.score,
    content,
    supportStatus: reference.supportStatus,
    raw: reference,
  };
}

function getRagReferences(metadata?: ChatResponseMetadataDto): NormalizedRagReference[] {
  const references = metadata?.ragReferences;
  return Array.isArray(references)
    ? references
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
        전략: {retrieval.requestedStrategy ?? "-"} (실제: {retrieval.resolvedStrategy ?? "-"}) · 최종 검색 수: {retrieval.finalCount ?? 0}
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

function renderInlineMarkdown(
  text: string,
  onCitationClick?: (indices: number[], event: React.MouseEvent<HTMLElement>) => void,
  ragReferences?: NormalizedRagReference[]
) {
  // Split on display math ($$...$$), inline math ($...$), bold (**...**), and bracketed citations ([1], [1, 2], [1, 2, 3])
  const parts = text.split(/((?:\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\*\*[^*]+\*\*|\[\d+(?:\s*,\s*\d+)*\]))/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <Box component="strong" key={`bold-${index}`} sx={{ fontWeight: 700 }}>
          {part.slice(2, -2)}
        </Box>
      );
    }
    const citationMatch = part.match(/^\[(\d+(?:\s*,\s*\d+)*)\]$/);
    if (citationMatch) {
      const numbers = citationMatch[1].split(",").map((n) => parseInt(n.trim(), 10));
      const matchingRefs = ragReferences?.filter((r) => numbers.includes(r.index ?? -1));

      const badge = (
        <Box
          component="span"
          key={`cite-${index}`}
          onClick={(e) => {
            if (onCitationClick) {
              onCitationClick(numbers, e);
            }
          }}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            mx: 0.3,
            px: 0.6,
            py: 0.1,
            borderRadius: "4px",
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
            color: "primary.main",
            fontWeight: 700,
            fontSize: "0.82em",
            cursor: onCitationClick ? "pointer" : "inherit",
            verticalAlign: "baseline",
            lineHeight: 1.2,
            transition: "all 120ms ease",
            "&:hover": onCitationClick
              ? { bgcolor: "primary.main", color: "#fff" }
              : {},
          }}
        >
          {part}
        </Box>
      );

      if (matchingRefs && matchingRefs.length > 0) {
        return (
          <Tooltip
            key={`cite-tooltip-${index}`}
            arrow
            placement="top"
            title={
              <Box sx={{ p: 0.5, maxWidth: 300 }}>
                {matchingRefs.map((r, i) => (
                  <Box key={i} sx={{ mb: i < matchingRefs.length - 1 ? 1 : 0 }}>
                    <Typography variant="caption" component="div" sx={{ fontWeight: 800, fontSize: 11.5, color: "#fff" }}>
                      근거 {r.index ?? i + 1}: {r.title} {r.chunk ? `(${r.chunk})` : ""}
                    </Typography>
                    {r.content ? (
                      <Typography
                        variant="caption"
                        component="div"
                        sx={{
                          color: "rgba(255, 255, 255, 0.85)",
                          fontSize: 11,
                          mt: 0.25,
                          lineHeight: 1.45,
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        "{r.content.trim()}"
                      </Typography>
                    ) : null}
                  </Box>
                ))}
              </Box>
            }
          >
            {badge}
          </Tooltip>
        );
      }

      return badge;
    }
    if (part.startsWith("$$") && part.endsWith("$$")) {
      try {
        const html = katex.renderToString(part.slice(2, -2), { displayMode: true, throwOnError: false });
        return (
          <Box
            key={`displaymath-${index}`}
            component="span"
            dangerouslySetInnerHTML={{ __html: html }}
            sx={{ display: "block", overflowX: "auto", my: 1, "& .katex": { fontSize: "1.05em" } }}
          />
        );
      } catch {
        return <Box key={`displaymath-${index}`} component="span">{part}</Box>;
      }
    }
    if (part.startsWith("$") && part.endsWith("$")) {
      try {
        const html = katex.renderToString(part.slice(1, -1), { displayMode: false, throwOnError: false });
        return (
          <Box
            key={`inlinemath-${index}`}
            component="span"
            dangerouslySetInnerHTML={{ __html: html }}
            sx={{ "& .katex": { fontSize: "1.05em" } }}
          />
        );
      } catch {
        return <Box key={`inlinemath-${index}`} component="span">{part}</Box>;
      }
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
  const [selectedCitationIndices, setSelectedCitationIndices] = useState<number[] | null>(null);
  const isErrorMessage =
    message.metadata?.finishReason === "error" || message.content.startsWith("오류:");
  const ragReferences = getRagReferences(message.metadata);
  const answerPolicy = message.metadata?.answerPolicy;
  const citationsReady =
    !sending &&
    ragReferences.length > 0 &&
    typeof message.metadata?.canonicalContent === "string";

  const displayedReferences = useMemo(() => {
    if (!selectedCitationIndices || selectedCitationIndices.length === 0) {
      return ragReferences;
    }
    const filtered = ragReferences.filter((ref) =>
      selectedCitationIndices.includes(ref.index ?? -1)
    );
    return filtered.length > 0 ? filtered : ragReferences;
  }, [ragReferences, selectedCitationIndices]);

  const popoverTitle =
    selectedCitationIndices && selectedCitationIndices.length > 0
      ? `근거 ${selectedCitationIndices.join(", ")}`
      : `전체 출처 (${ragReferences.length}개)`;

  const sourcePopoverOpen = Boolean(sourceAnchorEl);

  return (
    <Box sx={{ width: "100%", py: 0.5 }}>
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
        <Avatar
          sx={{
            width: 26,
            height: 26,
            fontSize: 11,
            fontWeight: 800,
            bgcolor: (theme) => (theme.palette.mode === "dark" ? "rgba(144, 202, 249, 0.16)" : "rgba(25, 118, 210, 0.08)"),
            color: "primary.main",
            border: "1px solid",
            borderColor: (theme) => alpha(theme.palette.primary.main, 0.25),
          }}
        >
          ✦
        </Avatar>
        <Typography variant="subtitle2" component="div" sx={{ fontWeight: 700, fontSize: 13, color: "text.primary", display: "flex", alignItems: "center", gap: 1 }}>
          Assistant
          {message.model && (
            <Chip
              size="small"
              variant="outlined"
              label={message.model}
              sx={{ height: 18, fontSize: 10, fontWeight: 500, borderColor: "divider", color: "text.secondary" }}
            />
          )}
          {answerPolicy?.effectiveMode ? (
            <Tooltip
              title={
                answerPolicy.clamped
                  ? `요청 모드가 서버 정책에 의해 조정되었습니다. (${answerPolicy.reasonCode})`
                  : "서버가 실제 적용한 RAG 답변 범위입니다."
              }
            >
              <Chip
                size="small"
                color={answerPolicy.effectiveMode === "STRICT_GROUNDED" ? "primary" : "secondary"}
                variant="outlined"
                label={
                  answerPolicy.effectiveMode === "STRICT_GROUNDED"
                    ? "문서 직접 근거"
                    : "문서 기반 해석"
                }
                sx={{ height: 18, fontSize: 10, fontWeight: 600 }}
              />
            </Tooltip>
          ) : null}
        </Typography>
      </Stack>

      <Box sx={{ width: "100%", color: "text.primary", pl: 0 }}>
        <Typography component="div" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 14.5, lineHeight: 1.8 }}>
          {message.content
            ? renderInlineMarkdown(
                message.content,
                citationsReady
                  ? (indices, event) => {
                      setSourceAnchorEl(event.currentTarget);
                      setSelectedCitationIndices(indices);
                    }
                  : undefined,
                ragReferences
              )
            : sending
            ? "응답 생성 중..."
            : ""}
        </Typography>
        {renderTokenUsage(message.metadata)}
        {renderRetrievalDebug(message.metadata)}
        {renderRetrievalPolicy(message.metadata)}
      </Box>

      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" sx={{ mt: 1.5, pt: 1, borderTop: "1px solid", borderColor: (theme) => alpha(theme.palette.divider, 0.6) }}>
        {message.createdAt ? (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, mr: 0.5 }}>
            {formatMessageTime(message.createdAt)}
          </Typography>
        ) : null}
        <Tooltip title="복사">
          <IconButton size="small" onClick={() => onCopy(message.content)} sx={{ opacity: 0.75, "&:hover": { opacity: 1 } }}>
            <ContentCopyOutlined fontSize="small" sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        {isLastAssistant ? (
          <Tooltip title="답변 다시 생성">
            <span>
              <IconButton size="small" disabled={sending} onClick={onRegenerate} sx={{ opacity: 0.75, "&:hover": { opacity: 1 } }}>
                <SyncOutlined fontSize="small" sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>
        ) : null}
        {isErrorMessage ? (
          <Tooltip title="마지막 질문 다시 보내기">
            <IconButton size="small" onClick={onRetryLastUser} sx={{ opacity: 0.75, "&:hover": { opacity: 1 } }}>
              <RefreshOutlined fontSize="small" sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        ) : null}
        {citationsReady ? (
          <>
            <Box
              component="button"
              type="button"
              onClick={(event) => {
                setSourceAnchorEl(event.currentTarget);
                setSelectedCitationIndices(null);
              }}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                border: "1px solid",
                borderColor: "divider",
                px: 1.25,
                py: 0.35,
                ml: 0.5,
                borderRadius: "999px",
                bgcolor: "background.paper",
                color: "text.primary",
                cursor: "pointer",
                font: "inherit",
                transition: "all 150ms ease",
                "&:hover": {
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                  borderColor: "primary.main",
                  color: "primary.main",
                },
              }}
            >
              <Stack direction="row" spacing={-0.55} alignItems="center">
                {ragReferences.slice(0, 4).map((reference) => (
                  <Box
                    key={`${reference.index}-${reference.title}-${reference.chunk}`}
                    sx={{
                      width: 18,
                      height: 18,
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
                    <DescriptionOutlined sx={{ fontSize: 12 }} />
                  </Box>
                ))}
              </Stack>
              <Typography variant="caption" color="inherit" sx={{ fontWeight: 600, fontSize: 11 }}>
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
                    width: 540,
                    maxWidth: "calc(100vw - 32px)",
                    maxHeight: 560,
                    borderRadius: "12px",
                    boxShadow: "0 12px 32px rgba(0, 0, 0, 0.15)",
                    overflow: "hidden",
                    border: "1px solid",
                    borderColor: "divider",
                  },
                },
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, fontSize: 15 }}>
                  {popoverTitle}
                </Typography>
                <IconButton size="small" onClick={() => setSourceAnchorEl(null)}>
                  <CloseOutlined fontSize="small" />
                </IconButton>
              </Stack>
              <Stack divider={<Divider />} sx={{ maxHeight: 490, overflowY: "auto" }}>
                {displayedReferences.map((reference) => {
                  const percent = scorePercent(reference.score);
                  return (
                    <Stack key={`${reference.index}-${reference.title}-${reference.chunk}`} direction="row" spacing={1.75} sx={{ px: 2.5, py: 2 }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                          color: "primary.main",
                          flex: "0 0 auto",
                        }}
                      >
                        <DescriptionOutlined sx={{ fontSize: 18 }} />
                      </Box>
                      <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "text.primary", fontSize: 13.5 }}>
                            {reference.index ? `근거 ${reference.index}` : "근거"}
                          </Typography>
                          {percent != null ? (
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              <Typography variant="caption" sx={{ color: scoreColor(percent), fontWeight: 700, fontSize: 11.5 }}>
                                관련도 {percent}%
                              </Typography>
                              <Box
                                sx={{
                                  width: 60,
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
                              <Chip
                                label={scoreLabel(percent)}
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  bgcolor: (theme) => alpha(scoreColor(percent) === "success.main" ? theme.palette.success.main : scoreColor(percent) === "primary.main" ? theme.palette.primary.main : theme.palette.warning.main, 0.12),
                                  color: scoreColor(percent),
                                }}
                              />
                            </Stack>
                          ) : null}
                          {reference.supportStatus ? (
                            <Chip
                              size="small"
                              variant="outlined"
                              color={reference.supportStatus === "SOURCE_VERIFIED" ? "success" : "warning"}
                              label={reference.supportStatus === "SOURCE_VERIFIED" ? "원문 확인" : reference.supportStatus}
                              sx={{ height: 18, fontSize: 10 }}
                            />
                          ) : null}
                        </Stack>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary", fontSize: 13.5, overflowWrap: "anywhere", lineHeight: 1.5 }}>
                          {formatReferenceTitle(reference)}
                        </Typography>
                        {(() => {
                          const summary = formatReferenceSummary(reference);
                          const meta = reference.raw?.metadata || {};
                          const fallbackText =
                            summary ||
                            (meta.sourceEvidence ? String(meta.sourceEvidence) : "") ||
                            (meta.trustedAnswer ? String(meta.trustedAnswer) : "") ||
                            (reference.chunk ? `원문 위치: ${reference.chunk}` : "원문 본문 검색 결과 수신됨");

                          return (
                            <Paper
                              variant="outlined"
                              sx={{
                                p: 1.25,
                                mt: 0.5,
                                bgcolor: (theme) => (theme.palette.mode === "dark" ? "action.hover" : "#f8fafc"),
                                borderColor: "divider",
                                borderRadius: 1.5,
                              }}
                            >
                              <Typography
                                variant="body2"
                                color={summary ? "text.primary" : "text.secondary"}
                                sx={{
                                  overflowWrap: "anywhere",
                                  fontSize: 12.5,
                                  lineHeight: 1.6,
                                  fontStyle: summary ? "normal" : "italic",
                                }}
                              >
                                {summary ? `"${summary}"` : `📄 ${fallbackText}`}
                              </Typography>
                            </Paper>
                          );
                        })()}

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
                                    <span style={{ color: "#7C3AED" }}>Q.</span> {renderInlineMarkdown(String(meta.criticalQuestion))}
                                  </Typography>
                                )}
                                {meta.trustedAnswer && (
                                  <Typography variant="body2" sx={{ fontSize: 11.5 }}>
                                    <span style={{ color: "#059669" }}>A.</span> {renderInlineMarkdown(String(meta.trustedAnswer))}
                                  </Typography>
                                )}
                                {meta.sourceEvidence && (
                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.5, fontStyle: "italic", mt: 0.25, display: "block" }}>
                                    원문 근거: {renderInlineMarkdown(String(meta.sourceEvidence))}
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
    </Box>
  );
}
