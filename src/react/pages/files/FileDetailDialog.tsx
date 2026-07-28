import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { alpha } from "@mui/material/styles";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Checkbox,
  FormControlLabel,
  Paper,
  Grid,
  Select,
  Switch,
  Container,
  Drawer,
  ToggleButton,
  ToggleButtonGroup,
  Tab,
  Tabs,
} from "@mui/material";
import {
  CloseOutlined,
  ContentCopyOutlined,
  ExpandMoreOutlined,
  LinkOutlined,
  RefreshOutlined,
  TextSnippetOutlined,
  TimelineOutlined,
  DownloadOutlined,
  CheckCircle,
  Cancel,
  ArrowBackIosNewOutlined,
  VisibilityOutlined,
  ArrowDownwardOutlined,
  AutoFixHighOutlined,
  LockOutlined,
  DescriptionOutlined,
} from "@mui/icons-material";
import dayjs from "dayjs";
import { useAuthStore } from "@/react/auth/store";
import { useToast } from "@/react/feedback";
import { reactAiApi, type EmbeddingOption } from "@/react/pages/ai/api";
import type {
  RagChunkConfigResponseDto,
  AiInfoResponse,
  ChatRagRequestDto,
  RagAnswerMode,
  RagAnswerPolicyCapabilitiesDto,
} from "@/types/studio/ai";
import {
  reactFilesApi,
  reactDocumentConvertApi,
  reactMarkdownDocumentApi,
  type OcrMode,
  type DocumentConvertStatus,
  type DocumentConvertJob,
  type MarkdownDocumentDto,
  type MarkdownDocumentRevisionDto,
  type MarkdownLocatorDto,
  type MarkdownResourceDto,
  type MarkdownPipelineStage,
  type MarkdownPipelineExecutionDto,
  type MarkdownRagReindexRequest,
  type RetrievalPolicyDto,
  type RetrievalPolicyUsageDto,
  type RetrievalPolicySummaryDto,
  type MarkdownDocumentProfileDescriptor,
  type MarkdownProcessingPlan,
  type MarkdownPipelineEstimateResponse,
  type MarkdownDocumentFromAttachmentRequest,
  type MarkdownDocumentReextractRequest,
  type DocumentMetadataSchema,
  type DocumentMetadataArtifact,
  type DocumentSemanticTypeSelection,
  type MetadataEnrichmentMode,
} from "@/react/pages/files/api";
import { AiProviderSelect } from "@/react/components/ai/AiProviderSelect";
import { AssistantMessageBubble } from "../ai/components/AssistantMessageBubble";
import { RagAnswerModeSelector } from "../ai/components/RagAnswerModeSelector";
import { UserMessageBubble } from "../ai/components/UserMessageBubble";
import type { ChatMessage } from "../ai/components/chatTypes";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { resolveAxiosError } from "@/utils/helpers";
import type { AttachmentDto } from "@/types/studio/files";
import { DocumentConvertDialog, getDocumentFormat, getFriendlyErrorMessage } from "./DocumentConvertDialog";
import { EpubReaderDialog } from "./EpubReaderDialog";
import { PdfReaderDialog } from "./PdfReaderDialog";
import { MarkdownViewerDialog } from "./MarkdownViewerDialog";
import { useMarkdownDocumentPolling } from "./hooks/useMarkdownDocumentPolling";
import { getCachedThumbnailUrl, requestThumbnail, invalidateThumbnail } from "./thumbnailCache";
import { findNormalizedDocumentResource, getNormalizationBadge, getNormalizationSourceLabel } from "../ai/chunkMetaHelper";

const THUMBNAIL_RETRY_INTERVAL_MS = 1500;
const THUMBNAIL_RETRY_LIMIT = 8;

function documentProfileLabel(profile: MarkdownDocumentProfileDescriptor) {
  return profile.displayName;
}

function documentProfileDescription(profile: MarkdownDocumentProfileDescriptor) {
  return profile.description;
}

function documentProfileSettings(profile: MarkdownDocumentProfileDescriptor) {
  const strategy = profile.chunkingStrategy ?? "자동 선택";
  const ocr = profile.ocrRequired ? "OCR 강제" : profile.ocrMode === "AUTO" ? "OCR 자동" : `OCR ${profile.ocrMode}`;
  return `청킹 ${strategy} · ${profile.chunkMaxSize}/${profile.chunkOverlap} ${profile.chunkUnit} · ${ocr}`;
}

function shouldRetryThumbnail(status?: string) {
  return !status || status === "pending";
}

function isImageContent(contentType?: string | null) {
  return Boolean(contentType?.toLowerCase().startsWith("image/"));
}

function isReadyThumbnail(status?: string) {
  return status !== "pending" && status !== "unavailable";
}

interface Props {
  open: boolean;
  onClose: () => void;
  attachmentId: number;
}

function ragObjectScopes(file: AttachmentDto | null, fallbackAttachmentId: number) {
  const attachmentObjectId = String(fallbackAttachmentId);
  const scopes: Array<{ objectType: string; objectId: string }> = [];
  const append = (objectType?: string | number | null, objectId?: string | number | null) => {
    const type = objectType == null ? "" : String(objectType).trim();
    const id = objectId == null ? "" : String(objectId).trim();
    if (!type || !id) {
      return;
    }
    if (!scopes.some((scope) => scope.objectType === type && scope.objectId === id)) {
      scopes.push({ objectType: type, objectId: id });
    }
  };

  append(file?.objectType, attachmentObjectId);
  append(file?.objectType, file?.objectId);
  append("attachment", attachmentObjectId);

  return scopes.length > 0 ? scopes : [{ objectType: "attachment", objectId: attachmentObjectId }];
}

function metadataMatchesAttachment(metadata: Record<string, unknown>, attachmentId: number) {
  const expected = String(attachmentId);
  const candidates = [
    metadata.attachmentId,
    metadata.sourceDocumentId,
    metadata.documentId,
  ];
  return candidates.some((c) => c != null && String(c) === expected);
}

function formatFileSize(size?: number | null) {
  if (size == null) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(value?: Date | string | null) {
  return value ? dayjs(value).format("YYYY-MM-DD HH:mm:ss") : "";
}

function normalizeExtractedText(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replaceAll(String.fromCharCode(0), "")
    .replace(/\f/g, "\n\n")
    .trim();
}

interface Props {
  open: boolean;
  attachmentId: number;
  onClose: () => void;
}

const knownMetadataLabels: Record<string, string> = {
  indexed: "RAG 색인 여부 (indexed)",
  documentId: "문서 ID (documentId)",
  embeddingProfileId: "임베딩 프로파일 (embeddingProfileId)",
  embeddingModel: "임베딩 모델 (embeddingModel)",
  embeddingProvider: "임베딩 제공업체 (embeddingProvider)",
  embeddingDimension: "벡터 차원 (embeddingDimension)",
  chunkingStrategy: "청킹 전략 (chunkingStrategy)",
  chunkCount: "총 청크 수 (chunkCount)",
  indexedAt: "색인 일시 (indexedAt)",
  createdAt: "생성 일시 (createdAt)",
  updatedAt: "수정 일시 (updatedAt)",
  ocrMode: "OCR 모드 (ocrMode)",
  ocrApplied: "OCR 적용 여부 (ocrApplied)",
  ocrLanguage: "OCR 언어 (ocrLanguage)",
};

function formatMetadataKey(key: string): string {
  return knownMetadataLabels[key] || key;
}

function formatMetadataValue(value: unknown): string {
  if (value == null) {
    return "-";
  }
  if (typeof value === "boolean") {
    return value ? "예 (true)" : "아니오 (false)";
  }
  if (typeof value === "string") {
    if (value.toLowerCase() === "unknown") return "미지정 (unknown)";
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value);
}

function formatEmbeddingModelName(modelName?: string | null): string {
  if (!modelName || modelName.trim() === "" || modelName === "-") return "-";
  if (modelName.toLowerCase() === "unknown") return "미지정 (unknown)";
  if (modelName.includes("undefined")) {
    return modelName.replace(/\s*\(\s*undefined\s*\)/gi, "").trim();
  }
  return modelName;
}

function RagMetadataAccordion({ entries }: { entries: Array<[string, unknown]> }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Accordion
      disableGutters
      elevation={0}
      expanded={expanded}
      onChange={(_, nextExpanded) => setExpanded(nextExpanded)}
      square
      sx={{
        bgcolor: "transparent",
        border: 0,
        boxShadow: "none",
        "&:before": { display: "none" },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreOutlined fontSize="small" />}
        sx={{
          borderBottom: "1px solid",
          borderColor: "divider",
          minHeight: 36,
          px: 0,
          "& .MuiAccordionSummary-content": {
            my: 0.75,
            alignItems: "center",
          },
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
          RAG Metadata
        </Typography>
      </AccordionSummary>
      {expanded ? (
        <AccordionDetails sx={{ px: 0, pt: 0, pb: 0.5 }}>
          <Box
            component="dl"
            sx={{
              m: 0,
              display: "grid",
              gridTemplateColumns: "minmax(120px, 40%) minmax(0, 1fr)",
              rowGap: 0,
              columnGap: 1.5,
            }}
          >
            {entries.map(([key, value]) => (
              <Box
                component="div"
                key={key}
                sx={{
                  display: "contents",
                  "& > dt, & > dd": {
                    py: 0.85,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  },
                }}
              >
                <Typography component="dt" variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  {formatMetadataKey(key)}
                </Typography>
                <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: "anywhere" }}>
                  {formatMetadataValue(value)}
                </Typography>
              </Box>
            ))}
          </Box>
        </AccordionDetails>
      ) : null}
    </Accordion>
  );
}

export function FileDetailDialog({ open, attachmentId, onClose }: Props) {
  const toast = useToast();
  
  const [file, setFile] = useState<AttachmentDto | null>(null);
  const [ragIndexed, setRagIndexed] = useState(false);
  const [ragMetadata, setRagMetadata] = useState<Record<string, unknown> | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [textExtracted, setTextExtracted] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailAvailable, setThumbnailAvailable] = useState(false);
  const [thumbnailLoading, setThumbnailLoading] = useState(false);
  const [thumbnailUnavailable, setThumbnailUnavailable] = useState(false);
  const [thumbnailReloadKey, setThumbnailReloadKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [textExtracting, setTextExtracting] = useState(false);
  const [ragJobId, setRagJobId] = useState<string | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [epubReaderOpen, setEpubReaderOpen] = useState(false);
  const [pdfReaderOpen, setPdfReaderOpen] = useState(false);
  const [ragIndexing, setRagIndexing] = useState(false);
  const [downloadLinkIssuing, setDownloadLinkIssuing] = useState(false);
  const [downloadLinkUrl, setDownloadLinkUrl] = useState<string | null>(null);
  const [downloadLinkExpiresAt, setDownloadLinkExpiresAt] = useState<string | null>(null);

  // Markdown Document Pipeline States
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [markdownDocument, setMarkdownDocument] = useState<MarkdownDocumentDto | null>(null);
  const [reused, setReused] = useState<boolean | null>(null);
  
  // Pipeline Options
  const [runChunking, setRunChunking] = useState<boolean>(true);
  const [runRagIndex, setRunRagIndex] = useState<boolean>(true);
  const [runSkillExtraction, setRunSkillExtraction] = useState<boolean>(false);
  const [skillExtractionMode, setSkillExtractionMode] = useState<'regex' | 'llm' | ''>('');
  const [userHasOverriddenChunking, setUserHasOverriddenChunking] = useState<boolean>(false);
  const [userHasOverriddenRagIndex, setUserHasOverriddenRagIndex] = useState<boolean>(false);
  const [userHasOverriddenSkillExtraction, setUserHasOverriddenSkillExtraction] = useState<boolean>(false);
  const [force, setForce] = useState<boolean>(false);
  const [profiles, setProfiles] = useState<MarkdownDocumentProfileDescriptor[]>([]);
  const [documentProfile, setDocumentProfile] = useState<string>("AUTO");
  const [metadataSchemas, setMetadataSchemas] = useState<DocumentMetadataSchema[]>([]);
  const [documentSemanticType, setDocumentSemanticType] = useState<DocumentSemanticTypeSelection>("AUTO");
  const [metadataEnrichmentMode, setMetadataEnrichmentMode] = useState<MetadataEnrichmentMode>("AUTO");
  const [documentMetadata, setDocumentMetadata] = useState<DocumentMetadataArtifact | null>(null);
  const [processingPlan, setProcessingPlan] = useState<MarkdownProcessingPlan | null>(null);
  const [pipelineEstimate, setPipelineEstimate] = useState<MarkdownPipelineEstimateResponse | null>(null);
  const [pipelineEstimateLoading, setPipelineEstimateLoading] = useState(false);
  const [pipelineEstimateError, setPipelineEstimateError] = useState<string | null>(null);
  const pipelineEstimateRequestId = useRef(0);

  // Overrides
  const [ocrOverride, setOcrOverride] = useState<boolean | null>(null);
  const [mathVisionCorrectionOverride, setMathVisionCorrectionOverride] = useState<boolean | null>(null);
  const [chunkingStrategyOverride, setChunkingStrategyOverride] = useState<string | null>(null);
  const [chunkMaxSizeOverride, setChunkMaxSizeOverride] = useState<number | string | null>(null);
  const [chunkOverlapOverride, setChunkOverlapOverride] = useState<number | string | null>(null);
  const [chunkUnitOverride, setChunkUnitOverride] = useState<string | null>(null);
  const [ocrLanguageOverride, setOcrLanguageOverride] = useState<string | null>(null);

  // RAG Configuration
  const [chunkConfig, setChunkConfig] = useState<RagChunkConfigResponseDto | null>(null);
  const [selectedEmbeddingOption, setSelectedEmbeddingOption] = useState<EmbeddingOption | null>(null);
  const [embeddingOptions, setEmbeddingOptions] = useState<EmbeddingOption[]>([]);

  // Derived Effective Options
  const chunkingStrategy = chunkingStrategyOverride ?? processingPlan?.effectiveOptions?.chunkingStrategy ?? "auto";
  const chunkMaxSize = chunkMaxSizeOverride ?? processingPlan?.effectiveOptions?.chunkMaxSize ?? 800;
  const chunkOverlap = chunkOverlapOverride ?? processingPlan?.effectiveOptions?.chunkOverlap ?? 100;
  const chunkUnit = chunkUnitOverride ?? processingPlan?.effectiveOptions?.chunkUnit ?? "TOKEN";
  const ocrMode: OcrMode = ocrOverride === true ? "FORCE" : ocrOverride === false ? "DISABLED" : "AUTO";
  const ocrLanguage = ocrLanguageOverride ?? processingPlan?.effectiveOptions?.ocrLanguage ?? "";
  const mathVisionCorrection = mathVisionCorrectionOverride ?? processingPlan?.effectiveOptions?.mathVisionCorrection ?? false;
  const hasEstimatedChunkingRecommendation = useMemo(() => {
    const recommended = pipelineEstimate?.recommended;
    if (!runChunking || !recommended) return false;
    return Boolean(
      (recommended.chunkingStrategy && recommended.chunkingStrategy !== chunkingStrategy) ||
      (recommended.chunkMaxSize != null && recommended.chunkMaxSize !== Number(chunkMaxSize)) ||
      (recommended.chunkOverlap != null && recommended.chunkOverlap !== Number(chunkOverlap)) ||
      (recommended.chunkUnit && recommended.chunkUnit !== chunkUnit)
    );
  }, [pipelineEstimate, runChunking, chunkingStrategy, chunkMaxSize, chunkOverlap, chunkUnit]);

  // Load profiles
  useEffect(() => {
    if (open) {
      Promise.all([
        reactMarkdownDocumentApi.getProfiles(),
        reactMarkdownDocumentApi.getMetadataSchemas(),
      ])
        .then(([profileResponse, schemaResponse]) => {
          setProfiles(profileResponse);
          setMetadataSchemas(schemaResponse);
        })
        .catch((err) => {
          console.error("Failed to load profiles:", err);
        });
    }
  }, [open]);

  // Fetch processing plan whenever options change
  const fetchPlan = useCallback(async () => {
    if (!open || !attachmentId) return;
    try {
      const payload: MarkdownDocumentFromAttachmentRequest = {
        attachmentId,
        force: false,
        documentProfile: documentProfile || "AUTO",
        documentSemanticType,
        metadataEnrichmentMode,
        runChunking,
        runRagIndex,
        runSkillExtraction,
        chunkingStrategy: chunkingStrategyOverride,
        chunkMaxSize: chunkMaxSizeOverride === "" || chunkMaxSizeOverride === null ? null : Number(chunkMaxSizeOverride),
        chunkOverlap: chunkOverlapOverride === "" || chunkOverlapOverride === null ? null : Number(chunkOverlapOverride),
        chunkUnit: chunkUnitOverride,
        ocrLanguage: ocrLanguageOverride,
        ocrRequired: ocrOverride,
        ocrMode: ocrOverride === true ? "FORCE" : ocrOverride === false ? "DISABLED" : null,
        mathVisionCorrection: mathVisionCorrectionOverride,
        skillExtractionMode: skillExtractionMode || null,
      };

      if (selectedEmbeddingOption?.deploymentId) {
        payload.embeddingDeploymentId = selectedEmbeddingOption.deploymentId;
      } else if (selectedEmbeddingOption?.modelId) {
        payload.embeddingModelId = selectedEmbeddingOption.modelId;
      } else if (selectedEmbeddingOption?.profileId) {
        payload.embeddingProfileId = selectedEmbeddingOption.profileId;
      } else if (selectedEmbeddingOption) {
        payload.embeddingProvider = selectedEmbeddingOption.provider || null;
        payload.embeddingModel = selectedEmbeddingOption.model || null;
        payload.embeddingDimension = selectedEmbeddingOption.dimension ?? null;
      }

      const plan = await reactMarkdownDocumentApi.getProcessingPlan(payload);
      setProcessingPlan(plan);
    } catch (error) {
      console.error("Failed to fetch processing plan:", error);
    }
  }, [
    open,
    attachmentId,
    documentProfile,
    documentSemanticType,
    metadataEnrichmentMode,
    runChunking,
    runRagIndex,
    runSkillExtraction,
    chunkingStrategyOverride,
    chunkMaxSizeOverride,
    chunkOverlapOverride,
    chunkUnitOverride,
    ocrLanguageOverride,
    ocrOverride,
    mathVisionCorrectionOverride,
    skillExtractionMode,
    selectedEmbeddingOption,
  ]);

  useEffect(() => {
    void fetchPlan();
  }, [fetchPlan]);

  // Synchronize pipeline stages with server recommendations (effectiveOptions)
  // unless the user has manually overridden them.
  useEffect(() => {
    if (!processingPlan?.effectiveOptions) return;
    const eff = processingPlan.effectiveOptions;
    if (!userHasOverriddenChunking && typeof eff.runChunking === "boolean" && runChunking !== eff.runChunking) {
      setRunChunking(eff.runChunking);
    }
    if (!userHasOverriddenRagIndex && typeof eff.runRagIndex === "boolean" && runRagIndex !== eff.runRagIndex) {
      setRunRagIndex(eff.runRagIndex);
    }
    if (!userHasOverriddenSkillExtraction && typeof eff.runSkillExtraction === "boolean" && runSkillExtraction !== eff.runSkillExtraction) {
      setRunSkillExtraction(eff.runSkillExtraction);
    }
  }, [processingPlan, userHasOverriddenChunking, userHasOverriddenRagIndex, userHasOverriddenSkillExtraction, runChunking, runRagIndex, runSkillExtraction]);

  const handleProfileChange = (profile: string) => {
    setDocumentProfile(profile);
    // Reset overrides
    setOcrOverride(null);
    setMathVisionCorrectionOverride(null);
    setChunkingStrategyOverride(null);
    setChunkMaxSizeOverride(null);
    setChunkOverlapOverride(null);
    setChunkUnitOverride(null);
    setOcrLanguageOverride(null);

    // Reset user stage overrides when switching profiles
    setUserHasOverriddenChunking(false);
    setUserHasOverriddenRagIndex(false);
    setUserHasOverriddenSkillExtraction(false);

    // Default to running Chunking and RAG, since it is a new profile setup
    setRunChunking(true);
    setRunRagIndex(true);
    setRunSkillExtraction(false);
    setSkillExtractionMode("");
  };

  // Locators & Resources
  const [locators, setLocators] = useState<MarkdownLocatorDto[]>([]);
  const [resources, setResources] = useState<MarkdownResourceDto[]>([]);

  const parsedOcrMeta = useMemo(() => {
    let normMeta: any = null;
    for (const r of resources) {
      if (r.resourceType === "normalized_document" || r.resourceType === "NORMALIZED_DOCUMENT") {
        normMeta = r.metadataJson;
        if (typeof normMeta === "string") {
          try {
            normMeta = JSON.parse(normMeta);
          } catch {
            normMeta = null;
          }
        }
        break;
      }
    }
    const ocrRaw = normMeta ?? (() => {
      for (const r of resources) {
        let m = r.metadataJson;
        if (typeof m === "string") {
          try { m = JSON.parse(m); } catch { m = null; }
        }
        if (m && (
          m.ocrApplied != null || m.ocrMode != null ||
          m.ocrRequested != null || m.ocrRequired != null ||
          m.ocrRequestedBy != null
        )) return m;
      }
      return null;
    })();

    if (!ocrRaw) return null;

    const recommendedRoute = ocrRaw.recommendedRoute ?? ocrRaw.pdfRecommendedRoute;
    const actualRoute = ocrRaw.actualRoute ?? ocrRaw.pdfActualRoute;

    return {
      ocrDecisionReason: ocrRaw.ocrDecisionReason as string | undefined,
      ocrRequestedBy: ocrRaw.ocrRequestedBy as string | undefined,
      recommendedRoute: recommendedRoute as string | undefined,
      actualRoute: actualRoute as string | undefined,
    };
  }, [resources]);

  const showOcrReextract = parsedOcrMeta?.ocrDecisionReason === "OCR_REQUIRES_CLIENT_FORCE";
  const showMathReextract = parsedOcrMeta?.recommendedRoute === "MATH_DOCUMENT" && parsedOcrMeta?.actualRoute !== "MATH_DOCUMENT";

  // Markdown Viewer States
  const [markdownViewerOpen, setMarkdownViewerOpen] = useState<boolean>(false);
  const [selectedViewerRevisionId, setSelectedViewerRevisionId] = useState<string | undefined>(undefined);

  const normalizedRes = findNormalizedDocumentResource(resources);
  const normalizedMeta = (() => {
    if (!normalizedRes) return null;
    let meta = normalizedRes.metadataJson;
    if (typeof meta === "string") {
      try {
        meta = JSON.parse(meta);
      } catch {
        return null;
      }
    }
    return meta;
  })();

  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isCanceling, setIsCanceling] = useState<boolean>(false);

  const {
    latestRevision,
    revisions,
    pipelineExecution,
    pipelineProgress,
    latestRagJob,
    ragJobs,
    status: markdownStatus,
    error: markdownError,
    isPolling: markdownIsPolling,
    startPolling,
    stopPolling,
    setLatestRevision,
    setPipelineExecution,
    setPipelineProgress,
    setLatestRagJob,
    setRagJobs,
    setStatus: setMarkdownStatus,
    setError: setMarkdownError,
  } = useMarkdownDocumentPolling();

  const selectedChunkingStrategy = [
    chunkingStrategyOverride,
    (ragMetadata as any)?.selectedChunkingStrategy,
    (ragMetadata as any)?.chunkingStrategy,
    (ragMetadata as any)?.chunkStrategy,
    (ragMetadata as any)?.strategy,
    (normalizedMeta as any)?.selectedChunkingStrategy,
    (normalizedMeta as any)?.chunkingStrategy,
    (normalizedMeta as any)?.chunkStrategy,
    latestRagJob?.chunkingStrategy,
    processingPlan?.effectiveOptions?.chunkingStrategy,
    (pipelineProgress?.chunking as any)?.chunkingStrategy,
    (pipelineProgress?.chunking as any)?.strategy,
    (pipelineExecution as any)?.chunkingStrategy,
    pipelineEstimate?.recommended?.chunkingStrategy,
  ].find((value) => typeof value === "string" && value.length > 0) as string | undefined;

  const effectiveTotalChunkCount = [
    latestRagJob?.chunkCount,
    (ragMetadata as any)?.totalChunks,
    (ragMetadata as any)?.chunkCount,
    (ragMetadata as any)?.chunksCount,
    (ragMetadata as any)?.totalChunkCount,
    pipelineProgress?.rag?.chunkCount,
    (pipelineProgress?.chunking as any)?.totalChunks,
    (normalizedMeta as any)?.totalChunks,
    (normalizedMeta as any)?.chunkCount,
  ].find((value) => typeof value === "number" && value > 0);

  const chunkingSelectionReason = [
    (ragMetadata as any)?.chunkingStrategySelectionReason,
    (normalizedMeta as any)?.chunkingStrategySelectionReason,
  ].find((value) => typeof value === "string" && value.length > 0) as string | undefined;

  const roles = useAuthStore((state) => state.user?.roles) ?? [];
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [blockifyValidationResult, setBlockifyValidationResult] = useState<{
    isValid: boolean;
    missingFields: string[];
    hasChunks: boolean;
  } | null>(null);
  const [blockifyStats, setBlockifyStats] = useState<{
    totalChunks: number;
    ideaBlockCount: number;
    fallbackCount: number;
    fallbackReasons: Record<string, number>;
  } | null>(null);
  const [blockifyLlmProvider, setBlockifyLlmProvider] = useState<string>("");
  const [blockifyLlmModel, setBlockifyLlmModel] = useState<string>("");
  const [blockifyPiiMaskingEnabled, setBlockifyPiiMaskingEnabled] = useState<boolean>(true);
  const [aiInfo, setAiInfo] = useState<AiInfoResponse | null>(null);
  const [currentTab, setCurrentTab] = useState<"info" | "qa">("info");
  const [qaProvider, setQaProvider] = useState<string>("google-ai");
  const [qaModel, setQaModel] = useState<string>("gemini-2.5-flash");
  const [qaDeploymentId, setQaDeploymentId] = useState<string>("chat-default");
  const [qaMessages, setQaMessages] = useState<ChatMessage[]>([]);
  const [qaInput, setQaInput] = useState<string>("");
  const [qaSending, setQaSending] = useState<boolean>(false);
  const [qaError, setQaError] = useState<string | null>(null);
  const [qaAnswerPolicy, setQaAnswerPolicy] = useState<RagAnswerPolicyCapabilitiesDto | null>(null);
  const [qaAnswerMode, setQaAnswerMode] = useState<RagAnswerMode>("STRICT_GROUNDED");
  const [showScrollToBottomBtn, setShowScrollToBottomBtn] = useState<boolean>(false);
  const qaMessageListRef = useRef<HTMLDivElement | null>(null);
  const canManage = roles.includes("ROLE_ADMIN") || roles.includes("ADMIN") || roles.includes("features:document-convert/manage");

  function clearThumbnail() {
    setThumbnailAvailable(false);
    setThumbnailLoading(false);
    setThumbnailUnavailable(false);
    setThumbnailUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
      return null;
    });
  }

  // Load embedding options and chunking config on mount
  const loadEmbeddingOptions = useCallback(async () => {
    try {
      const res = await reactAiApi.getEmbeddingOptions();
      const opts = res.options ?? [];
      setEmbeddingOptions(opts);
    } catch {
      // Ignore
    }
  }, []);

  const loadChunkConfig = useCallback(async () => {
    try {
      const res = await reactAiApi.getRagChunkConfig();
      setChunkConfig(res);
      const defaultStrategy = res.chunking.previewStrategy || res.chunking.strategy;
      if (defaultStrategy) {
        setChunkingStrategyOverride(null);
      }
    } catch {
      // Ignore
    }
  }, []);

  const loadProviders = useCallback(async () => {
    try {
      const res = await reactAiApi.fetchProviders();
      setAiInfo(res);
      const valid = (res.providers ?? []).filter((p) => p.chat && p.chat.enabled !== false);
      const targetProvider = res.defaultProvider || valid[0]?.name || res.providers?.[0]?.name;
      if (targetProvider) {
        setBlockifyLlmProvider(targetProvider);
        setQaProvider(targetProvider);
        const match = (res.providers ?? []).find((p) => p.name === targetProvider);
        const modelName = match?.chat?.model || (match as any)?.models?.[0] || (valid[0]?.chat?.model) || "";
        if (modelName) {
          setBlockifyLlmModel(modelName);
          setQaModel(modelName);
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  const loadRagAnswerPolicy = useCallback(async () => {
    try {
      setQaAnswerPolicy(await reactAiApi.fetchRagAnswerPolicy());
    } catch {
      // The server still enforces its default policy if capabilities cannot be loaded.
    }
  }, []);

  useEffect(() => {
    if (open && attachmentId) {
      void loadEmbeddingOptions();
      void loadChunkConfig();
      void loadProviders();
      void loadRagAnswerPolicy();
    }
  }, [open, attachmentId, loadEmbeddingOptions, loadChunkConfig, loadProviders, loadRagAnswerPolicy]);

  useEffect(() => {
    if (!open) {
      setCurrentTab("info");
      setQaMessages([]);
      setQaInput("");
      setQaSending(false);
      setQaError(null);
      setQaAnswerMode("STRICT_GROUNDED");
    }
  }, [open]);

  const availableStrategies = useMemo(() => {
    return chunkConfig?.chunking.availableStrategies ?? ["recursive", "structure-based"];
  }, [chunkConfig]);

  const strategyLabels: Record<string, string> = {
    "auto": "자동 선택",
    "recursive": "Recursive",
    "fixed-size": "Fixed Size",
    "structure-based": "Structure-Based",
    "blockify": "Blockify / IdeaBlock",
  };
  const strategyReasonLabels: Record<string, string> = {
    "STRUCTURED_BLOCKS_AVAILABLE": "문서 구조 정보 사용",
    "PLAIN_TEXT_ONLY": "일반 텍스트 기준",
    "NO_CONTENT_BLOCKS": "구조 정보 없음",
    "EXPLICIT_REQUEST": "사용자 지정",
  };

  const embeddingOptionKey = (opt: EmbeddingOption) =>
    opt.deploymentId || opt.modelId || opt.profileId || `${opt.provider}:${opt.model}`;
  const embeddingOptionLabel = (opt: EmbeddingOption) => {
    if (opt.displayName && !opt.displayName.includes("undefined")) {
      return opt.displayName;
    }
    const modelName = opt.model || (opt as any).apiModel || (opt as any).modelName;
    const idLabel = opt.deploymentId || opt.profileId || opt.provider;
    return modelName ? `${idLabel} (${modelName})` : idLabel;
  };

  useEffect(() => {
    if (markdownStatus === "COMPLETED" && documentId) {
      let active = true;
      const loadAdditionalInfo = async () => {
        try {
          const [locs, res] = await Promise.all([
            reactMarkdownDocumentApi.getLocators(documentId),
            reactMarkdownDocumentApi.getResources(documentId),
          ]);
          if (active) {
            setLocators(locs);
            setResources(res);
          }
        } catch (err) {
          console.error("Failed to load locators/resources:", err);
        }
      };
      void loadAdditionalInfo();
      return () => {
        active = false;
      };
    } else {
      setLocators([]);
      setResources([]);
    }
  }, [markdownStatus, documentId]);

  useEffect(() => {
    if (markdownStatus !== "COMPLETED" || !documentId) {
      setDocumentMetadata(null);
      return;
    }
    let active = true;
    reactMarkdownDocumentApi
      .getMetadata(documentId, latestRevision?.revisionId ?? markdownDocument?.currentRevisionId)
      .then((metadata) => {
        if (active) setDocumentMetadata(metadata);
      })
      .catch(() => {
        if (active) setDocumentMetadata(null);
      });
    return () => {
      active = false;
    };
  }, [markdownStatus, documentId, latestRevision?.revisionId, markdownDocument?.currentRevisionId]);

  useEffect(() => {
    if (latestRagJob?.jobId && latestRagJob.status === "SUCCEEDED" && (chunkingStrategy === "blockify" || latestRagJob.chunkingStrategy === "blockify")) {
      let active = true;
      const validateBlockify = async () => {
        try {
          const res = await reactAiApi.getRagJobChunks(latestRagJob.jobId, 0, 1000);
          if (!active) return;
          const chunks = res.content ?? [];
          if (chunks.length === 0) {
            setBlockifyValidationResult({ isValid: false, missingFields: [], hasChunks: false });
            setBlockifyStats(null);
            return;
          }
          const requiredKeys = ["requestedChunkingStrategy", "actualChunkingStrategy", "blockifyFingerprint", "sourceEvidence"];
          const missing = new Set<string>(requiredKeys);
          
          let ideaBlockCount = 0;
          let fallbackCount = 0;
          const fallbackReasons: Record<string, number> = {};

          for (const chunk of chunks) {
            const meta = chunk.metadata || {};
            for (const key of requiredKeys) {
              if (meta[key] !== undefined && meta[key] !== null && meta[key] !== "") {
                missing.delete(key);
              }
            }

            const chunkType = chunk.chunkType || meta.chunkType;
            const actualStrat = meta.actualChunkingStrategy || (chunk as any).actualChunkingStrategy;
            const reqStrat = meta.requestedChunkingStrategy || (chunk as any).requestedChunkingStrategy;
            
            if (chunkType === "ideaBlock") {
              ideaBlockCount++;
            }
            if (actualStrat === "structure-based" && reqStrat === "blockify") {
              fallbackCount++;
              const reason = String(meta.fallbackReason || "UNKNOWN");
              fallbackReasons[reason] = (fallbackReasons[reason] || 0) + 1;
            }
          }
          
          setBlockifyValidationResult({
            isValid: missing.size === 0,
            missingFields: Array.from(missing),
            hasChunks: true,
          });

          setBlockifyStats({
            totalChunks: res.totalElements ?? chunks.length,
            ideaBlockCount,
            fallbackCount,
            fallbackReasons,
          });
        } catch (err) {
          console.error("Failed to fetch job chunks for blockify validation", err);
          if (active) {
            setBlockifyValidationResult(null);
            setBlockifyStats(null);
          }
        }
      };
      void validateBlockify();
      return () => {
        active = false;
      };
    } else {
      setBlockifyValidationResult(null);
      setBlockifyStats(null);
    }
  }, [latestRagJob?.jobId, latestRagJob?.status, latestRagJob?.chunkingStrategy, chunkingStrategy]);

  const getStageFailureState = (stage: "EXTRACT" | "MARKDOWN" | "CHUNKING" | "EMBEDDING" | "INDEXING" | "SKILL_EXTRACTION") => {
    const isPipelineFailed = markdownStatus === "FAILED" || pipelineExecution?.status === "FAILED" || pipelineProgress?.status === "FAILED";
    if (!isPipelineFailed) return null;

    let failedStage: string = "";
    let failedStep: string = "";

    if (markdownStatus === "FAILED") {
      failedStage = "MARKDOWN";
    } else if (pipelineProgress?.status === "FAILED") {
      failedStage = pipelineProgress.currentStage || "";
      failedStep = pipelineProgress.rag?.currentStep || "";
    } else if (pipelineExecution?.status === "FAILED") {
      failedStage = pipelineExecution.currentStage || "";
    }

    const stagesOrder = ["EXTRACT", "MARKDOWN", "CHUNKING", "EMBEDDING", "INDEXING", "SKILL_EXTRACTION"];
    const currentIdx = stagesOrder.indexOf(stage);
    let failedIdx = stagesOrder.indexOf(failedStage);
    if (failedStage === "RAG_INDEX") {
      if (failedStep === "INDEXING") {
        failedIdx = stagesOrder.indexOf("INDEXING");
      } else {
        failedIdx = stagesOrder.indexOf("EMBEDDING");
      }
    }

    if (currentIdx > failedIdx) {
      return "NOT_RUN";
    }
    if (currentIdx === failedIdx) {
      return "FAILED";
    }
    return "COMPLETED";
  };

  useEffect(() => {
    if (open && attachmentId) {
      let ignored = false;
      const checkMarkdownDocument = async () => {
        try {
          const meta = await reactFilesApi.ragMetadata(attachmentId);
          if (ignored) return;

          setRagIndexed(Boolean(meta?.indexed));
          setRagMetadata(meta);

          const mdExists = (meta as any)?.markdown?.exists;
          let mdDocId = (meta as any)?.markdown?.documentId;

          if (!mdDocId) {
            try {
              const doc = await reactMarkdownDocumentApi.getByAttachment(attachmentId);
              if (!ignored && doc && doc.documentId) {
                mdDocId = doc.documentId;
                setMarkdownDocument(doc);
              }
            } catch (err) {
              // Ignore
            }
          }

          if (mdExists || mdDocId) {
            if (mdDocId) {
              setDocumentId(mdDocId);
              localStorage.setItem(`markdown_doc_id_${attachmentId}`, mdDocId);
              startPolling(mdDocId, attachmentId);
              try {
                const doc = await reactMarkdownDocumentApi.getByAttachment(attachmentId);
                if (!ignored) {
                  setMarkdownDocument(doc);
                }
              } catch (err) {
                // Ignore
              }
            } else {
              try {
                const doc = await reactMarkdownDocumentApi.getByAttachment(attachmentId);
                if (!ignored && doc && doc.documentId) {
                  setDocumentId(doc.documentId);
                  localStorage.setItem(`markdown_doc_id_${attachmentId}`, doc.documentId);
                  startPolling(doc.documentId, attachmentId);
                  setMarkdownDocument(doc);
                }
              } catch (err: any) {
                const status = err?.response?.status ?? err?.status;
                if (!ignored) {
                  if (status === 404 || status === 500) {
                    setDocumentId(null);
                    setMarkdownDocument(null);
                    setLatestRevision(null);
                    setPipelineExecution(null);
                    setPipelineProgress(null);
                    setMarkdownStatus(null);
                    setMarkdownError(null);
                  } else {
                    toast.error("Markdown 문서 조회 실패: " + resolveAxiosError(err));
                  }
                }
              }
            }
          } else {
            setDocumentId(null);
            setMarkdownDocument(null);
            setLatestRevision(null);
            setPipelineExecution(null);
            setPipelineProgress(null);
            setMarkdownStatus(null);
            setMarkdownError(null);
            stopPolling();

            try {
              const jobsRes = await reactAiApi.listRagJobs({
                objectType: "attachment",
                objectId: String(attachmentId),
                page: 0,
                size: 10,
                sort: "createdAt",
                direction: "desc",
              });
              const content = jobsRes.content ?? [];
              if (!ignored) {
                setRagJobs(content);
                setLatestRagJob(content[0] || null);
              }
            } catch (err) {
              console.error("Failed to load RAG jobs:", err);
            }
          }
        } catch (err) {
          console.error("Failed to load metadata:", err);
        }
      };
      void checkMarkdownDocument();
      return () => {
        ignored = true;
        stopPolling();
      };
    } else {
      setDocumentId(null);
      setMarkdownDocument(null);
      setLatestRevision(null);
      setPipelineExecution(null);
      setPipelineProgress(null);
      setMarkdownStatus(null);
      setMarkdownError(null);
      stopPolling();
    }
  }, [open, attachmentId, startPolling, stopPolling, setLatestRevision, setPipelineExecution, setPipelineProgress, setMarkdownStatus, setMarkdownError, setLatestRagJob, setRagJobs, toast]);

  // Restore options on load
  useEffect(() => {
    let opts: Record<string, unknown> | null = null;
    if (latestRevision?.optionsJson) {
      try {
        opts = JSON.parse(latestRevision.optionsJson) as Record<string, unknown>;
      } catch {
        // Ignore
      }
    }

    const restoredDocumentProfile = opts && typeof opts.requestedDocumentProfile === "string"
      ? opts.requestedDocumentProfile
      : opts && typeof opts.documentProfile === "string"
        ? opts.documentProfile
        : "AUTO";

    if (opts) {
      if (typeof opts.runChunking === "boolean") setRunChunking(opts.runChunking);
      if (typeof opts.runRagIndex === "boolean") setRunRagIndex(opts.runRagIndex);
      if (typeof opts.runSkillExtraction === "boolean") setRunSkillExtraction(opts.runSkillExtraction);
      
      setDocumentProfile(restoredDocumentProfile);

      if (typeof opts.ocrRequired === "boolean") {
        setOcrOverride(opts.ocrRequired);
      } else if (opts.ocrMode === "FORCE" || opts.ocrMode === "AUTO" || opts.ocrMode === "DISABLED") {
        setOcrOverride(opts.ocrMode === "FORCE" ? true : opts.ocrMode === "DISABLED" ? false : null);
      } else {
        setOcrOverride(null);
      }

      if (typeof opts.ocrLanguage === "string") {
        setOcrLanguageOverride(opts.ocrLanguage);
      } else {
        setOcrLanguageOverride(null);
      }

      if (typeof opts.mathVisionCorrection === "boolean") {
        setMathVisionCorrectionOverride(opts.mathVisionCorrection);
      } else {
        setMathVisionCorrectionOverride(null);
      }

      if (typeof opts.skillExtractionMode === "string" && (opts.skillExtractionMode === "regex" || opts.skillExtractionMode === "llm")) {
        setSkillExtractionMode(opts.skillExtractionMode);
      } else {
        setSkillExtractionMode("");
      }
    } else {
      setDocumentProfile("AUTO");
      setOcrOverride(null);
      setMathVisionCorrectionOverride(null);
      setOcrLanguageOverride(null);
      setChunkingStrategyOverride(null);
      setChunkMaxSizeOverride(null);
      setChunkOverlapOverride(null);
      setChunkUnitOverride(null);
      setRunChunking(true);
      setRunRagIndex(true);
      setRunSkillExtraction(false);
      setSkillExtractionMode("");
      setSelectedEmbeddingOption(null);
    }

    let strategy = opts && typeof opts.chunkingStrategy === "string" && opts.chunkingStrategy ? opts.chunkingStrategy : null;
    let maxSize = opts && opts.chunkMaxSize != null ? Number(opts.chunkMaxSize) : null;
    let overlap = opts && opts.chunkOverlap != null ? Number(opts.chunkOverlap) : null;
    let unit = opts && typeof opts.chunkUnit === "string" && opts.chunkUnit ? opts.chunkUnit : null;

    if (!strategy && restoredDocumentProfile !== "AUTO" && latestRagJob?.chunkingStrategy) {
      strategy = latestRagJob.chunkingStrategy;
    }
    if (maxSize === null && latestRagJob?.chunkMaxSize != null) maxSize = latestRagJob.chunkMaxSize;
    if (overlap === null && latestRagJob?.chunkOverlap != null) overlap = latestRagJob.chunkOverlap;
    if (!unit && latestRagJob?.chunkUnit) unit = latestRagJob.chunkUnit;

    setChunkingStrategyOverride(strategy);
    setChunkMaxSizeOverride(maxSize);
    setChunkOverlapOverride(overlap);
    setChunkUnitOverride(unit);

    let llmProvider = opts && typeof opts.blockifyLlmProvider === "string" ? opts.blockifyLlmProvider : null;
    let llmModel = opts && typeof opts.blockifyLlmModel === "string" ? opts.blockifyLlmModel : null;
    let piiMasking = opts && typeof opts.blockifyPiiMaskingEnabled === "boolean" ? opts.blockifyPiiMaskingEnabled : null;

    if (!llmProvider && latestRagJob?.chunkingStrategy === "blockify") llmProvider = (latestRagJob as any).blockifyLlmProvider || null;
    if (!llmModel && latestRagJob?.chunkingStrategy === "blockify") llmModel = (latestRagJob as any).blockifyLlmModel || null;
    if (piiMasking === null && latestRagJob?.chunkingStrategy === "blockify" && (latestRagJob as any).blockifyPiiMaskingEnabled !== undefined) {
      piiMasking = (latestRagJob as any).blockifyPiiMaskingEnabled;
    }

    if (llmProvider) setBlockifyLlmProvider(llmProvider);
    if (llmModel) setBlockifyLlmModel(llmModel);
    if (piiMasking !== null) {
      setBlockifyPiiMaskingEnabled(piiMasking);
    } else {
      setBlockifyPiiMaskingEnabled(true);
    }

    let deploymentId = opts && typeof opts.embeddingDeploymentId === "string" ? opts.embeddingDeploymentId : null;
    let profileId = opts && typeof opts.embeddingProfileId === "string" ? opts.embeddingProfileId : null;
    let provider = opts && typeof opts.embeddingProvider === "string" ? opts.embeddingProvider : null;
    let model = opts && typeof opts.embeddingModel === "string" ? opts.embeddingModel : null;

    if (!deploymentId && !profileId && !provider && !model && latestRagJob) {
      deploymentId = latestRagJob.embeddingDeploymentId || null;
      profileId = latestRagJob.embeddingProfileId || null;
      provider = latestRagJob.embeddingProvider || null;
      model = latestRagJob.embeddingModel || null;
    }

    if (embeddingOptions.length > 0) {
      let matched: EmbeddingOption | undefined;
      if (deploymentId) {
        matched = embeddingOptions.find((o) => o.deploymentId === deploymentId || o.modelId === deploymentId);
      }
      if (!matched && profileId) {
        matched = embeddingOptions.find((o) =>
          o.modelId === profileId || o.profileId === profileId || o.aliases?.includes(profileId));
      }
      if (!matched && provider && model) {
        matched = embeddingOptions.find((o) => o.provider === provider && o.model === model);
      }
      if (!matched) {
        matched = embeddingOptions.find((o) => o.defaultProfile || o.defaultProvider) || embeddingOptions[0];
      }
      if (matched) {
        setSelectedEmbeddingOption(matched);
      }
    }
  }, [latestRevision?.optionsJson, latestRagJob, embeddingOptions]);

  const metadataEntries = Object.entries(ragMetadata ?? {});
  const format = file ? getDocumentFormat(file.name, file.contentType) : null;
  const isEpub = file?.contentType?.includes("epub") || file?.name?.toLowerCase().includes("epub");
  const isPdf = file?.contentType?.includes("pdf") || file?.name?.toLowerCase().includes("pdf");
  const isPendingOrRunning =
    markdownStatus === "PENDING" ||
    markdownStatus === "RUNNING" ||
    pipelineExecution?.status === "PENDING" ||
    pipelineExecution?.status === "RUNNING" ||
    pipelineProgress?.status === "PENDING" ||
    pipelineProgress?.status === "RUNNING" ||
    latestRagJob?.status === "PENDING" ||
    latestRagJob?.status === "RUNNING";
  const controlsDisabled = isExtracting || isCanceling || markdownIsPolling;
  const isCanceledRevision =
    documentId !== null &&
    (!markdownDocument || markdownDocument.currentRevisionId === null || markdownDocument.currentRevisionId === undefined) &&
    latestRevision?.status === "CANCELED";


  const ragStateCacheRef = useRef<Map<number, Promise<{ indexed: boolean; metadata: Record<string, unknown> | null }>>>(new Map());

  async function loadRagState(nextFile: AttachmentDto, forceRefresh = false) {
    if (!forceRefresh && ragStateCacheRef.current.has(nextFile.attachmentId)) {
      return ragStateCacheRef.current.get(nextFile.attachmentId)!;
    }

    const promise = (async () => {
      const indexed = await reactFilesApi.hasEmbedding(nextFile.attachmentId);
      if (!indexed) {
        return {
          indexed,
          metadata: null,
        };
      }

      try {
        return {
          indexed,
          metadata: await reactFilesApi.ragMetadata(nextFile.attachmentId),
        };
      } catch {
        return {
          indexed,
          metadata: null,
        };
      }
    })();

    ragStateCacheRef.current.set(nextFile.attachmentId, promise);
    return promise;
  }

  function resetDetailState() {
    ragStateCacheRef.current.clear();
    setFile(null);
    setRagIndexed(false);
    setRagMetadata(null);
    setExtractedText("");
    setTextExtracted(false);
    setRagJobId(null);
    setDownloadLinkUrl(null);
    setDownloadLinkExpiresAt(null);
    clearThumbnail();
  }

  useEffect(() => {
    resetDetailState();

    if (!attachmentId) return;

    let ignored = false;
    async function loadDetail() {
      setLoading(true);
      try {
        const nextFile = await reactFilesApi.getById(attachmentId);
        if (ignored) return;

        setFile(nextFile);
        // 즉시 UI 차단 해제 (상세 정보 창 즉시 렌더링)
        setLoading(false);

        // RAG 상태는 비동기 백그라운드 로딩
        loadRagState(nextFile).then((ragState) => {
          if (!ignored) {
            setRagIndexed(ragState.indexed);
            setRagMetadata(ragState.metadata);
          }
        });
      } catch (error) {
        if (!ignored) {
          toast.error(resolveAxiosError(error));
          setLoading(false);
        }
      }
    }

    void loadDetail();
    return () => {
      ignored = true;
    };
  }, [attachmentId, toast]);

  useEffect(() => {
    if (pipelineExecution && file && pipelineExecution.status === "COMPLETED") {
      let active = true;
      void loadRagState(file).then((state) => {
        if (active) {
          setRagIndexed(state.indexed);
          setRagMetadata(state.metadata);
        }
      });
      return () => {
        active = false;
      };
    }
  }, [pipelineExecution?.status, file]);

  const markdownDocCacheRef = useRef<Map<number, Promise<MarkdownDocumentDto | null>>>(new Map());

  async function fetchMarkdownDoc(attId: number, forceRefresh = false) {
    if (!forceRefresh && markdownDocCacheRef.current.has(attId)) {
      return markdownDocCacheRef.current.get(attId)!;
    }
    const promise = reactMarkdownDocumentApi.getByAttachment(attId).catch((err) => {
      console.debug("Failed to sync markdown:", err);
      return null;
    });
    markdownDocCacheRef.current.set(attId, promise);
    return promise;
  }

  useEffect(() => {
    if (attachmentId && !markdownIsPolling) {
      let active = true;
      void fetchMarkdownDoc(attachmentId)
        .then((doc) => {
          if (active && doc) {
            setMarkdownDocument(doc);
          }
        });
      return () => {
        active = false;
      };
    }
  }, [attachmentId, markdownIsPolling]);

  useEffect(() => {
    if (!attachmentId) {
      clearThumbnail();
      return;
    }

    let ignored = false;
    let timer: number | undefined;
    const requestedId = attachmentId;
    setThumbnailLoading(true);
    setThumbnailUnavailable(false);

    function showUnavailable() {
      setThumbnailLoading(false);
      setThumbnailUrl((currentUrl) => {
        if (!currentUrl) {
          setThumbnailAvailable(false);
          setThumbnailUnavailable(true);
        }
        return currentUrl;
      });
    }

    function loadOriginalImageFallback() {
      if (!isImageContent(file?.contentType)) {
        showUnavailable();
        return;
      }

      reactFilesApi
        .downloadBlob(requestedId)
        .then((blob) => {
          if (ignored || requestedId !== attachmentId) {
            return;
          }
          if (blob.size === 0) {
            showUnavailable();
            return;
          }
          const objectUrl = URL.createObjectURL(blob);
          setThumbnailUrl((currentUrl) => {
            if (currentUrl) {
              URL.revokeObjectURL(currentUrl);
            }
            return objectUrl;
          });
          setThumbnailAvailable(true);
          setThumbnailLoading(false);
          setThumbnailUnavailable(false);
        })
        .catch(() => {
          if (!ignored) {
            showUnavailable();
          }
        });
    }

    function loadThumbnail(attempt: number) {
      reactFilesApi
        .fetchThumbnail(requestedId, 512)
        .then(({ blob, status, retryAfterMs }) => {
          if (ignored || requestedId !== attachmentId) {
            return;
          }
          if (blob.size > 0) {
            const objectUrl = URL.createObjectURL(blob);
            setThumbnailUrl((currentUrl) => {
              if (currentUrl) {
                URL.revokeObjectURL(currentUrl);
              }
              return objectUrl;
            });
            setThumbnailAvailable(true);
            setThumbnailUnavailable(false);
            if (isReadyThumbnail(status)) {
              setThumbnailLoading(false);
              return;
            }
          }
          if (shouldRetryThumbnail(status) && attempt < THUMBNAIL_RETRY_LIMIT) {
            setThumbnailLoading(true);
            timer = window.setTimeout(() => loadThumbnail(attempt + 1), retryAfterMs ?? THUMBNAIL_RETRY_INTERVAL_MS);
          } else {
            loadOriginalImageFallback();
          }
        })
        .catch(() => {
          if (ignored) {
            return;
          }
          if (attempt < THUMBNAIL_RETRY_LIMIT) {
            timer = window.setTimeout(() => loadThumbnail(attempt + 1), THUMBNAIL_RETRY_INTERVAL_MS);
          } else {
            loadOriginalImageFallback();
          }
        });
    }

    const cached = getCachedThumbnailUrl(requestedId);
    if (cached !== undefined) {
      if (cached) {
        setThumbnailUrl(cached);
        setThumbnailAvailable(true);
      } else {
        setThumbnailUrl(null);
        setThumbnailAvailable(false);
      }
      setThumbnailLoading(false);
    } else {
      loadThumbnail(0);
    }

    return () => {
      ignored = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [open, attachmentId, file?.contentType, thumbnailReloadKey]);

  async function refreshDetail() {
    if (!attachmentId) return;
    invalidateThumbnail(attachmentId);
    setFile(null);
    setRagIndexed(false);
    setRagMetadata(null);
    setExtractedText("");
    setTextExtracted(false);
    setRagJobId(null);
    setDownloadLinkUrl(null);
    setDownloadLinkExpiresAt(null);
    setThumbnailReloadKey((current) => current + 1);
    setLoading(true);
    try {
      const nextFile = await reactFilesApi.getById(attachmentId);
      setFile(nextFile);
      const ragState = await loadRagState(nextFile);
      setRagIndexed(ragState.indexed);
      setRagMetadata(ragState.metadata);

      const meta = ragState.metadata;
      const mdExists = (meta as any)?.markdown?.exists;
      let mdDocId = (meta as any)?.markdown?.documentId;

      if (!mdDocId) {
        try {
          const doc = await reactMarkdownDocumentApi.getByAttachment(attachmentId);
          if (doc && doc.documentId) {
            mdDocId = doc.documentId;
            setMarkdownDocument(doc);
          }
        } catch (err) {
          // Ignore
        }
      }

      if (mdExists || mdDocId) {
        if (mdDocId) {
          setDocumentId(mdDocId);
          localStorage.setItem(`markdown_doc_id_${attachmentId}`, mdDocId);
          startPolling(mdDocId, attachmentId);
          try {
            const doc = await reactMarkdownDocumentApi.getByAttachment(attachmentId);
            setMarkdownDocument(doc);
          } catch (err) {
            // Ignore
          }
        }
      } else {
        setDocumentId(null);
        setMarkdownDocument(null);
        setLatestRevision(null);
        setPipelineExecution(null);
        setPipelineProgress(null);
        setMarkdownStatus(null);
        setMarkdownError(null);
        stopPolling();

        try {
          const jobsRes = await reactAiApi.listRagJobs({
            objectType: "attachment",
            objectId: String(attachmentId),
            page: 0,
            size: 10,
            sort: "createdAt",
            direction: "desc",
          });
          const content = jobsRes.content ?? [];
          setRagJobs(content);
          setLatestRagJob(content[0] || null);
        } catch (err) {
          console.error("Failed to refresh RAG jobs:", err);
        }
      }
    } catch (error) {
      toast.error(resolveAxiosError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleExtractText() {
    if (!attachmentId || !file) return;
    const ok = window.confirm(`${file.name} 에서 텍스트를 추출하시겠습니까?`);
    if (!ok) return;

    setTextExtracting(true);
    try {
      const text = await reactFilesApi.extractText(attachmentId);
      setExtractedText(normalizeExtractedText(text));
      setTextExtracted(true);
    } catch (error) {
      toast.error(resolveAxiosError(error));
    } finally {
      setTextExtracting(false);
    }
  }

  async function handleCopyExtractedText() {
    const text = extractedText.trim();
    if (!text) {
      toast.warning("복사할 텍스트가 없습니다.");
      return;
    }
    if (!navigator.clipboard?.writeText) {
      toast.error("브라우저 환경이 클립보드 복사를 지원하지 않습니다.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("클립보드에 복사했습니다.");
    } catch {
      toast.error("클립보드 복사에 실패했습니다.");
    }
  }

  function sanitizeErrorMessage(msg: string | null | undefined): string {
    if (!msg) return "";
    if (msg.includes("Blockify chunking is disabled")) {
      return "Blockify 청킹이 서버에서 비활성화되어 있습니다. 서버 설정 studio.chunking.blockify.enabled=true 적용 후 다시 시도하세요.";
    }
    if (msg.includes("Invalid blockify chunk metadata") || msg.includes("Blockify chunking produced no chunks")) {
      return "Blockify 결과 검증에 실패했습니다. IdeaBlock 필수 metadata가 생성되지 않았습니다.";
    }
    return msg
      .replace(/(Signature|Expires|AWSAccessKeyId|token|access_token|key)=[^&\s]+/gi, '$1=***')
      .replace(/https?:\/\/[^\s]+(signature|token|key)[^\s]+/gi, '[SENSITIVE_URL]')
      .replace(/(s3|gs):\/\/[a-zA-Z0-9.\-_]+(\/[a-zA-Z0-9.\-_]+)*/gi, '[SENSITIVE_STORAGE_PATH]');
  }

  async function handleIssueDownloadLink() {
    if (!attachmentId || !file) return;

    setDownloadLinkIssuing(true);
    try {
      const issued = await reactFilesApi.issueDownloadUrl(attachmentId, { ttlSeconds: 300 });
      setDownloadLinkUrl(issued.url);
      setDownloadLinkExpiresAt(issued.expiresAt);
      if (!navigator.clipboard?.writeText) {
        toast.warning("다운로드 링크를 생성했습니다. 클립보드 복사는 브라우저에서 지원하지 않습니다.");
        return;
      }
      try {
        await navigator.clipboard.writeText(issued.url);
        toast.success("다운로드 링크를 생성하고 클립보드에 복사했습니다.");
      } catch {
        toast.warning("다운로드 링크를 생성했습니다. 아래 링크를 다시 복사해 주세요.");
      }
    } catch (error) {
      toast.error(resolveAxiosError(error));
    } finally {
      setDownloadLinkIssuing(false);
    }
  }

  async function handleCopyDownloadLink() {
    if (!downloadLinkUrl) {
      toast.warning("복사할 다운로드 링크가 없습니다.");
      return;
    }
    if (!navigator.clipboard?.writeText) {
      toast.error("현재 브라우저에서는 클립보드 복사를 지원하지 않습니다.");
      return;
    }
    try {
      await navigator.clipboard.writeText(downloadLinkUrl);
      toast.success("다운로드 링크를 클립보드에 복사했습니다.");
    } catch {
      toast.error("클립보드에 복사할 수 없습니다. 브라우저 권한을 확인해 주세요.");
    }
  }

  async function handleRagIndex() {
    if (!attachmentId || !file || ragIndexed) return;

    setRagIndexing(true);
    try {
      const [scope] = ragObjectScopes(file, attachmentId);
      const job = await reactAiApi.createRagJob({
        objectType: scope.objectType,
        objectId: scope.objectId,
        documentId: String(attachmentId),
        sourceType: "attachment",
        metadata: {
          attachmentId: String(attachmentId),
        },
        forceReindex: true,
        useLlmKeywordExtraction: true,
      });
      setRagJobId(job.jobId);
      toast.success(`${file.name} 파일의 RAG 색인 작업이 생성되었습니다.`);
    } catch (error) { 
      toast.error(resolveAxiosError(error));
    } finally {
      setRagIndexing(false);
    }
  }

  const handleRunChunkingChange = (checked: boolean) => {
    setUserHasOverriddenChunking(true);
    setRunChunking(checked);
    if (!checked) {
      setRunRagIndex(false);
      setRunSkillExtraction(false);
    }
  };


  const handleRunRagIndexChange = (checked: boolean) => {
    setUserHasOverriddenRagIndex(true);
    setRunRagIndex(checked);
    if (checked) {
      setRunChunking(true);
    } else {
      setRunSkillExtraction(false);
    }
  };

  const handleRunSkillExtractionChange = (checked: boolean) => {
    setUserHasOverriddenSkillExtraction(true);
    setRunSkillExtraction(checked);
    if (checked) {
      setRunRagIndex(true);
      setRunChunking(true);
    }
  };

  const buildPayload = (forEstimate = false) => {
    const maxSize = chunkMaxSizeOverride === "" || chunkMaxSizeOverride === null ? null : Number(chunkMaxSizeOverride);
    const overlap = chunkOverlapOverride === "" || chunkOverlapOverride === null ? null : Number(chunkOverlapOverride);

    if (runChunking) {
      if (maxSize !== null && (isNaN(maxSize) || maxSize <= 0)) {
        throw new Error("최대 크기는 양수여야 합니다.");
      }
      if (overlap !== null && (isNaN(overlap) || overlap < 0)) {
        throw new Error("중첩 크기는 0 이상이어야 합니다.");
      }
      if (maxSize !== null && overlap !== null && overlap >= maxSize) {
        throw new Error("중첩 크기는 최대 크기보다 작아야 합니다.");
      }
    }

    if (runRagIndex && !forEstimate && !selectedEmbeddingOption) {
      throw new Error("RAG 색인에 사용할 임베딩 모델을 선택해야 합니다.");
    }

    const payload: Record<string, any> = {
      documentProfile: documentProfile || "AUTO",
      documentSemanticType,
      metadataEnrichmentMode,
      runChunking,
      runRagIndex,
      runSkillExtraction,
      chunkingStrategy: (runChunking || forEstimate) ? (chunkingStrategyOverride || null) : null,
      chunkMaxSize: (runChunking || forEstimate) ? (maxSize || null) : null,
      chunkOverlap: (runChunking || forEstimate) ? (overlap || null) : null,
      chunkUnit: (runChunking || forEstimate) ? (chunkUnitOverride || null) : null,
      blockifyLlmProvider: (runChunking || forEstimate) && chunkingStrategy === "blockify" ? (blockifyLlmProvider || null) : null,
      blockifyLlmModel: (runChunking || forEstimate) && chunkingStrategy === "blockify" ? (blockifyLlmModel || null) : null,
      blockifyPiiMaskingEnabled: (runChunking || forEstimate) && chunkingStrategy === "blockify" ? blockifyPiiMaskingEnabled : null,
      ...(isPdf ? {
        ocrRequired: ocrOverride,
        ocrMode: ocrOverride === true ? "FORCE" : ocrOverride === false ? "DISABLED" : null,
        mathVisionCorrection: mathVisionCorrectionOverride,
      } : {}),
      ...(isPdf && ocrOverride === true && ocrLanguage ? { ocrLanguage } : {}),
    };

    if (runSkillExtraction || forEstimate) {
      payload.skillExtractionMode = skillExtractionMode || null;
    }

    if (runRagIndex || forEstimate) {
      if (selectedEmbeddingOption?.deploymentId) {
        payload.embeddingDeploymentId = selectedEmbeddingOption.deploymentId;
        payload.embeddingProvider = null;
        payload.embeddingModel = null;
        payload.embeddingDimension = selectedEmbeddingOption.dimension ?? null;
      } else if (selectedEmbeddingOption?.modelId) {
        payload.embeddingModelId = selectedEmbeddingOption.modelId;
        payload.embeddingProvider = null;
        payload.embeddingModel = null;
        payload.embeddingDimension = selectedEmbeddingOption.dimension ?? null;
      } else if (selectedEmbeddingOption?.profileId) {
        payload.embeddingProfileId = selectedEmbeddingOption.profileId;
        payload.embeddingProvider = null;
        payload.embeddingModel = null;
        payload.embeddingDimension = selectedEmbeddingOption.dimension ?? null;
      } else if (selectedEmbeddingOption) {
        payload.embeddingProfileId = null;
        payload.embeddingProvider = selectedEmbeddingOption.provider || null;
        payload.embeddingModel = selectedEmbeddingOption.model || null;
        payload.embeddingDimension = selectedEmbeddingOption.dimension ?? null;
      } else {
        payload.embeddingDeploymentId = null;
        payload.embeddingProfileId = null;
        payload.embeddingProvider = null;
        payload.embeddingModel = null;
        payload.embeddingDimension = null;
      }
    } else {
      payload.embeddingDeploymentId = null;
      payload.embeddingProfileId = null;
      payload.embeddingProvider = null;
      payload.embeddingModel = null;
      payload.embeddingDimension = null;
    }

    return payload;
  };

  useEffect(() => {
    const requestId = ++pipelineEstimateRequestId.current;
    if (!open || !attachmentId) {
      setPipelineEstimate(null);
      setPipelineEstimateLoading(false);
      setPipelineEstimateError(null);
      return;
    }

    setPipelineEstimateLoading(true);
    setPipelineEstimateError(null);
    const timer = window.setTimeout(async () => {
      try {
        const payload = buildPayload(true);
        const estimateRequest = {
          runChunking,
          runRagIndex,
          runSkillExtraction,
          chunkingStrategy: payload.chunkingStrategy,
          chunkMaxSize: payload.chunkMaxSize,
          chunkOverlap: payload.chunkOverlap,
          chunkUnit: payload.chunkUnit,
          embeddingDeploymentId: payload.embeddingDeploymentId,
          embeddingProfileId: payload.embeddingProfileId,
          embeddingProvider: payload.embeddingProvider,
          embeddingModel: payload.embeddingModel,
          embeddingDimension: payload.embeddingDimension,
          blockifyLlmProvider: payload.blockifyLlmProvider,
          blockifyLlmModel: payload.blockifyLlmModel,
          blockifyPiiMaskingEnabled: payload.blockifyPiiMaskingEnabled,
          ocrRequired: payload.ocrRequired,
          ocrMode: payload.ocrMode,
          ocrLanguage: payload.ocrLanguage,
          mathVisionCorrection: payload.mathVisionCorrection,
          documentProfile: payload.documentProfile,
          documentSemanticType: payload.documentSemanticType,
          metadataEnrichmentMode: payload.metadataEnrichmentMode,
          skillExtractionMode: payload.skillExtractionMode,
        };
        const estimate = markdownDocument?.currentRevisionId
          ? await reactMarkdownDocumentApi.estimatePipeline(markdownDocument.documentId, estimateRequest)
          : await reactMarkdownDocumentApi.estimatePipelineByAttachment(attachmentId, estimateRequest);
        if (pipelineEstimateRequestId.current === requestId) {
          setPipelineEstimate(estimate);
        }
      } catch (error) {
        if (pipelineEstimateRequestId.current === requestId) {
          setPipelineEstimate(null);
          setPipelineEstimateError(resolveAxiosError(error));
        }
      } finally {
        if (pipelineEstimateRequestId.current === requestId) {
          setPipelineEstimateLoading(false);
        }
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [
    open,
    attachmentId,
    markdownDocument?.currentRevisionId,
    markdownDocument?.documentId,
    documentProfile,
    documentSemanticType,
    metadataEnrichmentMode,
    runChunking,
    runRagIndex,
    runSkillExtraction,
    skillExtractionMode,
    chunkingStrategyOverride,
    chunkMaxSizeOverride,
    chunkOverlapOverride,
    chunkUnitOverride,
    blockifyLlmProvider,
    blockifyLlmModel,
    blockifyPiiMaskingEnabled,
    ocrOverride,
    ocrLanguageOverride,
    mathVisionCorrectionOverride,
    selectedEmbeddingOption,
  ]);

  const applyEstimatedChunkingRecommendation = () => {
    const recommended = pipelineEstimate?.recommended;
    if (!recommended) return;
    setChunkingStrategyOverride(recommended.chunkingStrategy || null);
    if (recommended.chunkMaxSize != null) setChunkMaxSizeOverride(recommended.chunkMaxSize);
    if (recommended.chunkOverlap != null) setChunkOverlapOverride(recommended.chunkOverlap);
    if (recommended.chunkUnit) setChunkUnitOverride(recommended.chunkUnit);
    setUserHasOverriddenChunking(true);
    toast.success("권장 청킹 설정을 적용했습니다.");
  };

  function getErrorMessageByStatus(status: number, originalMsg: string): string {
    if (status === 400) return `옵션 조합 오류: ${originalMsg}`;
    if (status === 401 || status === 403) return `권한이 부족합니다.`;
    if (status === 404) return `대상을 찾을 수 없습니다.`;
    if (status === 409) return `상태 충돌 발생 (처리 중이거나 이미 완료됨)`;
    if (status >= 500) return `서버 또는 파이프라인 장애 발생.`;
    return originalMsg;
  }

  async function handleExtractMarkdown() {
    if (!attachmentId || !file) return;

    // Check cost/time warning
    const isHighCost =
      processingPlan?.costTier === "HIGH" ||
      processingPlan?.effectiveOptions?.mathVisionCorrection === true ||
      pipelineEstimate?.riskLevel === "HIGH" ||
      pipelineEstimate?.riskLevel === "VERY_HIGH";
    if (isHighCost) {
      const ok = window.confirm(
        "이 설정(HIGH 비용 등급 또는 Vision 수식 보정 활성화)은 비용이 많이 발생하거나 처리 시간이 길어질 수 있습니다. 그래도 진행하시겠습니까?"
      );
      if (!ok) return;
    }

    const execute = async (payloadOverride?: any) => {
      let optionsPayload;
      try {
        optionsPayload = payloadOverride || buildPayload();
      } catch (err: any) {
        toast.error(err.message);
        return;
      }

      setIsExtracting(true);
      setReused(null);
      try {
        const res = await reactMarkdownDocumentApi.extractFromAttachment({
          attachmentId,
          force,
          ...optionsPayload,
        } as any);
        const newDocId = res.document.documentId;
        setDocumentId(newDocId);
        localStorage.setItem(`markdown_doc_id_${attachmentId}`, newDocId);
        setReused(res.reused);
        if (res.reused) {
          toast.info("기존 변환 결과를 사용합니다.");
        } else {
          toast.success("Markdown 지식 파이프라인 작업이 시작되었습니다.");
        }
        startPolling(newDocId, attachmentId);
      } catch (err: any) {
        const status = err?.response?.status;
        const rawMsg = resolveAxiosError(err);
        const errMsg = sanitizeErrorMessage(getErrorMessageByStatus(status, rawMsg));
        toast.error("Markdown 변환 요청 실패: " + errMsg);
      } finally {
        setIsExtracting(false);
      }
    };

    await execute();
  }

  async function handleRecreateMarkdownFromCanceled() {
    if (!attachmentId) return;
    setIsExtracting(true);
    try {
      const res = await reactMarkdownDocumentApi.extractFromAttachment({
        attachmentId,
        documentProfile: documentProfile || "AUTO",
        documentSemanticType,
        metadataEnrichmentMode,
        force: true,
        runChunking: false,
        runRagIndex: false,
        runSkillExtraction: false,
        ...(isPdf ? {
          ocrRequired: ocrOverride,
          ocrMode: ocrOverride === true ? "FORCE" : ocrOverride === false ? "DISABLED" : null,
          mathVisionCorrection: mathVisionCorrectionOverride,
        } : {}),
        ...(isPdf && ocrOverride === true && ocrLanguage ? { ocrLanguage } : {}),
      } as any);
      const newDocId = res.document.documentId;
      setDocumentId(newDocId);
      setMarkdownDocument(res.document);
      localStorage.setItem(`markdown_doc_id_${attachmentId}`, newDocId);
      setReused(res.reused);
      toast.success("Markdown 지식 파이프라인 작업이 재개되었습니다.");
      startPolling(newDocId, attachmentId);
    } catch (err: any) {
      toast.error("Markdown 다시 생성 실패: " + resolveAxiosError(err));
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleReextractWithOcr(mathVisionCorrectionOverride = false) {
    if (!documentId) return;
    const ok = window.confirm(
      mathVisionCorrectionOverride 
        ? "수식 OCR 및 Vision LLM 보정을 적용해서 다시 추출하시겠습니까? 처리 시간이 길어질 수 있습니다." 
        : "OCR을 적용해서 다시 추출하시겠습니까? 처리 시간이 길어질 수 있습니다."
    );
    if (!ok) return;
    setIsExtracting(true);
    setReused(null);
    try {
      const res = await reactMarkdownDocumentApi.reextract(documentId, {
        documentProfile: documentProfile || "AUTO",
        documentSemanticType,
        metadataEnrichmentMode,
        runChunking: false,
        runRagIndex: false,
        runSkillExtraction: false,
        ocrRequired: true,
        ocrMode: "FORCE",
        ocrLanguage: ocrLanguage || "kor+eng",
        mathVisionCorrection: mathVisionCorrectionOverride || mathVisionCorrection,
      });
      setReused(res.reused);
      toast.success(mathVisionCorrectionOverride ? "수식 OCR 재추출 작업이 시작되었습니다." : "OCR 재추출 작업이 시작되었습니다.");
      startPolling(documentId, attachmentId);
    } catch (err: any) {
      toast.error("재추출 실패: " + resolveAxiosError(err));
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleReextractMarkdown() {
    if (!documentId) return;

    // Check cost/time warning
    const isHighCost =
      processingPlan?.costTier === "HIGH" ||
      processingPlan?.effectiveOptions?.mathVisionCorrection === true ||
      pipelineEstimate?.riskLevel === "HIGH" ||
      pipelineEstimate?.riskLevel === "VERY_HIGH";
    if (isHighCost) {
      const ok = window.confirm(
        "이 설정(HIGH 비용 등급 또는 Vision 수식 보정 활성화)은 비용이 많이 발생하거나 처리 시간이 길어질 수 있습니다. 그래도 진행하시겠습니까?"
      );
      if (!ok) return;
    } else {
      const ok = window.confirm("기존 결과와 관계없이 새로 변환 및 색인을 진행하시겠습니까?");
      if (!ok) return;
    }

    const execute = async (payloadOverride?: any) => {
      let optionsPayload;
      try {
        optionsPayload = payloadOverride || buildPayload();
      } catch (err: any) {
        toast.error(err.message);
        return;
      }

      setIsExtracting(true);
      setReused(null);
      try {
        const res = await reactMarkdownDocumentApi.reextract(documentId, optionsPayload as any);
        setReused(res.reused);
        toast.success("재추출 및 RAG 색인 작업이 시작되었습니다.");
        startPolling(documentId, attachmentId);
      } catch (err: any) {
        const status = err?.response?.status;
        const rawMsg = resolveAxiosError(err);
        const errMsg = sanitizeErrorMessage(getErrorMessageByStatus(status, rawMsg));
        toast.error("재추출 요청 실패: " + errMsg);
      } finally {
        setIsExtracting(false);
      }
    };

    await execute();
  }

  async function handleCancelMarkdown() {
    if (!documentId) return;
    const ok = window.confirm("진행 중인 작업을 취소하시겠습니까?");
    if (!ok) return;

    setIsCanceling(true);
    try {
      await reactMarkdownDocumentApi.cancelExtraction(documentId);
      stopPolling();
      setMarkdownStatus("CANCELED");
      if (latestRevision) {
        setLatestRevision({ ...latestRevision, status: "CANCELED" });
      }
      toast.success("작업이 취소되었습니다.");
    } catch (err: any) {
      toast.error("작업 취소 실패: " + resolveAxiosError(err));
    } finally {
      setIsCanceling(false);
    }
  }

  const storeLastFailedMessage = () => {
    const currentErr = pipelineProgress?.errorMessage || pipelineExecution?.errorMessage || latestRevision?.errorMessage || markdownError || "";
    if (currentErr) {
      setLastFailedMessage(currentErr);
    }
  };

  async function handleResume(fromStage: MarkdownPipelineStage | null) {
    if (!documentId) return;
    storeLastFailedMessage();
    if (markdownStatus !== "COMPLETED") {
      toast.error("Markdown 변환이 성공적으로 완료된 상태에서만 작업을 재개할 수 있습니다.");
      return;
    }
    
    let optionsPayload;
    try {
      optionsPayload = buildPayload();
    } catch (err: any) {
      toast.error(err.message);
      return;
    }

    setIsExtracting(true);
    try {
      const res = await reactMarkdownDocumentApi.resume(documentId, {
        fromStage,
        ...optionsPayload,
      });
      toast.success(
        res.resumedPhase === "COMPLETED"
          ? "이미 완료된 단계입니다."
          : `작업이 [${res.resumedFrom}] 단계부터 재개되었습니다.`
      );
      startPolling(documentId, attachmentId);
    } catch (err: any) {
      toast.error("작업 재개 실패: " + resolveAxiosError(err));
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleCancelRagJob(jobId: string) {
    const ok = window.confirm("진행 중인 RAG 색인 작업을 취소하시겠습니까?");
    if (!ok) return;
    try {
      await reactAiApi.cancelRagJob(jobId);
      toast.success("RAG 색인 작업이 취소되었습니다.");
      if (documentId) {
        startPolling(documentId, attachmentId);
      }
    } catch (err: any) {
      toast.error("RAG 색인 취소 실패: " + resolveAxiosError(err));
    }
  }

  async function handleReindexRag() {
    if (!documentId) return;
    storeLastFailedMessage();
    if (!selectedEmbeddingOption) {
      toast.error("RAG 색인을 재지정할 임베딩 옵션을 선택해 주세요.");
      return;
    }
    const label = selectedEmbeddingOption.displayName || selectedEmbeddingOption.deploymentId || selectedEmbeddingOption.modelId
      || selectedEmbeddingOption.profileId || `${selectedEmbeddingOption.provider}:${selectedEmbeddingOption.model}`;
    const ok = window.confirm(`선택한 임베딩(${label})으로 RAG 색인을 재지정하시겠습니까?`);
    if (!ok) return;

    setIsExtracting(true);
    try {
      const payload: MarkdownRagReindexRequest = {
        runSkillExtraction: runSkillExtraction,
      };

      if (selectedEmbeddingOption.deploymentId) {
        payload.embeddingDeploymentId = selectedEmbeddingOption.deploymentId;
        payload.embeddingProvider = null;
        payload.embeddingModel = null;
        payload.embeddingDimension = selectedEmbeddingOption.dimension ?? null;
      } else if (selectedEmbeddingOption.modelId) {
        payload.embeddingModelId = selectedEmbeddingOption.modelId;
        payload.embeddingProvider = null;
        payload.embeddingModel = null;
        payload.embeddingDimension = selectedEmbeddingOption.dimension ?? null;
      } else if (selectedEmbeddingOption.profileId) {
        payload.embeddingProfileId = selectedEmbeddingOption.profileId;
        payload.embeddingProvider = null;
        payload.embeddingModel = null;
        payload.embeddingDimension = selectedEmbeddingOption.dimension ?? null;
      } else {
        payload.embeddingProfileId = null;
        payload.embeddingProvider = selectedEmbeddingOption.provider || null;
        payload.embeddingModel = selectedEmbeddingOption.model || null;
        payload.embeddingDimension = selectedEmbeddingOption.dimension ?? null;
      }

      if (runSkillExtraction) {
        payload.skillExtractionMode = skillExtractionMode || null;
      }

      await reactMarkdownDocumentApi.reindexRag(documentId, payload);
      toast.success("RAG 색인 재지정 작업이 시작되었습니다.");
      startPolling(documentId, attachmentId);
    } catch (err: any) {
      toast.error("RAG 색인 재지정 실패: " + resolveAxiosError(err));
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleCopyMarkdown() {
    if (!documentId) return;
    try {
      const text = await reactMarkdownDocumentApi.getMarkdownText(documentId);
      await navigator.clipboard.writeText(text);
      toast.success("마크다운이 클립보드에 복사되었습니다.");
    } catch (err: any) {
      toast.error("복사 실패: " + (err?.message || "알 수 없는 오류"));
    }
  }

  async function handleDownloadMarkdown() {
    if (!documentId) return;
    try {
      await reactMarkdownDocumentApi.downloadMarkdown(
        documentId,
        undefined,
        file?.name ? `${file.name.replace(/\.[^/.]+$/, "")}.md` : undefined
      );
      toast.success("다운로드가 시작되었습니다.");
    } catch (err: any) {
      toast.error("다운로드 실패: " + (err?.message || "알 수 없는 오류"));
    }
  }

  const getExtractStepStatus = () => {
    const failState = getStageFailureState("EXTRACT");
    if (failState) return failState;
    if (markdownStatus === "COMPLETED") return "COMPLETED";
    if (markdownStatus === "FAILED") return "FAILED";
    if (markdownStatus === "CANCELED") return "CANCELED";
    if (markdownStatus === "RUNNING" || markdownStatus === "PENDING") return "RUNNING";
    return "PENDING";
  };

  const getMarkdownStepStatus = () => {
    const failState = getStageFailureState("MARKDOWN");
    if (failState) return failState;
    return getExtractStepStatus();
  };

  const getChunkingStepStatus = () => {
    if (!runChunking) return "DISABLED";
    const failState = getStageFailureState("CHUNKING");
    if (failState) return failState;
    if (markdownStatus === "COMPLETED") {
      if (!pipelineExecution || pipelineExecution.status === "UNKNOWN" || pipelineExecution.errorCode === "PIPELINE_HISTORY_UNAVAILABLE") {
        return "COMPLETED";
      }
    }
    if (!pipelineExecution || pipelineExecution.status === "UNKNOWN" || pipelineExecution.errorCode === "PIPELINE_HISTORY_UNAVAILABLE") {
      return "PENDING";
    }
    if (pipelineExecution.status === "RUNNING" && pipelineExecution.currentStage === "CHUNKING") return "RUNNING";
    
    const completedStages: MarkdownPipelineStage[] = ["CHUNKING", "RAG_INDEX", "SKILL_EXTRACTION", "COMPLETED"];
    if (pipelineExecution.lastCompletedStage && completedStages.includes(pipelineExecution.lastCompletedStage)) {
      return "COMPLETED";
    }
    if (pipelineExecution.status === "COMPLETED") return "COMPLETED";
    return "PENDING";
  };

  const getEmbeddingStepStatus = () => {
    if (!runRagIndex) return "DISABLED";
    const failState = getStageFailureState("EMBEDDING");
    if (failState) return failState;

    if (latestRagJob) {
      const status = latestRagJob.status;
      if (status === "RUNNING") {
        if (latestRagJob.currentStep === "EMBEDDING") return "RUNNING";
        if (latestRagJob.currentStep === "INDEXING" || latestRagJob.currentStep === "COMPLETED") return "COMPLETED";
        return "PENDING";
      }
      if (status === "SUCCEEDED") return "COMPLETED";
      if (status === "CANCELLED") return "CANCELED";
      if (status === "PENDING") return "RUNNING";
    }
    if (markdownStatus === "COMPLETED") {
      if (!pipelineExecution || pipelineExecution.status === "UNKNOWN" || pipelineExecution.errorCode === "PIPELINE_HISTORY_UNAVAILABLE") {
        if (ragIndexed || ragMetadata?.indexed) return "COMPLETED";
        return "PENDING";
      }
    }
    if (!pipelineExecution || pipelineExecution.status === "UNKNOWN" || pipelineExecution.errorCode === "PIPELINE_HISTORY_UNAVAILABLE") {
      return "PENDING";
    }
    if (pipelineExecution.status === "RUNNING" && pipelineExecution.currentStage === "RAG_INDEX") return "RUNNING";

    const completedStages: MarkdownPipelineStage[] = ["RAG_INDEX", "SKILL_EXTRACTION", "COMPLETED"];
    if (pipelineExecution.lastCompletedStage && completedStages.includes(pipelineExecution.lastCompletedStage)) {
      return "COMPLETED";
    }
    if (pipelineExecution.status === "COMPLETED") return "COMPLETED";
    return "PENDING";
  };

  const getIndexingStepStatus = () => {
    if (!runRagIndex) return "DISABLED";
    const failState = getStageFailureState("INDEXING");
    if (failState) return failState;

    if (latestRagJob) {
      const status = latestRagJob.status;
      if (status === "RUNNING") {
        if (latestRagJob.currentStep === "INDEXING") return "RUNNING";
        if (latestRagJob.currentStep === "COMPLETED") return "COMPLETED";
        return "PENDING";
      }
      if (status === "SUCCEEDED") return "COMPLETED";
      if (status === "CANCELLED") return "CANCELED";
      if (status === "PENDING") return "PENDING";
    }
    if (markdownStatus === "COMPLETED") {
      if (!pipelineExecution || pipelineExecution.status === "UNKNOWN" || pipelineExecution.errorCode === "PIPELINE_HISTORY_UNAVAILABLE") {
        if (ragIndexed || ragMetadata?.indexed) return "COMPLETED";
        return "PENDING";
      }
    }
    if (!pipelineExecution || pipelineExecution.status === "UNKNOWN" || pipelineExecution.errorCode === "PIPELINE_HISTORY_UNAVAILABLE") {
      return "PENDING";
    }
    const completedStages: MarkdownPipelineStage[] = ["SKILL_EXTRACTION", "COMPLETED"];
    if (pipelineExecution.lastCompletedStage && completedStages.includes(pipelineExecution.lastCompletedStage)) {
      return "COMPLETED";
    }
    if (pipelineExecution.status === "COMPLETED") return "COMPLETED";
    return "PENDING";
  };

  const getSkillStepStatus = () => {
    if (!runSkillExtraction) return "DISABLED";
    const failState = getStageFailureState("SKILL_EXTRACTION");
    if (failState) return failState;

    if (markdownStatus === "COMPLETED") {
      if (!pipelineExecution || pipelineExecution.status === "UNKNOWN" || pipelineExecution.errorCode === "PIPELINE_HISTORY_UNAVAILABLE") {
        return "COMPLETED";
      }
    }
    if (!pipelineExecution || pipelineExecution.status === "UNKNOWN" || pipelineExecution.errorCode === "PIPELINE_HISTORY_UNAVAILABLE") {
      return "PENDING";
    }
    if (pipelineExecution.status === "RUNNING" && pipelineExecution.currentStage === "SKILL_EXTRACTION") return "RUNNING";
    
    const completedStages: MarkdownPipelineStage[] = ["SKILL_EXTRACTION", "COMPLETED"];
    if (pipelineExecution.lastCompletedStage && completedStages.includes(pipelineExecution.lastCompletedStage)) {
      return "COMPLETED";
    }
    if (pipelineExecution.status === "COMPLETED") return "COMPLETED";
    return "PENDING";
  };

  function renderPipelineStatusDashboard() {
    if (!documentId) return null;

    const getMarkdownProgress = () => {
      if (!latestRevision || !latestRevision.totalPartCount) return undefined;
      return Math.floor(((latestRevision.completedPartCount || 0) / latestRevision.totalPartCount) * 100);
    };

    const getMarkdownDetails = () => {
      if (!latestRevision || !latestRevision.totalPartCount) return undefined;
      const progress = getMarkdownProgress();
      return `${latestRevision.completedPartCount || 0}/${latestRevision.totalPartCount} (${progress}%)`;
    };

    const getEmbeddingProgress = () => {
      if (!latestRagJob || !latestRagJob.chunkCount) return 0;
      return Math.floor((latestRagJob.embeddedCount / latestRagJob.chunkCount) * 100);
    };

    const getIndexingProgress = () => {
      if (!latestRagJob || !latestRagJob.chunkCount) return 0;
      return Math.floor((latestRagJob.indexedCount / latestRagJob.chunkCount) * 100);
    };

    const mdProg = getMarkdownProgress();
    const embProg = getEmbeddingProgress();
    const idxProg = getIndexingProgress();

    const getChunkingDetails = () => {
      const chunking = pipelineProgress?.chunking;
      if (!chunking) return undefined;
      return `Samples (IdeaBlock): ${chunking.ideaBlockCount}개 / Fallbacks: ${chunking.fallbackCount}개 / 커버리지: ${(chunking.sourceBlockCoverage * 100).toFixed(1)}%`;
    };

    const getEmbeddingDetails = () => {
      if (pipelineProgress?.rag) {
        const r = pipelineProgress.rag;
        const count = r.chunkCount ?? 0;
        if (count > 0) {
          const prog = Math.floor(((r.embeddedCount ?? 0) / count) * 100);
          return `${r.embeddedCount ?? 0}/${count} (${prog}%)`;
        }
      }
      if (latestRagJob && latestRagJob.chunkCount > 0) {
        return `${latestRagJob.embeddedCount}/${latestRagJob.chunkCount} (${embProg}%)`;
      }
      return undefined;
    };

    const getIndexingDetails = () => {
      if (pipelineProgress?.rag) {
        const r = pipelineProgress.rag;
        const count = r.chunkCount ?? 0;
        if (count > 0) {
          const prog = Math.floor(((r.indexedCount ?? 0) / count) * 100);
          return `${r.indexedCount ?? 0}/${count} (${prog}%)`;
        }
      }
      if (latestRagJob && latestRagJob.chunkCount > 0) {
        return `${latestRagJob.indexedCount}/${latestRagJob.chunkCount} (${idxProg}%)`;
      }
      return undefined;
    };

    const steps = [
      {
        id: "extract",
        label: "Extract (본문 추출)",
        status: getExtractStepStatus(),
        description: "첨부파일(PDF, EPUB, DOCX 등) 원본에서 원시 텍스트 추출",
      },
      {
        id: "markdown",
        label: "Markdown (구조화)",
        status: getMarkdownStepStatus(),
        description: "추출 텍스트를 마크다운 포맷으로 가공 및 단락/목차 구조화",
        progress: mdProg,
        details: getMarkdownDetails(),
      },
      {
        id: "chunking",
        label: "Chunking (분할)",
        status: getChunkingStepStatus(),
        description: "최적의 크기(Chunk)로 문서 절단 및 메타데이터 추가",
        details: getChunkingDetails(),
      },
      {
        id: "embedding",
        label: "Embedding (벡터 변환)",
        status: getEmbeddingStepStatus(),
        description: "분할된 Chunk를 임베딩 모델을 통해 벡터로 변환",
        progress: pipelineProgress?.rag?.chunkCount ? Math.floor(((pipelineProgress.rag.embeddedCount ?? 0) / pipelineProgress.rag.chunkCount) * 100) : embProg,
        details: getEmbeddingDetails(),
      },
      {
        id: "indexing",
        label: "Vector upsert (벡터 저장)",
        status: getIndexingStepStatus(),
        description: "변환된 벡터 데이터를 Vector DB 테이블에 색인 및 적재",
        progress: pipelineProgress?.rag?.chunkCount ? Math.floor(((pipelineProgress.rag.indexedCount ?? 0) / pipelineProgress.rag.chunkCount) * 100) : idxProg,
        details: getIndexingDetails(),
      },
      {
        id: "skill",
        label: "Skill (지식 추출)",
        status: getSkillStepStatus(),
        description: "AI를 이용해 문서 내 핵심 스킬 및 연관 관계를 분석/추출",
      },
    ];

    return (
      <Box sx={{ mt: 2, mb: 2, p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "background.paper" }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <TimelineOutlined sx={{ fontSize: 18, color: "primary.main" }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: 13.5 }}>
            지식 파이프라인 처리 상태
          </Typography>
        </Stack>

        <Box sx={{ position: "relative", pl: 0.5 }}>
          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            let iconColor = "text.disabled";
            let textColor = "text.primary";
            let descColor = "text.secondary";
            let statusText = "대기";
            let statusColor = "default";
            let isRunning = step.status === "RUNNING";
            let isCompleted = step.status === "COMPLETED";
            let isFailed = step.status === "FAILED";
            let isCanceled = step.status === "CANCELED";
            let isDisabled = step.status === "DISABLED";
            let isNotRun = step.status === "NOT_RUN";

            if (isCompleted) {
              iconColor = "success.main";
              textColor = "text.primary";
              statusText = "완료";
              statusColor = "success";
            } else if (isRunning) {
              iconColor = "primary.main";
              textColor = "primary.main";
              statusText = "진행 중";
              statusColor = "primary";
            } else if (isFailed) {
              iconColor = "error.main";
              textColor = "error.main";
              statusText = "실패";
              statusColor = "error";
            } else if (isCanceled) {
              iconColor = "text.disabled";
              textColor = "text.disabled";
              descColor = "text.disabled";
              statusText = "취소됨";
              statusColor = "default";
            } else if (isDisabled) {
              iconColor = "text.disabled";
              textColor = "text.disabled";
              descColor = "text.disabled";
              statusText = "미실행";
              statusColor = "default";
            } else if (isNotRun) {
              iconColor = "text.disabled";
              textColor = "text.disabled";
              descColor = "text.disabled";
              statusText = "미실행";
              statusColor = "default";
            }

            return (
              <Box key={step.id} sx={{ display: "flex", position: "relative", pb: isLast ? 0 : 3 }}>
                {!isLast && (
                  <Box
                    sx={{
                      position: "absolute",
                      left: 11,
                      top: 24,
                      bottom: 0,
                      width: 2,
                      bgcolor: isCompleted ? "success.light" : "divider",
                      backgroundImage: isRunning
                        ? "linear-gradient(to bottom, #1976d2 50%, transparent 50%)"
                        : "none",
                      backgroundSize: isRunning ? "2px 6px" : "auto",
                      zIndex: 1,
                    }}
                  />
                )}

                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: isRunning ? "rgba(25, 118, 210, 0.08)" : isCompleted ? "rgba(46, 125, 50, 0.08)" : isFailed ? "rgba(211, 47, 47, 0.08)" : "action.hover",
                    border: "2px solid",
                    borderColor: isRunning ? "primary.main" : isCompleted ? "success.main" : isFailed ? "error.main" : "divider",
                    color: isRunning ? "primary.main" : isCompleted ? "success.main" : isFailed ? "error.main" : "text.secondary",
                    zIndex: 2,
                    mr: 2,
                    flexShrink: 0,
                    boxShadow: isRunning ? "0 0 0 3px rgba(25, 118, 210, 0.15)" : "none",
                  }}
                >
                  {isRunning ? (
                    <CircularProgress size={12} thickness={5} sx={{ color: "primary.main" }} />
                  ) : isCompleted ? (
                    <CheckCircle sx={{ fontSize: 14, color: "success.main" }} />
                  ) : isFailed ? (
                    <Cancel sx={{ fontSize: 14, color: "error.main" }} />
                  ) : (
                    <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 700, color: isDisabled ? "text.disabled" : "text.secondary" }}>
                      {idx + 1}
                    </Typography>
                  )}
                </Box>

                <Box sx={{ flex: 1, minWidth: 0, mt: 0.25 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: isRunning ? 700 : 500, color: textColor, fontSize: 12.5 }}>
                      {step.label} {step.details && <span style={{ fontSize: "11px", fontWeight: "normal", color: "gray", marginLeft: "4px" }}>{step.details}</span>}
                    </Typography>
                    <Chip
                      label={statusText}
                      size="small"
                      color={statusColor as any}
                      variant={isRunning || isCompleted || isFailed ? "filled" : "outlined"}
                      sx={{
                        height: 18,
                        fontSize: 9.5,
                        fontWeight: 600,
                        px: 0.5,
                        borderRadius: "4px",
                      }}
                    />
                  </Stack>
                  <Typography variant="caption" sx={{ color: descColor, display: "block", fontSize: 11, lineHeight: 1.4 }}>
                    {step.description}
                  </Typography>
                  
                  {isRunning && (
                    <Box sx={{ width: "100%", mt: 1, height: 4, bgcolor: "action.hover", borderRadius: 1, overflow: "hidden", position: "relative" }}>
                      <Box
                        sx={{
                          height: "100%",
                          width: step.progress !== undefined ? `${step.progress}%` : "50%",
                          bgcolor: "primary.main",
                          borderRadius: 1,
                          animation: step.progress !== undefined ? "none" : "shimmer 1.5s infinite linear",
                          transformOrigin: "left",
                          transition: "width 0.4s ease",
                          "@keyframes shimmer": {
                            "0%": { transform: "translateX(-100%) scaleX(1)" },
                            "50%": { transform: "translateX(0%) scaleX(1.5)" },
                            "100%": { transform: "translateX(100%) scaleX(1)" }
                          }
                        }}
                      />
                    </Box>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
        {renderBlockifyDiagnostic()}
      </Box>
    );
  }

  function renderBlockifyDiagnostic() {
    if (chunkingStrategy !== "blockify" && latestRagJob?.chunkingStrategy !== "blockify") {
      return null;
    }
    if (!blockifyValidationResult) {
      if (latestRagJob?.status === "RUNNING" || latestRagJob?.status === "PENDING") {
        return (
          <Alert severity="info" sx={{ mt: 2, py: 0.5, px: 1.5, "& .MuiAlert-message": { fontSize: 11, lineHeight: 1.4 } }}>
            Blockify 진단: 파이프라인 완료 후 메타데이터 검증을 시작합니다.
          </Alert>
        );
      }
      return null;
    }

    const { isValid, missingFields, hasChunks } = blockifyValidationResult;

    if (!hasChunks) {
      return (
        <Alert severity="warning" sx={{ mt: 2, "& .MuiAlert-message": { fontSize: 11, lineHeight: 1.4 } }}>
          <strong>Blockify 결과 미반영:</strong> 생성된 RAG Chunk가 존재하지 않습니다.
        </Alert>
      );
    }

    if (isValid) {
      return (
        <Alert severity="success" sx={{ mt: 2, "& .MuiAlert-message": { fontSize: 11, lineHeight: 1.4 } }}>
          <strong>Blockify 검증 통과:</strong> 모든 필수 메타데이터 필드가 정상 반영되었습니다.
        </Alert>
      );
    }

    return (
      <Alert severity="error" sx={{ mt: 2, "& .MuiAlert-message": { fontSize: 11, lineHeight: 1.4 } }}>
        <strong>Blockify 결과 미반영:</strong> 필수 메타데이터 필드가 누락되었습니다.
        <Box sx={{ mt: 0.5, pl: 1, fontSize: 11 }}>
          • 누락된 필드: {missingFields.join(", ")}
          <br />
          • 원인: 서버 설정 및 Fallback 동작을 확인하십시오.
        </Box>
      </Alert>
    );
  }

  function renderDetail(label: string, value?: string | number | null) {
    return (
      <Box>
        <Typography variant="body2" color="text.secondary" display="block" sx={{ fontWeight: 500, fontSize: 13 }}>
          {label}
        </Typography>
        <Typography variant="body1" sx={{ mt: 0.5, overflowWrap: "anywhere", fontWeight: 600, fontSize: 15.5 }}>
          {value || "-"}
        </Typography>
      </Box>
    );
  }

  const handleScrollToSection = (section: string) => {
    setActiveSection(section);
    const element = document.getElementById(`section-${section}`);
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  };

  const [activeSection, setActiveSection] = useState<string>("info");

  const isRagCompleted = useMemo(() => {
    return (
      ragIndexed ||
      (ragMetadata as any)?.indexed === true ||
      latestRagJob?.status === "SUCCEEDED" ||
      pipelineExecution?.lastCompletedStage === "RAG_INDEX" ||
      pipelineExecution?.lastCompletedStage === "SKILL_EXTRACTION" ||
      pipelineExecution?.status === "COMPLETED"
    );
  }, [ragIndexed, ragMetadata, latestRagJob?.status, pipelineExecution]);

  useEffect(() => {
    if (!isRagCompleted && currentTab === "qa") {
      setCurrentTab("info");
    }
  }, [isRagCompleted, currentTab]);

  const lastQaAssistantMessage = useMemo(() => {
    return [...qaMessages].reverse().find((m) => m.role === "assistant");
  }, [qaMessages]);

  const submitQaQuestion = async (trimmed: string, baseMessages: ChatMessage[], appendUserMessage: boolean) => {
    if (!trimmed || qaSending || !file) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    const nextMessages = appendUserMessage ? [...baseMessages, userMsg] : baseMessages;
    setQaMessages(nextMessages);
    setQaInput("");
    setQaSending(true);
    setQaError(null);

    try {
      const requestMessages = nextMessages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const embeddingDeploymentId = latestRagJob?.embeddingDeploymentId
        || (ragMetadata as any)?.embeddingDeploymentId || undefined;
      const embeddingProfileId = latestRagJob?.embeddingProfileId || (ragMetadata as any)?.embeddingProfileId || undefined;
      const embeddingProvider = latestRagJob?.embeddingProvider || (ragMetadata as any)?.embeddingProvider || undefined;
      const embeddingModel = latestRagJob?.embeddingModel || (ragMetadata as any)?.embeddingModel || undefined;

      const payload: ChatRagRequestDto = {
        chat: {
          deploymentId: qaDeploymentId || "chat-default",
          provider: qaProvider || undefined,
          model: qaModel || undefined,
          messages: requestMessages,
        },
        ragQuery: trimmed,
        objectType: "attachment",
        objectId: String(file.attachmentId),
        topK: 5,
        minScore: 0.35,
        debug: true,
        answerMode: qaAnswerMode,
      };

      if (embeddingDeploymentId) {
        payload.embeddingDeploymentId = embeddingDeploymentId;
      } else if (embeddingProfileId) {
        payload.embeddingProfileId = embeddingProfileId;
      } else if (embeddingProvider && embeddingModel) {
        payload.embeddingProvider = embeddingProvider;
        payload.embeddingModel = embeddingModel;
      }

      const res = await reactAiApi.sendRagChat(payload);
      const assistant = [...(res.messages ?? [])].reverse().find(m => m.role === "assistant");

      setQaMessages([
        ...nextMessages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: assistant?.content ?? "",
          createdAt: new Date().toISOString(),
          model: res.metadata?.resolvedModel || res.model || qaModel,
          metadata: res.metadata,
        }
      ]);
    } catch (err: any) {
      const msg = resolveAxiosError(err);
      setQaError(msg);
      setQaMessages([
        ...nextMessages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `오류가 발생했습니다: ${msg}`,
          createdAt: new Date().toISOString(),
          metadata: { finishReason: "error" },
        }
      ]);
    } finally {
      setQaSending(false);
    }
  };

  const handleSendQa = async () => {
    const trimmed = qaInput.trim();
    if (!trimmed || qaSending) return;
    await submitQaQuestion(trimmed, qaMessages, true);
  };

  const handleQaRegenerate = async () => {
    if (qaSending) return;
    const lastUserIdx = [...qaMessages].map((m) => m.role).lastIndexOf("user");
    if (lastUserIdx < 0) return;
    const baseMessages = qaMessages.slice(0, lastUserIdx + 1);
    const lastUser = baseMessages[lastUserIdx];
    await submitQaQuestion(lastUser.content, baseMessages, false);
  };

  const handleQaRetryLastUser = () => {
    const lastUser = [...qaMessages].reverse().find((item) => item.role === "user");
    if (lastUser?.content) {
      setQaInput(lastUser.content);
    }
  };

  const handleQaScroll = () => {
    const container = qaMessageListRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
    setShowScrollToBottomBtn(!isNearBottom);
  };

  const scrollToBottom = () => {
    const container = qaMessageListRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    if (currentTab === "qa") {
      scrollToBottom();
    }
  }, [qaMessages, currentTab]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        "& .MuiDrawer-paper": {
          width: "70vw",
          p: 0,
          display: "flex",
          flexDirection: "column",
          borderRadius: "12px 0 0 12px",
          borderTopRightRadius: 0,
          borderBottomRightRadius: 0,
        },
      }}
    >
      <Box sx={{ px: 3, py: 2, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.paper", flexShrink: 0 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, flex: 1, mr: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "8px", bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08), color: "primary.main", flexShrink: 0 }}>
            <DescriptionOutlined fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700, fontSize: 16, color: "text.primary" }}>
              {file ? file.name : "파일 상세 정보"}
            </Typography>
            {file && (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, display: "flex", alignItems: "center", gap: 0.75 }}>
                {file.contentType || "첨부파일"} {file.size ? `· ${formatFileSize(file.size)}` : ""}
              </Typography>
            )}
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
          {file && (
            <>
              {isPdf && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setPdfReaderOpen(true)}
                  sx={{ height: 32, fontSize: 12, borderRadius: "8px", textTransform: "none", fontWeight: 600 }}
                >
                  미리보기 (PDF)
                </Button>
              )}
              {isEpub && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setEpubReaderOpen(true)}
                  sx={{ height: 32, fontSize: 12, borderRadius: "8px", textTransform: "none", fontWeight: 600 }}
                >
                  미리보기 (EPUB)
                </Button>
              )}
              <Button
                size="small"
                variant="outlined"
                component="a"
                href={`/api/mgmt/files/${file.attachmentId}/download`}
                download={file.name}
                sx={{ height: 32, fontSize: 12, borderRadius: "8px", textTransform: "none", fontWeight: 600 }}
              >
                다운로드
              </Button>
            </>
          )}
          <Tooltip title="새로고침">
            <IconButton size="small" onClick={refreshDetail} sx={{ border: "1px solid", borderColor: "divider", borderRadius: "8px", width: 32, height: 32 }}>
              <RefreshOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="닫기">
            <IconButton size="small" onClick={onClose} sx={{ border: "1px solid", borderColor: "divider", borderRadius: "8px", width: 32, height: 32 }}>
              <CloseOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {file && isRagCompleted && (
        <Box sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper", flexShrink: 0 }}>
          <Tabs
            value={currentTab}
            onChange={(_, newValue) => setCurrentTab(newValue)}
            sx={{ px: 3 }}
          >
            <Tab label="상세 정보" value="info" sx={{ textTransform: "none", fontWeight: 700 }} />
            <Tab label="문서 Q&A (Ask Gemini)" value="qa" sx={{ textTransform: "none", fontWeight: 700 }} />
          </Tabs>
        </Box>
      )}

      {currentTab === "info" && (
        <Box sx={{ p: 3, flexGrow: 1, overflow: "auto" }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
            <CircularProgress />
          </Box>
        ) : !file ? (
          <Alert severity="warning">
            파일 정보를 찾을 수 없거나 불러오지 못했습니다.
          </Alert>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 200px" },
              gap: { xs: 0, lg: 3 },
            }}
          >
            <Stack spacing={2}>
          {/* 1. 기본 정보 상시 노출 */}
          <Container maxWidth="md" disableGutters>
            <Paper id="section-info" variant="outlined" sx={{ p: 2.5, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                파일 기본 정보
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>{renderDetail("이름", file.name)}</Grid>
                <Grid size={{ xs: 6, md: 3 }}>{renderDetail("콘텐츠 종류", file.contentType)}</Grid>
                <Grid size={{ xs: 6, md: 3 }}>{renderDetail("크기", formatFileSize(file.size))}</Grid>
                <Grid size={{ xs: 6, md: 6 }}>{renderDetail("수정일", formatDate(file.updatedAt || file.createdAt))}</Grid>
              </Grid>

              <Box sx={{ mt: 2, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">
                    다운로드 링크
                  </Typography>
                  <Tooltip title="5분 동안 사용할 수 있는 다운로드 링크를 생성하고 복사합니다.">
                    <span>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={downloadLinkIssuing ? <CircularProgress size={14} /> : <LinkOutlined fontSize="small" />}
                        disabled={downloadLinkIssuing}
                        onClick={() => void handleIssueDownloadLink()}
                      >
                        링크 생성
                      </Button>
                    </span>
                  </Tooltip>
                </Stack>
                {downloadLinkExpiresAt ? (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    최근 생성 링크 만료: {formatDate(downloadLinkExpiresAt)}
                  </Typography>
                ) : null}
                {downloadLinkUrl ? (
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1 }}>
                    <TextField
                      size="small"
                      value={downloadLinkUrl}
                      InputProps={{ readOnly: true }}
                      fullWidth
                    />
                    <Tooltip title="다운로드 링크 복사">
                      <IconButton size="small" onClick={() => void handleCopyDownloadLink()}>
                        <ContentCopyOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                ) : null}
              </Box>
              {thumbnailAvailable && thumbnailUrl ? (
                <Box sx={{ mt: 2, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      썸네일 프리뷰
                    </Typography>
                    {thumbnailLoading ? <CircularProgress size={14} thickness={4} /> : null}
                  </Stack>
                  <Box
                    component="img"
                    src={thumbnailUrl}
                    alt={file.name}
                    sx={{
                      maxHeight: 180,
                      objectFit: "contain",
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: "divider",
                      opacity: thumbnailLoading ? 0.72 : 1,
                      transition: "opacity 120ms ease",
                    }}
                  />
                </Box>
              ) : thumbnailLoading ? (
                <Box sx={{ mt: 2, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                    썸네일 프리뷰
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{
                      minHeight: 72,
                      color: "text.secondary",
                    }}
                  >
                    <CircularProgress size={18} thickness={4} />
                    <Typography variant="body2">썸네일을 불러오는 중입니다.</Typography>
                  </Stack>
                </Box>
              ) : thumbnailUnavailable ? (
                <Box sx={{ mt: 2, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                    썸네일 프리뷰
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    썸네일을 사용할 수 없습니다.
                  </Typography>
                </Box>
              ) : null}
              {metadataEntries.length > 0 && (
                <Box sx={{ mt: 2, pt: 1, borderTop: "1px solid", borderColor: "divider" }}>
                  <RagMetadataAccordion entries={metadataEntries} />
                </Box>
              )}
            </Paper>

            {/* Card 2: Text Extraction Panel */}
            <Paper id="section-textExtract" variant="outlined" sx={{ p: 2.5, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                텍스트 추출 결과
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                <Typography variant="body2" color="text.secondary">
                  추출 텍스트 관리
                </Typography>
                {!textExtracted ? (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<TextSnippetOutlined fontSize="small" />}
                    disabled={textExtracting}
                    onClick={handleExtractText}
                  >
                    텍스트 추출
                  </Button>
                ) : (
                  <IconButton size="small" onClick={handleCopyExtractedText}>
                    <ContentCopyOutlined fontSize="small" />
                  </IconButton>
                )}
              </Stack>
              {textExtracted ? (
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    maxHeight: 250,
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                    bgcolor: "background.default",
                    p: 1.5,
                    fontFamily: "monospace",
                    fontSize: 12,
                    lineHeight: 1.6,
                  }}
                >
                  {extractedText || "-"}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                  텍스트가 추출되지 않았습니다.
                </Typography>
              )}
            </Paper>

              {/* Card 3: Markdown 지식 파이프라인 Panel */}
              <Paper id="section-pipelineSummary" variant="outlined" sx={{ p: 2.5, mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                  Markdown 지식 파이프라인
                </Typography>
                <Box sx={{ mt: 2 }}>
                  {documentId && (
                    <Box sx={{ mb: 2, p: 2, border: "1px solid", borderColor: "divider", borderRadius: 1.5, bgcolor: "action.hover" }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: 13.5, mb: 1.5, display: "flex", alignItems: "center", gap: 0.5 }}>
                        <TimelineOutlined fontSize="small" color="primary" /> 파이프라인 및 RAG 상태 요약
                      </Typography>
                      <Grid container spacing={1.5}>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="caption" color="text.secondary" display="block">실제 적용 청킹 전략</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 12, color: "primary.main" }}>
                            {strategyLabels[selectedChunkingStrategy || ""] || selectedChunkingStrategy || String((ragMetadata as any)?.chunkingStrategy || "-")}
                          </Typography>
                          {chunkingSelectionReason && (
                            <Typography variant="caption" color="text.secondary">
                              {strategyReasonLabels[chunkingSelectionReason] || chunkingSelectionReason}
                            </Typography>
                          )}
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="caption" color="text.secondary" display="block">최종 embedding 모델</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500, fontSize: 12 }}>
                            {formatEmbeddingModelName(
                              selectedEmbeddingOption?.displayName
                              || selectedEmbeddingOption?.model
                              || selectedEmbeddingOption?.deploymentId
                              || latestRagJob?.embeddingModel
                              || latestRagJob?.embeddingDeploymentId
                              || (ragMetadata as any)?.embeddingModel
                              || (ragMetadata as any)?.embeddingDeploymentId)}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="caption" color="text.secondary" display="block">1. Markdown 생성 상태</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500, fontSize: 12 }}>
                            {markdownStatus === "COMPLETED" ? (
                              <span style={{ color: "#2e7d32" }}>생성 완료</span>
                            ) : markdownStatus === "FAILED" ? (
                              <span style={{ color: "#d32f2f" }}>생성 실패</span>
                            ) : markdownStatus ? (
                              <span style={{ color: "#1976d2" }}>진행 중 ({markdownStatus})</span>
                            ) : (
                              "-"
                            )}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="caption" color="text.secondary" display="block">2. Chunking 상태</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500, fontSize: 12 }}>
                            {latestRagJob ? (
                              latestRagJob.status === "SUCCEEDED" || latestRagJob.currentStep === "EMBEDDING" || latestRagJob.currentStep === "INDEXING" || latestRagJob.currentStep === "COMPLETED" ? (
                                <span style={{ color: "#2e7d32" }}>완료</span>
                              ) : latestRagJob.status === "FAILED" && latestRagJob.currentStep === "CHUNKING" ? (
                                <span style={{ color: "#d32f2f" }}>실패</span>
                              ) : (
                                <span style={{ color: "#1976d2" }}>진행 중</span>
                              )
                            ) : (ragMetadata as any)?.indexed ? (
                              <span style={{ color: "#2e7d32" }}>완료</span>
                            ) : (
                              "-"
                            )}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="caption" color="text.secondary" display="block">3. RAG 색인 상태</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500, fontSize: 12 }}>
                            {(() => {
                              if (latestRagJob) {
                                const status = latestRagJob.status;
                                if (status === "RUNNING" || status === "PENDING") {
                                  return <span style={{ color: "#1976d2", fontWeight: "bold" }}>색인 진행 중</span>;
                                }
                                if (status === "SUCCEEDED") {
                                  return <span style={{ color: "#2e7d32", fontWeight: "bold" }}>색인 완료</span>;
                                }
                                if (status === "FAILED") {
                                  return <span style={{ color: "#d32f2f", fontWeight: "bold" }}>색인 실패</span>;
                                }
                                if (status === "CANCELLED") {
                                  return <span style={{ color: "#757575" }}>색인 취소됨</span>;
                                }
                              }
                              return ragIndexed || (ragMetadata as any)?.indexed ? (
                                <span style={{ color: "#2e7d32", fontWeight: "bold" }}>색인 완료</span>
                              ) : (
                                <span style={{ color: "#d32f2f" }}>색인 미완료</span>
                              );
                            })()}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="caption" color="text.secondary" display="block">4. Skill extraction 상태</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500, fontSize: 12 }}>
                            {latestRagJob ? (
                              latestRagJob.status === "SUCCEEDED" ? (
                                <span style={{ color: "#2e7d32" }}>완료</span>
                              ) : latestRagJob.status === "FAILED" && latestRagJob.currentStep === "EXTRACTING" ? (
                                <span style={{ color: "#d32f2f" }}>실패</span>
                              ) : (
                                "-"
                              )
                            ) : (ragMetadata as any)?.indexed ? (
                              <span style={{ color: "#2e7d32" }}>완료</span>
                            ) : (
                              "-"
                            )}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="caption" color="text.secondary" display="block">총 Chunk 수</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500, fontSize: 12 }}>
                            {effectiveTotalChunkCount != null ? `${effectiveTotalChunkCount}개` : "-"}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="caption" color="text.secondary" display="block">RAG 작업 진행률</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500, fontSize: 12 }}>
                            {latestRagJob && latestRagJob.chunkCount > 0 ? (
                              latestRagJob.status === "RUNNING" ? (
                                latestRagJob.currentStep === "INDEXING"
                                  ? `색인 중: ${latestRagJob.indexedCount}/${latestRagJob.chunkCount} (${Math.floor((latestRagJob.indexedCount / latestRagJob.chunkCount) * 100)}%)`
                                  : `임베딩 중: ${latestRagJob.embeddedCount}/${latestRagJob.chunkCount} (${Math.floor((latestRagJob.embeddedCount / latestRagJob.chunkCount) * 100)}%)`
                              ) : latestRagJob.status === "SUCCEEDED" ? (
                                `완료 (${latestRagJob.chunkCount}개)`
                              ) : (
                                `${latestRagJob.status} (${latestRagJob.currentStep})`
                              )
                            ) : (ragMetadata as any)?.indexed ? (
                              "100% 완료"
                            ) : (
                              "-"
                            )}
                          </Typography>
                        </Grid>
                      </Grid>

                      {/* IdeaBlock Summary & Evaluation Dashboard removed per chunking simplification */}

                      {markdownStatus === "COMPLETED" && (
                        <Box sx={{ mt: 2, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
                          <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            startIcon={<VisibilityOutlined />}
                            onClick={() => {
                              setSelectedViewerRevisionId(undefined);
                              setMarkdownViewerOpen(true);
                            }}
                          >
                            Markdown 보기
                          </Button>
                        </Box>
                      )}
                    </Box>
                  )}
                  {/* Pipeline Step Checklist */}
                  <Box id="section-pipelineConfig" sx={{ mt: 1 }}>
                    <Typography variant="body2" color="text.secondary" display="block" sx={{ mb: 1, fontWeight: 700, fontSize: 13.5 }}>
                      지식 파이프라인 설정
                    </Typography>

                    {/* 프로필 선택 dropdown */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                        문서 처리 프로필
                      </Typography>
                      <Select
                        size="small"
                        fullWidth
                        value={documentProfile}
                        onChange={(e) => handleProfileChange(e.target.value)}
                        disabled={controlsDisabled || isCanceledRevision}
                        renderValue={(selected) => {
                          const selectedProfile = profiles.find((profile) => profile.id === selected);
                          return selectedProfile
                            ? `${documentProfileLabel(selectedProfile)} (${selectedProfile.id})`
                            : String(selected);
                        }}
                      >
                        <MenuItem value="AUTO" sx={{ py: 1 }}>
                          <Stack spacing={0.25}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              서버 권장 프로필 (AUTO)
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "normal" }}>
                              파일 형식과 구조에 따라 서버가 처리 프로필을 결정합니다.
                            </Typography>
                          </Stack>
                        </MenuItem>
                        {profiles.filter(p => p.id !== "AUTO").map((p) => (
                          <MenuItem key={p.id} value={p.id} sx={{ py: 1 }}>
                            <Stack spacing={0.25}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {documentProfileLabel(p)} ({p.id})
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "normal" }}>
                                {documentProfileDescription(p)}
                              </Typography>
                              <Typography variant="caption" color="primary.main" sx={{ whiteSpace: "normal" }}>
                                {documentProfileSettings(p)}
                              </Typography>
                            </Stack>
                          </MenuItem>
                        ))}
                      </Select>

                      {/* 프로필 정보 카드 */}
                      {(() => {
                        const selectedProfileObj = profiles.find(p => p.id === documentProfile);
                        if (!selectedProfileObj || selectedProfileObj.id === "AUTO") return null;
                        return (
                          <Box sx={{ mt: 1.5, p: 2, border: "1px solid", borderColor: "divider", borderRadius: 1.5, bgcolor: "action.hover" }}>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: 13 }}>
                                {selectedProfileObj.displayName}
                              </Typography>
                              <Chip
                                label={selectedProfileObj.costTier}
                                size="small"
                                color={
                                  selectedProfileObj.costTier === "HIGH" ? "error" :
                                  selectedProfileObj.costTier === "MEDIUM" ? "warning" : "success"
                                }
                                sx={{ height: 18, fontSize: 9, fontWeight: 700 }}
                              />
                            </Stack>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12, mb: 1 }}>
                              {documentProfileDescription(selectedProfileObj)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 10 }}>
                              지원 파일 형식: {selectedProfileObj.supportedFormats.join(", ")}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 10 }}>
                              {documentProfileSettings(selectedProfileObj)}
                            </Typography>
                          </Box>
                        );
                      })()}
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                        문서 의미 유형
                      </Typography>
                      <Select
                        size="small"
                        fullWidth
                        value={documentSemanticType}
                        onChange={(event) =>
                          setDocumentSemanticType(event.target.value as DocumentSemanticTypeSelection)
                        }
                        disabled={controlsDisabled || isCanceledRevision}
                      >
                        <MenuItem value="AUTO">
                          <Stack>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>자동 감지 (AUTO)</Typography>
                            <Typography variant="caption" color="text.secondary">
                              감지 결과를 BOOK, REPORT 같은 의미 유형으로 저장합니다. 처리 프로필과 청킹 방식은 바꾸지 않습니다.
                            </Typography>
                          </Stack>
                        </MenuItem>
                        {metadataSchemas.map((schema) => (
                          <MenuItem key={schema.semanticType} value={schema.semanticType} sx={{ py: 1 }}>
                            <Stack spacing={0.25}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {schema.displayName} ({schema.semanticType})
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "normal" }}>
                                {schema.description}
                              </Typography>
                              <Typography variant="caption" color="primary.main" sx={{ whiteSpace: "normal" }}>
                                {schema.fields
                                  .filter((field) => field.required || field.recommended)
                                  .map((field) => field.label)
                                  .join(", ")}
                              </Typography>
                            </Stack>
                          </MenuItem>
                        ))}
                      </Select>
                      <FormControlLabel
                        sx={{ mt: 1 }}
                        control={
                          <Select
                            size="small"
                            value={metadataEnrichmentMode}
                            onChange={(event) =>
                              setMetadataEnrichmentMode(event.target.value as MetadataEnrichmentMode)
                            }
                            disabled={controlsDisabled || isCanceledRevision}
                            sx={{ minWidth: 140 }}
                          >
                            <MenuItem value="OFF">규칙만 사용</MenuItem>
                            <MenuItem value="AUTO">필요 시 AI 보강</MenuItem>
                            <MenuItem value="REQUIRED">AI 보강 필수</MenuItem>
                          </Select>
                        }
                        label={<Typography variant="caption">메타데이터 보강 방식</Typography>}
                      />
                      {documentMetadata ? (
                        <Box sx={{ mt: 1.5, p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <Chip
                              size="small"
                              label={documentMetadata.classification.effectiveSemanticType ?? "UNKNOWN"}
                            />
                            <Chip size="small" variant="outlined" label={documentMetadata.quality} />
                          </Stack>
                          {Object.entries(documentMetadata.fields).map(([fieldId, field]) => (
                            <Box key={fieldId} sx={{ mb: 0.75 }}>
                              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                {metadataSchemas
                                  .flatMap((schema) => schema.fields)
                                  .find((descriptor) => descriptor.fieldId === fieldId)?.label ?? fieldId}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {(field.normalizedValues ?? field.rawValues ?? []).join(", ")}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      ) : null}
                    </Box>

                    {/* 실행 범위 체크박스들 */}
                    <Grid container spacing={1} sx={{ mb: 2, bgcolor: "action.hover", p: 1.5, borderRadius: 1.5 }}>
                      <Grid size={{ xs: 6 }}>
                        <FormControlLabel
                          control={<Checkbox size="small" checked disabled />}
                          label={<Typography variant="body2" sx={{ fontSize: 13 }}>Markdown 생성 (필수)</Typography>}
                        />
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              checked={runChunking}
                              onChange={(e) => handleRunChunkingChange(e.target.checked)}
                              disabled={controlsDisabled || isCanceledRevision}
                            />
                          }
                          label={<Typography variant="body2" sx={{ fontSize: 13 }}>Chunking 분할</Typography>}
                        />
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              checked={runRagIndex}
                              onChange={(e) => handleRunRagIndexChange(e.target.checked)}
                              disabled={controlsDisabled || isCanceledRevision}
                            />
                          }
                          label={<Typography variant="body2" sx={{ fontSize: 13 }}>RAG 색인</Typography>}
                        />
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              checked={runSkillExtraction}
                              onChange={(e) => handleRunSkillExtractionChange(e.target.checked)}
                              disabled={controlsDisabled || isCanceledRevision}
                            />
                          }
                          label={<Typography variant="body2" sx={{ fontSize: 13 }}>Skill 추출</Typography>}
                        />
                      </Grid>
                    </Grid>

                    {runRagIndex && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 0.75, fontWeight: 700, fontSize: 13.5 }}>
                          RAG 검색 모델 <Box component="span" sx={{ color: "error.main" }}>*</Box>
                        </Typography>
                        {embeddingOptions.length > 0 ? (
                          <TextField
                            select
                            label="임베딩 모델 선택"
                            size="small"
                            fullWidth
                            required
                            value={selectedEmbeddingOption ? embeddingOptionKey(selectedEmbeddingOption) : ""}
                            onChange={(e) => {
                              const matched = embeddingOptions.find((o) => embeddingOptionKey(o) === e.target.value);
                              setSelectedEmbeddingOption(matched ?? null);
                            }}
                            disabled={controlsDisabled || isCanceledRevision}
                            error={!selectedEmbeddingOption}
                            helperText={
                              selectedEmbeddingOption
                                ? `${selectedEmbeddingOption.provider} · ${selectedEmbeddingOption.model} · dimension ${selectedEmbeddingOption.dimension ?? "-"}`
                                : "색인과 검색 질의에 동일하게 사용할 모델을 명시적으로 선택하세요."
                            }
                          >
                            <MenuItem value="" disabled>임베딩 모델을 선택하세요</MenuItem>
                            {embeddingOptions.map((opt) => (
                              <MenuItem key={embeddingOptionKey(opt)} value={embeddingOptionKey(opt)}>
                                {embeddingOptionLabel(opt)}
                              </MenuItem>
                            ))}
                          </TextField>
                        ) : (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <CircularProgress size={14} />
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
                              임베딩 모델을 불러오는 중입니다.
                            </Typography>
                          </Stack>
                        )}
                        {selectedEmbeddingOption && (
                          <Alert severity="info" icon={false} sx={{ mt: 1, py: 0.25, px: 1.25 }}>
                            <Typography variant="caption">
                              선택한 모델은 이 문서의 벡터 색인 기준이 됩니다. 모델을 변경하면 전체 재색인이 필요합니다.
                            </Typography>
                          </Alert>
                        )}
                      </Box>
                    )}

                    {/* 접힌 고급 설정 영역 Accordion */}
                    <Accordion disableGutters variant="outlined" sx={{ mt: 2, borderRadius: 1.5, overflow: "hidden" }}>
                      <AccordionSummary expandIcon={<ExpandMoreOutlined fontSize="small" />}>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13 }}>고급 설정 (수동 지정)</Typography>
                      </AccordionSummary>
                      <AccordionDetails sx={{ pt: 1, pb: 2, px: 2 }}>
                        
                        {/* 강제 추출 (force) 및 OCR Toggle */}
                        <Stack direction="column" spacing={2} sx={{ mb: 2 }}>
                          <Stack direction="row" spacing={2} alignItems="center">
                            <Tooltip title="이전에 변환 완료된 결과나 캐시가 있더라도 무시하고 처음부터 다시 변환 및 색인을 수행합니다." arrow placement="top-start">
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    size="small"
                                    checked={force}
                                    onChange={(e) => setForce(e.target.checked)}
                                    disabled={controlsDisabled || isCanceledRevision}
                                  />
                                }
                                label={
                                  <Typography variant="body2" sx={{ fontSize: 13, borderBottom: "1px dashed", borderColor: "text.secondary", cursor: "help" }}>
                                    강제 재추출 (force)
                                  </Typography>
                                }
                              />
                            </Tooltip>
                          </Stack>

                          {isPdf && (
                            <Grid container spacing={2}>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontWeight: 600 }}>
                                  OCR 지정
                                </Typography>
                                <Select
                                  size="small"
                                  fullWidth
                                  value={ocrOverride === null ? "null" : String(ocrOverride)}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setOcrOverride(val === "null" ? null : val === "true");
                                  }}
                                  disabled={controlsDisabled || isCanceledRevision}
                                >
                                  <MenuItem value="null">기본 프로필 설정 사용</MenuItem>
                                  <MenuItem value="true">강제 사용 (FORCE)</MenuItem>
                                  <MenuItem value="false">사용 안 함 (DISABLED)</MenuItem>
                                </Select>
                              </Grid>

                              <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontWeight: 600 }}>
                                  수식 Vision 보정
                                </Typography>
                                <Select
                                  size="small"
                                  fullWidth
                                  value={mathVisionCorrectionOverride === null ? "null" : String(mathVisionCorrectionOverride)}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setMathVisionCorrectionOverride(val === "null" ? null : val === "true");
                                  }}
                                  disabled={controlsDisabled || isCanceledRevision}
                                >
                                  <MenuItem value="null">기본 프로필 설정 사용</MenuItem>
                                  <MenuItem value="true">사용</MenuItem>
                                  <MenuItem value="false">사용 안 함</MenuItem>
                                </Select>
                              </Grid>

                              {ocrMode === "FORCE" && (
                                <Grid size={{ xs: 12 }}>
                                  <TextField
                                    size="small"
                                    fullWidth
                                    label="OCR 언어 지정"
                                    placeholder={processingPlan?.effectiveOptions?.ocrLanguage || "kor+eng"}
                                    value={ocrLanguageOverride ?? ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setOcrLanguageOverride(val === "" ? null : val);
                                    }}
                                    disabled={controlsDisabled || isCanceledRevision}
                                    helperText="OCR용 언어 코드를 직접 지정할 때 입력하세요. (예: kor, eng, kor+eng)"
                                    FormHelperTextProps={{ sx: { m: 0, mt: 0.5, fontSize: 10 } }}
                                  />
                                </Grid>
                              )}
                            </Grid>
                          )}
                        </Stack>

                        <Divider sx={{ my: 1.5 }} />

                        {/* Chunking 설정 수동 지정 */}
                        {runChunking && (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, fontSize: 13 }}>
                              Chunking 설정 지정
                            </Typography>
                            <Grid container spacing={2}>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontWeight: 600 }}>
                                  청킹 전략
                                </Typography>
                                <Select
                                  size="small"
                                  fullWidth
                                  value={chunkingStrategyOverride ?? ""}
                                  onChange={(e) => setChunkingStrategyOverride(e.target.value === "" ? null : e.target.value)}
                                  disabled={controlsDisabled || isCanceledRevision}
                                >
                                  <MenuItem value="">
                                    {documentProfile === "AUTO" ? "자동 선택" : "문서 종류 기본값 사용"}
                                  </MenuItem>
                                  {availableStrategies.map((s) => (
                                    <MenuItem key={s} value={s}>{strategyLabels[s] || s}</MenuItem>
                                  ))}
                                </Select>
                              </Grid>

                              <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontWeight: 600 }}>
                                  청킹 단위
                                </Typography>
                                <Select
                                  size="small"
                                  fullWidth
                                  value={chunkUnitOverride ?? ""}
                                  onChange={(e) => setChunkUnitOverride(e.target.value === "" ? null : e.target.value)}
                                  disabled={controlsDisabled || isCanceledRevision}
                                >
                                  <MenuItem value="">기본 프로필 설정 사용</MenuItem>
                                  <MenuItem value="CHARACTER">CHARACTER</MenuItem>
                                  <MenuItem value="TOKEN">TOKEN</MenuItem>
                                </Select>
                              </Grid>

                              <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontWeight: 600 }}>
                                  최대 청크 크기
                                </Typography>
                                <TextField
                                  size="small"
                                  type="number"
                                  fullWidth
                                  value={chunkMaxSizeOverride ?? ""}
                                  placeholder={processingPlan?.effectiveOptions?.chunkMaxSize ? String(processingPlan.effectiveOptions.chunkMaxSize) : "기본값"}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setChunkMaxSizeOverride(val === "" ? null : Number(val));
                                  }}
                                  disabled={controlsDisabled || isCanceledRevision}
                                />
                              </Grid>

                              <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontWeight: 600 }}>
                                  중첩 크기 (Overlap)
                                </Typography>
                                <TextField
                                  size="small"
                                  type="number"
                                  fullWidth
                                  value={chunkOverlapOverride ?? ""}
                                  placeholder={processingPlan?.effectiveOptions?.chunkOverlap ? String(processingPlan.effectiveOptions.chunkOverlap) : "기본값"}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setChunkOverlapOverride(val === "" ? null : Number(val));
                                  }}
                                  disabled={controlsDisabled || isCanceledRevision}
                                />
                              </Grid>

                              {chunkingStrategy === "blockify" && (
                                <>
                                  <Grid size={{ xs: 12 }}>
                                    <Alert severity="info" sx={{ fontSize: 11, py: 0.5 }}>
                                      Blockify는 질문·답변 형태의 IdeaBlock을 생성합니다.
                                    </Alert>
                                  </Grid>
                                  <Grid size={{ xs: 12, sm: 6 }}>
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontWeight: 600 }}>
                                      Blockify LLM Provider
                                    </Typography>
                                    <Select
                                      size="small"
                                      fullWidth
                                      value={blockifyLlmProvider}
                                      onChange={(e) => {
                                        const prov = e.target.value;
                                        setBlockifyLlmProvider(prov);
                                        const match = aiInfo?.providers.find((p) => p.name === prov);
                                        if (match?.chat?.model) {
                                          setBlockifyLlmModel(match.chat.model);
                                        }
                                      }}
                                      disabled={controlsDisabled || isCanceledRevision}
                                    >
                                      <MenuItem value="">(서버 기본값)</MenuItem>
                                      {aiInfo?.providers.map((p) => (
                                        <MenuItem key={p.name} value={p.name}>{p.name}</MenuItem>
                                      ))}
                                    </Select>
                                  </Grid>
                                  <Grid size={{ xs: 12, sm: 6 }}>
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontWeight: 600 }}>
                                      Blockify LLM Model
                                    </Typography>
                                    <Select
                                      size="small"
                                      fullWidth
                                      value={blockifyLlmModel}
                                      onChange={(e) => setBlockifyLlmModel(e.target.value)}
                                      disabled={controlsDisabled || isCanceledRevision || !blockifyLlmProvider}
                                    >
                                      <MenuItem value="">(서버 기본값)</MenuItem>
                                      {(() => {
                                        const selectedProv = aiInfo?.providers.find((p) => p.name === blockifyLlmProvider);
                                        if (!selectedProv) return null;
                                        return (
                                          <MenuItem value={selectedProv.chat.model}>{selectedProv.chat.model}</MenuItem>
                                        );
                                      })()}
                                    </Select>
                                  </Grid>
                                  <Grid size={{ xs: 12 }}>
                                    <FormControlLabel
                                      control={
                                        <Switch
                                          size="small"
                                          checked={blockifyPiiMaskingEnabled}
                                          onChange={(e) => setBlockifyPiiMaskingEnabled(e.target.checked)}
                                          disabled={controlsDisabled || isCanceledRevision}
                                        />
                                      }
                                      label={<Typography variant="body2" sx={{ fontSize: 13 }}>개인정보 마스킹 활성화</Typography>}
                                    />
                                  </Grid>
                                </>
                              )}
                            </Grid>
                          </Box>
                        )}

                        <Divider sx={{ my: 1.5 }} />

                        {/* Skill 추출 설정 */}
                        {runSkillExtraction && (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, fontSize: 13 }}>
                              Skill 추출 설정
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                              스킬 후보 추출 방식
                            </Typography>
                            <Select
                              size="small"
                              fullWidth
                              value={skillExtractionMode}
                              onChange={(e) => setSkillExtractionMode(e.target.value as any)}
                              disabled={controlsDisabled || isCanceledRevision}
                            >
                              <MenuItem value="">서버 기본값 사용</MenuItem>
                              <MenuItem value="regex">규칙 기반 추출 (regex)</MenuItem>
                              <MenuItem value="llm">LLM 기반 추출 (llm)</MenuItem>
                            </Select>
                          </Box>
                        )}

                        {/* 적용 예정 옵션 미리보기 (Processing Plan) */}
                        {processingPlan && (
                          <Box sx={{ mt: 3, p: 2, border: "1px dashed", borderColor: "primary.main", borderRadius: 1.5, bgcolor: "action.hover" }}>
                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700, fontSize: 12.5, color: "primary.main" }}>
                              ⚙️ 최종 적용 예정 옵션 미리보기 (Processing Plan)
                            </Typography>
                            <Grid container spacing={1}>
                              <Grid size={{ xs: 6 }}>
                                <Typography variant="caption" color="text.secondary" display="block">분석 프로필</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 11.5 }}>
                                  {processingPlan.resolvedDocumentProfile || "-"}
                                </Typography>
                              </Grid>
                              <Grid size={{ xs: 6 }}>
                                <Typography variant="caption" color="text.secondary" display="block">비용 등급</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 11.5 }}>
                                  {processingPlan.costTier || "-"}
                                </Typography>
                              </Grid>
                              <Grid size={{ xs: 6 }}>
                                <Typography variant="caption" color="text.secondary" display="block">청킹 전략</Typography>
                                <Typography variant="body2" sx={{ fontSize: 11.5 }}>
                                  {strategyLabels[processingPlan.effectiveOptions?.chunkingStrategy || "auto"] || "자동 선택"}
                                </Typography>
                              </Grid>
                              <Grid size={{ xs: 6 }}>
                                <Typography variant="caption" color="text.secondary" display="block">청킹 크기/중첩/단위</Typography>
                                <Typography variant="body2" sx={{ fontSize: 11.5 }}>
                                  {processingPlan.effectiveOptions?.chunkMaxSize || "-"} / {processingPlan.effectiveOptions?.chunkOverlap || "-"} / {processingPlan.effectiveOptions?.chunkUnit || "-"}
                                </Typography>
                              </Grid>
                              <Grid size={{ xs: 6 }}>
                                <Typography variant="caption" color="text.secondary" display="block">OCR 여부/모드/언어</Typography>
                                <Typography variant="body2" sx={{ fontSize: 11.5 }}>
                                  {processingPlan.effectiveOptions?.ocrRequired ? "사용" : "사용 안 함"} ({processingPlan.effectiveOptions?.ocrMode || "-"}) / {processingPlan.effectiveOptions?.ocrLanguage || "-"}
                                </Typography>
                              </Grid>
                              <Grid size={{ xs: 6 }}>
                                <Typography variant="caption" color="text.secondary" display="block">수식 Vision 보정</Typography>
                                <Typography variant="body2" sx={{ fontSize: 11.5 }}>
                                  {processingPlan.effectiveOptions?.mathVisionCorrection ? "활성화" : "비활성화"}
                                </Typography>
                              </Grid>
                            </Grid>
                          </Box>
                        )}
                      </AccordionDetails>
                    </Accordion>

                    <Box sx={{ mt: 2, mb: 2, pt: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13.5 }}>
                          예상 처리량
                        </Typography>
                        {pipelineEstimateLoading ? (
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <CircularProgress size={13} />
                            <Typography variant="caption" color="text.secondary">자동 계산 중</Typography>
                          </Stack>
                        ) : pipelineEstimate ? (
                          <Chip
                            size="small"
                            label={`위험도 ${pipelineEstimate.riskLevel}`}
                            color={
                              pipelineEstimate.riskLevel === "VERY_HIGH" || pipelineEstimate.riskLevel === "HIGH"
                                ? "error"
                                : pipelineEstimate.riskLevel === "MEDIUM" ? "warning" : "success"
                            }
                            sx={{ height: 22, fontSize: 10 }}
                          />
                        ) : null}
                      </Stack>

                      {pipelineEstimateError ? (
                        <Alert severity="warning" sx={{ py: 0.25 }}>
                          예상 처리량을 계산하지 못했습니다. 현재 설정으로 실행할 수는 있습니다.
                        </Alert>
                      ) : pipelineEstimate ? (
                        <>
                          <Grid container spacing={1.25}>
                            <Grid size={{ xs: 4 }}>
                              <Typography variant="caption" color="text.secondary" display="block">예상 청크</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>{pipelineEstimate.estimatedChunkCount ?? 0}개</Typography>
                            </Grid>
                            <Grid size={{ xs: 4 }}>
                              <Typography variant="caption" color="text.secondary" display="block">임베딩 요청</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>{runRagIndex ? `${pipelineEstimate.estimatedEmbeddingRequests ?? 0}회` : "사용 안 함"}</Typography>
                            </Grid>
                            <Grid size={{ xs: 4 }}>
                              <Typography variant="caption" color="text.secondary" display="block">계산 기준</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {pipelineEstimate.estimateBasis === "REVISION_CONTENT" ? "실제 Markdown" : "원본 크기 (예비)"}
                              </Typography>
                            </Grid>
                          </Grid>
                          {pipelineEstimate.estimateBasis !== "REVISION_CONTENT" && (
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                              Markdown 생성 후 실제 내용 기준으로 다시 자동 계산됩니다.
                            </Typography>
                          )}
                          {hasEstimatedChunkingRecommendation && pipelineEstimate.recommended && (() => {
                            const isElevatedRisk = pipelineEstimate.riskLevel === "HIGH" || pipelineEstimate.riskLevel === "VERY_HIGH" || pipelineEstimate.riskLevel === "MEDIUM";
                            const isCriticalRisk = pipelineEstimate.riskLevel === "HIGH" || pipelineEstimate.riskLevel === "VERY_HIGH";

                            return (
                              <Box
                                sx={{
                                  mt: 1.5,
                                  p: 1.5,
                                  borderRadius: 1.5,
                                  bgcolor: isElevatedRisk ? (isCriticalRisk ? "error.50" : "warning.50") : "action.hover",
                                  border: "1px solid",
                                  borderColor: isElevatedRisk ? (isCriticalRisk ? "error.main" : "warning.main") : "divider",
                                  transition: "all 150ms ease",
                                }}
                              >
                                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5}>
                                  <Box sx={{ minWidth: 0 }}>
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        fontWeight: isElevatedRisk ? 700 : 600,
                                        color: isElevatedRisk ? (isCriticalRisk ? "error.main" : "warning.dark") : "text.primary",
                                        display: "block",
                                        mb: 0.25,
                                      }}
                                    >
                                      {isElevatedRisk ? "⚠️ 처리 부하 감지: 권장 설정을 적용하여 파이프라인을 최적화하세요." : "권장 파이프라인 설정"}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                                      청킹: {strategyLabels[pipelineEstimate.recommended.chunkingStrategy || "auto"] || "자동 선택"} · 크기 {pipelineEstimate.recommended.chunkMaxSize ?? "기본"} / 중첩 {pipelineEstimate.recommended.chunkOverlap ?? "기본"} / 단위 {pipelineEstimate.recommended.chunkUnit ?? "기본"}
                                    </Typography>
                                  </Box>
                                  <Button
                                    size="small"
                                    variant={isElevatedRisk ? "contained" : "outlined"}
                                    color={isCriticalRisk ? "error" : isElevatedRisk ? "warning" : "primary"}
                                    startIcon={<AutoFixHighOutlined fontSize="small" />}
                                    onClick={applyEstimatedChunkingRecommendation}
                                    sx={{
                                      fontWeight: 700,
                                      fontSize: 12,
                                      whiteSpace: "nowrap",
                                      boxShadow: isElevatedRisk ? 2 : 0,
                                      py: 0.6,
                                      px: 1.5,
                                      borderRadius: 1.25,
                                      flexShrink: 0,
                                    }}
                                  >
                                    권장 설정 적용
                                  </Button>
                                </Stack>
                              </Box>
                            );
                          })()}
                        </>
                      ) : null}
                    </Box>

                  {/* Actions Trigger Panel */}
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {markdownStatus ? (
                        <Chip
                          label={`Markdown: ${isCanceledRevision ? "취소됨" : markdownStatus}`}
                          size="small"
                          color={
                            isCanceledRevision ? "default" :
                            markdownStatus === "COMPLETED" ? "success" :
                            (markdownStatus === "RUNNING" || markdownStatus === "PENDING") ? "primary" :
                            markdownStatus === "FAILED" ? "error" : "default"
                          }
                          sx={{ height: 24, fontWeight: 500 }}
                        />
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          파이프라인 이력이 없습니다.
                        </Typography>
                      )}
                      {reused && markdownStatus === "COMPLETED" && (
                        <Chip label="기존 변환 결과 사용" color="info" size="small" variant="outlined" sx={{ height: 24 }} />
                      )}
                    </Box>

                    {!documentId ? (
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="contained"
                          disabled={controlsDisabled || (runRagIndex && !selectedEmbeddingOption)}
                          onClick={handleExtractMarkdown}
                        >
                          {runChunking || runRagIndex || runSkillExtraction ? "지식 파이프라인 생성" : "Markdown 생성"}
                        </Button>
                      </Stack>
                    ) : (
                      <Stack spacing={1.5} width="100%" sx={{ mt: 1 }}>
                        {isCanceledRevision ? (
                          <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, fontSize: 13 }}>
                              Markdown 생성 취소됨
                            </Typography>
                            <Button
                              size="small"
                              variant="contained"
                              color="primary"
                              disabled={controlsDisabled}
                              onClick={handleRecreateMarkdownFromCanceled}
                            >
                              Markdown 다시 생성
                            </Button>
                          </Box>
                        ) : (
                          <>
                            <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, fontSize: 13 }}>
                                신규 재추출 (Reextract)
                              </Typography>
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="warning"
                                  disabled={controlsDisabled || (runRagIndex && !selectedEmbeddingOption)}
                                  onClick={handleReextractMarkdown}
                                >
                                  새로 재추출 실행
                                </Button>
                                {isPdf && showOcrReextract && (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="secondary"
                                    disabled={controlsDisabled || (runRagIndex && !selectedEmbeddingOption)}
                                    onClick={() => void handleReextractWithOcr(false)}
                                  >
                                    OCR 적용 후 재추출
                                  </Button>
                                )}
                                {isPdf && showMathReextract && (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="info"
                                    disabled={controlsDisabled || (runRagIndex && !selectedEmbeddingOption)}
                                    onClick={() => void handleReextractWithOcr(true)}
                                  >
                                    수식 OCR 적용 후 재추출
                                  </Button>
                                )}
                              </Stack>
                            </Box>

                            <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, fontSize: 13 }}>
                                작업 재개 (Resume)
                              </Typography>
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  disabled={controlsDisabled || markdownStatus !== "COMPLETED" || pipelineExecution?.status === "COMPLETED"}
                                  onClick={() => void handleResume(null)}
                                >
                                  이어서 진행
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  disabled={controlsDisabled || markdownStatus !== "COMPLETED"}
                                  onClick={() => void handleResume("CHUNKING")}
                                >
                                  청킹부터 재실행
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  disabled={controlsDisabled || markdownStatus !== "COMPLETED" || !selectedEmbeddingOption}
                                  onClick={handleReindexRag}
                                >
                                  RAG 색인부터 재실행
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  disabled={controlsDisabled || markdownStatus !== "COMPLETED"}
                                  onClick={() => void handleResume("SKILL_EXTRACTION")}
                                >
                                  Skill 추출부터 재실행
                                </Button>
                              </Stack>
                            </Box>
                          </>
                        )}
                      </Stack>
                    )}
                  </Stack>


                  {renderPipelineStatusDashboard()}

                  {isPendingOrRunning && (
                    <Box sx={{ mt: 1.5, mb: 1.5, bgcolor: "action.hover", p: 1.5, borderRadius: 1.5, border: "1px dashed", borderColor: "primary.main" }}>
                      <Stack direction="row" spacing={1.5} alignItems="center" width="100%">
                        <CircularProgress size={16} />
                        <Typography variant="caption" color="text.secondary">
                          {(() => {
                            if (latestRevision) {
                              if (latestRevision.status === "RUNNING" || latestRevision.status === "PENDING") {
                                return "추출/Markdown 생성 중";
                              }
                              if (latestRevision.status === "FAILED") {
                                return `실패: ${latestRevision.errorCode || "Markdown 생성 실패"}`;
                              }
                              if (latestRevision.status === "COMPLETED") {
                                if (pipelineProgress) {
                                  const pipeline = pipelineProgress;
                                  const rag = pipeline.rag;
                                  if (pipeline.status === "RUNNING" && pipeline.currentStage === "CHUNKING") return "청킹 중";
                                  if (pipeline.status === "RUNNING" && pipeline.currentStage === "RAG_INDEX") {
                                    if (rag?.currentStep === "EMBEDDING") {
                                      return `임베딩 중 ${rag.embeddedCount ?? 0} / ${rag.chunkCount ?? 0}`;
                                    } else if (rag?.currentStep === "INDEXING") {
                                      return `벡터 저장 중 ${rag.indexedCount ?? 0} / ${rag.chunkCount ?? 0}`;
                                    }
                                  }
                                  if (pipeline.status === "FAILED") return `실패: ${pipeline.errorCode}`;
                                }
                                if (latestRagJob?.status === "RUNNING" || latestRagJob?.status === "PENDING") {
                                  return `RAG 색인 진행 중... (${latestRagJob.currentStep})`;
                                }
                                const normalizedRes = findNormalizedDocumentResource(resources);
                                if (normalizedRes) {
                                  let meta = normalizedRes.metadataJson;
                                  if (typeof meta === "string") {
                                    try { meta = JSON.parse(meta); } catch { meta = null; }
                                  }
                                  const status = meta?.normalizationStatus;
                                  return status === "REVIEW_REQUIRED" ? "정규화 검토 필요" : "정규화 완료";
                                }
                                return "정규화 정보 없음";
                              }
                            }
                            if (pipelineProgress?.status === "FAILED") return `실패: ${pipelineProgress.errorCode}`;
                            return "Markdown 지식 파이프라인 진행 중...";
                          })()}
                        </Typography>
                        {(latestRagJob?.status === "RUNNING" || latestRagJob?.status === "PENDING") && (
                          <Button
                            size="small"
                            color="error"
                            variant="text"
                            sx={{ minWidth: 0, p: 0, ml: "auto", fontSize: 11 }}
                            onClick={() => void handleCancelRagJob(latestRagJob.jobId)}
                          >
                            색인 취소
                          </Button>
                        )}
                        {(markdownStatus === "RUNNING" || markdownStatus === "PENDING") && (
                          <Button
                            size="small"
                            color="error"
                            variant="text"
                            sx={{ minWidth: 0, p: 0, ml: "auto", fontSize: 11 }}
                            disabled={isCanceling}
                            onClick={handleCancelMarkdown}
                          >
                            {isCanceling ? "취소 중..." : "변환 취소"}
                          </Button>
                        )}
                      </Stack>
                    </Box>
                  )}

                  {(() => {
                    const isFailedState = markdownStatus === "FAILED" || pipelineExecution?.status === "FAILED" || pipelineProgress?.status === "FAILED";
                    if (!isFailedState) return null;

                    const errCode = pipelineProgress?.errorCode || pipelineExecution?.errorCode || latestRevision?.errorCode || "-";
                    const errMessage = pipelineProgress?.errorMessage || pipelineExecution?.errorMessage || latestRevision?.errorMessage || markdownError || "-";
                    const ragErrMessage = (pipelineProgress?.rag as any)?.errorMessage || latestRagJob?.errorMessage;

                    let stageStr = "";
                    let stepStr = "";
                    const stage = (pipelineProgress?.currentStage || pipelineExecution?.currentStage || (markdownStatus === "FAILED" ? "MARKDOWN" : "")) as string;
                    if (stage === "EXTRACT") stageStr = "본문 추출";
                    else if (stage === "MARKDOWN") stageStr = "Markdown 구조화";
                    else if (stage === "CHUNKING") stageStr = "분할 (Chunking)";
                    else if (stage === "RAG_INDEX") stageStr = "RAG 색인";
                    else if (stage === "SKILL_EXTRACTION") stageStr = "지식 추출 (Skill)";

                    const step = pipelineProgress?.rag?.currentStep || latestRagJob?.currentStep;
                    if (step === "EMBEDDING") stepStr = "임베딩";
                    else if (step === "INDEXING") stepStr = "벡터 저장";

                    const stageStepLabel = stageStr && stepStr ? `${stageStr} > ${stepStr}` : (stageStr || "-");
                    const isSameError = errMessage && lastFailedMessage && errMessage === lastFailedMessage;

                    return (
                      <Box sx={{ mt: 1.5, mb: 1.5, bgcolor: "error.light", color: "error.contrastText", p: 1.5, borderRadius: 1.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1, fontSize: 14 }}>
                          지식 파이프라인 실행 실패
                        </Typography>
                        <Stack spacing={0.5} sx={{ fontSize: 12, mb: 1.5 }}>
                          <Box><strong>단계:</strong> {stageStepLabel}</Box>
                          <Box><strong>원인:</strong> {errCode} ({sanitizeErrorMessage(errMessage)})</Box>
                          {ragErrMessage && (
                            <Box><strong>상세 (RAG):</strong> {sanitizeErrorMessage(ragErrMessage)}</Box>
                          )}
                        </Stack>
                        {isSameError && (
                          <Alert severity="warning" sx={{ mt: 1, mb: 1.5, color: "warning.dark", py: 0.5, px: 1 }}>
                            이전 실행과 동일한 오류가 발생했습니다.
                          </Alert>
                        )}
                        <Stack direction="row" spacing={1.5}>
                          <Button
                            size="small"
                            variant="contained"
                            color="warning"
                            sx={{ textTransform: "none", fontSize: 11 }}
                            onClick={() => {
                              const failedStage = pipelineProgress?.currentStage || pipelineExecution?.currentStage;
                              void handleResume(failedStage || null);
                            }}
                          >
                            실패 단계부터 재개
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="inherit"
                            sx={{ textTransform: "none", fontSize: 11 }}
                            disabled={!selectedEmbeddingOption}
                            onClick={handleReindexRag}
                          >
                            RAG 다시 실행
                          </Button>
                        </Stack>
                      </Box>
                    );
                  })()}
                  </Box>
                </Box>
              </Paper>
            </Container>
          </Stack>

        {/* 2. TOC contents aside panel */}
        <Box
          component="aside"
          sx={{
            display: { xs: "none", lg: "block" },
            position: "sticky",
            top: 16,
            alignSelf: "start",
            borderLeft: "1px solid",
            borderColor: "divider",
            pl: 2,
            py: 1,
          }}
        >
          <Typography variant="subtitle2" color="text.primary" fontWeight={700} sx={{ mb: 2, letterSpacing: 0.5 }}>
            Contents
          </Typography>
          <Stack spacing={0.75} sx={{ mt: 1 }}>
            <Button
              size="small"
              variant="text"
              sx={{
                justifyContent: "flex-start",
                color: activeSection === "info" ? "primary.main" : "text.secondary",
                fontWeight: activeSection === "info" ? 700 : 500,
                borderLeft: activeSection === "info" ? "2.5px solid" : "2.5px solid transparent",
                borderColor: activeSection === "info" ? "primary.main" : "transparent",
                pl: 1.5,
                py: 0.6,
                fontSize: 13.5,
                textTransform: "none",
              }}
              onClick={() => handleScrollToSection("info")}
            >
              기본 정보
            </Button>
            <Button
              size="small"
              variant="text"
              sx={{
                justifyContent: "flex-start",
                color: activeSection === "textExtract" ? "primary.main" : "text.secondary",
                fontWeight: activeSection === "textExtract" ? 700 : 500,
                borderLeft: activeSection === "textExtract" ? "2.5px solid" : "2.5px solid transparent",
                borderColor: activeSection === "textExtract" ? "primary.main" : "transparent",
                pl: 1.5,
                py: 0.6,
                fontSize: 13.5,
                textTransform: "none",
              }}
              onClick={() => handleScrollToSection("textExtract")}
            >
              텍스트 추출 결과
            </Button>
            <Button
              size="small"
              variant="text"
              sx={{
                justifyContent: "flex-start",
                color: activeSection === "pipelineSummary" ? "primary.main" : "text.secondary",
                fontWeight: activeSection === "pipelineSummary" ? 700 : 500,
                borderLeft: activeSection === "pipelineSummary" ? "2.5px solid" : "2.5px solid transparent",
                borderColor: activeSection === "pipelineSummary" ? "primary.main" : "transparent",
                pl: 1.5,
                py: 0.6,
                fontSize: 13.5,
                textTransform: "none",
              }}
              onClick={() => handleScrollToSection("pipelineSummary")}
            >
              파이프라인 요약
            </Button>
            <Button
              size="small"
              variant="text"
              sx={{
                justifyContent: "flex-start",
                color: activeSection === "pipelineConfig" ? "primary.main" : "text.secondary",
                fontWeight: activeSection === "pipelineConfig" ? 700 : 500,
                borderLeft: activeSection === "pipelineConfig" ? "2.5px solid" : "2.5px solid transparent",
                borderColor: activeSection === "pipelineConfig" ? "primary.main" : "transparent",
                pl: 1.5,
                py: 0.6,
                fontSize: 13.5,
                textTransform: "none",
              }}
              onClick={() => handleScrollToSection("pipelineConfig")}
            >
              실행 및 설정
            </Button>
          </Stack>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 1.5, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" sx={{ mb: 1 }}>
              파이프라인 요약
            </Typography>
            <Stack spacing={1}>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 10.5 }}>
                  RAG 검색 모델
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 11.5, color: "primary.main" }}>
                  {formatEmbeddingModelName(
                    selectedEmbeddingOption?.displayName
                    || selectedEmbeddingOption?.model
                    || selectedEmbeddingOption?.deploymentId
                    || latestRagJob?.embeddingModel
                    || (ragMetadata as any)?.embeddingModel
                    || "-")}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 10.5 }}>
                  청킹 전략
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500, fontSize: 11.5 }}>
                  {strategyLabels[selectedChunkingStrategy || ""] || selectedChunkingStrategy || "-"}
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Box>
      </Box>
    )}
        </Box>
      )}

      {/* Reader / Convert Dialogs */}
      {file && (
        <>
          <DocumentConvertDialog
            open={convertDialogOpen}
            onClose={() => setConvertDialogOpen(false)}
            file={file}
          />
          {isEpub && (
            <EpubReaderDialog
              open={epubReaderOpen}
              onClose={() => setEpubReaderOpen(false)}
              url={`/api/mgmt/files/${file.attachmentId}/download`}
              filename={file.name}
            />
          )}
          {isPdf && (
            <PdfReaderDialog
              open={pdfReaderOpen}
              onClose={() => setPdfReaderOpen(false)}
              url={`/api/mgmt/files/${file.attachmentId}/download`}
              filename={file.name}
            />
          )}
          {documentId && (
            <MarkdownViewerDialog
              open={markdownViewerOpen}
              onClose={() => setMarkdownViewerOpen(false)}
              documentId={documentId}
              revisionId={selectedViewerRevisionId}
              fileName={file.name}
              onRetryProgress={() => {
                if (documentId) {
                  startPolling(documentId, attachmentId);
                }
              }}
            />
          )}

          {currentTab === "qa" && file && (
            <Box sx={{ display: "flex", flexDirection: "column", flexGrow: 1, height: "calc(100vh - 120px)", overflow: "hidden" }}>
              {/* Chat config row */}
              <Box
                sx={{
                  px: 3,
                  py: 1.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  bgcolor: (theme) => (theme.palette.mode === "dark" ? "background.paper" : "rgba(248, 250, 252, 0.6)"),
                }}
              >
                <Stack direction="row" spacing={2} alignItems="center" sx={{ width: "100%", maxWidth: 720 }}>
                  {/* Chat model selection */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <AiProviderSelect
                      provider={qaProvider}
                      model={qaModel}
                      deploymentId={qaDeploymentId}
                      onChange={(p, m, d) => {
                        setQaProvider(p);
                        setQaModel(m);
                        if (d) setQaDeploymentId(d);
                      }}
                    />
                  </Box>

                  {/* RAG Answer Mode selection */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <RagAnswerModeSelector
                      capabilities={qaAnswerPolicy}
                      value={qaAnswerMode}
                      disabled={qaSending}
                      hideHelperText
                      onChange={(mode) => {
                        if (mode === qaAnswerMode) return;
                        setQaAnswerMode(mode);
                        setQaMessages([]);
                        setQaInput("");
                        setQaError(null);
                      }}
                    />
                  </Box>
                </Stack>
              </Box>

              {/* Chat messages list */}
              <Box sx={{ flex: 1, minHeight: 0, position: "relative", display: "flex", flexDirection: "column" }}>
                <Box
                  ref={qaMessageListRef}
                  onScroll={handleQaScroll}
                  sx={{ flex: 1, overflow: "auto", p: 3, display: "flex", flexDirection: "column", gap: 2, bgcolor: "background.default" }}
                >
                  {qaMessages.length === 0 ? (
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", opacity: 0.7 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                        문서 Q&A (Ask Gemini)
                      </Typography>
                      <Typography variant="body2" color="text.secondary" align="center">
                        이 문서의 내용을 기반으로 RAG 질문과 답변을 생성할 수 있습니다.<br />
                        질문을 입력하여 대화를 시작해 보세요.
                      </Typography>
                    </Box>
                  ) : (
                    qaMessages.map((msg, idx) => {
                      if (msg.role === "assistant") {
                        return (
                          <AssistantMessageBubble
                            key={msg.id}
                            message={msg}
                            sending={qaSending}
                            isLastAssistant={idx === qaMessages.length - 1}
                            onCopy={(content) => void navigator.clipboard.writeText(content)}
                            onRegenerate={handleQaRegenerate}
                            onRetryLastUser={handleQaRetryLastUser}
                          />
                        );
                      }
                      return (
                        <UserMessageBubble
                          key={msg.id}
                          message={msg}
                          onCopy={(content) => void navigator.clipboard.writeText(content)}
                          onEdit={(id, content) => {
                            setQaInput(content);
                            setQaMessages((prev) => {
                              const idx = prev.findIndex((m) => m.id === id);
                              return idx >= 0 ? prev.slice(0, idx) : prev;
                            });
                          }}
                        />
                      );
                    })
                  )}
                  {qaSending && (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                      <CircularProgress size={20} />
                    </Box>
                  )}
                </Box>

                {/* Floating scroll to bottom button */}
                {showScrollToBottomBtn && (
                  <IconButton
                    onClick={scrollToBottom}
                    sx={{
                      position: "absolute",
                      bottom: 16,
                      right: 24,
                      bgcolor: "background.paper",
                      color: "text.primary",
                      boxShadow: 3,
                      "&:hover": {
                        bgcolor: "action.hover",
                      },
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      border: "1px solid",
                      borderColor: "divider",
                      zIndex: 10,
                    }}
                    size="small"
                  >
                    <ArrowDownwardOutlined fontSize="small" />
                  </IconButton>
                )}
              </Box>

              {/* Input field */}
              <Box sx={{ p: 2, borderTop: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
                {lastQaAssistantMessage?.metadata && (
                  <Stack direction="row" spacing={2} sx={{ mb: 1.25, px: 0.5 }} alignItems="center">
                    {lastQaAssistantMessage.metadata.tokenUsage && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                        토큰량: <strong>{lastQaAssistantMessage.metadata.tokenUsage.totalTokens}</strong> tokens
                        (입력: {lastQaAssistantMessage.metadata.tokenUsage.inputTokens} /
                         출력: {lastQaAssistantMessage.metadata.tokenUsage.outputTokens})
                      </Typography>
                    )}
                    {lastQaAssistantMessage.metadata.latencyMs != null && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                        응답 속도: <strong>{(lastQaAssistantMessage.metadata.latencyMs / 1000).toFixed(2)}</strong>초 ({lastQaAssistantMessage.metadata.latencyMs}ms)
                      </Typography>
                    )}
                  </Stack>
                )}
                <Stack direction="row" spacing={1} alignItems="flex-end">
                  <TextField
                    placeholder="문서에 대해 질문해보세요... (Shift+Enter 줄바꿈, Enter 전송)"
                    multiline
                    maxRows={4}
                    size="small"
                    fullWidth
                    value={qaInput}
                    onChange={(e) => setQaInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.nativeEvent.isComposing) return;
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendQa();
                      }
                    }}
                    disabled={qaSending}
                  />
                  <Button
                    variant="contained"
                    onClick={handleSendQa}
                    disabled={qaSending || !qaInput.trim()}
                    sx={{ height: 40, minWidth: 70 }}
                  >
                    전송
                  </Button>
                </Stack>
              </Box>
            </Box>
          )}
        </>
      )}
    </Drawer>
  );
}
