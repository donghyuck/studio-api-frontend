import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Stack,
  Divider,
  Box,
  Typography,
  FormControl,
  InputLabel,
} from "@mui/material";
import { useAuthStore } from "@/react/auth/store";
import { resolveAxiosError } from "@/utils/helpers";
import {
  reactDocumentConvertApi,
  type DocumentConvertJob,
  type DocumentConvertStatus,
  type DocumentConvertOptions,
} from "./api";
import type { AttachmentDto } from "@/types/studio/files";

const supportedConversions = {
  markdown: ["html", "docx", "pdf"],
  html: ["docx", "pdf"],
  docx: ["markdown", "html"],
};

export function getDocumentFormat(filename: string, contentType: string): "markdown" | "html" | "docx" | null {
  const lowerName = filename.toLowerCase();
  if (lowerName.endsWith(".md") || lowerName.endsWith(".markdown") || contentType.includes("markdown")) {
    return "markdown";
  }
  if (lowerName.endsWith(".html") || lowerName.endsWith(".htm") || contentType.includes("html")) {
    return "html";
  }
  if (lowerName.endsWith(".docx") || contentType.includes("officedocument.wordprocessingml.document")) {
    return "docx";
  }
  return null;
}

function getFriendlyErrorMessage(errorCode: string | null, errorMessage: string | null): string {
  if (!errorCode) return errorMessage || "알 수 없는 오류가 발생했습니다.";
  switch (errorCode) {
    case "WORKER_UNAVAILABLE":
      return "변환 서버(Pandoc Worker)를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.";
    case "UNSUPPORTED_SOURCE_FORMAT":
      return "지원되지 않는 원본 파일 형식입니다.";
    case "UNSUPPORTED_TARGET_FORMAT":
      return "지원되지 않는 변환 대상 파일 형식입니다.";
    case "INVALID_CONVERT_OPTION":
      return "변환 옵션이 올바르지 않습니다.";
    case "SOURCE_FILE_NOT_FOUND":
      return "원본 파일을 찾을 수 없습니다.";
    case "SOURCE_FILE_TOO_LARGE":
      return "원본 파일의 크기가 너무 큽니다.";
    case "RESULT_FILE_TOO_LARGE":
      return "변환 결과 파일의 크기가 제한을 초과했습니다.";
    case "PANDOC_TIMEOUT":
      return "문서 변환 시간 초과(Timeout)가 발생했습니다.";
    case "PANDOC_EXIT_NON_ZERO":
      return "Pandoc 변환기에서 에러가 리턴되었습니다.";
    case "RESULT_UPLOAD_FAILED":
      return "변환 완료 파일 업로드에 실패했습니다.";
    case "INTERNAL_ERROR":
      return "서버 내부 오류가 발생했습니다.";
    default:
      return `${errorCode}: ${errorMessage || "알 수 없는 오류가 발생했습니다."}`;
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
  file: AttachmentDto;
}

export function DocumentConvertDialog({ open, onClose, file }: Props) {
  const roles = useAuthStore((state) => state.user?.roles) ?? [];
  const canRead = roles.includes("ROLE_ADMIN") || roles.includes("ADMIN") || roles.includes("features:document-convert/read");
  const canManage = roles.includes("ROLE_ADMIN") || roles.includes("ADMIN") || roles.includes("features:document-convert/manage");

  const sourceFormat = getDocumentFormat(file.name, file.contentType);
  const targetOptions = sourceFormat ? supportedConversions[sourceFormat] : [];

  const [targetFormat, setTargetFormat] = useState<string>("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // PDF options
  const [pdfEngine] = useState<"xelatex">("xelatex");
  const [mainFont, setMainFont] = useState("Noto Sans CJK KR");
  const [toc, setToc] = useState(false);
  const [numberSections, setNumberSections] = useState(false);
  const [standalone, setStandalone] = useState(true);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");

  // Job progress states
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<DocumentConvertJob | null>(null);
  const [status, setStatus] = useState<DocumentConvertStatus | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  // Initialize and check localStorage
  useEffect(() => {
    if (open && file.attachmentId) {
      const savedJobId = localStorage.getItem(`doc_convert_job_${file.attachmentId}`);
      if (savedJobId) {
        setJobId(savedJobId);
        setStatus("RUNNING"); // trigger polling
        setNetworkError(null);
      } else {
        setJobId(null);
        setJob(null);
        setStatus(null);
        setNetworkError(null);
        if (targetOptions.length > 0) {
          setTargetFormat(targetOptions[0]);
        }
      }
    }
  }, [open, file.attachmentId, targetOptions]);

  // Polling useEffect
  useEffect(() => {
    if (!open || !jobId || (status !== "PENDING" && status !== "RUNNING")) {
      return;
    }

    let intervalTime = 2000;
    let timerId: number | undefined;
    let consecutiveErrors = 0;

    const poll = async () => {
      try {
        const res = await reactDocumentConvertApi.getJob(jobId);
        consecutiveErrors = 0;
        setNetworkError(null);
        setJob(res.data);
        setStatus(res.data.status);
        if (res.data.status === "COMPLETED" || res.data.status === "FAILED" || res.data.status === "CANCELED") {
          if (timerId) window.clearInterval(timerId);
        }
      } catch (error: any) {
        if (error?.response?.status === 403) {
          setNetworkError("조회 권한이 부족합니다. (403)");
          if (timerId) window.clearInterval(timerId);
          return;
        }
        consecutiveErrors += 1;
        if (consecutiveErrors >= 3) {
          setNetworkError("연속적인 네트워크 오류로 폴링이 중단되었습니다. 수동으로 새로고침 해주세요.");
          if (timerId) window.clearInterval(timerId);
        }
      }
    };

    const restartInterval = (ms: number) => {
      if (timerId) window.clearInterval(timerId);
      timerId = window.setInterval(poll, ms);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        restartInterval(5000);
      } else {
        restartInterval(2000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    // initial start
    restartInterval(document.hidden ? 5000 : 2000);
    void poll(); // run immediately on startup

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timerId) window.clearInterval(timerId);
    };
  }, [open, jobId, status]);

  const handleManualRefresh = async () => {
    if (!jobId) return;
    setRefreshing(true);
    setNetworkError(null);
    try {
      const res = await reactDocumentConvertApi.getJob(jobId);
      setJob(res.data);
      setStatus(res.data.status);
    } catch (error: any) {
      setNetworkError(resolveAxiosError(error) || "상태 조회에 실패했습니다.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleStartConversion = async () => {
    if (!sourceFormat || !targetFormat || !canManage) return;

    setSubmitLoading(true);
    setNetworkError(null);

    const convertOptions: DocumentConvertOptions = {};
    if (targetFormat === "pdf") {
      convertOptions.pdfEngine = pdfEngine;
      convertOptions.mainFont = mainFont.trim() || undefined;
      convertOptions.toc = toc;
      convertOptions.numberSections = numberSections;
      convertOptions.standalone = standalone;
      if (title.trim() || author.trim()) {
        convertOptions.metadata = {
          title: title.trim() || undefined,
          author: author.trim() || undefined,
        };
      }
    }

    try {
      const res = await reactDocumentConvertApi.convert({
        sourceFileId: String(file.attachmentId),
        sourceFormat,
        targetFormat: targetFormat as any,
        options: targetFormat === "pdf" ? convertOptions : undefined,
      });

      const newJob = res.data;
      setJob(newJob);
      setJobId(newJob.jobId);
      setStatus(newJob.status);
      localStorage.setItem(`doc_convert_job_${file.attachmentId}`, newJob.jobId);
    } catch (error) {
      setNetworkError(resolveAxiosError(error) || "문서 변환 요청에 실패했습니다.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDownload = () => {
    if (!jobId) return;
    window.location.assign(`/api/document-conversions/${encodeURIComponent(jobId)}/download`);
  };

  const handleRetry = async () => {
    if (!jobId || !canManage) return;
    setIsRetrying(true);
    setNetworkError(null);
    try {
      const res = await reactDocumentConvertApi.retryJob(jobId);
      setJob(res.data);
      setStatus(res.data.status);
    } catch (error) {
      setNetworkError(resolveAxiosError(error) || "변환 재시도에 실패했습니다.");
    } finally {
      setIsRetrying(false);
    }
  };

  const handleCancel = async () => {
    if (!jobId || !canManage) return;
    const confirmed = window.confirm("진행 중인 변환 작업을 취소하시겠습니까?");
    if (!confirmed) return;

    setIsCanceling(true);
    try {
      await reactDocumentConvertApi.cancelJob(jobId);
      setStatus("CANCELED");
      if (job) {
        setJob({ ...job, status: "CANCELED" });
      }
    } catch (error) {
      setNetworkError(resolveAxiosError(error) || "작업 취소에 실패했습니다.");
    } finally {
      setIsCanceling(false);
    }
  };

  const handleReset = () => {
    localStorage.removeItem(`doc_convert_job_${file.attachmentId}`);
    setJobId(null);
    setJob(null);
    setStatus(null);
    setNetworkError(null);
  };

  if (!canRead) {
    return (
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
        <DialogTitle>문서 변환</DialogTitle>
        <DialogContent>
          <Alert severity="error">문서 변환 조회 권한(features:document-convert/read)이 없습니다.</Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>닫기</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>문서 변환 ({file.name})</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {/* File details */}
          <Box sx={{ bgcolor: "action.hover", p: 1.5, borderRadius: 1.5 }}>
            <Typography variant="body2" color="text.secondary">파일명</Typography>
            <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.25 }}>{file.name}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>원본 포맷</Typography>
            <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.25, textTransform: "uppercase" }}>
              {sourceFormat || "지원되지 않는 파일 형식"}
            </Typography>
          </Box>

          {!sourceFormat && (
            <Alert severity="warning">
              이 파일 형식은 변환을 지원하지 않습니다. (지원 형식: Markdown, HTML, DOCX)
            </Alert>
          )}

          {/* Setup view when no active job */}
          {!jobId && sourceFormat && (
            <Stack spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel id="target-format-select-label">변환할 대상 포맷</InputLabel>
                <Select
                  labelId="target-format-select-label"
                  value={targetFormat}
                  onChange={(e) => setTargetFormat(e.target.value)}
                  label="변환할 대상 포맷"
                >
                  {targetOptions.map((fmt) => (
                    <MenuItem key={fmt} value={fmt}>
                      {fmt.toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* PDF Settings Panel */}
              {targetFormat === "pdf" && (
                <Box sx={{ border: "1px dashed", borderColor: "divider", p: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>PDF 변환 옵션</Typography>
                  <Stack spacing={2}>
                    <TextField
                      label="PDF 엔진"
                      value={pdfEngine}
                      disabled
                      size="small"
                      helperText="현재 xelatex 엔진만 지원합니다."
                      fullWidth
                    />
                    <TextField
                      label="기본 폰트"
                      value={mainFont}
                      onChange={(e) => setMainFont(e.target.value)}
                      placeholder="Noto Sans CJK KR"
                      size="small"
                      fullWidth
                    />
                    <TextField
                      label="문서 제목"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      size="small"
                      fullWidth
                    />
                    <TextField
                      label="작성자"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      size="small"
                      fullWidth
                    />
                    <Stack direction="row" spacing={2}>
                      <FormControlLabel
                        control={<Checkbox checked={toc} onChange={(e) => setToc(e.target.checked)} />}
                        label="목차 생성 (TOC)"
                      />
                      <FormControlLabel
                        control={<Checkbox checked={numberSections} onChange={(e) => setNumberSections(e.target.checked)} />}
                        label="섹션 번호 부여"
                      />
                    </Stack>
                    <FormControlLabel
                      control={<Checkbox checked={standalone} onChange={(e) => setStandalone(e.target.checked)} />}
                      label="독립형 문서로 변환 (Standalone)"
                    />
                  </Stack>
                </Box>
              )}

              {!canManage && (
                <Alert severity="warning">변환 요청 권한(features:document-convert/manage)이 없습니다.</Alert>
              )}
            </Stack>
          )}

          {/* Job Progress View */}
          {jobId && (
            <Stack spacing={2} alignItems="center" sx={{ py: 2 }}>
              {status === "PENDING" && (
                <Stack spacing={1.5} alignItems="center">
                  <CircularProgress size={36} />
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>변환 작업 대기 중...</Typography>
                  <Typography variant="caption" color="text.secondary">서버의 작업 처리를 기다리고 있습니다.</Typography>
                </Stack>
              )}

              {status === "RUNNING" && (
                <Stack spacing={1.5} alignItems="center">
                  <CircularProgress size={36} color="primary" />
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>문서를 변환하고 있습니다...</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {sourceFormat?.toUpperCase()} → {targetFormat.toUpperCase() || job?.targetFormat.toUpperCase()}
                  </Typography>
                </Stack>
              )}

              {status === "COMPLETED" && (
                <Stack spacing={1.5} alignItems="center">
                  <Box sx={{ color: "success.main", fontSize: 40 }}>✓</Box>
                  <Typography variant="body1" sx={{ fontWeight: 600 }} color="success.main">문서 변환 성공!</Typography>
                  <Typography variant="caption" color="text.secondary">
                    아래 버튼을 눌러 변환된 결과 파일을 다운로드할 수 있습니다.
                  </Typography>
                  <Button variant="contained" color="success" onClick={handleDownload}>
                    결과 다운로드
                  </Button>
                </Stack>
              )}

              {status === "FAILED" && (
                <Stack spacing={1.5} alignItems="center" sx={{ width: "100%" }}>
                  <Box sx={{ color: "error.main", fontSize: 40 }}>✗</Box>
                  <Typography variant="body1" sx={{ fontWeight: 600 }} color="error.main">문서 변환 실패</Typography>
                  <Alert severity="error" sx={{ width: "100%" }}>
                    {getFriendlyErrorMessage(job?.errorCode ?? null, job?.errorMessage ?? null)}
                  </Alert>
                  {canManage && (
                    <Button variant="outlined" color="primary" disabled={isRetrying} onClick={handleRetry}>
                      {isRetrying ? "재시도 요청 중..." : "변환 다시 시도 (Retry)"}
                    </Button>
                  )}
                </Stack>
              )}

              {status === "CANCELED" && (
                <Stack spacing={1.5} alignItems="center">
                  <Box sx={{ color: "text.secondary", fontSize: 40 }}>⊘</Box>
                  <Typography variant="body1" sx={{ fontWeight: 600 }} color="text.secondary">변환 작업이 취소되었습니다.</Typography>
                  <Typography variant="caption" color="text.secondary">사용자에 의해 요청이 취소되었습니다.</Typography>
                </Stack>
              )}

              {/* Polling control info */}
              <Divider sx={{ width: "100%", my: 1.5 }} />

              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ width: "100%" }}>
                <Typography variant="caption" color="text.secondary">
                  Job ID: <code style={{ fontSize: 11 }}>{jobId}</code>
                </Typography>
                <Stack direction="row" spacing={1}>
                  {networkError && (
                    <Button size="small" variant="outlined" disabled={refreshing} onClick={handleManualRefresh}>
                      {refreshing ? "로딩 중..." : "수동 새로고침"}
                    </Button>
                  )}
                  {status !== "PENDING" && status !== "RUNNING" && (
                    <Button size="small" variant="text" onClick={handleReset}>
                      새 변환 시작하기
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Stack>
          )}

          {networkError && <Alert severity="warning">{networkError}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions>
        {/* Actions for setup */}
        {!jobId && (
          <>
            <Button onClick={onClose} disabled={submitLoading}>취소</Button>
            <Button
              variant="contained"
              disabled={!sourceFormat || !targetFormat || submitLoading || !canManage}
              onClick={handleStartConversion}
            >
              {submitLoading ? "변환 요청 중..." : "변환 시작"}
            </Button>
          </>
        )}

        {/* Actions during active job */}
        {jobId && (
          <>
            {(status === "PENDING" || status === "RUNNING") && canManage && (
              <Button color="error" disabled={isCanceling} onClick={handleCancel}>
                {isCanceling ? "취소 중..." : "작업 취소"}
              </Button>
            )}
            <Button onClick={onClose} disabled={isCanceling}>닫기</Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
