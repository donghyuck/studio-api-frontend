import { useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Badge,
  Box,
  Button,
  ButtonGroup,
  Chip,
  CircularProgress,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import BugReportOutlined from "@mui/icons-material/BugReportOutlined";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import ExpandMore from "@mui/icons-material/ExpandMore";
import SpeedOutlined from "@mui/icons-material/SpeedOutlined";
import TagOutlined from "@mui/icons-material/TagOutlined";
import type { ColDef } from "ag-grid-community";
import { GridContent } from "@/react/components/ag-grid";
import { reactAiApi } from "@/react/pages/ai/api";
import type {
  AiInfoResponse,
  ChatMessageDto,
  ChatResponseMetadataDto,
  RagIndexJobDto,
  SearchResultDto,
  TokenUsageDto,
  VectorSearchResultDto,
} from "@/types/studio/ai";
import { resolveAxiosError } from "@/utils/helpers";

type ResultTab = "vector" | "rag" | "answer";
type RunningAction = ResultTab | null;

const CITATION_PRIMARY = "#7C3AED";
const CITATION_BACKGROUND = "#EDE9FE";
const ANSWER_BACKGROUND = "#F9FAFB";
const REFERENCE_COLORS = [
  { main: "#7C3AED", soft: "#EDE9FE", border: "#C4B5FD", text: "#4C1D95" },
  { main: "#2563EB", soft: "#DBEAFE", border: "#93C5FD", text: "#1E3A8A" },
  { main: "#059669", soft: "#D1FAE5", border: "#6EE7B7", text: "#064E3B" },
  { main: "#D97706", soft: "#FEF3C7", border: "#FCD34D", text: "#78350F" },
  { main: "#E11D48", soft: "#FFE4E6", border: "#FDA4AF", text: "#881337" },
];

function buildRequestKey(value: unknown) {
  return JSON.stringify(value);
}

function formatValue(value: unknown) {
  if (value == null || value === "") {
    return "-";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function formatTokenUsage(usage?: TokenUsageDto) {
  if (!usage) {
    return "토큰 정보 없음";
  }
  return `입력 ${usage.inputTokens.toLocaleString()} / 출력 ${usage.outputTokens.toLocaleString()} / 합계 ${usage.totalTokens.toLocaleString()}`;
}

function sourceDisplayName(job?: RagIndexJobDto | null) {
  if (!job) {
    return "-";
  }
  return job.sourceName || job.documentId || `${job.objectType} #${job.objectId}` || job.jobId;
}

function metadataValue(metadata: Record<string, unknown> | undefined, keys: string[]) {
  if (!metadata) {
    return undefined;
  }
  for (const key of keys) {
    const value = metadata[key];
    if (value != null && value !== "") {
      return value;
    }
  }
  return undefined;
}

function chunkValue(metadata?: Record<string, unknown>) {
  const order = metadataValue(metadata, ["chunkOrder", "chunkIndex", "chunk_order", "chunk_index", "order", "index"]);
  if (order != null) {
    return `#${formatValue(order)}`;
  }
  return formatValue(metadataValue(metadata, ["chunkId", "chunk_id", "id"]));
}

function resultSourceName(row: SearchResultDto) {
  const metadataName = metadataValue(row.metadata, [
    "sourceName",
    "fileName",
    "filename",
    "originalFilename",
    "documentName",
    "title",
    "name",
  ]);
  if (metadataName != null) {
    return formatValue(metadataName);
  }

  const objectType = metadataValue(row.metadata, ["objectType", "object_type"]);
  const objectId = metadataValue(row.metadata, ["objectId", "object_id"]);
  if (objectType != null && objectId != null) {
    return `${formatValue(objectType)} #${formatValue(objectId)}`;
  }

  return row.documentId || "문서";
}

function referenceLabel(row: SearchResultDto, index: number) {
  const chunk = chunkValue(row.metadata);
  const score = typeof row.score === "number" ? `유사도 ${row.score.toFixed(4)}` : "";
  return [`근거 ${index + 1}`, resultSourceName(row), chunk !== "-" ? chunk : "", score]
    .filter(Boolean)
    .join(" / ");
}

function referenceColor(index: number) {
  return REFERENCE_COLORS[index % REFERENCE_COLORS.length];
}

function parseCitationIndex(value: string) {
  const match = value.match(/근거\s*(\d+)/);
  if (!match) {
    return null;
  }
  const index = Number(match[1]) - 1;
  return Number.isFinite(index) && index >= 0 ? index : null;
}

function extractCitationIndices(value: string) {
  const seen = new Set<number>();
  const regex = /[\[(]근거\s*(\d+)[^\])\]]*[\])]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(value)) !== null) {
    const index = Number(match[1]) - 1;
    if (Number.isFinite(index) && index >= 0) {
      seen.add(index);
    }
  }
  return [...seen];
}

function isTableSeparatorLine(line: string) {
  const cells = parseTableLine(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseTableLine(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

type AnswerBlock =
  | { type: "text"; text: string }
  | { type: "table"; rows: string[][] };

function parseAnswerBlocks(content: string): AnswerBlock[] {
  const lines = content.split(/\r?\n/);
  const blocks: AnswerBlock[] = [];
  let textLines: string[] = [];

  const flushText = () => {
    const text = textLines.join("\n").trim();
    if (text) {
      blocks.push({ type: "text", text });
    }
    textLines = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const nextLine = lines[index + 1] ?? "";
    if (line.includes("|") && isTableSeparatorLine(nextLine)) {
      flushText();
      const tableLines = [line, nextLine];
      index += 2;
      while (index < lines.length && lines[index].includes("|")) {
        tableLines.push(lines[index]);
        index += 1;
      }
      index -= 1;
      const rows = tableLines
        .filter((tableLine, tableLineIndex) => tableLineIndex !== 1)
        .map(parseTableLine)
        .filter((row) => row.length > 0);
      if (rows.length > 0) {
        blocks.push({ type: "table", rows });
      }
      continue;
    }

    if (!line.trim()) {
      flushText();
      continue;
    }

    textLines.push(line);
  }

  flushText();
  return blocks;
}

function CitationBadge({
  index,
  onReferenceHover,
}: {
  index: number;
  onReferenceHover: (index: number | null) => void;
}) {
  const color = referenceColor(index);
  const scrollToReference = () => {
    document.getElementById(`rag-reference-${index}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };
  return (
    <Box
      component="span"
      onMouseEnter={() => onReferenceHover(index)}
      onMouseLeave={() => onReferenceHover(null)}
      onClick={scrollToReference}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.2,
        mx: 0.18,
        px: 0.52,
        py: 0.02,
        borderRadius: 999,
        border: 1,
        borderColor: "transparent",
        bgcolor: "rgba(237, 233, 254, 0.72)",
        color: "#4C1D95",
        fontSize: 10.5,
        fontWeight: 700,
        lineHeight: 1.35,
        verticalAlign: "super",
        cursor: "pointer",
        transition: "background-color 140ms ease, border-color 140ms ease, color 140ms ease",
        "&:hover": {
          borderColor: CITATION_PRIMARY,
          bgcolor: CITATION_BACKGROUND,
          color: "#3B0764",
        },
      }}
    >
      <DescriptionOutlined sx={{ fontSize: 11, color: color.main }} />
      ({index + 1})
    </Box>
  );
}

function renderTextWithCitations(text: string, onReferenceHover: (index: number | null) => void) {
  const parts = text.split(/(\[근거\s*\d+[^\]]*\]|\(근거\s*\d+[^\)]*\))/g);
  return parts.map((part, index) => {
    const referenceIndex = parseCitationIndex(part);
    if (referenceIndex == null) {
      return part;
    }
    return (
      <CitationBadge
        key={`${part}-${index}`}
        index={referenceIndex}
        onReferenceHover={onReferenceHover}
      />
    );
  });
}

function stripCitationLabels(text: string) {
  return text
    .replace(/\s*[\[(]근거\s*\d+[^\])\]]*[\])]/g, "")
    .replace(/\s+([.,!?])/g, "$1")
    .trim();
}

function CitationGroup({
  indices,
  onReferenceHover,
}: {
  indices: number[];
  onReferenceHover: (index: number | null) => void;
}) {
  if (indices.length === 0) {
    return null;
  }
  return (
    <Box component="span" sx={{ whiteSpace: "nowrap" }}>
      {indices.map((index) => (
        <CitationBadge key={index} index={index} onReferenceHover={onReferenceHover} />
      ))}
    </Box>
  );
}

function renderInlineMarkdown(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <Box key={`${part}-${index}`} component="strong" sx={{ fontWeight: 700 }}>
          {part.slice(2, -2)}
        </Box>
      );
    }
    return part;
  });
}

function MarkdownText({
  text,
  citationIndices,
  onReferenceHover,
}: {
  text: string;
  citationIndices: number[];
  onReferenceHover: (index: number | null) => void;
}) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const listItems = lines.filter((line) => /^\s*[-*]\s+/.test(line));

  if (lines.length > 0 && listItems.length === lines.length) {
    return (
      <Box component="ul" sx={{ m: 0, pl: 2.25 }}>
        {lines.map((line, index) => (
          <Box key={`${line}-${index}`} component="li" sx={{ mb: index === lines.length - 1 ? 0 : 0.85 }}>
            {renderInlineMarkdown(line.replace(/^\s*[-*]\s+/, ""))}
            {index === lines.length - 1 ? (
              <>
                {" "}
                <CitationGroup indices={citationIndices} onReferenceHover={onReferenceHover} />
              </>
            ) : null}
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <>
      {lines.map((line, index) => (
        <Box key={`${line}-${index}`} component="p" sx={{ m: 0, mb: index === lines.length - 1 ? 0 : 1 }}>
          {renderInlineMarkdown(line)}
          {index === lines.length - 1 ? (
            <>
              {" "}
              <CitationGroup indices={citationIndices} onReferenceHover={onReferenceHover} />
            </>
          ) : null}
        </Box>
      ))}
    </>
  );
}

function buildVisibleRagContext(rows: SearchResultDto[], topK: number) {
  return rows
    .slice(0, Math.max(1, topK))
    .map((row, index) => {
      const content = row.content?.trim();
      if (!content) {
        return "";
      }
      const score = typeof row.score === "number" ? ` score=${row.score.toFixed(4)}` : "";
      const chunk = chunkValue(row.metadata);
      const chunkLabel = chunk === "-" ? "" : ` chunk=${chunk}`;
      return `[${referenceLabel(row, index)}] documentId=${row.documentId}${score}${chunkLabel}\n${content.slice(0, 1600)}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

function highlightText(content: string, query: string) {
  const terms = query
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);

  if (terms.length === 0) {
    return content;
  }

  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  return content.split(regex).map((part, index) => {
    const matched = terms.some((term) => part.toLocaleLowerCase().includes(term.toLocaleLowerCase()));
    if (!matched) {
      return part;
    }
    return (
      <Box
        key={`${part}-${index}`}
        component="mark"
        sx={{
          px: 0.25,
          py: 0.05,
          borderRadius: 0.5,
          bgcolor: "warning.light",
          color: "warning.contrastText",
        }}
      >
        {part}
      </Box>
    );
  });
}

function ReferenceDocuments({
  rows,
  topK,
  query,
  activeReferenceIndex,
}: {
  rows: SearchResultDto[];
  topK: number;
  query: string;
  activeReferenceIndex: number | null;
}) {
  const references = rows.slice(0, Math.max(1, topK));
  const [expandedReferenceIndex, setExpandedReferenceIndex] = useState<number | false>(0);

  useEffect(() => {
    if (activeReferenceIndex != null) {
      setExpandedReferenceIndex(activeReferenceIndex);
    }
  }, [activeReferenceIndex]);

  if (references.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        border: 0,
        borderRadius: 2,
        bgcolor: "background.paper",
        overflow: "hidden",
        height: "100%",
        minWidth: 0,
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ px: 1.5, py: 1, bgcolor: ANSWER_BACKGROUND }}
      >
        <Typography variant="subtitle2">참고 문서</Typography>
        <Chip label={`${references.length}개 근거`} size="small" sx={{ bgcolor: CITATION_BACKGROUND, color: "#4C1D95" }} />
      </Stack>
      <Stack
        spacing={1}
        sx={{
          p: 1,
          maxHeight: { xs: "none", lg: 520 },
          overflow: { xs: "visible", lg: "auto" },
          "&::-webkit-scrollbar": {
            width: 6,
          },
          "&::-webkit-scrollbar-thumb": {
            borderRadius: 8,
            bgcolor: "divider",
          },
        }}
      >
        {references.map((row, index) => {
          const color = referenceColor(index);
          const active = activeReferenceIndex === index;
          const scorePercent =
            typeof row.score === "number" ? Math.max(0, Math.min(100, row.score * 100)) : 0;
          return (
            <Accordion
              key={`${row.documentId}-${index}`}
              id={`rag-reference-${index}`}
              expanded={expandedReferenceIndex === index}
              disableGutters
              onChange={(_, expanded) => setExpandedReferenceIndex(expanded ? index : false)}
              sx={{
                border: 1,
                borderColor: active ? color.border : "divider",
                borderRadius: 1.5,
                bgcolor: active ? color.soft : "background.default",
                borderLeft: 4,
                borderLeftColor: color.main,
                boxShadow: active ? `0 0 0 3px ${color.soft}, 0 8px 20px rgba(124, 58, 237, 0.08)` : "none",
                transition: "background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
                transform: active ? "translateY(-1px)" : "none",
                overflow: "hidden",
                "&::before": {
                  display: "none",
                },
                "&.Mui-expanded": {
                  m: 0,
                },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMore />}
                sx={{
                  minHeight: 64,
                  px: 1.25,
                  py: 0.75,
                  "&.Mui-expanded": {
                    minHeight: 64,
                  },
                  "& .MuiAccordionSummary-content": {
                    m: 0,
                    minWidth: 0,
                  },
                  "& .MuiAccordionSummary-content.Mui-expanded": {
                    m: 0,
                  },
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ width: "100%", minWidth: 0 }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                    <Box
                      sx={{
                        width: 30,
                        height: 30,
                        borderRadius: 1,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: color.main,
                        color: "#fff",
                        flexShrink: 0,
                      }}
                    >
                      <DescriptionOutlined fontSize="small" />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <Typography variant="body2" fontWeight={700} sx={{ flexShrink: 0 }}>
                          근거 {index + 1}
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          sx={{
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {resultSourceName(row)}
                        </Typography>
                      </Stack>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {(row.content?.trim() || "-").slice(0, 90)}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack
                    direction="row"
                    spacing={0.5}
                    alignItems="center"
                    sx={{
                      flexShrink: 0,
                      display: { xs: "none", sm: "flex" },
                    }}
                  >
                    <Chip
                      icon={<TagOutlined />}
                      label={chunkValue(row.metadata)}
                      size="small"
                      variant="outlined"
                    />
                    {typeof row.score === "number" ? (
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <Box
                          sx={{
                            position: "relative",
                            width: 34,
                            height: 34,
                            borderRadius: "50%",
                            background: `conic-gradient(${color.main} ${scorePercent}%, #E5E7EB 0)`,
                            "&::after": {
                              content: '""',
                              position: "absolute",
                              inset: 4,
                              borderRadius: "50%",
                              bgcolor: "background.paper",
                            },
                          }}
                        />
                        <Chip
                          icon={<SpeedOutlined />}
                          label={row.score.toFixed(4)}
                          size="small"
                          color={row.score >= 0.7 ? "success" : "warning"}
                          variant="outlined"
                        />
                      </Stack>
                    ) : null}
                  </Stack>
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 1.25, pt: 0, pb: 1.25 }}>
                <Stack
                  direction="row"
                  spacing={0.5}
                  useFlexGap
                  flexWrap="wrap"
                  sx={{
                    display: { xs: "flex", sm: "none" },
                    mb: 0.75,
                  }}
                >
                  <Chip icon={<TagOutlined />} label={chunkValue(row.metadata)} size="small" variant="outlined" />
                  {typeof row.score === "number" ? (
                    <Chip
                      icon={<SpeedOutlined />}
                      label={row.score.toFixed(4)}
                      size="small"
                      color={row.score >= 0.7 ? "success" : "warning"}
                      variant="outlined"
                    />
                  ) : null}
                </Stack>
                <Typography
                  component="div"
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    maxHeight: 180,
                    overflow: "auto",
                    pr: 0.75,
                    lineHeight: 1.6,
                    overflowWrap: "anywhere",
                    whiteSpace: "pre-wrap",
                    bgcolor: active ? "#FFFBEB" : "transparent",
                    borderRadius: 1,
                    px: active ? 0.75 : 0,
                    py: active ? 0.5 : 0,
                    "&::-webkit-scrollbar": {
                      width: 6,
                    },
                    "&::-webkit-scrollbar-thumb": {
                      borderRadius: 8,
                      bgcolor: "divider",
                    },
                  }}
                >
                  {highlightText(row.content?.trim() || "-", query)}
                </Typography>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Stack>
    </Box>
  );
}

function AnswerTextBlock({
  text,
  onReferenceHover,
}: {
  text: string;
  onReferenceHover: (index: number | null) => void;
}) {
  const indices = extractCitationIndices(text);
  const cleanText = stripCitationLabels(text);
  return (
    <Box
      sx={{ minWidth: 0 }}
    >
      <Typography
        component="div"
        sx={{
          overflowWrap: "anywhere",
          fontSize: 13,
          lineHeight: 1.75,
        }}
      >
        <MarkdownText
          text={cleanText}
          citationIndices={indices}
          onReferenceHover={onReferenceHover}
        />
      </Typography>
    </Box>
  );
}

function AnswerTable({
  rows,
  onReferenceHover,
}: {
  rows: string[][];
  onReferenceHover: (index: number | null) => void;
}) {
  const [header, ...bodyRows] = rows;
  if (!header) {
    return null;
  }
  return (
    <Box sx={{ overflowX: "auto", borderRadius: 1.5 }}>
      <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: 13, lineHeight: 1.9 }}>
        <Box component="thead" sx={{ bgcolor: ANSWER_BACKGROUND }}>
          <Box component="tr">
            {header.map((cell, index) => (
              <Box
                key={`${cell}-${index}`}
                component="th"
                sx={{
                  textAlign: "left",
                  px: 1.25,
                  py: 1.1,
                  fontWeight: 700,
                  color: "text.primary",
                  borderBottom: 1,
                  borderColor: "divider",
                }}
              >
                {renderTextWithCitations(cell, onReferenceHover)}
              </Box>
            ))}
          </Box>
        </Box>
        <Box component="tbody">
          {bodyRows.map((row, rowIndex) => (
            <Box key={rowIndex} component="tr">
              {header.map((_, cellIndex) => (
                <Box
                  key={`${rowIndex}-${cellIndex}`}
                  component="td"
                  sx={{
                    px: 1.25,
                    py: 1.1,
                    verticalAlign: "top",
                    borderBottom: rowIndex === bodyRows.length - 1 ? 0 : 1,
                    borderColor: "divider",
                    bgcolor: rowIndex % 2 === 1 ? "rgba(249, 250, 251, 0.72)" : "transparent",
                    color: "text.secondary",
                  }}
                >
                  {renderTextWithCitations(row[cellIndex] ?? "", onReferenceHover)}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function AnswerRenderer({
  content,
  onReferenceHover,
}: {
  content: string;
  onReferenceHover: (index: number | null) => void;
}) {
  const blocks = parseAnswerBlocks(content);
  return (
    <Stack spacing={1.25}>
      {blocks.map((block, index) =>
        block.type === "table" ? (
          <AnswerTable key={`table-${index}`} rows={block.rows} onReferenceHover={onReferenceHover} />
        ) : (
          <AnswerTextBlock key={`text-${index}`} text={block.text} onReferenceHover={onReferenceHover} />
        )
      )}
    </Stack>
  );
}

function AnswerPanel({
  messages,
  referencesCount,
  onReferenceHover,
}: {
  messages: ChatMessageDto[];
  referencesCount: number;
  onReferenceHover: (index: number | null) => void;
}) {
  return (
    <Box
      sx={{
        borderRadius: 2,
        bgcolor: ANSWER_BACKGROUND,
        overflow: "hidden",
        height: "100%",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ px: 1.5, py: 1.25 }}
      >
        <Typography variant="subtitle2">생성 답변</Typography>
        {referencesCount > 0 ? (
          <Chip label={`근거 ${referencesCount}개 사용`} size="small" color="success" variant="outlined" />
        ) : null}
      </Stack>
      <Stack
        spacing={1.5}
        sx={{
          px: 1.5,
          pb: 1.5,
          flex: 1,
          maxHeight: { xs: "none", lg: 520 },
          overflow: { xs: "visible", lg: "auto" },
          "&::-webkit-scrollbar": {
            width: 6,
          },
          "&::-webkit-scrollbar-thumb": {
            borderRadius: 8,
            bgcolor: "divider",
          },
        }}
      >
        {messages.map((message, index) => (
          <Box
            key={`${message.role}-${index}`}
            sx={{
              borderRadius: 1.5,
              bgcolor: "background.paper",
              p: 1.5,
            }}
          >
            <AnswerRenderer content={message.content} onReferenceHover={onReferenceHover} />
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function MetadataPanel({
  metadata,
  provider,
  model,
}: {
  metadata: ChatResponseMetadataDto | null;
  provider: string;
  model: string;
}) {
  return (
    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
      <Chip
        label={metadata ? metadata.provider ?? provider : provider || "-"}
        size="small"
        variant="outlined"
      />
      <Chip
        label={metadata ? metadata.resolvedModel ?? model : model || "-"}
        size="small"
        variant="outlined"
      />
      {metadata ? (
        <>
          <Chip label={formatTokenUsage(metadata.tokenUsage)} size="small" variant="outlined" />
          <Chip label={`${metadata.latencyMs ?? "-"}ms`} size="small" variant="outlined" />
        </>
      ) : null}
    </Stack>
  );
}

function LoadingPanel() {
  return (
    <Box
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        p: 2,
        bgcolor: "background.paper",
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center">
        <CircularProgress size={18} />
        <Box>
          <Typography variant="body2" fontWeight={600}>
            문맥 기반 답변을 생성하는 중입니다.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            조회된 RAG 문맥을 기준으로 답변과 근거 정보를 정리합니다.
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}

function EmptyAnswerPanel() {
  return (
    <Box
      sx={{
        border: 1,
        borderStyle: "dashed",
        borderColor: "divider",
        borderRadius: 2,
        p: 2,
        bgcolor: "background.paper",
      }}
    >
      <Typography variant="body2" color="text.secondary">
        문맥 기반 답변 생성 결과가 여기에 표시됩니다.
      </Typography>
    </Box>
  );
}

function ContentPreview({
  title,
  content,
  metadata,
}: {
  title: string;
  content?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 1.25 }}>
      <Stack spacing={1}>
        <Typography variant="subtitle2">{title}</Typography>
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 1,
            minHeight: 120,
            maxHeight: 300,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            bgcolor: "action.hover",
            borderRadius: 2,
            fontFamily: (theme) => theme.typography.fontFamily,
            fontSize: 12,
            lineHeight: 1.7,
          }}
        >
          {content?.trim() || "row를 선택하면 전체 내용이 표시됩니다."}
        </Box>
        {metadata ? (
          <Box
            component="pre"
            sx={{
              m: 0,
              maxHeight: 160,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              color: "text.secondary",
              fontSize: 12,
            }}
          >
            {JSON.stringify(metadata, null, 2)}
          </Box>
        ) : null}
      </Stack>
    </Box>
  );
}

export function RagSearchValidationPanel({ job }: { job: RagIndexJobDto | null }) {
  const [aiInfo, setAiInfo] = useState<AiInfoResponse | null>(null);
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState("2");
  const [minScore, setMinScore] = useState("0.7");
  const [debug, setDebug] = useState(true);
  const [tab, setTab] = useState<ResultTab>("vector");
  const [vectorRows, setVectorRows] = useState<VectorSearchResultDto[]>([]);
  const [ragRows, setRagRows] = useState<SearchResultDto[]>([]);
  const [selectedVector, setSelectedVector] = useState<VectorSearchResultDto | null>(null);
  const [selectedRag, setSelectedRag] = useState<SearchResultDto | null>(null);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [lastMetadata, setLastMetadata] = useState<ChatResponseMetadataDto | null>(null);
  const [diagnostics, setDiagnostics] = useState<Record<string, unknown> | null>(null);
  const [runningAction, setRunningAction] = useState<RunningAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState(false);
  const [lastVectorKey, setLastVectorKey] = useState<string | null>(null);
  const [lastRagKey, setLastRagKey] = useState<string | null>(null);
  const [lastAnswerKey, setLastAnswerKey] = useState<string | null>(null);
  const [activeReferenceIndex, setActiveReferenceIndex] = useState<number | null>(null);

  const provider = aiInfo?.defaultProvider ?? "";
  const model = aiInfo?.providers.find((item) => item.name === provider)?.chat.model ?? "";
  const topKNumber = Math.max(1, Number(topK) || 5);
  const minScoreNumber = minScore.trim() === "" ? undefined : Number(minScore);
  const searchScope = job ? { objectType: job.objectType, objectId: job.objectId } : {};
  const isRunning = runningAction != null;
  const currentSearchKey = buildRequestKey({
    query: query.trim(),
    topK: topKNumber,
    minScore: Number.isFinite(minScoreNumber) ? minScoreNumber : undefined,
    ...searchScope,
  });
  const currentRagKey = buildRequestKey({
    query: query.trim(),
    topK: topKNumber,
    hybrid: true,
    ...searchScope,
  });
  const currentAnswerKey = buildRequestKey({
    search: currentSearchKey,
    rag: lastRagKey === currentRagKey ? currentRagKey : null,
    provider,
    model,
    debug,
  });
  const vectorLoaded = lastVectorKey === currentSearchKey;
  const ragLoaded = lastRagKey === currentRagKey;
  const answerLoaded = lastAnswerKey === currentAnswerKey && (messages.length > 0 || answerError);

  useEffect(() => {
    let alive = true;
    reactAiApi
      .fetchProviders()
      .then((response) => {
        if (alive) {
          setAiInfo(response);
        }
      })
      .catch((providerError) => {
        if (alive) {
          setError(resolveAxiosError(providerError));
        }
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setVectorRows([]);
    setRagRows([]);
    setSelectedVector(null);
    setSelectedRag(null);
    setMessages([]);
    setLastMetadata(null);
    setDiagnostics(null);
    setError(null);
    setAnswerError(false);
    setLastVectorKey(null);
    setLastRagKey(null);
    setLastAnswerKey(null);
    setActiveReferenceIndex(null);
  }, [job?.jobId]);

  const vectorColumns = useMemo<ColDef<VectorSearchResultDto>[]>(
    () => [
      { field: "id", headerName: "ID", width: 70, filter: false, cellClass: "ag-center-cell" },
      {
        field: "score",
        headerName: "유사도",
        width: 90,
        filter: false,
        cellClass: "ag-center-cell",
        valueFormatter: (params) =>
          typeof params.value === "number" ? params.value.toFixed(4) : "-",
      },
      {
        colId: "chunk",
        headerName: "Chunk",
        width: 80,
        filter: false,
        cellClass: "ag-center-cell",
        valueGetter: (params) => chunkValue(params.data?.metadata),
      },
      { field: "content", headerName: "콘텐츠", flex: 1, minWidth: 420, filter: false },
    ],
    []
  );

  const ragColumns = useMemo<ColDef<SearchResultDto>[]>(
    () => [
      { field: "documentId", headerName: "Document", width: 120, filter: false },
      {
        field: "score",
        headerName: "유사도",
        width: 90,
        filter: false,
        cellClass: "ag-center-cell",
        valueFormatter: (params) =>
          typeof params.value === "number" ? params.value.toFixed(4) : "-",
      },
      {
        colId: "chunk",
        headerName: "Chunk",
        width: 80,
        filter: false,
        cellClass: "ag-center-cell",
        valueGetter: (params) => chunkValue(params.data?.metadata),
      },
      { field: "content", headerName: "콘텐츠", flex: 1, minWidth: 420, filter: false },
    ],
    []
  );

  async function handleVectorSearch(force = false) {
    if (!query.trim()) {
      return;
    }
    if (!force && vectorLoaded) {
      setTab("vector");
      return;
    }
    setRunningAction("vector");
    setTab("vector");
    setError(null);
    setVectorRows([]);
    setSelectedVector(null);
    try {
      const response = await reactAiApi.searchVector({
        query: query.trim(),
        topK: topKNumber,
        ...searchScope,
        minScore: Number.isFinite(minScoreNumber) ? minScoreNumber : undefined,
      });
      setVectorRows(response);
      setLastVectorKey(currentSearchKey);
    } catch (searchError) {
      setError(resolveAxiosError(searchError));
      setLastVectorKey(null);
    } finally {
      setRunningAction(null);
    }
  }

  async function handleRagSearch(force = false) {
    if (!query.trim()) {
      return;
    }
    if (!force && ragLoaded) {
      setTab("rag");
      return;
    }
    setRunningAction("rag");
    setTab("rag");
    setError(null);
    setRagRows([]);
    setSelectedRag(null);
    setMessages([]);
    setLastMetadata(null);
    setDiagnostics(null);
    setAnswerError(false);
    setLastAnswerKey(null);
    setActiveReferenceIndex(null);
    try {
      const response = await reactAiApi.searchRag({
        query: query.trim(),
        topK: topKNumber,
        hybrid: true,
        ...searchScope,
      });
      setRagRows(response);
      setLastRagKey(currentRagKey);
    } catch (searchError) {
      setError(resolveAxiosError(searchError));
      setLastRagKey(null);
    } finally {
      setRunningAction(null);
    }
  }

  async function handleAnswer(force = false) {
    if (!query.trim()) {
      return;
    }
    if (!force && answerLoaded) {
      setTab("answer");
      return;
    }
    setRunningAction("answer");
    setTab("answer");
    setError(null);
    setMessages([]);
    setLastMetadata(null);
    setDiagnostics(null);
    setAnswerError(false);
    setActiveReferenceIndex(null);
    const visibleRagContext = buildVisibleRagContext(ragRows, topKNumber);
    try {
      const response = await reactAiApi.sendRagChat({
        chat: {
          provider: provider || undefined,
          model: model || undefined,
          systemPrompt: [
            "제공된 RAG 문서 내용에 근거해서만 답변하세요. 문서에서 확인할 수 없는 내용은 확인할 수 없다고 답변하세요.",
            "답변에서 참고 문서를 언급할 때는 긴 문서명이나 Chunk를 쓰지 말고 반드시 (근거 1), (근거 2) 형식만 사용하세요.",
            "같은 문장 안에서는 근거를 반복하지 말고 문장 끝에 필요한 근거만 한 번 모아서 표시하세요.",
            "표가 적절한 경우 Markdown table로 작성하고, 표의 셀이나 행에도 필요한 경우 (근거 N)을 붙이세요.",
            visibleRagContext
              ? `아래는 현재 화면의 RAG 결과입니다. 이 내용을 우선 근거로 사용하세요.\n${visibleRagContext}`
              : "",
          ].filter(Boolean).join("\n\n"),
          messages: [{ role: "user", content: query.trim() }],
        },
        ragQuery: query.trim(),
        ragTopK: topKNumber,
        topK: topKNumber,
        ...searchScope,
        minScore: Number.isFinite(minScoreNumber) ? minScoreNumber : undefined,
        debug,
      });
      setMessages(response.messages ?? []);
      setLastMetadata(response.metadata ?? null);
      const ragDiagnostics = response.metadata?.ragDiagnostics;
      const contextDiagnostics = response.metadata?.ragContextDiagnostics;
      setDiagnostics(
        ragDiagnostics || contextDiagnostics
          ? { retrieval: ragDiagnostics, context: contextDiagnostics }
          : null
      );
      setAnswerError(false);
      setLastAnswerKey(currentAnswerKey);
    } catch (answerError) {
      setError(resolveAxiosError(answerError));
      setAnswerError(true);
      setLastAnswerKey(currentAnswerKey);
    } finally {
      setRunningAction(null);
    }
  }

  return (
    <Stack spacing={1.5} sx={{ mt: 1.5 }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1">검색 검증</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {job
              ? `${sourceDisplayName(job)} / ${job.objectType} #${job.objectId}`
              : "색인 작업을 선택하지 않으면 전체 RAG 범위에서 검색합니다."}
          </Typography>
        </Box>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}>
        <TextField
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setVectorRows([]);
            setRagRows([]);
            setMessages([]);
            setAnswerError(false);
            setSelectedVector(null);
            setSelectedRag(null);
            setLastVectorKey(null);
            setLastRagKey(null);
            setLastAnswerKey(null);
            setActiveReferenceIndex(null);
          }}
          placeholder="검증 쿼리 입력"
          size="small"
          fullWidth
          inputProps={{ "aria-label": "검증 쿼리" }}
        />
        <TextField
          label="Top K"
          value={topK}
          onChange={(event) => setTopK(event.target.value)}
          size="small"
          sx={{ width: { xs: "100%", md: 110 } }}
        />
        <TextField
          label="Min Score"
          value={minScore}
          onChange={(event) => setMinScore(event.target.value)}
          size="small"
          sx={{ width: { xs: "100%", md: 130 } }}
        />
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Debug
          </Typography>
          <Switch checked={debug} onChange={(event) => setDebug(event.target.checked)} />
        </Stack>
      </Stack>

      <Stack spacing={0.5} alignItems="flex-start">
        <ButtonGroup
          variant="outlined"
          size="small"
          sx={{
            flexWrap: "wrap",
            "& .MuiButton-root": {
              minWidth: { xs: 150, md: 180 },
              px: 2,
            },
          }}
        >
          <Button
            variant={tab === "vector" ? "contained" : "outlined"}
            onClick={() => void handleVectorSearch()}
            disabled={isRunning || !query.trim()}
            startIcon={
              runningAction === "vector" ? <CircularProgress size={16} color="inherit" /> : undefined
            }
          >
            <Tooltip describeChild title={vectorLoaded ? "배지를 클릭하면 같은 조건으로 다시 조회합니다." : ""}>
              <Badge
                badgeContent={vectorLoaded ? vectorRows.length : null}
                color={vectorRows.length === 0 ? "default" : "primary"}
                invisible={!vectorLoaded}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!isRunning && query.trim()) {
                    void handleVectorSearch(true);
                  }
                }}
                sx={{
                  cursor: vectorLoaded ? "pointer" : "inherit",
                  "& .MuiBadge-badge": { right: -14 },
                }}
              >
                <Box component="span">벡터 검색</Box>
              </Badge>
            </Tooltip>
          </Button>
          <Button
            variant={tab === "rag" ? "contained" : "outlined"}
            onClick={() => void handleRagSearch()}
            disabled={isRunning || !query.trim()}
            startIcon={runningAction === "rag" ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            <Tooltip describeChild title={ragLoaded ? "배지를 클릭하면 같은 조건으로 다시 조회합니다." : ""}>
              <Badge
                badgeContent={ragLoaded ? ragRows.length : null}
                color={ragRows.length === 0 ? "default" : "primary"}
                invisible={!ragLoaded}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!isRunning && query.trim()) {
                    void handleRagSearch(true);
                  }
                }}
                sx={{
                  cursor: ragLoaded ? "pointer" : "inherit",
                  "& .MuiBadge-badge": { right: -14 },
                }}
              >
                <Box component="span">RAG 결과 조회</Box>
              </Badge>
            </Tooltip>
          </Button>
          <Button
            variant={tab === "answer" ? "contained" : "outlined"}
            onClick={() => void handleAnswer()}
            disabled={isRunning || !query.trim()}
            startIcon={
              runningAction === "answer" ? <CircularProgress size={16} color="inherit" /> : undefined
            }
          >
            <Tooltip describeChild title={answerLoaded ? "배지를 클릭하면 같은 조건으로 다시 생성합니다." : ""}>
              <Badge
                badgeContent={
                  answerLoaded
                    ? answerError
                      ? <BugReportOutlined sx={{ fontSize: 12 }} />
                      : "완료"
                    : null
                }
                color={answerError ? "error" : "success"}
                invisible={!answerLoaded}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!isRunning && query.trim()) {
                    void handleAnswer(true);
                  }
                }}
                sx={{
                  cursor: answerLoaded ? "pointer" : "inherit",
                  "& .MuiBadge-badge": {
                    minWidth: answerError ? 18 : undefined,
                    right: answerError ? -12 : -18,
                  },
                }}
              >
                <Box component="span">문맥 기반 답변 생성</Box>
              </Badge>
            </Tooltip>
          </Button>
        </ButtonGroup>
      </Stack>

      {tab === "vector" ? (
        <Stack spacing={1}>
          <GridContent<VectorSearchResultDto>
            columns={vectorColumns}
            rowData={vectorRows}
            loading={runningAction === "vector"}
            height={280}
            events={[
              {
                type: "rowClicked",
                listener: (event) =>
                  setSelectedVector((event as { data?: VectorSearchResultDto }).data ?? null),
              },
            ]}
          />
          <ContentPreview
            title="선택한 벡터 결과"
            content={selectedVector?.content}
            metadata={selectedVector?.metadata}
          />
        </Stack>
      ) : null}

      {tab === "rag" ? (
        <Stack spacing={1}>
          <GridContent<SearchResultDto>
            columns={ragColumns}
            rowData={ragRows}
            loading={runningAction === "rag"}
            height={280}
            events={[
              {
                type: "rowClicked",
                listener: (event) => setSelectedRag((event as { data?: SearchResultDto }).data ?? null),
              },
            ]}
          />
          <ContentPreview
            title="선택한 RAG 결과"
            content={selectedRag?.content}
            metadata={selectedRag?.metadata}
          />
        </Stack>
      ) : null}

      {tab === "answer" ? (
        <Stack spacing={1}>
          {runningAction === "answer" ? (
            <LoadingPanel />
          ) : messages.length ? (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "minmax(0, 1fr)",
                  lg: "minmax(0, 1fr) minmax(0, 1fr)",
                },
                gap: 1.25,
                alignItems: "stretch",
              }}
            >
              <AnswerPanel
                messages={messages}
                referencesCount={Math.min(ragRows.length, topKNumber)}
                onReferenceHover={setActiveReferenceIndex}
              />
              <ReferenceDocuments
                rows={ragRows}
                topK={topKNumber}
                query={query}
                activeReferenceIndex={activeReferenceIndex}
              />
            </Box>
          ) : (
            <EmptyAnswerPanel />
          )}
          <MetadataPanel metadata={lastMetadata} provider={provider} model={model} />
          {diagnostics ? (
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 1,
                maxHeight: 220,
                overflow: "auto",
                bgcolor: "action.hover",
                borderRadius: 2,
                fontSize: 12,
              }}
            >
              {JSON.stringify(diagnostics, null, 2)}
            </Box>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}
