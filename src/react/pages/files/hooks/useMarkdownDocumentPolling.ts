import { useState, useEffect, useRef, useCallback } from "react";
import { reactMarkdownDocumentApi, type MarkdownDocumentRevisionDto } from "../api";
import { reactAiApi } from "@/react/pages/ai/api";
import { skillGraphApi } from "@/react/pages/ai/skillgraph/api";
import type { RagIndexJobDto } from "@/types/studio/ai";
import type { SkillGraphJob } from "@/types/studio/skillgraph";

export function useMarkdownDocumentPolling(maxPollTimeMs = 300000) { // 5 minutes default
  const [latestRevision, setLatestRevision] = useState<MarkdownDocumentRevisionDto | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // RAG and Skill Job states
  const [ragJob, setRagJob] = useState<RagIndexJobDto | null>(null);
  const [skillJob, setSkillJob] = useState<SkillGraphJob | null>(null);

  const timeoutIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pollCountRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const visibilityCleanupRef = useRef<(() => void) | null>(null);
  const activeOptionsRef = useRef<{ runRagIndex: boolean; runSkillExtraction: boolean }>({
    runRagIndex: false,
    runSkillExtraction: false,
  });

  const stopPolling = useCallback(() => {
    if (timeoutIdRef.current) {
      window.clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
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

  const poll = useCallback(async (
    documentId: string,
    options: { runRagIndex: boolean; runSkillExtraction: boolean }
  ) => {
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

    pollCountRef.current += 1;

    let markdownDone = false;
    let ragDone = !options.runRagIndex;
    let skillDone = !options.runSkillExtraction;

    try {
      // 1. Markdown Revision Polling
      const revisions = await reactMarkdownDocumentApi.getRevisions(documentId, {
        signal: abortControllerRef.current.signal,
      });

      if (revisions && revisions.length > 0) {
        // Sort revisions by createdAt descending
        const sorted = [...revisions].sort((a, b) => {
          const t1 = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const t2 = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return t2 - t1;
        });

        const latest = sorted[0];
        setLatestRevision(latest);
        setStatus(latest.status);
        if (latest.status === "FAILED") {
          setError(latest.errorMessage || "Markdown 변환에 실패했습니다.");
        }

        if (latest.status === "COMPLETED" || latest.status === "FAILED" || latest.status === "CANCELED") {
          markdownDone = true;
        }
      } else {
        // No revisions yet, but keep polling
      }

      // 2. RAG Index Job Polling
      if (options.runRagIndex) {
        try {
          const ragJobsResponse = await reactAiApi.listRagJobs({
            documentId,
            page: 0,
            size: 1,
            sort: "createdAt",
            direction: "desc",
          });
          const latestRagJob = ragJobsResponse.content?.[0] || null;
          setRagJob(latestRagJob);
          if (latestRagJob) {
            const rStatus = latestRagJob.status;
            if (rStatus === "SUCCEEDED" || rStatus === "FAILED" || rStatus === "CANCELLED" || (rStatus as string) === "CANCELED") {
              ragDone = true;
            }
          }
        } catch (err) {
          console.error("RAG Job polling failed:", err);
        }
      }

      // 3. Skill Extraction Job Polling
      if (options.runSkillExtraction) {
        try {
          const skillJobsResponse = await skillGraphApi.listJobs({
            keyword: documentId,
            page: 0,
            size: 1,
            sort: "updatedAt,desc",
          });
          const latestSkillJob = skillJobsResponse.content?.[0] || null;
          setSkillJob(latestSkillJob);
          if (latestSkillJob) {
            const sStatus = latestSkillJob.status;
            if (sStatus === "COMPLETED" || sStatus === "FAILED" || sStatus === "CANCELED" || sStatus === "CANCELLED" || sStatus === "PARTIAL") {
              skillDone = true;
            }
          }
        } catch (err) {
          console.error("Skill Job polling failed:", err);
        }
      }

      // If all active pipelines are finished, stop polling
      if (markdownDone && ragDone && skillDone) {
        stopPolling();
        return;
      }
    } catch (err: any) {
      if (err.name === "CanceledError" || err.name === "AbortError" || err.message === "canceled") {
        return; // Ignore canceled request
      }
      if (err?.response?.status === 404 || err?.response?.status === 403) {
        setError(err?.response?.data?.message || "문서 또는 권한을 찾을 수 없습니다.");
        stopPolling();
        return;
      }
    }

    // Schedule next poll if still marked as polling
    let delay = 2000;
    if (document.hidden) {
      delay = 5000;
    } else if (pollCountRef.current >= 10) {
      delay = 5000;
    }

    timeoutIdRef.current = window.setTimeout(() => {
      void poll(documentId, options);
    }, delay);
  }, [maxPollTimeMs, stopPolling]);

  const startPolling = useCallback((
    documentId: string,
    options: { runRagIndex: boolean; runSkillExtraction: boolean }
  ) => {
    stopPolling();
    setIsPolling(true);
    setError(null);
    setRagJob(null);
    setSkillJob(null);
    startTimeRef.current = Date.now();
    pollCountRef.current = 0;
    activeOptionsRef.current = options;

    // Run first poll immediately
    void poll(documentId, options);

    const handleVisibilityChange = () => {
      if (timeoutIdRef.current) {
        window.clearTimeout(timeoutIdRef.current);
      }
      let delay = 2000;
      if (document.hidden) {
        delay = 5000;
      } else if (pollCountRef.current >= 10) {
        delay = 5000;
      }
      timeoutIdRef.current = window.setTimeout(() => {
        void poll(documentId, activeOptionsRef.current);
      }, delay);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
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
    ragJob,
    skillJob,
    startPolling,
    stopPolling,
    setLatestRevision,
    setStatus,
    setError,
    setRagJob,
    setSkillJob,
  };
}
