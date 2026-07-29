import type { MouseEvent, ReactNode } from "react";
import { alpha, Box, Tooltip, Typography } from "@mui/material";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";

const CITATION_PATTERN = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
const CITATION_TARGET = "#rag-citation-";
const FENCE_PATTERN = /^\s{0,3}(`{3,}|~{3,})/;

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

export function RagMarkdownRenderer({ content, references, onCitationClick }: Props) {
  const allowedCitationIndices = new Set(
    references
      .map((reference) => reference.index)
      .filter((index): index is number => Number.isInteger(index) && (index ?? 0) > 0)
  );
  const components: Components = {
    a: ({ href, children }) => {
      const indices = citationIndices(href);
      if (indices.length > 0) {
        return (
          <CitationLink
            indices={indices}
            references={references}
            onCitationClick={onCitationClick}
          />
        );
      }
      return (
        <a href={href} target="_blank" rel="noreferrer noopener">
          {children as ReactNode}
        </a>
      );
    },
  };

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
      }}
    >
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeSanitize, rehypeKatex]}
        urlTransform={safeUrlTransform}
        components={components}
      >
        {encodeRagCitations(content, allowedCitationIndices)}
      </ReactMarkdown>
    </Box>
  );
}
