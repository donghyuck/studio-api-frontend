export interface ChunkMetadata {
  requestedChunkingStrategy?: string;
  actualChunkingStrategy?: string;
  strategy?: string;
  fallbackStatus?: string;
  fallbackFrom?: string;
  fallbackTo?: string;
  fallbackReason?: string;
  chunkQualityStatus?: string;
  chunkQualityIssues?: string[];
  validationStatus?: string;
  [key: string]: any;
}

export interface ChunkDto {
  metadata?: ChunkMetadata;
  chunkType?: string;
  strategy?: string;
  sourceRef?: string;
  sourceRefs?: string[];
  page?: number;
  slide?: number;
  blockIds?: string[];
  startOffset?: number;
  endOffset?: number;
  [key: string]: any;
}

/**
 * Capitalizes strategy names for clean UI display (e.g. "recursive" -> "Recursive")
 */
export function formatStrategyName(strategy?: string): string {
  if (!strategy) return "-";
  const trim = strategy.trim();
  if (trim.toLowerCase() === "fixed-size") return "Fixed";
  if (trim.toLowerCase() === "structure-based") return "Structure-based";
  return trim.charAt(0).toUpperCase() + trim.slice(1);
}

/**
 * Resolves the display text for requested vs actual strategies
 */
export function getChunkStrategyDisplay(meta?: ChunkMetadata): string {
  if (!meta) return "-";
  const requested = meta.requestedChunkingStrategy;
  const actual = meta.actualChunkingStrategy ?? meta.strategy;
  
  if (!requested && !actual) return "-";
  
  const formattedActual = formatStrategyName(actual);
  if (!requested) return formattedActual;
  
  const formattedRequested = formatStrategyName(requested);
  if (requested.trim().toLowerCase() === actual?.trim().toLowerCase()) {
    return formattedActual;
  }
  
  return `${formattedRequested} -> ${formattedActual}`;
}

/**
 * Returns issue description for UI tooltips/warnings
 */
export function getChunkQualityIssueText(issue: string): string {
  switch (issue) {
    case "MISSING_PROVENANCE":
      return "원문 위치 정보가 부족합니다. 검색은 가능하지만 원문 복원 품질 확인이 필요합니다.";
    case "EMPTY_CONTENT":
      return "본문이 비어 있습니다. 색인 대상에서는 제외되어야 합니다.";
    case "MAX_SIZE_EXCEEDED":
      return "최대 chunk 크기를 초과했습니다. fallback 또는 재청킹 확인이 필요합니다.";
    default:
      return issue;
  }
}

/**
 * Check if the chunk contains any valid provenance tracking parameters
 */
export function hasChunkProvenance(chunk?: ChunkDto): boolean {
  if (!chunk) return false;
  const meta = chunk.metadata || {};
  return Boolean(
    chunk.sourceRef ||
    meta.sourceRef ||
    (chunk.sourceRefs && chunk.sourceRefs.length > 0) ||
    (meta.sourceRefs && (meta.sourceRefs as any).length > 0) ||
    chunk.page != null ||
    meta.page != null ||
    chunk.slide != null ||
    meta.slide != null ||
    (chunk.blockIds && chunk.blockIds.length > 0) ||
    (meta.blockIds && (meta.blockIds as any).length > 0) ||
    (chunk.startOffset != null && chunk.endOffset != null) ||
    (meta.startOffset != null && meta.endOffset != null)
  );
}
