import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { CheckOutlined, ContentCopyOutlined } from "@mui/icons-material";
import { alpha, Box, IconButton, Tooltip, Typography } from "@mui/material";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";

const CITATION_PATTERN = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
const CITATION_TARGET = "#rag-citation-";
const FENCE_PATTERN = /^\s{0,3}(`{3,}|~{3,})/;
const MAX_RICH_MARKDOWN_CHARS = 32_000;

export interface RagMarkdownReference {
  index?: number;
  title?: string;
  chunk?: string;
  content?: string;
}

interface Props {
  content: string;
  references: RagMarkdownReference[];
  onCitationClick?: (indices: number[], event: MouseEvent<HTMLElement>) => void;
}

function encodeInlineCitations(line: string, allowedIndices?: ReadonlySet<number>) {
  const parts = line.split(/(`+)/);
  let inlineCodeDelimiter = "";

  return parts
    .map((part) => {
      if (/^`+$/.test(part)) {
        if (!inlineCodeDelimiter) {
          inlineCodeDelimiter = part;
        } else if (part.length === inlineCodeDelimiter.length) {
          inlineCodeDelimiter = "";
        }
        return part;
      }
      if (inlineCodeDelimiter) {
        return part;
      }
      return part.replace(CITATION_PATTERN, (_match, value: string) => {
        const indices = value
          .split(",")
          .map((item) => Number.parseInt(item.trim(), 10));
        if (allowedIndices && !indices.every((index) => allowedIndices.has(index))) {
          return _match;
        }
        const compact = value.replace(/\s+/g, "");
        return `[${value}](${CITATION_TARGET}${compact})`;
      });
    })
    .join("");
}

/**
 * Converts validated citation labels into safe fragment links that ReactMarkdown
 * can hand to the citation component. Code blocks and inline code stay untouched.
 */
export function encodeRagCitations(content: string, allowedIndices?: ReadonlySet<number>) {
  let fenceMarker = "";
  return content
    .split(/\r?\n/)
    .map((line) => {
      const fence = line.match(FENCE_PATTERN)?.[1] ?? "";
      if (fence) {
        if (!fenceMarker) {
          fenceMarker = fence[0];
        } else if (fence[0] === fenceMarker) {
          fenceMarker = "";
        }
        return line;
      }
      return fenceMarker ? line : encodeInlineCitations(line, allowedIndices);
    })
    .join("\n");
}

function citationIndices(href?: string) {
  if (!href?.startsWith(CITATION_TARGET)) {
    return [];
  }
  return href
    .slice(CITATION_TARGET.length)
    .split(",")
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function CitationLink({
  indices,
  references,
  onCitationClick,
}: {
  indices: number[];
  references: RagMarkdownReference[];
  onCitationClick?: Props["onCitationClick"];
}) {
  const matchingReferences = references.filter((reference) => indices.includes(reference.index ?? -1));
  const label = `[${indices.join(", ")}]`;
  if (matchingReferences.length !== indices.length) {
    return <>{label}</>;
  }
  const badge = (
    <Box
      component="button"
      type="button"
      aria-label={`근거 ${indices.join(", ")}`}
      onClick={(event) => onCitationClick?.(indices, event)}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        mx: 0.3,
        px: 0.6,
        py: 0.1,
        border: 0,
        borderRadius: "4px",
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
        color: "primary.main",
        font: "inherit",
        fontWeight: 700,
        fontSize: "0.82em",
        cursor: onCitationClick ? "pointer" : "default",
        verticalAlign: "baseline",
        lineHeight: 1.2,
        transition: "all 120ms ease",
        "&:hover": onCitationClick
          ? { bgcolor: "primary.main", color: "#fff" }
          : {},
      }}
    >
      {label}
    </Box>
  );

  if (matchingReferences.length === 0) {
    return badge;
  }

  return (
    <Tooltip
      arrow
      placement="top"
      title={
        <Box sx={{ p: 0.5, maxWidth: 320 }}>
          {matchingReferences.map((reference, index) => (
            <Box key={`${reference.index}-${reference.title}-${index}`} sx={{ mb: index < matchingReferences.length - 1 ? 1 : 0 }}>
              <Typography variant="caption" component="div" sx={{ fontWeight: 800, fontSize: 11.5, color: "#fff" }}>
                근거 {reference.index ?? index + 1}: {reference.title}
                {reference.chunk ? ` (${reference.chunk})` : ""}
              </Typography>
              {reference.content ? (
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
                  “{reference.content.trim()}”
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

function safeUrlTransform(url: string) {
  return url.startsWith(CITATION_TARGET) ? url : defaultUrlTransform(url);
}

type TableCopyStatus = "idle" | "copied" | "failed";

function tableAsTsv(table: HTMLTableElement) {
  return Array.from(table.rows)
    .map((row) => Array.from(row.cells)
      .map((cell) => (cell.textContent ?? "").replace(/\s+/g, " ").trim())
      .join("\t"))
    .join("\n");
}

function CopyableTable({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copyStatus, setCopyStatus] = useState<TableCopyStatus>("idle");

  useEffect(() => {
    if (copyStatus === "idle") return undefined;
    const timer = window.setTimeout(() => setCopyStatus("idle"), 1_600);
    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  const copyTable = async () => {
    const table = containerRef.current?.querySelector("table");
    const text = table ? tableAsTsv(table) : "";
    if (!text || !navigator.clipboard?.writeText) {
      setCopyStatus("failed");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };

  const tooltip = copyStatus === "copied"
    ? "표 복사 완료"
    : copyStatus === "failed"
      ? "표를 복사할 수 없습니다"
      : "표 복사";

  return (
    <Box
      ref={containerRef}
      className="rag-table-container"
      sx={{ position: "relative", maxWidth: "100%" }}
    >
      <Box className="rag-table-scroll" sx={{ maxWidth: "100%", overflowX: "auto" }}>
        <table>{children}</table>
      </Box>
      <Box
        className="rag-table-copy-zone"
        sx={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 44,
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          "& .rag-table-copy-button": {
            opacity: 0,
            pointerEvents: "none",
          },
          "&:hover .rag-table-copy-button, &:focus-within .rag-table-copy-button": {
            opacity: 1,
            pointerEvents: "auto",
          },
        }}
      >
        <Tooltip title={tooltip} placement="top" arrow>
          <IconButton
            className="rag-table-copy-button"
            type="button"
            size="small"
            aria-label={tooltip}
            onClick={() => void copyTable()}
            color={copyStatus === "failed" ? "error" : "default"}
            sx={{
              width: 28,
              height: 28,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              bgcolor: (theme) => alpha(theme.palette.background.paper, 0.94),
              boxShadow: 1,
              transition: "opacity 120ms ease, background-color 120ms ease",
              "&:hover, &:focus-visible": { bgcolor: "background.paper" },
            }}
          >
            {copyStatus === "copied"
              ? <CheckOutlined color="success" sx={{ fontSize: 16 }} />
              : <ContentCopyOutlined sx={{ fontSize: 15 }} />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

export function RagMarkdownRenderer({ content, references, onCitationClick }: Props) {
  const allowedCitationIndices = new Set(
    references
      .map((reference) => reference.index)
      .filter((index): index is number => Number.isInteger(index) && (index ?? 0) > 0)
  );
  const components: Components = {
    a: ({ href, children }) => {
      const indices = citationIndices(href);
      const renderedLabel = Array.isArray(children)
        ? children.join("")
        : String(children ?? "");
      const expectedLabel = indices.join(", ");
      if (indices.length > 0
          && renderedLabel.replace(/\s+/g, " ").trim() === expectedLabel
          && indices.every((index) => allowedCitationIndices.has(index))) {
        return (
          <CitationLink
            indices={indices}
            references={references}
            onCitationClick={onCitationClick}
          />
        );
      }
      // Model-authored links are not trusted navigation. Source links are
      // rendered by the bounded reference UI after the server authorizes them.
      return <>{children as ReactNode}</>;
    },
    img: ({ alt }) => <>{alt ? `[이미지: ${alt}]` : null}</>,
    table: ({ children }) => <CopyableTable>{children}</CopyableTable>,
  };

  if (content.length > MAX_RICH_MARKDOWN_CHARS) {
    return (
      <Typography
        data-testid="rag-markdown-plain-fallback"
        component="div"
        sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 14.5, lineHeight: 1.75 }}
      >
        {content}
      </Typography>
    );
  }

  return (
    <Box
      data-testid="rag-markdown"
      sx={{
        overflowWrap: "anywhere",
        fontSize: 14.5,
        lineHeight: 1.75,
        "& > :first-of-type": { mt: 0 },
        "& > :last-child": { mb: 0 },
        "& p": { mt: 0, mb: 1.25 },
        "& h1, & h2, & h3, & h4": {
          mt: 2,
          mb: 0.75,
          lineHeight: 1.4,
          fontWeight: 800,
          color: "text.primary",
        },
        "& h1": { fontSize: "1.2rem" },
        "& h2": { fontSize: "1.08rem" },
        "& h3, & h4": { fontSize: "1rem" },
        "& ul, & ol": { mt: 0.5, mb: 1.25, pl: 3 },
        "& li": { mb: 0.75, pl: 0.25 },
        "& li:last-child": { mb: 0 },
        "& li > p": { mb: 0.4 },
        "& blockquote": {
          m: "12px 0",
          px: 1.5,
          py: 0.75,
          borderLeft: "3px solid",
          borderColor: "primary.light",
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
          color: "text.secondary",
        },
        "& pre": {
          my: 1.25,
          p: 1.5,
          overflowX: "auto",
          borderRadius: 1.5,
          bgcolor: (theme) => alpha(theme.palette.text.primary, 0.06),
        },
        "& code": {
          px: 0.45,
          py: 0.1,
          borderRadius: 0.5,
          bgcolor: (theme) => alpha(theme.palette.text.primary, 0.06),
          fontSize: "0.9em",
        },
        "& pre code": { p: 0, bgcolor: "transparent" },
        "& a": { color: "primary.main", textDecorationColor: "currentColor" },
        "& .rag-table-container": { my: 1.25 },
        "& table": {
          width: "100%",
          minWidth: 480,
          borderCollapse: "collapse",
          fontSize: "0.94em",
        },
        "& th, & td": {
          px: 1.25,
          py: 0.8,
          border: "1px solid",
          borderColor: "divider",
          textAlign: "left",
          verticalAlign: "top",
        },
        "& th": {
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.07),
          fontWeight: 800,
          whiteSpace: "nowrap",
        },
        "& th:last-of-type": { pr: 5 },
      }}
    >
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeSanitize, rehypeKatex]}
        urlTransform={safeUrlTransform}
        components={components}
      >
        {encodeRagCitations(content, allowedCitationIndices)}
      </ReactMarkdown>
    </Box>
  );
}
