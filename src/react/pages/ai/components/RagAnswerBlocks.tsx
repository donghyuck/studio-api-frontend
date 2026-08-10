import { useEffect, useState, type MouseEvent } from "react";
import { alpha, Box, Button, Stack, Typography } from "@mui/material";
import type {
  RagAnswerBlocksDto,
  RagAnswerChartBlockDto,
  RagAnswerSourceImageBlockDto,
} from "@/types/studio/ai";

interface Props {
  document?: RagAnswerBlocksDto;
  canonicalContent?: string;
  onCitationClick?: (indices: number[], event: MouseEvent<HTMLElement>) => void;
}

async function sha256(value: string) {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validChart(block: unknown): block is RagAnswerChartBlockDto {
  if (!block || typeof block !== "object") return false;
  const candidate = block as RagAnswerChartBlockDto;
  return candidate.type === "CHART"
    && candidate.chartType === "BAR"
    && typeof candidate.title === "string"
    && Array.isArray(candidate.points)
    && candidate.points.length > 0
    && candidate.points.length <= 100
    && candidate.points.every((point) =>
      point
      && typeof point.label === "string"
      && point.label.length <= 2_000
      && Number.isFinite(point.value)
      && Array.isArray(point.citationIndexes));
}

const SOURCE_IMAGE_PATH = /^\/api\/ai\/chat\/rag\/source-images\/[A-Za-z0-9_-]{20,4096}$/;

function validSourceImage(block: unknown): block is RagAnswerSourceImageBlockDto {
  if (!block || typeof block !== "object") return false;
  const candidate = block as RagAnswerSourceImageBlockDto;
  return candidate.type === "SOURCE_IMAGE"
    && candidate.mediaType === "image/png"
    && typeof candidate.src === "string"
    && SOURCE_IMAGE_PATH.test(candidate.src)
    && typeof candidate.alt === "string"
    && candidate.alt.length > 0
    && candidate.alt.length <= 200
    && Number.isInteger(candidate.page)
    && candidate.page > 0
    && Array.isArray(candidate.citationIndexes)
    && candidate.citationIndexes.length <= 64
    && candidate.citationIndexes.every((value) => Number.isInteger(value) && value > 0);
}

function BoundedBarChart({
  block,
  onCitationClick,
}: {
  block: RagAnswerChartBlockDto;
  onCitationClick?: Props["onCitationClick"];
}) {
  const absoluteMaximum = Math.max(...block.points.map((point) => Math.abs(point.value)), 1);

  return (
    <Box
      data-testid="rag-answer-chart"
      sx={{
        mt: 1.5,
        p: 1.5,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1.5,
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.025),
      }}
    >
      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.25 }}>
        {block.title}
      </Typography>
      <Stack spacing={1}>
        {block.points.map((point, index) => {
          const width = Math.max(2, Math.min(100, Math.abs(point.value) / absoluteMaximum * 100));
          const citations = point.citationIndexes.filter((value) => Number.isInteger(value) && value > 0);
          return (
            <Box key={`${block.blockId}-${point.label}-${index}`}>
              <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="baseline">
                <Typography variant="caption" sx={{ fontWeight: 650, overflowWrap: "anywhere" }}>
                  {point.label}
                </Typography>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Typography variant="caption" sx={{ fontVariantNumeric: "tabular-nums" }}>
                    {point.value.toLocaleString()}{block.unit}
                  </Typography>
                  {citations.length > 0 ? (
                    <Button
                      size="small"
                      aria-label={`근거 ${citations.join(", ")}`}
                      onClick={(event) => onCitationClick?.(citations, event)}
                      sx={{ minWidth: 0, px: 0.5, py: 0, fontSize: 10, fontWeight: 800 }}
                    >
                      [{citations.join(", ")}]
                    </Button>
                  ) : null}
                </Stack>
              </Stack>
              <Box sx={{ mt: 0.4, height: 8, borderRadius: 4, bgcolor: "action.hover", overflow: "hidden" }}>
                <Box
                  sx={{
                    width: `${width}%`,
                    height: "100%",
                    borderRadius: 4,
                    bgcolor: point.value < 0 ? "error.main" : "primary.main",
                  }}
                />
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

function SourceImageBlock({
  block,
  onCitationClick,
}: {
  block: RagAnswerSourceImageBlockDto;
  onCitationClick?: Props["onCitationClick"];
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <Box
      data-testid="rag-source-image"
      sx={{
        mt: 1.5,
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1.5,
        bgcolor: "background.paper",
      }}
    >
      <Box
        component="img"
        src={block.src}
        alt={block.alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        sx={{ display: "block", width: "100%", height: "auto", maxHeight: 720, objectFit: "contain" }}
      />
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ p: 1 }}>
        <Typography variant="caption" color="text.secondary">
          원문 PDF {block.page}페이지
        </Typography>
        {block.citationIndexes.length > 0 ? (
          <Button
            size="small"
            aria-label={`근거 ${block.citationIndexes.join(", ")}`}
            onClick={(event) => onCitationClick?.(block.citationIndexes, event)}
            sx={{ minWidth: 0, px: 0.75, py: 0, fontSize: 10, fontWeight: 800 }}
          >
            [{block.citationIndexes.join(", ")}]
          </Button>
        ) : null}
      </Stack>
    </Box>
  );
}

export function RagAnswerBlocks({ document, canonicalContent, onCitationClick }: Props) {
  const [fingerprintValid, setFingerprintValid] = useState(false);
  useEffect(() => {
    let active = true;
    setFingerprintValid(false);
    const expected = document?.canonicalContentFingerprint;
    if (!expected || typeof canonicalContent !== "string") return () => { active = false; };
    void sha256(canonicalContent).then((actual) => {
      if (active) setFingerprintValid(actual === expected.toLowerCase());
    });
    return () => { active = false; };
  }, [canonicalContent, document?.canonicalContentFingerprint]);

  if (document?.schemaVersion !== "rag-answer-blocks-v1" || !Array.isArray(document.blocks)) {
    return null;
  }
  if (!fingerprintValid) return null;
  const charts = document.blocks.filter(validChart);
  const sourceImages = document.blocks.filter(validSourceImage);
  if (charts.length === 0 && sourceImages.length === 0) return null;

  return (
    <Stack spacing={1}>
      {charts.map((chart) => (
        <BoundedBarChart key={chart.blockId} block={chart} onCitationClick={onCitationClick} />
      ))}
      {sourceImages.map((sourceImage) => (
        <SourceImageBlock
          key={sourceImage.blockId}
          block={sourceImage}
          onCitationClick={onCitationClick}
        />
      ))}
    </Stack>
  );
}
