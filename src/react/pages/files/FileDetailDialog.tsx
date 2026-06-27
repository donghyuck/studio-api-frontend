import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Select,
  Switch,
} from "@mui/material";
import {
  CloseOutlined,
  ContentCopyOutlined,
  RefreshOutlined,
  TextSnippetOutlined,
  TimelineOutlined,
  ExpandMoreOutlined,
  DownloadOutlined,
  CheckCircle,
  Cancel,
  HourglassEmpty,
} from "@mui/icons-material";
import dayjs from "dayjs";
import { useAuthStore } from "@/react/auth/store";
import { useToast } from "@/react/feedback";
import { reactAiApi, type EmbeddingOption } from "@/react/pages/ai/api";
import type { RagChunkConfigResponseDto, AiInfoResponse } from "@/types/studio/ai";
import {
  reactFilesApi,
  reactDocumentConvertApi,
  reactMarkdownDocumentApi,
  type DocumentConvertStatus,
  type DocumentConvertJob,
  type MarkdownDocumentDto,
  type MarkdownDocumentRevisionDto,
  type MarkdownLocatorDto,
  type MarkdownResourceDto,
  type MarkdownPipelineStage,
  type MarkdownPipelineExecutionDto,
  type MarkdownRagReindexRequest,
} from "@/react/pages/files/api";
import { skillGraphApi } from "@/react/pages/ai/skillgraph/api";
import type { AttachmentDto } from "@/types/studio/files";
import type { RagIndexJobStatus, RagIndexJobStep } from "@/types/studio/ai";
import { resolveAxiosError } from "@/utils/helpers";
import { DocumentConvertDialog, getDocumentFormat, getFriendlyErrorMessage } from "./DocumentConvertDialog";
import { IdeaBlockSummaryPanel } from "./IdeaBlockSummaryPanel";
import { EpubReaderDialog } from "./EpubReaderDialog";
import { PdfReaderDialog } from "./PdfReaderDialog";
import { useMarkdownDocumentPolling } from "./hooks/useMarkdownDocumentPolling";
import { getCachedThumbnailUrl, requestThumbnail, invalidateThumbnail } from "./thumbnailCache";

interface Props {
  open: boolean;
  onClose: () => void;
  attachmentId: number;
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



export function FileDetailDialog({ open, onClose, attachmentId }: Props) {
  const toast = useToast();
  const [file, setFile] = useState<AttachmentDto | null>(null);
  const [ragIndexed, setRagIndexed] = useState(false);
  const [ragMetadata, setRagMetadata] = useState<Record<string, unknown> | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [textExtracted, setTextExtracted] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailAvailable, setThumbnailAvailable] = useState(false);
  const [thumbnailReloadKey, setThumbnailReloadKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [textExtracting, setTextExtracting] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [epubReaderOpen, setEpubReaderOpen] = useState(false);
  const [pdfReaderOpen, setPdfReaderOpen] = useState(false);

  // Markdown Document Pipeline States
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [markdownDocument, setMarkdownDocument] = useState<MarkdownDocumentDto | null>(null);
  const [reused, setReused] = useState<boolean | null>(null);
  
  // Pipeline Options
  const [runChunking, setRunChunking] = useState<boolean>(true);
  const [runRagIndex, setRunRagIndex] = useState<boolean>(true);
  const [runSkillExtraction, setRunSkillExtraction] = useState<boolean>(false);
  const [skillExtractionMode, setSkillExtractionMode] = useState<'regex' | 'llm' | ''>('');
  const [force, setForce] = useState<boolean>(false);

  // Chunking Configuration
  const [chunkingStrategy, setChunkingStrategy] = useState<string>("structure-based");
  const [chunkMaxSize, setChunkMaxSize] = useState<number | string>(800);
  const [chunkOverlap, setChunkOverlap] = useState<number | string>(100);
  const [chunkUnit, setChunkUnit] = useState<string>("TOKEN");
  const [chunkConfig, setChunkConfig] = useState<RagChunkConfigResponseDto | null>(null);

  // RAG Configuration — unified EmbeddingOption (profileId 있으면 profile 방식, 없으면 직접 방식)
  const [selectedEmbeddingOption, setSelectedEmbeddingOption] = useState<EmbeddingOption | null>(null);
  const [embeddingOptions, setEmbeddingOptions] = useState<EmbeddingOption[]>([]);

  // Locators & Resources
  const [locators, setLocators] = useState<MarkdownLocatorDto[]>([]);
  const [resources, setResources] = useState<MarkdownResourceDto[]>([]);

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
  const canManage = roles.includes("ROLE_ADMIN") || roles.includes("ADMIN") || roles.includes("features:document-convert/manage");

  // Load embedding options and chunking config on open
  const loadEmbeddingOptions = useCallback(async () => {
    try {
      const res = await reactAiApi.getEmbeddingOptions();
      const opts = res.options ?? [];
      setEmbeddingOptions(opts);
      // Set default: prefer defaultProfile option, else defaultProvider, else first
      const defaultOpt = opts.find((o) => o.defaultProfile) ?? opts.find((o) => o.defaultProvider) ?? opts[0];
      if (defaultOpt) {
        setSelectedEmbeddingOption(defaultOpt);
      }
    } catch {
      // Ignore - fall back to manual input
    }
  }, []);

  const loadChunkConfig = useCallback(async () => {
    try {
      const res = await reactAiApi.getRagChunkConfig();
      setChunkConfig(res);
      // Set default strategy from server config if not already set
      const defaultStrategy = res.chunking.previewStrategy || res.chunking.strategy;
      if (defaultStrategy) {
        setChunkingStrategy(defaultStrategy);
      }
    } catch {
      // Ignore - fall back to hardcoded values
    }
  }, []);

  const loadProviders = useCallback(async () => {
    try {
      const res = await reactAiApi.fetchProviders();
      setAiInfo(res);
      if (res.defaultProvider) {
        setBlockifyLlmProvider(res.defaultProvider);
        const match = res.providers.find((p) => p.name === res.defaultProvider);
        if (match?.chat?.model) {
          setBlockifyLlmModel(match.chat.model);
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadEmbeddingOptions();
      void loadChunkConfig();
      void loadProviders();
    }
  }, [open, loadEmbeddingOptions, loadChunkConfig, loadProviders]);

  // Derived: available chunking strategies
  const availableStrategies = useMemo(() => {
    const serverStrategies = chunkConfig?.chunking.availableStrategies ?? ["fixed-size", "recursive", "structure-based"];
    if (!serverStrategies.includes("blockify")) {
      return [...serverStrategies, "blockify"];
    }
    return serverStrategies;
  }, [chunkConfig]);

  const strategyLabels: Record<string, string> = {
    "recursive": "Recursive",
    "fixed-size": "Fixed Size",
    "structure-based": "Structure-Based",
    "blockify": "Blockify / IdeaBlock",
  };

  // Derived: embedding option value key (same pattern as RagPage/RagChatPage)
  const embeddingOptionKey = (opt: EmbeddingOption) => opt.profileId || `${opt.provider}:${opt.model}`;
  const embeddingOptionLabel = (opt: EmbeddingOption) =>
    opt.profileId
      ? `${opt.profileId} (${opt.provider} – ${opt.model})`
      : `${opt.provider} – ${opt.model} (${opt.dimension}d)`;


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
    if (open && latestRagJob?.jobId && latestRagJob.status === "SUCCEEDED" && (chunkingStrategy === "blockify" || latestRagJob.chunkingStrategy === "blockify")) {
      let active = true;
      const validateBlockify = async () => {
        try {
          // Fetch up to 1000 chunks to compute accurate statistics on the client side
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

            // Stat calculation
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
          console.error("Failed to fetch job chunks for blockify validation and stats", err);
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
  }, [open, latestRagJob?.jobId, latestRagJob?.status, latestRagJob?.chunkingStrategy, chunkingStrategy]);

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
              // Ignore 404
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

            // Fetch RAG Jobs once since markdown document doesn't exist but RAG jobs might
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
              console.error("Failed to load initial RAG jobs:", err);
            }
          }
        } catch (err) {
          console.error("Failed to load initial metadata:", err);
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
      setReused(null);
      stopPolling();
    }
  }, [open, attachmentId, startPolling, stopPolling, setLatestRevision, setPipelineExecution, setPipelineProgress, setMarkdownStatus, setMarkdownError, setLatestRagJob, setRagJobs, toast]);

  // Restore form state from latestRevision.optionsJson when a processed revision is loaded
  useEffect(() => {
    let opts: Record<string, unknown> | null = null;
    if (latestRevision?.optionsJson) {
      try {
        opts = JSON.parse(latestRevision.optionsJson) as Record<string, unknown>;
      } catch {
        // Ignore JSON parse errors
      }
    }

    // Restore pipeline toggles
    if (opts) {
      if (typeof opts.runChunking === "boolean") setRunChunking(opts.runChunking);
      if (typeof opts.runRagIndex === "boolean") setRunRagIndex(opts.runRagIndex);
      if (typeof opts.runSkillExtraction === "boolean") setRunSkillExtraction(opts.runSkillExtraction);
      if (typeof opts.skillExtractionMode === "string" && (opts.skillExtractionMode === "regex" || opts.skillExtractionMode === "llm")) {
        setSkillExtractionMode(opts.skillExtractionMode);
      } else {
        setSkillExtractionMode("");
      }
    }

    // Restore chunking settings
    let strategy = opts && typeof opts.chunkingStrategy === "string" && opts.chunkingStrategy ? opts.chunkingStrategy : null;
    let maxSize = opts && opts.chunkMaxSize != null ? Number(opts.chunkMaxSize) : null;
    let overlap = opts && opts.chunkOverlap != null ? Number(opts.chunkOverlap) : null;
    let unit = opts && typeof opts.chunkUnit === "string" && opts.chunkUnit ? opts.chunkUnit : null;

    if (!strategy && latestRagJob?.chunkingStrategy) strategy = latestRagJob.chunkingStrategy;
    if (maxSize === null && latestRagJob?.chunkMaxSize != null) maxSize = latestRagJob.chunkMaxSize;
    if (overlap === null && latestRagJob?.chunkOverlap != null) overlap = latestRagJob.chunkOverlap;
    if (!unit && latestRagJob?.chunkUnit) unit = latestRagJob.chunkUnit;

    if (strategy) setChunkingStrategy(strategy);
    if (maxSize !== null) setChunkMaxSize(maxSize);
    if (overlap !== null) setChunkOverlap(overlap);
    if (unit) setChunkUnit(unit);

    // Restore blockify settings
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

    // Restore embedding option
    let profileId = opts && typeof opts.embeddingProfileId === "string" ? opts.embeddingProfileId : null;
    let provider = opts && typeof opts.embeddingProvider === "string" ? opts.embeddingProvider : null;
    let model = opts && typeof opts.embeddingModel === "string" ? opts.embeddingModel : null;

    if (!profileId && !provider && !model && latestRagJob) {
      profileId = latestRagJob.embeddingProfileId || null;
      provider = latestRagJob.embeddingProvider || null;
      model = latestRagJob.embeddingModel || null;
    }

    if (embeddingOptions.length > 0 && (profileId || (provider && model))) {
      let matched: EmbeddingOption | undefined;
      if (profileId) {
        matched = embeddingOptions.find((o) => o.profileId === profileId);
      }
      if (!matched && provider && model) {
        matched = embeddingOptions.find((o) => o.provider === provider && o.model === model);
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

  function clearThumbnail() {
    setThumbnailAvailable(false);
    setThumbnailUrl(null);
  }

  async function loadRagState(nextFile: AttachmentDto) {
    try {
      const metadata = await reactFilesApi.ragMetadata(nextFile.attachmentId);
      return {
        indexed: Boolean(metadata?.indexed),
        metadata,
      };
    } catch {
      return {
        indexed: false,
        metadata: null,
      };
    }
  }

  useEffect(() => {
    setFile(null);
    setRagIndexed(false);
    setRagMetadata(null);
    setExtractedText("");
    setTextExtracted(false);
    clearThumbnail();

    if (!open || !attachmentId) {
      return;
    }

    let ignored = false;
    const requestedId = attachmentId;

    async function loadDetail() {
      setLoading(true);
      try {
        const nextFile = await reactFilesApi.getById(requestedId);
        if (ignored || nextFile.attachmentId !== requestedId) {
          return;
        }

        setFile(nextFile);
        setExtractedText("");
        setTextExtracted(false);

        const ragState = await loadRagState(nextFile);
        if (ignored) {
          return;
        }

        setRagIndexed(ragState.indexed);
        setRagMetadata(ragState.metadata);
      } catch (error) {
        if (!ignored) {
          toast.error(resolveAxiosError(error));
          setRagIndexed(false);
          setRagMetadata(null);
        }
      } finally {
        if (!ignored) {
          setLoading(false);
        }
      }
    }

    void loadDetail();

    return () => {
      ignored = true;
    };
  }, [open, attachmentId, toast]);

  // Refresh RAG metadata when pipeline completes successfully
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineExecution?.status]);

  // Sync markdownDocument state when polling finishes or when latestRevision status updates
  useEffect(() => {
    if (attachmentId && !markdownIsPolling) {
      let active = true;
      void reactMarkdownDocumentApi.getByAttachment(attachmentId)
        .then((doc) => {
          if (active) {
            setMarkdownDocument(doc);
          }
        })
        .catch((err) => {
          console.debug("Failed to sync markdown document:", err);
        });
      return () => {
        active = false;
      };
    }
  }, [attachmentId, markdownIsPolling, latestRevision?.status]);

  useEffect(() => {
    if (!open || !attachmentId) {
      clearThumbnail();
      return;
    }

    let ignored = false;
    const requestedId = attachmentId;

    // Check cache first
    const cached = getCachedThumbnailUrl(requestedId);
    if (cached !== undefined) {
      if (cached) {
        setThumbnailUrl(cached);
        setThumbnailAvailable(true);
      } else {
        setThumbnailUrl(null);
        setThumbnailAvailable(false);
      }
      return;
    }

    requestThumbnail(requestedId, 256).then((url) => {
      if (ignored || requestedId !== attachmentId) {
        return;
      }
      if (url) {
        setThumbnailUrl(url);
        setThumbnailAvailable(true);
      } else {
        setThumbnailUrl(null);
        setThumbnailAvailable(false);
      }
    });

    return () => {
      ignored = true;
    };
  }, [open, attachmentId, thumbnailReloadKey]);

  async function refreshDetail() {
    if (!attachmentId) return;
    if (!file) {
      setFile(null);
      setRagIndexed(false);
      setRagMetadata(null);
      setExtractedText("");
      setTextExtracted(false);
      clearThumbnail();
    }
    invalidateThumbnail(attachmentId);
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
          // Ignore 404
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
        } else {
          try {
            const doc = await reactMarkdownDocumentApi.getByAttachment(attachmentId);
            if (doc && doc.documentId) {
              setDocumentId(doc.documentId);
              localStorage.setItem(`markdown_doc_id_${attachmentId}`, doc.documentId);
              startPolling(doc.documentId, attachmentId);
              setMarkdownDocument(doc);
            }
          } catch (err: any) {
            const status = err?.response?.status ?? err?.status;
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
          console.error("Failed to load initial RAG jobs in refreshDetail:", err);
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
      toast.error("현재 브라우저에서는 클립보드 복사를 지원하지 않습니다.");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success("클립보드에 복사했습니다.");
    } catch {
      toast.error("클립보드에 복사할 수 없습니다. 브라우저 권한을 확인해 주세요.");
    }
  }

  function sanitizeErrorMessage(msg: string | null | undefined): string {
    if (!msg) return "";
    if (msg.includes("Blockify chunking is disabled")) {
      return "Blockify 청킹이 서버에서 비활성화되어 있습니다. 서버 설정 studio.chunking.blockify.enabled=true 적용 후 다시 시도하세요.";
    }
    if (msg.includes("Invalid blockify chunk metadata") || msg.includes("Blockify chunking produced no chunks")) {
      return "Blockify 결과 검증에 실패했습니다. IdeaBlock 필수 metadata가 생성되지 않아 잘못된 성공 저장을 차단했습니다.";
    }
    return msg
      .replace(/(Signature|Expires|AWSAccessKeyId|token|access_token|key)=[^&\s]+/gi, '$1=***')
      .replace(/https?:\/\/[^\s]+(signature|token|key)[^\s]+/gi, '[SENSITIVE_URL]')
      .replace(/(s3|gs):\/\/[a-zA-Z0-9.\-_]+(\/[a-zA-Z0-9.\-_]+)*/gi, '[SENSITIVE_STORAGE_PATH]');
  }

  const handleRunChunkingChange = (checked: boolean) => {
    setRunChunking(checked);
    if (!checked) {
      setRunRagIndex(false);
      setRunSkillExtraction(false);
    }
  };

  const handleRunRagIndexChange = (checked: boolean) => {
    setRunRagIndex(checked);
    if (checked) {
      setRunChunking(true);
    } else {
      setRunSkillExtraction(false);
    }
  };

  const handleRunSkillExtractionChange = (checked: boolean) => {
    setRunSkillExtraction(checked);
    if (checked) {
      setRunRagIndex(true);
      setRunChunking(true);
    }
  };

  const buildPayload = (forEstimate = false) => {
    const maxSize = chunkMaxSize === "" ? null : Number(chunkMaxSize);
    const overlap = chunkOverlap === "" ? null : Number(chunkOverlap);

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

    const payload: Record<string, any> = {
      runChunking,
      runRagIndex,
      runSkillExtraction,
      chunkingStrategy: (runChunking || forEstimate) ? (chunkingStrategy || null) : null,
      chunkMaxSize: (runChunking || forEstimate) ? (maxSize || null) : null,
      chunkOverlap: (runChunking || forEstimate) ? (overlap || null) : null,
      chunkUnit: (runChunking || forEstimate) ? (chunkUnit || null) : null,
      blockifyLlmProvider: (runChunking || forEstimate) && chunkingStrategy === "blockify" ? (blockifyLlmProvider || null) : null,
      blockifyLlmModel: (runChunking || forEstimate) && chunkingStrategy === "blockify" ? (blockifyLlmModel || null) : null,
      blockifyPiiMaskingEnabled: (runChunking || forEstimate) && chunkingStrategy === "blockify" ? blockifyPiiMaskingEnabled : null,
    };

    if (runSkillExtraction || forEstimate) {
      payload.skillExtractionMode = skillExtractionMode || null;
    }

    if (runRagIndex || forEstimate) {
      if (selectedEmbeddingOption?.profileId) {
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
        payload.embeddingProfileId = null;
        payload.embeddingProvider = null;
        payload.embeddingModel = null;
        payload.embeddingDimension = null;
      }
    } else {
      payload.embeddingProfileId = null;
      payload.embeddingProvider = null;
      payload.embeddingModel = null;
      payload.embeddingDimension = null;
    }

    return payload;
  };

  function getErrorMessageByStatus(status: number, originalMsg: string): string {
    if (status === 400) {
      return `옵션 조합 또는 값 오류: ${originalMsg}`;
    }
    if (status === 401 || status === 403) {
      return `인증 실패 또는 Markdown 변환 권한이 부족합니다.`;
    }
    if (status === 404) {
      return `첨부파일 또는 Markdown 문서를 찾을 수 없습니다.`;
    }
    if (status === 409) {
      return `상태 충돌이 발생했습니다. (이미 처리 중이거나 완료됨)`;
    }
    if (status >= 500) {
      return `서버, Pandoc Worker 또는 후속 파이프라인 장애가 발생했습니다.`;
    }
    return originalMsg;
  }

  async function runPipelineWithEstimate(executeAction: (payloadOverride?: any) => Promise<void>) {
    const metadata = (ragMetadata || {}) as any;
    const shouldEstimate =
      (file?.size ?? 0) >= 10 * 1024 * 1024 ||
      (metadata.pageCount ?? 0) >= 100 ||
      (metadata.markdownLength ?? 0) >= 1024 * 1024;

    if (shouldEstimate) {
      setIsExtracting(true);
      try {
        const payload = buildPayload(true);
        const estimateReq = {
          runChunking,
          runRagIndex,
          runSkillExtraction,
          chunkingStrategy: payload.chunkingStrategy,
          chunkMaxSize: payload.chunkMaxSize,
          chunkOverlap: payload.chunkOverlap,
          chunkUnit: payload.chunkUnit,
          embeddingProfileId: payload.embeddingProfileId,
          embeddingProvider: payload.embeddingProvider,
          embeddingModel: payload.embeddingModel,
          embeddingDimension: payload.embeddingDimension,
        };

        let estimateRes;
        if (!markdownDocument?.currentRevisionId) {
          estimateRes = await reactMarkdownDocumentApi.estimatePipelineByAttachment(attachmentId!, estimateReq);
        } else {
          estimateRes = await reactMarkdownDocumentApi.estimatePipeline(markdownDocument.documentId, estimateReq);
        }

        if (estimateRes && estimateRes.recommended) {
          const rec = estimateRes.recommended;
          if (rec.chunkingStrategy) setChunkingStrategy(rec.chunkingStrategy);
          if (rec.chunkMaxSize != null) setChunkMaxSize(rec.chunkMaxSize);
          if (rec.chunkOverlap != null) setChunkOverlap(rec.chunkOverlap);
          if (rec.chunkUnit) setChunkUnit(rec.chunkUnit);

          if (rec.embeddingProfileId) {
            const opt = embeddingOptions.find(o => o.profileId === rec.embeddingProfileId);
            if (opt) setSelectedEmbeddingOption(opt);
          } else if (rec.embeddingProvider && rec.embeddingModel) {
            const opt = embeddingOptions.find(o => o.provider === rec.embeddingProvider && o.model === rec.embeddingModel);
            if (opt) setSelectedEmbeddingOption(opt);
          }

          const newPayload = {
            runChunking,
            runRagIndex,
            runSkillExtraction,
            chunkingStrategy: rec.chunkingStrategy ?? payload.chunkingStrategy,
            chunkMaxSize: rec.chunkMaxSize ?? payload.chunkMaxSize,
            chunkOverlap: rec.chunkOverlap ?? payload.chunkOverlap,
            chunkUnit: rec.chunkUnit ?? payload.chunkUnit,
            embeddingProfileId: rec.embeddingProfileId ?? payload.embeddingProfileId,
            embeddingProvider: rec.embeddingProvider ?? payload.embeddingProvider,
            embeddingModel: rec.embeddingModel ?? payload.embeddingModel,
            embeddingDimension: rec.embeddingDimension ?? payload.embeddingDimension,
          };

          await executeAction(newPayload);
          return;
        }
      } catch (err: any) {
        console.error("Pipeline estimation failed:", err);
        const status = err?.response?.status;
        const data = err?.response?.data;
        const code = data?.code || data?.message;
        if (code === "markdown.source.too-large" || status === 413) {
          toast.error("첨부파일이 Markdown 처리 허용 크기를 초과했습니다.");
          return;
        } else if (code === "markdown.pipeline.estimate-unavailable" || status === 409) {
          toast.error("Markdown 생성 완료 전에는 문서 기준 estimate를 사용할 수 없습니다. 첨부파일 기준 estimate를 사용합니다.");
        } else {
          toast.error("부하 추산에 실패했습니다: " + resolveAxiosError(err));
        }
      } finally {
        setIsExtracting(false);
      }
    }

    await executeAction();
  }

  async function handleManualEstimate() {
    setIsExtracting(true);
    try {
      const payload = buildPayload(true);
      const estimateReq = {
        runChunking,
        runRagIndex,
        runSkillExtraction,
        chunkingStrategy: payload.chunkingStrategy,
        chunkMaxSize: payload.chunkMaxSize,
        chunkOverlap: payload.chunkOverlap,
        chunkUnit: payload.chunkUnit,
        embeddingProfileId: payload.embeddingProfileId,
        embeddingProvider: payload.embeddingProvider,
        embeddingModel: payload.embeddingModel,
        embeddingDimension: payload.embeddingDimension,
      };

      let estimateRes;
      if (!markdownDocument?.currentRevisionId) {
        estimateRes = await reactMarkdownDocumentApi.estimatePipelineByAttachment(attachmentId!, estimateReq);
      } else {
        estimateRes = await reactMarkdownDocumentApi.estimatePipeline(markdownDocument.documentId, estimateReq);
      }

      if (estimateRes) {
        const recommended = estimateRes.recommended || {};
        let resultMsg = `[부하 추산 결과]\n` +
          `- 위험도 (Risk Level): ${estimateRes.riskLevel}\n`;
        if (estimateRes.reason) {
          resultMsg += `- 사유 (Reason): ${estimateRes.reason}\n`;
        }

        if (recommended.chunkingStrategy) setChunkingStrategy(recommended.chunkingStrategy);
        if (recommended.chunkMaxSize != null) setChunkMaxSize(recommended.chunkMaxSize);
        if (recommended.chunkOverlap != null) setChunkOverlap(recommended.chunkOverlap);
        if (recommended.chunkUnit) setChunkUnit(recommended.chunkUnit);

        if (recommended.embeddingProfileId) {
          const opt = embeddingOptions.find(o => o.profileId === recommended.embeddingProfileId);
          if (opt) setSelectedEmbeddingOption(opt);
        } else if (recommended.embeddingProvider && recommended.embeddingModel) {
          const opt = embeddingOptions.find(o => o.provider === recommended.embeddingProvider && o.model === recommended.embeddingModel);
          if (opt) setSelectedEmbeddingOption(opt);
        }

        toast.success("추천 설정이 적용되었습니다.");
        window.alert(resultMsg + `\n추천 설정이 적용되었습니다.`);
      }
    } catch (err: any) {
      console.error("Pipeline manual estimation failed:", err);
      const status = err?.response?.status;
      const data = err?.response?.data;
      const code = data?.code || data?.message;
      if (code === "markdown.source.too-large" || status === 413) {
        toast.error("첨부파일이 Markdown 처리 허용 크기를 초과했습니다.");
      } else if (code === "markdown.pipeline.estimate-unavailable" || status === 409) {
        toast.error("Markdown 생성 완료 전에는 문서 기준 estimate를 사용할 수 없습니다. 첨부파일 기준 estimate를 사용합니다.");
      } else {
        toast.error("부하 추산에 실패했습니다: " + resolveAxiosError(err));
      }
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleExtractMarkdown() {
    if (!attachmentId || !file) return;

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

    await runPipelineWithEstimate(execute);
  }

  async function handleRecreateMarkdownFromCanceled() {
    if (!attachmentId) return;
    setIsExtracting(true);
    try {
      const res = await reactMarkdownDocumentApi.extractFromAttachment({
        attachmentId,
        force: true,
        runChunking: false,
        runRagIndex: false,
        runSkillExtraction: false,
      } as any);
      const newDocId = res.document.documentId;
      setDocumentId(newDocId);
      setMarkdownDocument(res.document);
      localStorage.setItem(`markdown_doc_id_${attachmentId}`, newDocId);
      setReused(res.reused);
      toast.success("Markdown 지식 파이프라인 작업이 다시 시작되었습니다.");
      startPolling(newDocId, attachmentId);
    } catch (err: any) {
      toast.error("Markdown 다시 생성 실패: " + resolveAxiosError(err));
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleReextractMarkdown() {
    if (!documentId) return;
    const ok = window.confirm("기존 결과와 관계없이 새로 변환 및 색인을 진행하시겠습니까?");
    if (!ok) return;

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

    await runPipelineWithEstimate(execute);
  }

  async function handleCancelMarkdown() {
    if (!documentId) return;
    const ok = window.confirm("진행 중인 변환 및 RAG 색인 작업을 취소하시겠습니까?");
    if (!ok) return;

    setIsCanceling(true);
    try {
      await reactMarkdownDocumentApi.cancelExtraction(documentId);
      stopPolling();
      setMarkdownStatus("CANCELED");
      if (latestRevision) {
        setLatestRevision({
          ...latestRevision,
          status: "CANCELED"
        });
      }
      toast.success("작업이 취소되었습니다.");
    } catch (err: any) {
      const status = err?.response?.status;
      const rawMsg = resolveAxiosError(err);
      const errMsg = sanitizeErrorMessage(getErrorMessageByStatus(status, rawMsg));
      toast.error("작업 취소 실패: " + errMsg);
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
      toast.error("Markdown 변환이 성공적으로 완료된 상태에서만 작업을 재개할 수 있습니다. 실패한 경우 '새로 재추출 실행'을 이용해 주세요.");
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
          ? "이미 모든 작업이 완료되었습니다."
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

  async function handleRetryRagJob(jobId: string) {
    try {
      await reactAiApi.retryRagJob(jobId);
      toast.success("RAG 색인 작업을 재시도합니다.");
      if (documentId) {
        startPolling(documentId, attachmentId);
      }
    } catch (err: any) {
      toast.error("RAG 색인 재시도 실패: " + resolveAxiosError(err));
    }
  }

  async function handleReindexRag() {
    if (!documentId) return;
    storeLastFailedMessage();
    if (!selectedEmbeddingOption) {
      toast.error("RAG 색인을 재지정할 임베딩 옵션을 선택해 주세요.");
      return;
    }
    const label = selectedEmbeddingOption.profileId || `${selectedEmbeddingOption.provider}:${selectedEmbeddingOption.model}`;
    const ok = window.confirm(`선택한 임베딩(${label})으로 RAG 색인을 재지정하시겠습니까?`);
    if (!ok) return;

    setIsExtracting(true);
    try {
      const payload: MarkdownRagReindexRequest = {
        runSkillExtraction: runSkillExtraction,
      };

      if (selectedEmbeddingOption.profileId) {
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

  // 1. Extract 단계 상태
  const getExtractStepStatus = () => {
    const failState = getStageFailureState("EXTRACT");
    if (failState) return failState;
    if (markdownStatus === "COMPLETED") return "COMPLETED";
    if (markdownStatus === "FAILED") return "FAILED";
    if (markdownStatus === "CANCELED") return "CANCELED";
    if (markdownStatus === "RUNNING" || markdownStatus === "PENDING") return "RUNNING";
    return "PENDING";
  };

  // 2. Markdown 생성 단계 상태
  const getMarkdownStepStatus = () => {
    const failState = getStageFailureState("MARKDOWN");
    if (failState) return failState;
    return getExtractStepStatus();
  };

  // 3. Chunking 단계 상태
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

  // 4. Vector Embedding 단계 상태
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

  // 5. DB Indexing 단계 상태
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

  // 6. Skill 추출 단계 상태
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
      return `IdeaBlock: ${chunking.ideaBlockCount} / Fallback: ${chunking.fallbackCount} / Coverage: ${(chunking.sourceBlockCoverage * 100).toFixed(1)}%`;
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
                    transition: "all 0.3s ease",
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
            Blockify PoC 진단: 파이프라인 완료 후 메타데이터 검증을 시작합니다.
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
          • 원인: 서버 설정 `studio.chunking.blockify.enabled=true` 비활성화 또는 Fallback 동작으로 인해 `structure-based` 청킹이 실행되었을 수 있습니다.
        </Box>
      </Alert>
    );
  }

  function renderDetail(label: string, value?: string | number | null) {
    return (
      <Box>
        <Typography variant="caption" color="text.secondary" display="block">
          {label}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.25, overflowWrap: "anywhere" }}>
          {value || "-"}
        </Typography>
      </Box>
    );
  }

  const handleAccordionChange = (event: React.SyntheticEvent, isExpanded: boolean) => {
    if (isExpanded) {
      const target = event.currentTarget as HTMLElement;
      setTimeout(() => {
        target.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 240);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 520 },
          maxWidth: "100%",
          height: "100%",
          maxHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        },
      }}
    >
      <Box
          sx={{
            minHeight: 56,
            px: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            flexShrink: 0,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" noWrap>
              {file?.name ?? "파일 상세"}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              {file ? (file.properties?.objectTypeName || file.properties?.objectType || `#${file.attachmentId}`) : ""}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0} alignItems="center" flexShrink={0}>
            <Tooltip title="새로고침">
              <IconButton size="small" onClick={() => void refreshDetail()}>
                <RefreshOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={onClose}>
              <CloseOutlined fontSize="small" />
            </IconButton>
          </Stack>
        </Box>
        <Divider />

        <Box
          sx={{
            p: 2,
            flex: "1 1 0%",
            minHeight: 0,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {file ? (
            <>
              {/* 기본 정보 상시 노출 (박스 및 타이틀 없이 수직 나열) */}
              <Stack spacing={2} sx={{ mb: 2, flexShrink: 0 }}>
                {renderDetail("이름", file.name)}
                {renderDetail("콘텐츠 종류", file.contentType)}
                {renderDetail("크기", formatFileSize(file.size))}
                {renderDetail("수정일", formatDate(file.updatedAt || file.createdAt))}

                {thumbnailAvailable && thumbnailUrl ? (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
                      썸네일 프리뷰
                    </Typography>
                    <Box
                      component="img"
                      src={thumbnailUrl}
                      alt={file.name}
                      sx={{
                        width: "100%",
                        maxHeight: 180,
                        objectFit: "contain",
                      }}
                    />
                  </Box>
                ) : null}
              </Stack>

              {/* Accordion Group Container (No Rounding) */}
              <Box
                sx={{
                  flexShrink: 0,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 0,
                  overflow: "hidden",
                  "& .MuiAccordion-root": {
                    border: "none",
                    borderRadius: 0,
                    "&:not(:last-child)": {
                      borderBottom: "1px solid",
                      borderColor: "divider",
                    },
                    "&:before": {
                      display: "none",
                    },
                  },
                }}
              >
                {/* Card 2: Text Extraction Accordion */}
                <Accordion disableGutters square elevation={0} onChange={handleAccordionChange}>
                <AccordionSummary expandIcon={<ExpandMoreOutlined />} sx={{ bgcolor: "action.hover", borderBottom: "1px solid", borderColor: "divider", minHeight: 40, "& .MuiAccordionSummary-content": { my: 1 } }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    텍스트 추출 결과
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 2, bgcolor: "background.paper" }}>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                    <Typography variant="body2" color="text.secondary">
                      추출 텍스트 관리
                    </Typography>
                    {!textExtracted ? (
                      <Tooltip title="콘텐츠에서 텍스트를 추출합니다.">
                        <span>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<TextSnippetOutlined fontSize="small" />}
                            disabled={textExtracting}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleExtractText();
                            }}
                          >
                            텍스트 추출
                          </Button>
                        </span>
                      </Tooltip>
                    ) : (
                      <Tooltip title="클립보드에 복사">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleCopyExtractedText();
                          }}
                        >
                          <ContentCopyOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                  {textExtracted ? (
                    <Box
                      component="pre"
                      sx={{
                        m: 0,
                        maxHeight: 200,
                        overflow: "auto",
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                        wordBreak: "break-word",
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1,
                        bgcolor: "background.default",
                        color: "text.primary",
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
                      추출된 텍스트가 없습니다. 버튼을 눌러 추출을 시작하세요.
                    </Typography>
                  )}
                </AccordionDetails>
              </Accordion>

              {/* Card 3: Markdown 지식 파이프라인 Accordion */}
              <Accordion defaultExpanded disableGutters square elevation={0} onChange={handleAccordionChange}>
                <AccordionSummary expandIcon={<ExpandMoreOutlined />} sx={{ bgcolor: "action.hover", borderBottom: "1px solid", borderColor: "divider", minHeight: 40, "& .MuiAccordionSummary-content": { my: 1 } }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Markdown 지식 파이프라인
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 2, bgcolor: "background.paper" }}>
                  {documentId && (
                    <Box sx={{ mb: 2, p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1.5, bgcolor: "action.hover" }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: 13, mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
                        <TimelineOutlined fontSize="small" color="primary" /> 파이프라인 및 RAG 상태 요약
                      </Typography>
                      <Grid container spacing={1.5}>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="caption" color="text.secondary" display="block">선택된 청킹 전략</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 12, color: "primary.main" }}>
                            {strategyLabels[latestRagJob?.chunkingStrategy || ""] || latestRagJob?.chunkingStrategy || String((ragMetadata as any)?.chunkingStrategy || "-")}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="caption" color="text.secondary" display="block">최종 embedding 모델</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500, fontSize: 12 }}>
                            {latestRagJob?.embeddingModel || String(ragMetadata?.embeddingModel || "-")}
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
                                <span style={{ color: "#2e7d32" }}>완료 (또는 스킵)</span>
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
                            {latestRagJob?.chunkCount != null ? `${latestRagJob.chunkCount}개` : "-"}
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

                      {/* Blockify/Chunking 집계 표시 영역 */}
                      {(() => {
                        const chunking = pipelineProgress?.chunking;
                        
                        // 집계 데이터 획득 (서버 응답 chunking을 우선하되, 없으면 기존 blockifyStats fallback)
                        const stats = chunking ? {
                          totalChunks: chunking.chunkCount,
                          ideaBlockCount: chunking.ideaBlockCount,
                          fallbackCount: chunking.fallbackCount,
                          fallbackReasons: chunking.fallbackReasonCounts || {},
                          sourceBlockCoverage: chunking.sourceBlockCoverage,
                          averageConfidence: chunking.averageConfidence,
                          sourceBlockTargetCount: chunking.sourceBlockTargetCount,
                        } : blockifyStats ? {
                          totalChunks: blockifyStats.totalChunks,
                          ideaBlockCount: blockifyStats.ideaBlockCount,
                          fallbackCount: blockifyStats.fallbackCount,
                          fallbackReasons: blockifyStats.fallbackReasons || {},
                          sourceBlockCoverage: undefined,
                          averageConfidence: undefined,
                          sourceBlockTargetCount: undefined,
                        } : null;

                        const blockifyApplied = stats ? (stats.totalChunks > 0 && (stats.ideaBlockCount > 0 || stats.fallbackCount > 0)) : false;
                        const blockifyEffective = stats ? (stats.ideaBlockCount > 0) : false;

                        let blockifyStatusText = "청킹 결과 대기 중";
                        let blockifyStatusColor = "text.secondary";
                        if (stats) {
                          if (stats.totalChunks === 0) {
                            blockifyStatusText = "청킹 결과 없음";
                            blockifyStatusColor = "text.secondary";
                          } else if (blockifyEffective) {
                            blockifyStatusText = "IdeaBlock 생성됨";
                            blockifyStatusColor = "success.main";
                          } else if (blockifyApplied) {
                            blockifyStatusText = "전체 Fallback 처리됨";
                            blockifyStatusColor = "warning.main";
                          }
                        }

                        // Coverage 경고 메시지 결정
                        let coverageSeverity: "success" | "warning" | "error" | null = null;
                        let coverageMessage = "";
                        const coverageVal = stats?.sourceBlockCoverage;
                        const targetCount = stats?.sourceBlockTargetCount ?? 0;

                        if (stats && coverageVal !== undefined && targetCount > 0) {
                          if (coverageVal >= 0.95) {
                            coverageSeverity = "success";
                            coverageMessage = "Source block coverage 양호";
                          } else if (coverageVal >= 0.8) {
                            coverageSeverity = "warning";
                            coverageMessage = "일부 source block이 fallback 또는 누락되었을 수 있습니다.";
                          } else {
                            coverageSeverity = "error";
                            coverageMessage = "IdeaBlock coverage가 낮습니다. structure-based 또는 hybrid 검색을 권장합니다.";
                          }
                        }

                        if (!latestRevision?.documentId || !latestRevision?.revisionId) return null;
                        return (
                          <IdeaBlockSummaryPanel 
                            documentId={latestRevision.documentId}
                            revisionId={latestRevision.revisionId} 
                            revisionStatus={latestRevision?.status}
                            attachmentId={attachmentId}
                            chunkingStrategy={latestRagJob?.chunkingStrategy || (ragMetadata as any)?.chunkingStrategy || chunkingStrategy}
                            llmProvider={blockifyLlmProvider}
                            llmModel={blockifyLlmModel}
                            embeddingProfileId={selectedEmbeddingOption?.profileId}
                            useLlmKeywordExtraction={true}
                            disabled={controlsDisabled}
                            onMergeApplied={(runRagIndex) => {
                              if (runRagIndex) {
                                startPolling(latestRevision.documentId, attachmentId);
                              }
                            }}
                          />
                        );
                      })()}
                    </Box>
                  )}
                  
                  {/* Pipeline Options */}
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1, fontWeight: 600 }}>
                    파이프라인 단계 선택
                  </Typography>
                  <Grid container spacing={1} sx={{ mb: 2, bgcolor: "action.hover", p: 1.5, borderRadius: 1.5 }}>
                    <Grid size={{ xs: 6, sm: 4 }}>
                      <FormControlLabel
                        control={<Checkbox size="small" checked disabled />}
                        label={<Typography variant="body2" sx={{ fontSize: 13 }}>Markdown 생성 (필수)</Typography>}
                      />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4 }}>
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
                    <Grid size={{ xs: 6, sm: 4 }}>
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
                    <Grid size={{ xs: 6, sm: 4 }}>
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
                    <Grid size={{ xs: 6, sm: 4 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={force}
                            onChange={(e) => setForce(e.target.checked)}
                            disabled={controlsDisabled || isCanceledRevision}
                          />
                        }
                        label={<Typography variant="body2" sx={{ fontSize: 13 }}>강제 재추출 (force)</Typography>}
                      />
                    </Grid>
                  </Grid>

                  {/* Chunking Configuration Form */}
                  {runChunking && (
                    <Box sx={{ mb: 2, p: 2, border: "1px solid", borderColor: "divider", borderRadius: 1.5, bgcolor: "background.default" }}>
                      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, fontSize: 13 }}>
                        Chunking 설정
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                            전략
                          </Typography>
                          <Select
                            size="small"
                            fullWidth
                            value={chunkingStrategy}
                            onChange={(e) => setChunkingStrategy(e.target.value)}
                            disabled={controlsDisabled || isCanceledRevision}
                          >
                            {availableStrategies.map((s) => (
                              <MenuItem key={s} value={s}>{strategyLabels[s] || s}</MenuItem>
                            ))}
                          </Select>
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block", fontSize: 10 }}>
                            {chunkingStrategy === "structure-based" && "Markdown heading/block 구조 기반 chunk"}
                            {chunkingStrategy === "blockify" && "source block 단위 질문·답변 IdeaBlock 생성"}
                          </Typography>
                        </Grid>
                        {chunkingStrategy === "blockify" && (
                          <Grid size={{ xs: 12 }}>
                            <Alert severity="info" sx={{ fontSize: 11, py: 1, whiteSpace: "pre-wrap" }}>
                              <strong>Blockify / IdeaBlock 안내:</strong>{"\n"}
                              Blockify는 문서의 조항, 항, 호, 표 row, 예외 조건 단위로 IdeaBlock을 생성합니다.{"\n"}
                              각 IdeaBlock은 critical question, trusted answer, source evidence를 포함합니다.{"\n"}
                              누락되거나 검증 실패한 source block은 structure-based fallback chunk로 보존됩니다.
                            </Alert>
                          </Grid>
                        )}
                        {chunkingStrategy === "blockify" && (
                          <>
                            <Grid size={{ xs: 6 }}>
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
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
                            <Grid size={{ xs: 6 }}>
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
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
                                label={
                                  <Typography variant="body2" sx={{ fontSize: 13 }}>
                                    개인정보 마스킹 (Presidio PII) 활성화
                                  </Typography>
                                }
                              />
                              {!blockifyPiiMaskingEnabled && (
                                <Alert severity="error" sx={{ fontSize: 11, mt: 1, py: 0.5 }}>
                                  [주의] 외부 LLM 사용 전 개인정보 마스킹 비활성화 시 민감 정보 누출 위험이 있습니다.
                                </Alert>
                              )}
                            </Grid>
                          </>
                        )}
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                            단위
                          </Typography>
                          <Select
                            size="small"
                            fullWidth
                            value={chunkUnit}
                            onChange={(e) => setChunkUnit(e.target.value)}
                            disabled={controlsDisabled || isCanceledRevision}
                          >
                            <MenuItem value="CHARACTER">CHARACTER</MenuItem>
                            <MenuItem value="TOKEN">TOKEN</MenuItem>
                          </Select>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <TextField
                            label="최대 크기"
                            size="small"
                            type="number"
                            fullWidth
                            value={chunkMaxSize}
                            onChange={(e) => setChunkMaxSize(e.target.value)}
                            disabled={controlsDisabled || isCanceledRevision}
                            placeholder="800 (기본값)"
                            helperText="양수"
                            FormHelperTextProps={{ sx: { m: 0, mt: 0.5, fontSize: 10 } }}
                          />
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <TextField
                            label="중첩 크기"
                            size="small"
                            type="number"
                            fullWidth
                            value={chunkOverlap}
                            onChange={(e) => setChunkOverlap(e.target.value)}
                            disabled={controlsDisabled || isCanceledRevision}
                            placeholder="100 (기본값)"
                            helperText="0 이상, 최대 크기 미만"
                            FormHelperTextProps={{ sx: { m: 0, mt: 0.5, fontSize: 10 } }}
                          />
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  {/* RAG Configuration Form */}
                  {runRagIndex && (
                    <Box sx={{ mb: 2, p: 2, border: "1px solid", borderColor: "divider", borderRadius: 1.5, bgcolor: "background.default" }}>
                      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, fontSize: 13 }}>
                        RAG 색인 설정
                      </Typography>

                      {embeddingOptions.length > 0 ? (
                        <TextField
                          select
                          label="임베딩 모델 / 프로파일"
                          size="small"
                          fullWidth
                          value={selectedEmbeddingOption ? embeddingOptionKey(selectedEmbeddingOption) : ""}
                          onChange={(e) => {
                            const matched = embeddingOptions.find((o) => embeddingOptionKey(o) === e.target.value);
                            if (matched) setSelectedEmbeddingOption(matched);
                          }}
                          disabled={controlsDisabled || isCanceledRevision}
                          helperText={
                            selectedEmbeddingOption?.profileId
                              ? `Profile 방식 · dimension: ${selectedEmbeddingOption.dimension ?? "-"}`
                              : selectedEmbeddingOption
                              ? `직접 방식 · dimension: ${selectedEmbeddingOption.dimension ?? "-"}`
                              : "서버에 등록된 임베딩 옵션을 선택합니다."
                          }
                          FormHelperTextProps={{ sx: { m: 0, mt: 0.5, fontSize: 10 } }}
                        >
                          {embeddingOptions.map((opt) => (
                            <MenuItem key={embeddingOptionKey(opt)} value={embeddingOptionKey(opt)}>
                              {embeddingOptionLabel(opt)}
                            </MenuItem>
                          ))}
                        </TextField>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
                          임베딩 옵션 로딩 중...
                        </Typography>
                      )}
                    </Box>
                  )}

                  {/* Skill Configuration Form */}
                  {runSkillExtraction && (
                    <Box sx={{ mb: 2, p: 2, border: "1px solid", borderColor: "divider", borderRadius: 1.5, bgcolor: "background.default" }}>
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


                  {/* Actions & Global Status */}
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
                            markdownStatus === "FAILED" ? "error" :
                            "default"
                          }
                          sx={{ height: 24, fontWeight: 500 }}
                        />
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          변환 이력이 없습니다.
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
                          disabled={controlsDisabled}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleExtractMarkdown();
                          }}
                        >
                          Markdown 변환
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={controlsDisabled}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleManualEstimate();
                          }}
                        >
                          부하 추산
                        </Button>
                      </Stack>
                    ) : (
                      <Stack spacing={1.5} width="100%" sx={{ mt: 1 }}>
                        {isCanceledRevision ? (
                          <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, fontSize: 13 }}>
                              Markdown 생성 취소됨
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1, lineHeight: 1.4 }}>
                              이전 Markdown 변환이 취소되었습니다. 작업을 완료하려면 다시 생성해야 합니다.
                            </Typography>
                            <Button
                              size="small"
                              variant="contained"
                              color="primary"
                              disabled={controlsDisabled}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleRecreateMarkdownFromCanceled();
                              }}
                            >
                              Markdown 다시 생성
                            </Button>
                          </Box>
                        ) : (
                          <>
                            {/* 1. Reextract option (Create New Revision) */}
                            <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, fontSize: 13 }}>
                                신규 재추출 (Reextract)
                              </Typography>
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1, lineHeight: 1.4 }}>
                                기존 이력과 관계없이 새로운 리비전(문서 버전)을 생성하여 처음부터 모든 파이프라인 단계를 다시 수행합니다.
                              </Typography>
                              <Stack direction="row" spacing={1}>
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="warning"
                                  disabled={controlsDisabled}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleReextractMarkdown();
                                  }}
                                >
                                  새로 재추출 실행
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="warning"
                                  disabled={controlsDisabled}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleManualEstimate();
                                  }}
                                >
                                  부하 추산
                                </Button>
                              </Stack>
                            </Box>

                            {/* 2. Resume Options (Continue Existing Revision) */}
                            <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, fontSize: 13 }}>
                                작업 재개 (Resume)
                              </Typography>
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1, lineHeight: 1.4 }}>
                                기존 리비전 상태를 유지하면서 지정한 단계부터 후속 처리를 이어서 진행합니다.
                              </Typography>
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  disabled={controlsDisabled || markdownStatus !== "COMPLETED" || pipelineExecution?.status === "COMPLETED"}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleResume(null);
                                  }}
                                >
                                  이어서 진행
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  disabled={controlsDisabled || markdownStatus !== "COMPLETED"}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleResume("CHUNKING");
                                  }}
                                >
                                  청킹부터 재실행
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  disabled={controlsDisabled || markdownStatus !== "COMPLETED" || !selectedEmbeddingOption}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleReindexRag();
                                  }}
                                >
                                  RAG 색인부터 재실행
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  disabled={controlsDisabled || markdownStatus !== "COMPLETED"}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleResume("SKILL_EXTRACTION");
                                  }}
                                >
                                  Skill 추출부터 재실행
                                </Button>
                              </Stack>
                              {markdownStatus !== "COMPLETED" && (
                                <Alert severity="info" sx={{ mt: 1.5, py: 0.5, px: 1, "& .MuiAlert-message": { fontSize: 11, lineHeight: 1.4 } }}>
                                  Markdown 변환이 완료되지 않았거나 실패하여 작업을 재개할 수 없습니다. 상단의 '새로 재추출'을 먼저 실행해 주십시오.
                                </Alert>
                              )}
                            </Box>
                          </>
                        )}
                      </Stack>
                    )}
                  </Stack>

                  {/* Pipeline Status Dashboard */}
                  {renderPipelineStatusDashboard()}

                  {/* Polling Progress */}
                  {isPendingOrRunning && (
                    <Box sx={{ mt: 1.5, mb: 1.5, bgcolor: "action.hover", p: 1.5, borderRadius: 1.5, border: "1px dashed", borderColor: "primary.main" }}>
                      <Stack direction="column" spacing={1} width="100%">
                        <Stack direction="row" spacing={1.5} alignItems="center" width="100%">
                          <CircularProgress size={16} />
                          <Typography variant="caption" color="text.secondary">
                            {(() => {
                              if (pipelineProgress) {
                                const pipeline = pipelineProgress;
                                const rag = pipeline.rag;
                                if (pipeline.status === "RUNNING" && pipeline.currentStage === "CHUNKING") {
                                  return "청킹 중";
                                }
                                if (pipeline.status === "RUNNING" && pipeline.currentStage === "RAG_INDEX") {
                                  if (rag?.currentStep === "EMBEDDING") {
                                    return `임베딩 중 ${rag.embeddedCount ?? 0} / ${rag.chunkCount ?? 0}`;
                                  } else if (rag?.currentStep === "INDEXING") {
                                    return `벡터 저장 중 ${rag.indexedCount ?? 0} / ${rag.chunkCount ?? 0}`;
                                  }
                                }
                                if (pipeline.status === "FAILED") {
                                  return `실패: ${pipeline.errorCode}`;
                                }
                              }
                              // Fallback to legacy check
                              if (latestRagJob?.status === "RUNNING" || latestRagJob?.status === "PENDING") {
                                return `RAG 색인 진행 중... (${latestRagJob.currentStep})`;
                              }
                              if (markdownStatus === "COMPLETED" && pipelineExecution?.status === "RUNNING" && pipelineExecution?.currentStage === "RAG_INDEX") {
                                return "Markdown 생성 완료, RAG 색인 진행 중...";
                              }
                              return "Markdown 지식 파이프라인 진행 중...";
                            })()}
                          </Typography>
                          {(latestRagJob?.status === "RUNNING" || latestRagJob?.status === "PENDING") && (
                            <Button
                              size="small"
                              color="error"
                              variant="text"
                              sx={{ minWidth: 0, p: 0, ml: "auto", fontSize: 11 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleCancelRagJob(latestRagJob.jobId);
                              }}
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
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleCancelMarkdown();
                              }}
                            >
                              {isCanceling ? "취소 중..." : "변환 취소"}
                            </Button>
                          )}
                        </Stack>
                      </Stack>
                    </Box>
                  )}

                  {/* FAILED message */}
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
                        <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1 }}>
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
                          <Alert severity="warning" sx={{ mt: 1, mb: 1.5, color: "warning.dark", py: 0.5, px: 1, "& .MuiAlert-message": { fontSize: 11, lineHeight: 1.4 } }}>
                            이전 실행과 동일한 오류가 발생했습니다. 재시도 전 서버 설정(예: KURE 임베딩 서버 batch size, Blockify 활성화 여부 등)이 변경 및 반영되었는지 꼭 확인해 주세요.
                          </Alert>
                        )}
                        <Stack direction="row" spacing={1.5}>
                          <Button
                            size="small"
                            variant="contained"
                            color="warning"
                            sx={{ textTransform: "none", fontSize: 11, py: 0.5 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              const failedStage = pipelineProgress?.currentStage || pipelineExecution?.currentStage;
                              if (failedStage) {
                                void handleResume(failedStage);
                              } else {
                                void handleResume(null);
                              }
                            }}
                          >
                            실패 단계부터 재개
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="inherit"
                            sx={{ textTransform: "none", fontSize: 11, py: 0.5 }}
                            disabled={!selectedEmbeddingOption}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleReindexRag();
                            }}
                          >
                            RAG 다시 실행
                          </Button>
                        </Stack>
                      </Box>
                    );
                  })()}

                  {/* Metadata Table (Visible whenever documentId exists) */}
                  {documentId && (
                    <Stack spacing={2} sx={{ mt: 2 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontWeight: 600 }}>
                          변환 및 파이프라인 상세 메타데이터
                        </Typography>
                        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
                          <Table size="small" sx={{ "& tr td:first-of-type": { borderRight: "1px solid", borderColor: "divider" } }}>
                            <TableBody>
                              <TableRow>
                                <TableCell sx={{ bgcolor: "action.hover", fontWeight: 600, width: "32%", fontSize: 11 }}>원본 Attachment ID</TableCell>
                                <TableCell sx={{ fontSize: 11 }}>{attachmentId || "-"}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ bgcolor: "action.hover", fontWeight: 600, fontSize: 11 }}>1. Markdown Document ID</TableCell>
                                <TableCell sx={{ fontSize: 11, wordBreak: "break-all" }}>{documentId}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ bgcolor: "action.hover", fontWeight: 600, fontSize: 11 }}>2. Revision ID</TableCell>
                                <TableCell sx={{ fontSize: 11, wordBreak: "break-all" }}>{latestRevision?.revisionId || "-"}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ bgcolor: "action.hover", fontWeight: 600, fontSize: 11 }}>3. 추출 상태 (Revision status)</TableCell>
                                <TableCell sx={{ fontSize: 11 }}>{latestRevision?.status || "-"}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ bgcolor: "action.hover", fontWeight: 600, fontSize: 11 }}>4. Pipeline 상태 / 현재 단계</TableCell>
                                <TableCell sx={{ fontSize: 11 }}>
                                  {pipelineExecution ? `${pipelineExecution.status} / ${pipelineExecution.currentStage}` : "-"}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ bgcolor: "action.hover", fontWeight: 600, fontSize: 11 }}>5. 마지막 성공 단계</TableCell>
                                <TableCell sx={{ fontSize: 11 }}>{pipelineExecution?.lastCompletedStage || "-"}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ bgcolor: "action.hover", fontWeight: 600, fontSize: 11 }}>6. 실행 횟수 (Attempt Count)</TableCell>
                                <TableCell sx={{ fontSize: 11 }}>{pipelineExecution?.attemptCount ?? "-"}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ bgcolor: "action.hover", fontWeight: 600, fontSize: 11 }}>7. 오류 코드 및 메시지</TableCell>
                                <TableCell sx={{ fontSize: 11, wordBreak: "break-all" }}>
                                  {pipelineExecution?.errorCode || latestRevision?.errorCode
                                    ? `[${pipelineExecution?.errorCode || latestRevision?.errorCode}] `
                                    : ""}
                                  {pipelineExecution?.errorMessage || latestRevision?.errorMessage || markdownError || "-"}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ bgcolor: "action.hover", fontWeight: 600, fontSize: 11 }}>8. 시각 정보 (생성/시작/완료/갱신)</TableCell>
                                <TableCell sx={{ fontSize: 11, whiteSpace: "pre-wrap" }}>
                                  {`생성: ${formatDate(latestRevision?.createdAt) || "-"}\n` +
                                   `시작: ${formatDate(pipelineExecution?.startedAt) || "-"}\n` +
                                   `완료: ${formatDate(pipelineExecution?.completedAt || latestRevision?.completedAt) || "-"}\n` +
                                   `갱신: ${formatDate(pipelineExecution?.updatedAt) || "-"}`}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ bgcolor: "action.hover", fontWeight: 600, fontSize: 11 }}>9. Document Convert Job ID</TableCell>
                                <TableCell sx={{ fontSize: 11, wordBreak: "break-all" }}>{latestRevision?.documentConvertJobId || "-"}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ bgcolor: "action.hover", fontWeight: 600, fontSize: 11 }}>적용된 파이프라인 옵션</TableCell>
                                <TableCell sx={{ fontSize: 11, whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
                                  {latestRevision?.optionsJson ? (
                                    (() => {
                                      try {
                                        return JSON.stringify(JSON.parse(latestRevision.optionsJson), null, 2);
                                      } catch {
                                        return latestRevision.optionsJson;
                                      }
                                    })()
                                  ) : (
                                    `Chunking: ${runChunking ? "Y" : "N"}\n` +
                                    `RAG 색인: ${runRagIndex ? "Y" : "N"}\n` +
                                    `Skill 추출: ${runSkillExtraction ? "Y" : "N"}`
                                  )}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>

                      {/* Revision 이력 Table */}
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontWeight: 600 }}>
                          Revision 이력
                        </Typography>
                        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 200, borderRadius: 1 }}>
                          <Table size="small" stickyHeader>
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontSize: 10, fontWeight: 600 }}>버전 (Rev ID)</TableCell>
                                <TableCell sx={{ fontSize: 10, fontWeight: 600 }}>상태</TableCell>
                                <TableCell sx={{ fontSize: 10, fontWeight: 600 }}>생성 시간</TableCell>
                                <TableCell sx={{ fontSize: 10, fontWeight: 600 }}>오류 내용</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {revisions.map((rev) => (
                                <TableRow key={rev.revisionId} hover>
                                  <TableCell sx={{ fontSize: 10, fontFamily: "monospace" }}>{rev.revisionId.substring(0, 8)}</TableCell>
                                  <TableCell sx={{ fontSize: 10 }}>
                                    <Chip
                                      label={rev.status}
                                      size="small"
                                      color={
                                        rev.status === "COMPLETED" ? "success" :
                                        rev.status === "FAILED" ? "error" :
                                        rev.status === "CANCELED" ? "default" : "primary"
                                      }
                                      sx={{ height: 16, fontSize: 8.5, borderRadius: "3px" }}
                                    />
                                  </TableCell>
                                  <TableCell sx={{ fontSize: 10 }}>{formatDate(rev.createdAt)}</TableCell>
                                  <TableCell sx={{ fontSize: 10, color: "error.main", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {rev.errorMessage || "-"}
                                  </TableCell>
                                </TableRow>
                              ))}
                              {revisions.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={4} align="center" sx={{ fontSize: 10, py: 2, color: "text.secondary" }}>
                                    이력이 없습니다.
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>

                      {/* RAG Job 이력 Table */}
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontWeight: 600 }}>
                          RAG Job 이력
                        </Typography>
                        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 200, borderRadius: 1 }}>
                          <Table size="small" stickyHeader>
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontSize: 10, fontWeight: 600 }}>임베딩 모델</TableCell>
                                <TableCell sx={{ fontSize: 10, fontWeight: 600 }}>상태</TableCell>
                                <TableCell sx={{ fontSize: 10, fontWeight: 600 }}>청크 (색인/총)</TableCell>
                                <TableCell sx={{ fontSize: 10, fontWeight: 600 }}>실패 사유</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {ragJobs.map((job) => (
                                <TableRow key={job.jobId} hover>
                                  <TableCell sx={{ fontSize: 10, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {job.embeddingModel || "-"}
                                  </TableCell>
                                  <TableCell sx={{ fontSize: 10 }}>
                                    <Chip
                                      label={job.status}
                                      size="small"
                                      color={
                                        job.status === "SUCCEEDED" ? "success" :
                                        job.status === "FAILED" ? "error" :
                                        job.status === "CANCELLED" ? "default" : "primary"
                                      }
                                      sx={{ height: 16, fontSize: 8.5, borderRadius: "3px" }}
                                    />
                                  </TableCell>
                                  <TableCell sx={{ fontSize: 10 }}>
                                    {job.indexedCount} / {job.chunkCount}
                                  </TableCell>
                                  <TableCell sx={{ fontSize: 10, color: "error.main", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {job.errorMessage || "-"}
                                  </TableCell>
                                </TableRow>
                              ))}
                              {ragJobs.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={4} align="center" sx={{ fontSize: 10, py: 2, color: "text.secondary" }}>
                                    이력이 없습니다.
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                      {latestRevision?.status === "COMPLETED" && (
                        <>
                          {latestRevision?.markdownText && (
                        <Box>
                          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                              추출된 Markdown 본문
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (latestRevision?.markdownText) {
                                  await navigator.clipboard.writeText(latestRevision.markdownText);
                                  toast.success("클립보드에 복사했습니다.");
                                }
                              }}
                            >
                              <ContentCopyOutlined fontSize="inherit" />
                            </IconButton>
                          </Stack>
                          <Box
                            component="pre"
                            sx={{
                              m: 0,
                              maxHeight: 200,
                              overflow: "auto",
                              whiteSpace: "pre-wrap",
                              overflowWrap: "anywhere",
                              wordBreak: "break-word",
                              border: "1px solid",
                              borderColor: "divider",
                              borderRadius: 1,
                              bgcolor: "background.default",
                              color: "text.primary",
                              p: 1.5,
                              fontFamily: "monospace",
                              fontSize: 12,
                              lineHeight: 1.6,
                            }}
                          >
                            {latestRevision.markdownText}
                          </Box>
                        </Box>
                      )}

                      {/* Locators Section */}
                      {locators.length > 0 && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontWeight: 600 }}>
                            목차 및 위치 정보 (Locators)
                          </Typography>
                          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 180, overflow: "auto", borderRadius: 1 }}>
                            <Table size="small" stickyHeader>
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ fontSize: 10, fontWeight: 600 }}>Level</TableCell>
                                  <TableCell sx={{ fontSize: 10, fontWeight: 600 }}>제목 (Title)</TableCell>
                                  <TableCell sx={{ fontSize: 10, fontWeight: 600 }}>오프셋 (Offset)</TableCell>
                                  <TableCell sx={{ fontSize: 10, fontWeight: 600 }}>페이지</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {locators.map((loc) => (
                                  <TableRow key={loc.locatorId} hover>
                                    <TableCell sx={{ fontSize: 10 }}>L{loc.level}</TableCell>
                                    <TableCell sx={{ fontSize: 10, fontWeight: 500 }}>{loc.title}</TableCell>
                                    <TableCell sx={{ fontSize: 10, color: "text.secondary" }}>{loc.startOffset} ~ {loc.endOffset}</TableCell>
                                    <TableCell sx={{ fontSize: 10 }}>{loc.pageNumber ?? "-"}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Box>
                      )}

                      {/* Resources Section */}
                      {resources.length > 0 && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontWeight: 600 }}>
                            추출 리소스 목록 (Resources)
                          </Typography>
                          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 180, overflow: "auto", borderRadius: 1 }}>
                            <Table size="small" stickyHeader>
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ fontSize: 10, fontWeight: 600 }}>리소스명</TableCell>
                                  <TableCell sx={{ fontSize: 10, fontWeight: 600 }}>유형 / 형식</TableCell>
                                  <TableCell sx={{ fontSize: 10, fontWeight: 600 }}>크기</TableCell>
                                  <TableCell sx={{ fontSize: 10, fontWeight: 600, textAlign: "right" }}>작업</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {resources.map((res) => (
                                  <TableRow key={res.resourceId} hover>
                                    <TableCell sx={{ fontSize: 10, fontWeight: 500, wordBreak: "break-all" }}>{res.name}</TableCell>
                                    <TableCell sx={{ fontSize: 10, color: "text.secondary" }}>
                                      {res.resourceType} ({res.contentType})
                                    </TableCell>
                                    <TableCell sx={{ fontSize: 10 }}>{formatFileSize(res.sizeBytes)}</TableCell>
                                    <TableCell sx={{ fontSize: 10, textAlign: "right" }}>
                                      <IconButton
                                        size="small"
                                        color="primary"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          window.location.assign(`/api/mgmt/files/${encodeURIComponent(res.attachmentId)}/download`);
                                        }}
                                      >
                                        <DownloadOutlined fontSize="inherit" />
                                      </IconButton>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Box>
                      )}

                      {latestRevision?.resultAttachmentId && (
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          fullWidth
                          startIcon={<DownloadOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.assign(`/api/mgmt/files/${encodeURIComponent(latestRevision.resultAttachmentId!)}/download`);
                          }}
                        >
                          변환 결과 파일 다운로드
                        </Button>
                      )}
                    </>
                  )}
                </Stack>
              )}
                </AccordionDetails>
              </Accordion>

              {/* Card 4: RAG Metadata Accordion */}
              {metadataEntries.length > 0 ? (
                <Accordion disableGutters square elevation={0} onChange={handleAccordionChange}>
                  <AccordionSummary expandIcon={<ExpandMoreOutlined />} sx={{ bgcolor: "action.hover", borderBottom: "1px solid", borderColor: "divider", minHeight: 40, "& .MuiAccordionSummary-content": { my: 1 } }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      RAG Metadata
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 2, bgcolor: "background.paper" }}>
                    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
                      <Table size="small">
                        <TableBody>
                          {metadataEntries.map(([key, value]) => (
                            <TableRow key={key}>
                              <TableCell sx={{ bgcolor: "action.hover", fontWeight: 600, width: "35%", fontSize: 11, verticalAlign: "top" }}>{key}</TableCell>
                              <TableCell sx={{ fontSize: 11, overflowWrap: "anywhere", wordBreak: "break-all" }}>
                                {typeof value === "object" && value !== null ? (
                                  <Box component="pre" sx={{ m: 0, fontFamily: "monospace", fontSize: 10, whiteSpace: "pre-wrap", overflowWrap: "anywhere", bgcolor: "action.hover", p: 1, borderRadius: 0.5 }}>
                                    {JSON.stringify(value, null, 2)}
                                  </Box>
                                ) : (
                                  String(value)
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </AccordionDetails>
                </Accordion>
              ) : null}
              </Box>
            </>
          ) : (
            <Typography color="text.secondary">데이터 없음</Typography>
          )}
        </Box>

        <Divider />
        <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center" sx={{ p: 2, flexShrink: 0 }}>
          <Stack direction="row" spacing={1}>
            {file && getDocumentFormat(file.name, file.contentType) && (
              <Button
                variant="contained"
                color="primary"
                onClick={() => setConvertDialogOpen(true)}
              >
                문서 변환
              </Button>
            )}
            {isEpub && (
              <Button
                variant="contained"
                color="primary"
                onClick={() => setEpubReaderOpen(true)}
              >
                미리보기 (EPUB)
              </Button>
            )}
            {isPdf && (
              <Button
                variant="contained"
                color="primary"
                onClick={() => setPdfReaderOpen(true)}
              >
                미리보기 (PDF)
              </Button>
            )}
          </Stack>
          <Button onClick={onClose}>닫기</Button>
        </Stack>

        {loading || textExtracting || isExtracting || isCanceling ? (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              bgcolor: "rgba(255, 255, 255, 0.56)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1300,
            }}
          >
            <CircularProgress />
          </Box>
        ) : null}

      {file && convertDialogOpen && (
        <DocumentConvertDialog
          open={convertDialogOpen}
          onClose={() => setConvertDialogOpen(false)}
          file={file}
        />
      )}
      {file && epubReaderOpen && (
        <EpubReaderDialog
          open={epubReaderOpen}
          onClose={() => setEpubReaderOpen(false)}
          url={`/api/mgmt/files/${file.attachmentId}/download`}
          filename={file.name}
        />
      )}
      {file && pdfReaderOpen && (
        <PdfReaderDialog
          open={pdfReaderOpen}
          onClose={() => setPdfReaderOpen(false)}
          url={`/api/mgmt/files/${file.attachmentId}/download`}
          filename={file.name}
        />
      )}
    </Drawer>
  );
}
