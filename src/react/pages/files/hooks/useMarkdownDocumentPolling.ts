import { useState, useEffect, useRef, useCallback } from "react";
import { reactMarkdownDocumentApi, type MarkdownDocumentRevisionDto } from "../api";

export function useMarkdownDocumentPolling(maxPollTimeMs = 300000) { // 5 minutes default
  const [latestRevision, setLatestRevision] = useState<MarkdownDocumentRevisionDto | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const visibilityCleanupRef = useRef<(() => void) | null>(null);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (visibilityCleanupRef.current) {
      visibilityCleanupRef.current();
      visibilityCleanupRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const poll = useCallback(async (documentId: string) => {
    // Check timeout
    if (Date.now() - startTimeRef.current > maxPollTimeMs) {
      setError("변환 시간 초과(Timeout)가 발생했습니다.");
      stopPolling();
      return;
    }

    // Cancel previous pending request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const revisions = await reactMarkdownDocumentApi.getRevisions(documentId, {
        signal: abortControllerRef.current.signal,
      });

      if (!revisions || revisions.length === 0) {
        return;
      }

      // Sort revisions by createdAt descending
      const sorted = [...revisions].sort((a, b) => {
        const t1 = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const t2 = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return t2 - t1;
      });

      const latest = sorted[0];
      setLatestRevision(latest);
      setStatus(latest.status);
      setError(latest.errorMessage);

      if (latest.status === "COMPLETED" || latest.status === "FAILED" || latest.status === "CANCELED") {
        stopPolling();
      }
    } catch (err: any) {
      if (err.name === "CanceledError" || err.name === "AbortError" || err.message === "canceled") {
        return; // Ignore canceled request
      }
      if (err?.response?.status === 404 || err?.response?.status === 403) {
        setError(err?.response?.data?.message || "문서 또는 권한을 찾을 수 없습니다.");
        stopPolling();
      }
    }
  }, [maxPollTimeMs, stopPolling]);

  const startPolling = useCallback((documentId: string) => {
    stopPolling();
    setIsPolling(true);
    setError(null);
    startTimeRef.current = Date.now();

    const runPoll = () => {
      void poll(documentId);
    };

    // Run first check immediately
    runPoll();

    const restartInterval = (ms: number) => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
      timerRef.current = window.setInterval(runPoll, ms);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        restartInterval(5000);
      } else {
        restartInterval(1500);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    restartInterval(document.hidden ? 5000 : 1500);

    visibilityCleanupRef.current = () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [poll, stopPolling]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    latestRevision,
    status,
    error,
    isPolling,
    startPolling,
    stopPolling,
    setLatestRevision,
    setStatus,
    setError,
  };
}
