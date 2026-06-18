import { useState, useEffect, useRef, useCallback } from "react";
import {
  reactMarkdownDocumentApi,
  type MarkdownDocumentRevisionDto,
  type MarkdownPipelineExecutionDto,
} from "../api";
import { reactAiApi } from "@/react/pages/ai/api";
import type { RagIndexJobDto } from "@/types/studio/ai";

export function useMarkdownDocumentPolling(maxPollTimeMs = 300000) { // 5 minutes default
  const [latestRevision, setLatestRevision] = useState<MarkdownDocumentRevisionDto | null>(null);
  const [revisions, setRevisions] = useState<MarkdownDocumentRevisionDto[]>([]);
  const [pipelineExecution, setPipelineExecution] = useState<MarkdownPipelineExecutionDto | null>(null);
  const [latestRagJob, setLatestRagJob] = useState<RagIndexJobDto | null>(null);
  const [ragJobs, setRagJobs] = useState<RagIndexJobDto[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const timeoutIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pollCountRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const visibilityCleanupRef = useRef<(() => void) | null>(null);
  const activeDocIdRef = useRef<string | null>(null);
  const activeAttachmentIdRef = useRef<number | null>(null);

  const latestRevisionRef = useRef<MarkdownDocumentRevisionDto | null>(null);
  const pipelineExecutionRef = useRef<MarkdownPipelineExecutionDto | null>(null);

  // Sync refs with state
  useEffect(() => {
    latestRevisionRef.current = latestRevision;
  }, [latestRevision]);

  useEffect(() => {
    pipelineExecutionRef.current = pipelineExecution;
  }, [pipelineExecution]);

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

    pollCountRef.current += 1;

    let revisionDone = false;
    let pipelineDone = false;
    let jobDone = true;

    // Check last known statuses from refs
    const currentRevStatus = latestRevisionRef.current?.status;
    const currentPipelineStatus = pipelineExecutionRef.current?.status;

    // 1. Fetch Revisions (only if revision is not terminal)
    const shouldFetchRevision = !currentRevStatus || !(currentRevStatus === "COMPLETED" || currentRevStatus === "FAILED" || currentRevStatus === "CANCELED");

    let latestRevForStep = latestRevisionRef.current;

    if (shouldFetchRevision) {
      try {
        const revisions = await reactMarkdownDocumentApi.getRevisions(documentId, {
          signal: abortControllerRef.current.signal,
        });

        if (revisions && revisions.length > 0) {
          const sorted = [...revisions].sort((a, b) => {
            const t1 = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const t2 = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return t2 - t1;
          });

          const latest = sorted[0];
          latestRevForStep = latest;
          setLatestRevision(latest);
          setRevisions(sorted);
          setStatus(latest.status);

          if (latest.status === "FAILED") {
            setError(latest.errorMessage || "Markdown 변환에 실패했습니다.");
          }

          if (latest.status === "COMPLETED" || latest.status === "FAILED" || latest.status === "CANCELED") {
            revisionDone = true;
            if (latest.status === "FAILED" || latest.status === "CANCELED") {
              pipelineDone = true;
            }
          }
        }
      } catch (err: any) {
        if (err.name === "CanceledError" || err.name === "AbortError" || err.message === "canceled") {
          return;
        }
        console.error("Revision polling failed:", err);
      }
    } else {
      revisionDone = true;
      if (currentRevStatus === "FAILED" || currentRevStatus === "CANCELED") {
        pipelineDone = true;
      }
    }

    // 2. Fetch Pipeline (only if revision status is completed and pipeline status is not terminal)
    const isRevisionCompleted = latestRevForStep?.status === "COMPLETED";
    const shouldFetchPipeline = isRevisionCompleted && (!currentPipelineStatus || !(currentPipelineStatus === "COMPLETED" || currentPipelineStatus === "FAILED"));

    if (shouldFetchPipeline) {
      try {
        let pipeline = await reactMarkdownDocumentApi.getPipeline(documentId);
        if (pipeline && (pipeline as any).data !== undefined) {
          pipeline = (pipeline as any).data;
        }
        setPipelineExecution(pipeline);
        if (pipeline) {
          const pStatus = pipeline.status;
          if (pStatus === "COMPLETED" || pStatus === "FAILED") {
            pipelineDone = true;
          }
        }
      } catch (err: any) {
        if (err.name === "CanceledError" || err.name === "AbortError" || err.message === "canceled") {
          return;
        }
        if (err?.response?.status === 404) {
          pipelineDone = true;
          setPipelineExecution(null);
        } else {
          console.error("Pipeline polling failed:", err);
        }
      }
    } else if (isRevisionCompleted) {
      if (currentPipelineStatus === "COMPLETED" || currentPipelineStatus === "FAILED") {
        pipelineDone = true;
      }
    } else {
      // If revision is failed or canceled, pipeline is done
      if (latestRevForStep?.status === "FAILED" || latestRevForStep?.status === "CANCELED") {
        pipelineDone = true;
      }
    }

    // 3. Fetch RAG Jobs
    const attachmentId = activeAttachmentIdRef.current;
    if (attachmentId && isRevisionCompleted && !pipelineDone) {
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
        const latestJob = content[0] || null;
        setLatestRagJob(latestJob);
        if (latestJob) {
          const jStatus = latestJob.status;
          if (jStatus === "PENDING" || jStatus === "RUNNING") {
            jobDone = false;
          }
        }
      } catch (err) {
        console.error("RAG Job polling failed:", err);
      }
    }

    // Schedule next poll if not done
    const allDone = revisionDone && pipelineDone && jobDone;
    if (!allDone) {
      if (timeoutIdRef.current) {
        window.clearTimeout(timeoutIdRef.current);
      }
      timeoutIdRef.current = window.setTimeout(() => {
        void poll(documentId);
      }, 2500);
    } else {
      setIsPolling(false);
    }
  }, [maxPollTimeMs, stopPolling]);

  const startPolling = useCallback((documentId: string, attachmentId?: number) => {
    stopPolling();
    setIsPolling(true);
    setError(null);
    setLatestRevision(null);
    setRevisions([]);
    setPipelineExecution(null);
    setLatestRagJob(null);
    setRagJobs([]);
    startTimeRef.current = Date.now();
    pollCountRef.current = 0;
    activeDocIdRef.current = documentId;
    activeAttachmentIdRef.current = attachmentId ?? null;

    void poll(documentId);
  }, [poll, stopPolling]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    latestRevision,
    revisions,
    pipelineExecution,
    latestRagJob,
    ragJobs,
    status,
    error,
    isPolling,
    startPolling,
    stopPolling,
    setLatestRevision,
    setRevisions,
    setPipelineExecution,
    setLatestRagJob,
    setRagJobs,
    setStatus,
    setError,
  };
}
