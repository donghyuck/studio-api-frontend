import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Select,
  Switch,
  Container,
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
  ArrowBackIosNewOutlined,
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
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { resolveAxiosError } from "@/utils/helpers";
import type { AttachmentDto } from "@/types/studio/files";
import { DocumentConvertDialog, getDocumentFormat, getFriendlyErrorMessage } from "./DocumentConvertDialog";
import { IdeaBlockSummaryPanel } from "./IdeaBlockSummaryPanel";
import { EpubReaderDialog } from "./EpubReaderDialog";
import { PdfReaderDialog } from "./PdfReaderDialog";
import { useMarkdownDocumentPolling } from "./hooks/useMarkdownDocumentPolling";
import { getCachedThumbnailUrl, requestThumbnail, invalidateThumbnail } from "./thumbnailCache";

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

export function FileDetailPage() {
  const { attachmentId: paramAttachmentId } = useParams<{ attachmentId: string }>();
  const attachmentId = Number(paramAttachmentId);
  const navigate = useNavigate();
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

  // RAG Configuration
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

  // Load embedding options and chunking config on mount
  const loadEmbeddingOptions = useCallback(async () => {
    try {
      const res = await reactAiApi.getEmbeddingOptions();
      const opts = res.options ?? [];
      setEmbeddingOptions(opts);
      const defaultOpt = opts.find((o) => o.defaultProfile) ?? opts.find((o) => o.defaultProvider) ?? opts[0];
      if (defaultOpt) {
        setSelectedEmbeddingOption(defaultOpt);
      }
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
        setChunkingStrategy(defaultStrategy);
      }
    } catch {
      // Ignore
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
    if (attachmentId) {
      void loadEmbeddingOptions();
      void loadChunkConfig();
      void loadProviders();
    }
  }, [attachmentId, loadEmbeddingOptions, loadChunkConfig, loadProviders]);

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
    if (attachmentId) {
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
    }
  }, [attachmentId, startPolling, stopPolling, setLatestRevision, setPipelineExecution, setPipelineProgress, setMarkdownStatus, setMarkdownError, setLatestRagJob, setRagJobs, toast]);

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

    if (!attachmentId) return;

    let ignored = false;
    async function loadDetail() {
      setLoading(true);
      try {
        const nextFile = await reactFilesApi.getById(attachmentId);
        if (ignored) return;

        setFile(nextFile);
        const ragState = await loadRagState(nextFile);
        if (ignored) return;

        setRagIndexed(ragState.indexed);
        setRagMetadata(ragState.metadata);
      } catch (error) {
        if (!ignored) {
          toast.error(resolveAxiosError(error));
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
          console.debug("Failed to sync markdown:", err);
        });
      return () => {
        active = false;
      };
    }
  }, [attachmentId, markdownIsPolling, latestRevision?.status]);

  useEffect(() => {
    if (!attachmentId) {
      clearThumbnail();
      return;
    }

    let ignored = false;
    const cached = getCachedThumbnailUrl(attachmentId);
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

    requestThumbnail(attachmentId, 256).then((url) => {
      if (ignored) return;
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
  }, [attachmentId, thumbnailReloadKey]);

  async function refreshDetail() {
    if (!attachmentId) return;
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
    if (status === 400) return `옵션 조합 오류: ${originalMsg}`;
    if (status === 401 || status === 403) return `권한이 부족합니다.`;
    if (status === 404) return `대상을 찾을 수 없습니다.`;
    if (status === 409) return `상태 충돌 발생 (처리 중이거나 이미 완료됨)`;
    if (status >= 500) return `서버 또는 파이프라인 장애 발생.`;
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
          estimateRes = await reactMarkdownDocumentApi.estimatePipelineByAttachment(attachmentId, estimateReq);
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
          toast.error("허용 크기를 초과했습니다.");
          return;
        } else {
          toast.error("부하 추산 실패: " + resolveAxiosError(err));
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
        estimateRes = await reactMarkdownDocumentApi.estimatePipelineByAttachment(attachmentId, estimateReq);
      } else {
        estimateRes = await reactMarkdownDocumentApi.estimatePipeline(markdownDocument.documentId, estimateReq);
      }

      if (estimateRes) {
        const recommended = estimateRes.recommended || {};
        let resultMsg = `[부하 추산 결과]\n- 위험도 (Risk Level): ${estimateRes.riskLevel}\n`;
        if (estimateRes.reason) {
          resultMsg += `- 사유: ${estimateRes.reason}\n`;
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
      toast.error("부하 추산 실패: " + resolveAxiosError(err));
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
      toast.success("Markdown 지식 파이프라인 작업이 재개되었습니다.");
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
        <Typography variant="caption" color="text.secondary" display="block">
          {label}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.25, overflowWrap: "anywhere", fontWeight: 500 }}>
          {value || "-"}
        </Typography>
      </Box>
    );
  }

  const handleScrollToSection = (section: string) => {
    setActiveSection(section);
    const element = document.getElementById(`section-${section}`);
    if (element) {
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementPosition - 20;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  const [activeSection, setActiveSection] = useState<string>("info");

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!file) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        파일 정보를 찾을 수 없거나 불러오지 못했습니다.
      </Alert>
    );
  }

  return (
    <Stack spacing={2}>
      <PageToolbar
        divider={true}
        breadcrumbs={["서비스 관리", "자원 관리", "파일", file.name]}
        label="파일의 변환 내역 및 RAG 파이프라인 처리 상태를 정밀 진단하고 조작합니다."
        previous
        onPrevious={() => navigate("/application/files")}
        onRefresh={refreshDetail}
      />
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

              {thumbnailAvailable && thumbnailUrl && (
                <Box sx={{ mt: 2, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                    썸네일 프리뷰
                  </Typography>
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
                    }}
                  />
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
              <Paper id="section-pipeline" variant="outlined" sx={{ p: 2.5, mb: 2 }}>
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

                      {latestRevision?.documentId && latestRevision?.revisionId && (
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
                      )}
                    </Box>
                  )}
                  
                  {/* Pipeline Step Checklist */}
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
                        </Grid>
                        {chunkingStrategy === "blockify" && (
                          <>
                            <Grid size={{ xs: 12 }}>
                              <Alert severity="info" sx={{ fontSize: 11, py: 1 }}>
                                Blockify는 질문·답변 형태의 IdeaBlock을 생성합니다.
                              </Alert>
                            </Grid>
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
                                label={<Typography variant="body2" sx={{ fontSize: 13 }}>개인정보 마스킹 활성화</Typography>}
                              />
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
                              : `직접 방식 · dimension: ${selectedEmbeddingOption.dimension ?? "-"}`
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
                          임베딩 모델 로딩 중...
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
                          disabled={controlsDisabled}
                          onClick={handleExtractMarkdown}
                        >
                          Markdown 변환
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={controlsDisabled}
                          onClick={handleManualEstimate}
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
                              <Stack direction="row" spacing={1}>
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="warning"
                                  disabled={controlsDisabled}
                                  onClick={handleReextractMarkdown}
                                >
                                  새로 재추출 실행
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="warning"
                                  disabled={controlsDisabled}
                                  onClick={handleManualEstimate}
                                >
                                  부하 추산
                                </Button>
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

                  {/* Metadata Table */}
                  {documentId && (
                    <Stack spacing={2} sx={{ mt: 2 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontWeight: 600 }}>
                          상세 메타데이터
                        </Typography>
                        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
                          <Table size="small">
                            <TableBody>
                              <TableRow>
                                <TableCell sx={{ bgcolor: "action.hover", fontWeight: 600, width: "32%", fontSize: 11 }}>1. Markdown Document ID</TableCell>
                                <TableCell sx={{ fontSize: 11 }}>{documentId}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ bgcolor: "action.hover", fontWeight: 600, fontSize: 11 }}>2. Revision ID</TableCell>
                                <TableCell sx={{ fontSize: 11 }}>{latestRevision?.revisionId || "-"}</TableCell>
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
                                  <TableCell sx={{ fontSize: 10 }}>{rev.revisionId.substring(0, 8)}</TableCell>
                                  <TableCell sx={{ fontSize: 10 }}>
                                    <Chip
                                      label={rev.status}
                                      size="small"
                                      color={
                                        rev.status === "COMPLETED" ? "success" :
                                        rev.status === "FAILED" ? "error" :
                                        rev.status === "CANCELED" ? "default" : "primary"
                                      }
                                      sx={{ height: 16, fontSize: 8.5 }}
                                    />
                                  </TableCell>
                                  <TableCell sx={{ fontSize: 10 }}>{formatDate(rev.createdAt)}</TableCell>
                                  <TableCell sx={{ fontSize: 10, color: "error.main" }}>{rev.errorMessage || "-"}</TableCell>
                                </TableRow>
                              ))}
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
                                  <TableCell sx={{ fontSize: 10 }}>{job.embeddingModel || "-"}</TableCell>
                                  <TableCell sx={{ fontSize: 10 }}>
                                    <Chip
                                      label={job.status}
                                      size="small"
                                      color={
                                        job.status === "SUCCEEDED" ? "success" :
                                        job.status === "FAILED" ? "error" :
                                        job.status === "CANCELLED" ? "default" : "primary"
                                      }
                                      sx={{ height: 16, fontSize: 8.5 }}
                                    />
                                  </TableCell>
                                  <TableCell sx={{ fontSize: 10 }}>{job.indexedCount} / {job.chunkCount}</TableCell>
                                  <TableCell sx={{ fontSize: 10, color: "error.main" }}>{job.errorMessage || "-"}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                    </Stack>
                  )}
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
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.2 }}>
            Contents
          </Typography>
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            <Button
              size="small"
              variant="text"
              sx={{
                justifyContent: "flex-start",
                color: activeSection === "info" ? "primary.main" : "text.secondary",
                fontWeight: activeSection === "info" ? 700 : 400,
                borderLeft: activeSection === "info" ? "2px solid" : "2px solid transparent",
                borderColor: activeSection === "info" ? "primary.main" : "transparent",
                pl: 1,
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
                fontWeight: activeSection === "textExtract" ? 700 : 400,
                borderLeft: activeSection === "textExtract" ? "2px solid" : "2px solid transparent",
                borderColor: activeSection === "textExtract" ? "primary.main" : "transparent",
                pl: 1,
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
                color: activeSection === "pipeline" ? "primary.main" : "text.secondary",
                fontWeight: activeSection === "pipeline" ? 700 : 400,
                borderLeft: activeSection === "pipeline" ? "2px solid" : "2px solid transparent",
                borderColor: activeSection === "pipeline" ? "primary.main" : "transparent",
                pl: 1,
              }}
              onClick={() => handleScrollToSection("pipeline")}
            >
              지식 파이프라인
            </Button>
          </Stack>
        </Box>
      </Box>

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
        </>
      )}
    </Stack>
  );
}
