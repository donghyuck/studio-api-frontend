import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  Link,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  CancelOutlined,
  DeleteOutline,
  InfoOutlined,
  PreviewOutlined,
  RefreshOutlined,
  SettingsOutlined,
} from "@mui/icons-material";
import { reactAiApi } from "@/react/pages/ai/api";
import { GridContent } from "@/react/components/ag-grid";
import type { ColDef } from "ag-grid-community";
import type {
  IndexedWebCapabilitiesDto,
  IndexedWebSourceRefDto,
  WebCrawlDiscoveryMode,
  WebCrawlPolicyRequest,
  WebCrawlScope,
  WebKnowledgeCrawlRunView,
  WebKnowledgePageView,
  WebKnowledgePageDetailView,
  WebKnowledgeSitePreviewView,
  WebKnowledgeSourceDto,
} from "@/types/studio/ai";
import { mapWebKnowledgeError } from "../utils/evidenceSource";

type Props = {
  workspaceId?: number | null;
  embeddingDeploymentId?: string | null;
  capabilities?: IndexedWebCapabilitiesDto | null;
  value: IndexedWebSourceRefDto[];
  maxSelectedSources?: number;
  disabled?: boolean;
  managementOnly?: boolean;
  selectionOnly?: boolean;
  listAllDeployments?: boolean;
  onChange: (value: IndexedWebSourceRefDto[]) => void;
  onResetConversation?: () => void;
};

const ACTIVE_STATUSES = new Set(["PENDING", "FETCHING", "NORMALIZING", "INDEXING"]);

export function mapWebErrorCodeToMessage(code: string | null | undefined, defaultMsg?: string): string {
  return mapWebKnowledgeError(code, defaultMsg);
}

function statusLabel(status: string) {
  switch (status) {
    case "PENDING": return "대기 중";
    case "FETCHING": return "수집 중";
    case "NORMALIZING": return "정규화 중";
    case "INDEXING": return "색인 중";
    case "COMPLETED": return "사용 가능";
    case "UNCHANGED": return "변경 없음";
    case "FAILED": return "실패";
    case "CANCELLED": return "취소됨";
    default: return status;
  }
}

function formatRunDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ko-KR");
}

function isForbiddenError(err: unknown) {
  if (!err) return false;
  if (typeof err === "object" && "status" in err && (err as { status?: number }).status === 403) return true;
  if (typeof err === "object" && "response" in err && (err as { response?: { status?: number } }).response?.status === 403) return true;
  const msg = mapWebKnowledgeError(err, "");
  return msg.includes("403") || msg.toLowerCase().includes("forbidden") || msg.includes("권한");
}

export function RagEvidenceSourcePicker({
  workspaceId,
  embeddingDeploymentId,
  capabilities,
  value,
  maxSelectedSources = 10,
  disabled = false,
  managementOnly = false,
  selectionOnly = false,
  listAllDeployments = false,
  onChange,
  onResetConversation,
}: Props) {
  const [sources, setSources] = useState<WebKnowledgeSourceDto[]>([]);
  const [url, setUrl] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [collectionMode, setCollectionMode] = useState<"SINGLE_PAGE" | "SITE">("SINGLE_PAGE");

  // Crawl Policy form state for initial SITE collection
  const [scope, setScope] = useState<WebCrawlScope>("PATH_PREFIX");
  const [discoveryMode, setDiscoveryMode] = useState<WebCrawlDiscoveryMode>("SITEMAP_AND_LINKS");
  const [maxDepth, setMaxDepth] = useState<number>(capabilities?.defaultMaxDepth ?? 2);
  const [maxPages, setMaxPages] = useState<number>(capabilities?.defaultMaxPages ?? 50);
  const [includeGlobs, setIncludeGlobs] = useState("");
  const [excludeGlobs, setExcludeGlobs] = useState("");

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<WebKnowledgeSitePreviewView | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [readError, setReadError] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [writeDisabled, setWriteDisabled] = useState(false);

  // Detail view modal/dialog for an existing source
  const [detailSource, setDetailSource] = useState<WebKnowledgeSourceDto | null>(null);
  const [detailTab, setDetailTab] = useState<"runs" | "pages">("runs");
  const [crawlRuns, setCrawlRuns] = useState<WebKnowledgeCrawlRunView[]>([]);
  const [pages, setPages] = useState<WebKnowledgePageView[]>([]);
  const [pageDetail, setPageDetail] = useState<WebKnowledgePageDetailView | null>(null);
  const [pageDetailLoading, setPageDetailLoading] = useState(false);
  const [pageDetailError, setPageDetailError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailLoadError, setDetailLoadError] = useState<string | null>(null);
  const [policyEditNotice, setPolicyEditNotice] = useState<string | null>(null);

  // Crawl Policy edit state for an existing source
  const [editScope, setEditScope] = useState<WebCrawlScope>("PATH_PREFIX");
  const [editDiscoveryMode, setEditDiscoveryMode] = useState<WebCrawlDiscoveryMode>("SITEMAP_AND_LINKS");
  const [editMaxDepth, setEditMaxDepth] = useState<number>(capabilities?.defaultMaxDepth ?? 2);
  const [editMaxPages, setEditMaxPages] = useState<number>(capabilities?.defaultMaxPages ?? 50);
  const [editIncludeGlobs, setEditIncludeGlobs] = useState("");
  const [editExcludeGlobs, setEditExcludeGlobs] = useState("");

  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const detailRequestSeqRef = useRef(0);
  const pageDetailRequestSeqRef = useRef(0);

  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  }, [value, onChange]);

  const effectiveDeploymentId = embeddingDeploymentId?.trim() || null;
  const siteCrawlEnabled = capabilities?.siteCrawlEnabled !== false;

  useEffect(() => {
    detailRequestSeqRef.current += 1;
    pageDetailRequestSeqRef.current += 1;
    setDetailSource(null);
    setLoadingDetail(false);
    setDetailLoadError(null);
    setCrawlRuns([]);
    setPages([]);
    setPageDetail(null);
    setPageDetailLoading(false);
    setPageDetailError(null);
  }, [workspaceId, effectiveDeploymentId, listAllDeployments]);

  useEffect(() => () => {
    detailRequestSeqRef.current += 1;
    pageDetailRequestSeqRef.current += 1;
  }, []);

  const buildCrawlPolicyInput = useCallback((): WebCrawlPolicyRequest | undefined => {
    if (collectionMode !== "SITE") return undefined;
    return {
      scope,
      discoveryMode,
      maxDepth: Number(maxDepth) || 2,
      maxPages: Number(maxPages) || 50,
      includePathGlobs: includeGlobs
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean),
      excludePathGlobs: excludeGlobs
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }, [collectionMode, scope, discoveryMode, maxDepth, maxPages, includeGlobs, excludeGlobs]);

  const load = useCallback(async () => {
    if (!workspaceId || (!listAllDeployments && !effectiveDeploymentId)) {
      setSources([]);
      return;
    }
    try {
      setLoading(true);
      const result = await reactAiApi.listWebKnowledgeSources(
        workspaceId,
        listAllDeployments ? undefined : effectiveDeploymentId ?? undefined
      );
      setSources(result);
      setReadError(null);

      const usableKeys = new Set(
        result
          .filter((item) => item.currentCorpusRevisionId || item.currentRevisionId)
          .map((item) => item.sourceId)
      );

      const retained = valueRef.current.filter((item) => usableKeys.has(item.sourceId));
      if (retained.length !== valueRef.current.length) {
        onChangeRef.current(retained);
        if (onResetConversation) onResetConversation();
      }
    } catch (loadError) {
      if (isForbiddenError(loadError)) {
        setReadError("이 workspace의 URL 자료를 조회할 수 없습니다.");
      } else {
        setReadError(mapWebKnowledgeError(loadError));
      }
    } finally {
      setLoading(false);
    }
  }, [workspaceId, effectiveDeploymentId, listAllDeployments, onResetConversation]);

  useEffect(() => {
    setWriteError(null);
    setWriteDisabled(false);
    void load();
  }, [workspaceId, effectiveDeploymentId, load]);

  useEffect(() => {
    if (!sources.some((source) => ACTIVE_STATUSES.has(source.status))) return;
    const timer = window.setInterval(() => void load(), 2000);
    return () => window.clearInterval(timer);
  }, [sources, load]);

  const selectedSourceIds = useMemo(
    () => new Set(value.map((item) => item.sourceId)),
    [value]
  );
  const crawlRunColumns = useMemo<ColDef<WebKnowledgeCrawlRunView>[]>(() => [
    {
      field: "runId",
      headerName: "Run ID",
      minWidth: 170,
      flex: 1,
      tooltipField: "runId",
    },
    { field: "status", headerName: "상태", width: 110 },
    { field: "discoveredCount", headerName: "발견", width: 82, type: "numericColumn" },
    { field: "fetchedCount", headerName: "수집", width: 82, type: "numericColumn" },
    { field: "indexedCount", headerName: "색인", width: 82, type: "numericColumn" },
    { field: "failedCount", headerName: "실패", width: 82, type: "numericColumn" },
    { field: "skippedCount", headerName: "제외", width: 82, type: "numericColumn" },
    { field: "responseBytes", headerName: "응답 Byte", width: 112, type: "numericColumn" },
    { field: "normalizedChars", headerName: "정규화 문자", width: 120, type: "numericColumn" },
    {
      field: "startedAt",
      headerName: "시작",
      minWidth: 170,
      valueFormatter: ({ value }) => formatRunDate(value),
    },
    {
      field: "completedAt",
      headerName: "완료",
      minWidth: 170,
      valueFormatter: ({ value }) => formatRunDate(value),
    },
    { field: "errorCode", headerName: "오류", minWidth: 180, flex: 1 },
  ], []);

  async function handlePreview() {
    if (!workspaceId || !url.trim() || !effectiveDeploymentId) return;
    try {
      setPreviewing(true);
      setWriteError(null);
      const res = await reactAiApi.previewWebKnowledgeSource(workspaceId, {
        url: url.trim(),
        crawlPolicy: buildCrawlPolicyInput(),
      });
      setPreviewData(res);
      setPreviewOpen(true);
    } catch (previewErr) {
      setWriteError(mapWebKnowledgeError(previewErr));
    } finally {
      setPreviewing(false);
    }
  }

  async function createSource() {
    if (!workspaceId || !url.trim() || !effectiveDeploymentId || writeDisabled) return;
    try {
      setSubmitting(true);
      setWriteError(null);
      await reactAiApi.createWebKnowledgeSource(workspaceId, {
        url: url.trim(),
        displayName: displayName.trim() || undefined,
        embeddingDeploymentId: effectiveDeploymentId,
        collectionMode,
        crawlPolicy: buildCrawlPolicyInput(),
      });
      setUrl("");
      setDisplayName("");
      await load();
    } catch (createErr) {
      if (isForbiddenError(createErr)) {
        setWriteDisabled(true);
        setWriteError("기존 자료만 사용할 수 있으며 새 URL을 등록할 수 없습니다.");
      } else {
        setWriteError(mapWebKnowledgeError(createErr));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function toggle(source: WebKnowledgeSourceDto) {
    const isSite = source.collectionMode === "SITE";
    const usableRevision = isSite
      ? source.currentCorpusRevisionId
      : source.currentRevisionId || source.currentCorpusRevisionId;
    const selectable =
      Boolean(usableRevision) &&
      (source.status === "COMPLETED" || source.status === "UNCHANGED");

    if (!selectable || !usableRevision) return;

    if (selectedSourceIds.has(source.sourceId)) {
      onChange(value.filter((item) => item.sourceId !== source.sourceId));
      if (onResetConversation) onResetConversation();
      return;
    }

    if (value.length >= maxSelectedSources) return;

    const ref: IndexedWebSourceRefDto = isSite
      ? { sourceId: source.sourceId, corpusRevisionId: source.currentCorpusRevisionId || undefined }
      : { sourceId: source.sourceId, revisionId: (source.currentRevisionId || source.currentCorpusRevisionId) || undefined };

    onChange([...value, ref]);
    if (onResetConversation) onResetConversation();
  }

  function upgradeRevision(source: WebKnowledgeSourceDto) {
    const isSite = source.collectionMode === "SITE";
    const updatedValue = value.map((item) => {
      if (item.sourceId === source.sourceId) {
        return isSite
          ? { sourceId: source.sourceId, corpusRevisionId: source.currentCorpusRevisionId || undefined }
          : { sourceId: source.sourceId, revisionId: (source.currentRevisionId || source.currentCorpusRevisionId) || undefined };
      }
      return item;
    });
    onChange(updatedValue);
    if (onResetConversation) onResetConversation();
  }

  async function refreshSource(sourceId: string) {
    if (!workspaceId || writeDisabled) return;
    try {
      setWriteError(null);
      await reactAiApi.refreshWebKnowledgeSource(workspaceId, sourceId);
      await load();
    } catch (refreshErr) {
      setWriteError(mapWebKnowledgeError(refreshErr));
    }
  }

  async function cancelSource(sourceId: string) {
    if (!workspaceId || writeDisabled) return;
    try {
      setWriteError(null);
      await reactAiApi.cancelWebKnowledgeSource(workspaceId, sourceId);
      await load();
    } catch (cancelErr) {
      setWriteError(mapWebKnowledgeError(cancelErr));
    }
  }

  async function archiveSource(sourceId: string) {
    if (!workspaceId || writeDisabled) return;
    try {
      setWriteError(null);
      await reactAiApi.archiveWebKnowledgeSource(workspaceId, sourceId);
      onChange(value.filter((item) => item.sourceId !== sourceId));
      if (onResetConversation) onResetConversation();
      await load();
    } catch (archiveErr) {
      setWriteError(mapWebKnowledgeError(archiveErr));
    }
  }

  async function openDetailView(source: WebKnowledgeSourceDto) {
    const requestSeq = ++detailRequestSeqRef.current;
    pageDetailRequestSeqRef.current += 1;
    setDetailSource(source);
    setDetailTab("runs");
    setCrawlRuns([]);
    setPages([]);
    setDetailLoadError(null);
    setPageDetail(null);
    setPageDetailError(null);
    setPageDetailLoading(false);
    setPolicyEditNotice(null);

    const savedPolicy = source.crawlPolicy;
    setEditScope(savedPolicy?.scope ?? "PATH_PREFIX");
    setEditDiscoveryMode(savedPolicy?.discoveryMode ?? "SITEMAP_AND_LINKS");
    setEditMaxDepth(savedPolicy?.maxDepth ?? capabilities?.defaultMaxDepth ?? 2);
    setEditMaxPages(savedPolicy?.maxPages ?? capabilities?.defaultMaxPages ?? 50);
    setEditIncludeGlobs((savedPolicy?.includePathGlobs ?? []).join(", "));
    setEditExcludeGlobs((savedPolicy?.excludePathGlobs ?? []).join(", "));

    if (!workspaceId) return;
    try {
      setLoadingDetail(true);
      const [runsResult, pagesResult] = await Promise.allSettled([
        reactAiApi.listCrawlRuns(workspaceId, source.sourceId),
        reactAiApi.listPages(workspaceId, source.sourceId),
      ]);
      if (requestSeq !== detailRequestSeqRef.current) return;

      if (runsResult.status === "fulfilled") setCrawlRuns(runsResult.value);
      if (pagesResult.status === "fulfilled") setPages(pagesResult.value);

      const rejectedResult = runsResult.status === "rejected" ? runsResult : pagesResult.status === "rejected" ? pagesResult : null;
      if (rejectedResult) {
        setDetailLoadError(mapWebKnowledgeError(rejectedResult.reason, "수집 이력 또는 페이지 목록을 불러오지 못했습니다."));
      }
    } finally {
      if (requestSeq === detailRequestSeqRef.current) setLoadingDetail(false);
    }
  }

  async function openPageDetail(page: WebKnowledgePageView) {
    if (!workspaceId || !detailSource) return;
    const requestSeq = ++pageDetailRequestSeqRef.current;
    try {
      setPageDetailLoading(true);
      setPageDetail(null);
      setPageDetailError(null);
      const result = await reactAiApi.getPage(workspaceId, detailSource.sourceId, page.pageId);
      if (requestSeq === pageDetailRequestSeqRef.current) setPageDetail(result);
    } catch (err) {
      if (requestSeq === pageDetailRequestSeqRef.current) setPageDetailError(mapWebKnowledgeError(err));
    } finally {
      if (requestSeq === pageDetailRequestSeqRef.current) setPageDetailLoading(false);
    }
  }

  function closePageDetail() {
    pageDetailRequestSeqRef.current += 1;
    setPageDetail(null);
    setPageDetailLoading(false);
    setPageDetailError(null);
  }

  function closeDetailView() {
    detailRequestSeqRef.current += 1;
    setDetailSource(null);
    setLoadingDetail(false);
    setDetailLoadError(null);
    setCrawlRuns([]);
    setPages([]);
    closePageDetail();
  }

  async function handleUpdatePolicyAndRefresh() {
    if (!workspaceId || !detailSource) return;
    if (detailSource.collectionMode === "SINGLE_PAGE") {
      setPolicyEditNotice("서버의 수집 범위 전환 기능이 필요합니다.");
      return;
    }
    const requestSeq = ++detailRequestSeqRef.current;
    const sourceId = detailSource.sourceId;
    try {
      setLoadingDetail(true);
      const payload: WebCrawlPolicyRequest = {
        scope: editScope,
        discoveryMode: editDiscoveryMode,
        maxDepth: Number(editMaxDepth) || 2,
        maxPages: Number(editMaxPages) || 50,
        includePathGlobs: editIncludeGlobs
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean),
        excludePathGlobs: editExcludeGlobs
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean),
      };
      await reactAiApi.updateCrawlPolicy(workspaceId, sourceId, payload);
      await reactAiApi.refreshWebKnowledgeSource(workspaceId, sourceId);
      if (requestSeq !== detailRequestSeqRef.current) return;
      setPolicyEditNotice("수집 정책을 갱신하고 재수집을 시작했습니다.");
      await load();
      if (requestSeq === detailRequestSeqRef.current) closeDetailView();
    } catch (err) {
      if (requestSeq === detailRequestSeqRef.current) setPolicyEditNotice(mapWebKnowledgeError(err));
    } finally {
      if (requestSeq === detailRequestSeqRef.current) setLoadingDetail(false);
    }
  }

  if (!workspaceId) {
    return <Alert severity="info">자료를 저장할 workspace를 선택해 주세요.</Alert>;
  }

  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
          {selectionOnly ? "Workspace URL 자료" : "수집한 웹 참고자료"}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {selectionOnly
            ? "현재 문서와 함께 답변 근거로 사용할 기존 URL 자료를 선택합니다."
            : "공개 HTTPS URL 한 페이지 또는 사이트 전체를 수집하여 RAG 근거로 활용합니다."}
        </Typography>
      </Box>

      {writeError ? <Alert severity="warning">{writeError}</Alert> : null}
      {readError ? <Alert severity="error">{readError}</Alert> : null}

      {/* Prominent Collection Mode Box */}
      <Paper variant="outlined" sx={{ display: selectionOnly ? "none" : undefined, p: 2, borderRadius: 2, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "text.primary" }}>
            수집 범위 설정
          </Typography>

          <RadioGroup
            row
            value={collectionMode}
            onChange={(e) => setCollectionMode(e.target.value as "SINGLE_PAGE" | "SITE")}
          >
            <FormControlLabel
              value="SINGLE_PAGE"
              control={<Radio size="small" />}
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: collectionMode === "SINGLE_PAGE" ? 700 : 400 }}>
                    📄 이 페이지만 (SINGLE_PAGE)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    입력한 특정 URL 1개 페이지 내용만 수집
                  </Typography>
                </Box>
              }
            />
            <FormControlLabel
              value="SITE"
              control={<Radio size="small" />}
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: collectionMode === "SITE" ? 800 : 400, color: "primary.main" }}>
                    🌐 하위 페이지 포함 (SITE)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    사이트 하위 경로 및 연결 링크 페이지 묶음 수집
                  </Typography>
                </Box>
              }
            />
          </RadioGroup>

          {/* Additional Options Panel for SITE (Automatically shown when SITE is selected) */}
          <Collapse in={collectionMode === "SITE"}>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: "action.hover", borderRadius: 2, mt: 1 }}>
              <Stack spacing={1.5}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "primary.main" }}>
                  ⚙️ 사이트 세부 수집 옵션 (Crawl Policy)
                </Typography>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>수집 범위 (Scope)</InputLabel>
                    <Select
                      value={scope}
                      label="수집 범위 (Scope)"
                      onChange={(e) => setScope(e.target.value as WebCrawlScope)}
                    >
                      <MenuItem value="PATH_PREFIX">PATH_PREFIX (경로 접두사 유지)</MenuItem>
                      <MenuItem value="SAME_ORIGIN">SAME_ORIGIN (동일 도메인 전체)</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" fullWidth>
                    <InputLabel>발견 방식 (Discovery Mode)</InputLabel>
                    <Select
                      value={discoveryMode}
                      label="발견 방식 (Discovery Mode)"
                      onChange={(e) => setDiscoveryMode(e.target.value as WebCrawlDiscoveryMode)}
                    >
                      <MenuItem value="SITEMAP_AND_LINKS">SITEMAP_AND_LINKS (사이트맵 + 링크)</MenuItem>
                      <MenuItem value="SITEMAP_ONLY">SITEMAP_ONLY (사이트맵만)</MenuItem>
                      <MenuItem value="LINKS_ONLY">LINKS_ONLY (링크만)</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>

                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small"
                    type="number"
                    label="최대 깊이 (Max Depth)"
                    value={maxDepth}
                    onChange={(e) => setMaxDepth(Number(e.target.value))}
                    inputProps={{ min: 1, max: capabilities?.maximumDepth ?? 5 }}
                    fullWidth
                  />
                  <TextField
                    size="small"
                    type="number"
                    label="최대 페이지 수 (Max Pages)"
                    value={maxPages}
                    onChange={(e) => setMaxPages(Number(e.target.value))}
                    inputProps={{ min: 1, max: capabilities?.maximumPages ?? 500 }}
                    fullWidth
                  />
                </Stack>

                <Stack spacing={1}>
                  <TextField
                    size="small"
                    label="포함 패턴 (Include Globs, 쉼표/줄바꿈 구분)"
                    placeholder="/docs/**, /guide/**"
                    value={includeGlobs}
                    onChange={(e) => setIncludeGlobs(e.target.value)}
                    fullWidth
                  />
                  <TextField
                    size="small"
                    label="제외 패턴 (Exclude Globs, 쉼표/줄바꿈 구분)"
                    placeholder="/archive/**, /tag/**"
                    value={excludeGlobs}
                    onChange={(e) => setExcludeGlobs(e.target.value)}
                    fullWidth
                  />
                </Stack>
              </Stack>
            </Paper>
          </Collapse>
        </Stack>
      </Paper>

      {/* URL Input Row */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ display: selectionOnly ? "none" : undefined }}>
        <TextField
          size="small"
          type="url"
          label="공개 HTTPS URL"
          placeholder="https://example.org/docs/"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={disabled || submitting || writeDisabled}
          fullWidth
        />
        <TextField
          size="small"
          label="표시 이름 (선택)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={disabled || submitting || writeDisabled}
          sx={{ minWidth: 140 }}
        />
        {collectionMode === "SITE" && siteCrawlEnabled ? (
          <Button
            variant="outlined"
            color="info"
            startIcon={<PreviewOutlined fontSize="small" />}
            onClick={() => void handlePreview()}
            disabled={disabled || previewing || !url.trim()}
            sx={{ whiteSpace: "nowrap" }}
          >
            {previewing ? <CircularProgress size={16} /> : "미리보기"}
          </Button>
        ) : null}
        <Button
          variant="contained"
          color={collectionMode === "SITE" ? "primary" : "inherit"}
          onClick={() => void createSource()}
          disabled={disabled || submitting || writeDisabled || !url.trim()}
          sx={{ whiteSpace: "nowrap", fontWeight: 700 }}
        >
          {submitting ? (
            <CircularProgress size={18} color="inherit" />
          ) : collectionMode === "SITE" ? (
            "SITE 수집 시작"
          ) : (
            "단일 수집 시작"
          )}
        </Button>
      </Stack>

      {loading && sources.length === 0 ? <CircularProgress size={20} /> : null}

      {/* Source List */}
      <Stack spacing={1}>
        {sources.map((source) => {
          const isSite = source.collectionMode === "SITE";
          const usableRevision = isSite
            ? source.currentCorpusRevisionId
            : source.currentRevisionId || source.currentCorpusRevisionId;
          const selectable = Boolean(usableRevision) && (source.status === "COMPLETED" || source.status === "UNCHANGED");
          const isSelected = selectedSourceIds.has(source.sourceId);

          const selectedRef = value.find((v) => v.sourceId === source.sourceId);
          const isOutdatedRevision =
            isSelected &&
            selectedRef &&
            (isSite
              ? Boolean(source.currentCorpusRevisionId && selectedRef.corpusRevisionId !== source.currentCorpusRevisionId)
              : Boolean(source.currentRevisionId && selectedRef.revisionId !== source.currentRevisionId));

          return (
            <Box
              key={source.sourceId}
              sx={{
                border: "1px solid",
                borderColor: isSelected ? "primary.main" : "divider",
                bgcolor: isSelected ? "action.hover" : "background.paper",
                borderRadius: 2,
                px: 1.5,
                py: 1,
              }}
            >
              <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
                <FormControlLabel
                  sx={{ m: 0, flex: 1, alignItems: "flex-start" }}
                  control={
                    <Checkbox
                      size="small"
                      checked={isSelected}
                      onChange={() => toggle(source)}
                      disabled={managementOnly || disabled || !selectable}
                      sx={managementOnly ? { display: "none" } : undefined}
                    />
                  }
                  label={
                    <Box sx={{ pt: 0.2 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {source.displayName || source.title || source.host}
                        </Typography>
                        <Chip
                          size="small"
                          label={isSite ? "SITE" : "SINGLE"}
                          color={isSite ? "primary" : "default"}
                          variant="outlined"
                          sx={{ height: 20, fontSize: 11, fontWeight: 700 }}
                        />
                        <Chip size="small" label={statusLabel(source.status)} sx={{ height: 20, fontSize: 11 }} />

                        {isOutdatedRevision ? (
                          <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            onClick={(e) => {
                              e.stopPropagation();
                              upgradeRevision(source);
                            }}
                            sx={{ fontSize: 11, py: 0, px: 0.75, height: 20, minWidth: 0, whiteSpace: "nowrap" }}
                          >
                            새 버전 사용
                          </Button>
                        ) : null}
                      </Stack>

                      <Link
                        component="button"
                        type="button"
                        variant="caption"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void openDetailView(source);
                        }}
                        sx={{
                          overflowWrap: "anywhere",
                          display: "inline-block",
                          mt: 0.25,
                          p: 0,
                          border: 0,
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                      >
                        {source.url}
                      </Link>

                      {/* Display breakdown stats */}
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5, fontWeight: 600 }}>
                        {`색인 ${source.indexedCount ?? (source.status === "COMPLETED" ? 1 : 0)} / 발견 ${source.discoveredCount ?? 1} / 실패 ${source.failedCount ?? 0} / 제외 ${source.skippedCount ?? 0}`}
                      </Typography>

                      {source.errorCode ? (
                        <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.25 }}>
                          {mapWebKnowledgeError(source.errorCode)}
                        </Typography>
                      ) : null}
                    </Box>
                  }
                />

                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ display: selectionOnly ? "none" : undefined }}>
                  <Button
                    size="small"
                    variant="text"
                    color="primary"
                    startIcon={<SettingsOutlined fontSize="small" />}
                    onClick={() => void openDetailView(source)}
                    sx={{ fontSize: 12, px: 0.75, whiteSpace: "nowrap" }}
                  >
                    옵션 수정
                  </Button>

                  {ACTIVE_STATUSES.has(source.status) ? (
                    <Tooltip title="수집 취소">
                      <IconButton size="small" disabled={disabled || writeDisabled} onClick={() => void cancelSource(source.sourceId)}>
                        <CancelOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Tooltip title="새로 수집">
                      <IconButton size="small" disabled={disabled || writeDisabled} onClick={() => void refreshSource(source.sourceId)}>
                        <RefreshOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}

                  <Tooltip title="삭제">
                    <IconButton
                      size="small"
                      disabled={disabled || writeDisabled || ACTIVE_STATUSES.has(source.status)}
                      onClick={() => void archiveSource(source.sourceId)}
                    >
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            </Box>
          );
        })}
      </Stack>

      <Typography variant="caption" color="text.secondary">
        {value.length}/{maxSelectedSources}개 선택됨
      </Typography>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>사이트 수집 범위 미리보기 (Preview)</DialogTitle>
        <DialogContent dividers>
          {previewData ? (
            <Stack spacing={2}>
              <Alert severity="info" icon={<InfoOutlined fontSize="small" />}>
                미리보기는 실제 전체 수집 결과가 아니라 첫 링크와 bounded sitemap을 이용한 예상 범위입니다. (PREVIEW_FIRST_HOP_ONLY)
              </Alert>

              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  적용될 정책 및 통계
                </Typography>
                <Typography variant="caption" display="block">
                  루트 URL: {previewData.rootUrl}
                </Typography>
                <Typography variant="caption" display="block">
                  예상 후보 페이지: {previewData.candidateCount}개 (제외 후보: {previewData.excludedCount}개)
                </Typography>
                <Typography variant="caption" display="block">
                  제거된 Query 파라미터 수: {previewData.queryParametersRemovedCount}개
                </Typography>
                {previewData.truncated ? (
                  <Typography variant="caption" color="warning.main" display="block" sx={{ fontWeight: 700 }}>
                    상한 도달로 미리보기가 조기 중단되었습니다 (Truncated).
                  </Typography>
                ) : null}
              </Paper>

              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  대표 후보 URL ({previewData.candidates.length}개 표출)
                </Typography>
                <Stack spacing={0.5} sx={{ maxHeight: 180, overflowY: "auto" }}>
                  {previewData.candidates.map((cand, idx) => (
                    <Box key={idx} sx={{ py: 0.25, borderBottom: "1px solid", borderColor: "divider" }}>
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        [Depth {cand.depth}] {cand.path}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>

              {previewData.excludedSamples.length > 0 ? (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, color: "text.secondary" }}>
                    제외된 후보 예시 및 사유 ({previewData.excludedSamples.length}개)
                  </Typography>
                  <Stack spacing={0.5} sx={{ maxHeight: 140, overflowY: "auto" }}>
                    {previewData.excludedSamples.map((ex, idx) => (
                      <Stack key={idx} direction="row" spacing={1} alignItems="center">
                        <Chip size="small" label={ex.reasonCode} color="default" sx={{ height: 18, fontSize: 10 }} />
                        <Typography variant="caption" color="text.secondary">
                          {ex.path}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              ) : null}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>닫기</Button>
        </DialogActions>
      </Dialog>

      {/* Source Detail & Policy Edit / Runs / Pages Modal */}
      <Dialog open={Boolean(detailSource)} onClose={closeDetailView} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          {detailSource?.displayName || detailSource?.host || "자료 상세 및 수집 이력"}
        </DialogTitle>
        <DialogContent dividers>
          {detailSource ? (
            <Stack spacing={2}>
              {policyEditNotice ? <Alert severity="info">{policyEditNotice}</Alert> : null}
              {detailLoadError ? <Alert severity="error">{detailLoadError}</Alert> : null}

              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label={`모드: ${detailSource.collectionMode || "SINGLE_PAGE"}`} color="primary" size="small" />
                <Chip label={`상태: ${statusLabel(detailSource.status)}`} size="small" />
              </Stack>

              <Link
                href={detailSource.canonicalUrl || detailSource.url}
                target="_blank"
                rel="noopener noreferrer"
                variant="body2"
                sx={{ alignSelf: "flex-start", overflowWrap: "anywhere" }}
              >
                {detailSource.url} · 원문 URL 열기
              </Link>

              {/* Crawl policy update form for SITE */}
              {!selectionOnly && detailSource.collectionMode === "SITE" ? (
                <Paper variant="outlined" sx={{ p: 2, bgcolor: "background.paper", borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, color: "primary.main" }}>
                    수집 정책(옵션) 변경 및 재수집
                  </Typography>

                  <Stack spacing={1.5}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <FormControl size="small" fullWidth>
                        <InputLabel>수집 범위 (Scope)</InputLabel>
                        <Select
                          value={editScope}
                          label="수집 범위 (Scope)"
                          onChange={(e) => setEditScope(e.target.value as WebCrawlScope)}
                        >
                          <MenuItem value="PATH_PREFIX">PATH_PREFIX (경로 접두사 유지)</MenuItem>
                          <MenuItem value="SAME_ORIGIN">SAME_ORIGIN (동일 도메인 전체)</MenuItem>
                        </Select>
                      </FormControl>
                      <FormControl size="small" fullWidth>
                        <InputLabel>발견 방식 (Discovery Mode)</InputLabel>
                        <Select
                          value={editDiscoveryMode}
                          label="발견 방식 (Discovery Mode)"
                          onChange={(e) => setEditDiscoveryMode(e.target.value as WebCrawlDiscoveryMode)}
                        >
                          <MenuItem value="SITEMAP_AND_LINKS">SITEMAP_AND_LINKS (사이트맵 + 링크)</MenuItem>
                          <MenuItem value="SITEMAP_ONLY">SITEMAP_ONLY (사이트맵만)</MenuItem>
                          <MenuItem value="LINKS_ONLY">LINKS_ONLY (링크만)</MenuItem>
                        </Select>
                      </FormControl>
                    </Stack>

                    <Stack direction="row" spacing={1}>
                      <TextField
                        size="small"
                        type="number"
                        label="최대 깊이"
                        value={editMaxDepth}
                        onChange={(e) => setEditMaxDepth(Number(e.target.value))}
                        inputProps={{ min: 1, max: capabilities?.maximumDepth ?? 5 }}
                        fullWidth
                      />
                      <TextField
                        size="small"
                        type="number"
                        label="최대 페이지 수"
                        value={editMaxPages}
                        onChange={(e) => setEditMaxPages(Number(e.target.value))}
                        inputProps={{ min: 1, max: capabilities?.maximumPages ?? 500 }}
                        fullWidth
                      />
                    </Stack>

                    <TextField
                      size="small"
                      label="포함 패턴 (Include Globs, 쉼표/줄바꿈 구분)"
                      placeholder="/docs/**, /guide/**"
                      value={editIncludeGlobs}
                      onChange={(e) => setEditIncludeGlobs(e.target.value)}
                      fullWidth
                    />
                    <TextField
                      size="small"
                      label="제외 패턴 (Exclude Globs, 쉼표/줄바꿈 구분)"
                      placeholder="/archive/**, /tag/**"
                      value={editExcludeGlobs}
                      onChange={(e) => setEditExcludeGlobs(e.target.value)}
                      fullWidth
                    />

                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<SettingsOutlined fontSize="small" />}
                      onClick={() => void handleUpdatePolicyAndRefresh()}
                      disabled={loadingDetail}
                      sx={{ alignSelf: "flex-start" }}
                    >
                      수집 정책 변경 및 재수집 시작
                    </Button>
                  </Stack>
                </Paper>
              ) : !selectionOnly ? (
                <Alert severity="info" sx={{ py: 0.5 }}>
                  서버의 수집 범위 전환 기능이 필요합니다. (SINGLE_PAGE → SITE 전환 불가)
                </Alert>
              ) : null}

              <Box>
                <Tabs value={detailTab} onChange={(_, val) => setDetailTab(val)}>
                  <Tab label="수집 실행 이력 (Crawl Runs)" value="runs" />
                  <Tab label="수집 페이지 목록 (Pages)" value="pages" />
                </Tabs>
              </Box>

              {loadingDetail ? (
                <CircularProgress size={24} />
              ) : detailTab === "runs" ? (
                <GridContent<WebKnowledgeCrawlRunView>
                  columns={crawlRunColumns}
                  rowData={crawlRuns}
                  height={300}
                  options={{
                    pagination: true,
                    paginationPageSize: 10,
                    paginationPageSizeSelector: [10, 20, 50],
                    defaultColDef: { sortable: true, filter: false, resizable: true },
                    overlayNoRowsTemplate: "수집 실행 이력이 없습니다.",
                  }}
                />
              ) : (
                <Stack spacing={1} sx={{ maxHeight: 300, overflowY: "auto" }}>
                  {pages.map((page) => (
                    <Paper key={page.pageId} variant="outlined" sx={{ p: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                            {page.title || page.path || page.url}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block" noWrap>
                            {page.host}{page.path} ({page.status})
                          </Typography>
                        </Box>
                        <Button size="small" variant="outlined" disabled={pageDetailLoading} onClick={() => void openPageDetail(page)}>
                          상세
                        </Button>
                      </Stack>
                    </Paper>
                  ))}
                  {pages.length === 0 ? <Typography variant="caption" color="text.secondary">수집된 페이지가 없습니다.</Typography> : null}
                </Stack>
              )}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDetailView}>닫기</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(pageDetail) || pageDetailLoading || Boolean(pageDetailError)} onClose={closePageDetail} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>수집 페이지 상세</DialogTitle>
        <DialogContent dividers>
          {pageDetailLoading ? <CircularProgress size={24} /> : null}
          {pageDetailError ? <Alert severity="error">{pageDetailError}</Alert> : null}
          {pageDetail ? (
            <Stack spacing={2}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {pageDetail.title || pageDetail.path || pageDetail.url}
                </Typography>
                <Link href={pageDetail.canonicalUrl || pageDetail.url} target="_blank" rel="noopener noreferrer">
                  {pageDetail.canonicalUrl || pageDetail.url}
                </Link>
              </Box>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={`페이지 ${pageDetail.active ? "활성" : "제거됨"}`} />
                <Chip size="small" label={`Revision ${pageDetail.revisionStatus || "없음"}`} />
                <Chip size="small" label={pageDetail.contentType || "content-type 없음"} />
                {pageDetail.language ? <Chip size="small" label={`언어 ${pageDetail.language}`} /> : null}
              </Stack>

              <Stack spacing={0.5}>
                <Typography variant="body2"><b>Page ID:</b> {pageDetail.pageId}</Typography>
                <Typography variant="body2"><b>Revision ID:</b> {pageDetail.pageRevisionId || "-"}</Typography>
                <Typography variant="body2"><b>Run ID:</b> {pageDetail.runId || "-"}</Typography>
                <Typography variant="body2"><b>Publisher:</b> {pageDetail.publisher || "-"}</Typography>
                <Typography variant="body2"><b>수집 시각:</b> {formatRunDate(pageDetail.retrievedAt)}</Typography>
                <Typography variant="body2"><b>원문 수정 시각:</b> {formatRunDate(pageDetail.sourceModifiedAt)}</Typography>
                <Typography variant="body2"><b>크기:</b> {pageDetail.contentLength ?? "-"}</Typography>
                <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}><b>Content hash:</b> {pageDetail.contentHash || "-"}</Typography>
              </Stack>

              {pageDetail.errorCode ? (
                <Alert severity="error">{mapWebKnowledgeError(pageDetail.errorCode)}</Alert>
              ) : null}

              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>본문 미리보기</Typography>
                <Paper component="pre" variant="outlined" sx={{ p: 1.5, m: 0, maxHeight: 260, overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 12 }}>
                  {pageDetail.contentPreview || "미리보기가 없습니다."}
                </Paper>
              </Box>

              {pageDetail.metadataJson ? (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>메타데이터</Typography>
                  {pageDetail.metadataTruncated ? (
                    <Alert severity="info" sx={{ mb: 1 }}>
                      큰 메타데이터이므로 앞부분만 표시합니다.
                    </Alert>
                  ) : null}
                  <Paper component="pre" variant="outlined" sx={{ p: 1.5, m: 0, maxHeight: 220, overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 12 }}>
                    {pageDetail.metadataJson}
                  </Paper>
                </Box>
              ) : null}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closePageDetail}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
