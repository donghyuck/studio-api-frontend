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

export interface ChunkQualitySummary {
  total: number;
  valid: number;
  reviewRequired: number;
  strategyFallback: number;
  missingProvenance: number;
  unknown: number;
  maxSizeExceeded: number;
  status: "warning" | "info" | "success";
}

/**
 * Ratio threshold for triggering chunk processing recommendations (10%)
 */
export const ACTION_RECOMMENDATION_THRESHOLD = 0.1;

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
 * 1. Resolves actual chunking strategy
 */
export function getActualChunkingStrategy(metadata?: ChunkMetadata): string {
  if (!metadata) return "unknown";
  return metadata.actualChunkingStrategy ?? metadata.strategy ?? "unknown";
}

/**
 * 2. Resolves requested chunking strategy
 */
export function getRequestedChunkingStrategy(metadata?: ChunkMetadata): string | undefined {
  if (!metadata) return undefined;
  return metadata.requestedChunkingStrategy;
}

/**
 * 3. Resolves strategy flow label representation
 */
export function getStrategyFlowLabel(metadata?: ChunkMetadata): string {
  if (!metadata) return "unknown";
  const requested = getRequestedChunkingStrategy(metadata);
  const actual = getActualChunkingStrategy(metadata);
  
  if (!requested || requested.trim() === "") return actual;
  if (requested.trim().toLowerCase() === actual.trim().toLowerCase()) return actual;
  
  return `${requested} -> ${actual}`;
}

/**
 * 4. Resolves fallback badge display text
 */
export function getFallbackBadge(metadata?: ChunkMetadata): string | undefined {
  if (!metadata) return undefined;
  return metadata.fallbackStatus === "APPLIED" ? "Strategy Fallback" : undefined;
}

/**
 * 5. Resolves quality badge display text
 */
export function getQualityBadge(metadata?: ChunkMetadata): string | undefined {
  if (!metadata) return undefined;
  const status = metadata.chunkQualityStatus;
  if (status === "VALID") return "Valid";
  if (status === "REVIEW_REQUIRED") return "Review required";
  return undefined;
}

/**
 * 6. Resolves list of quality issues
 */
export function getQualityIssues(metadata?: ChunkMetadata): string[] {
  if (!metadata) return [];
  return metadata.chunkQualityIssues ?? [];
}

/**
 * 7. Gathers list of active provenance badges
 */
export function getProvenanceBadges(chunk?: ChunkDto): string[] {
  if (!chunk) return ["No provenance"];
  const meta = chunk.metadata || {};
  const badges: string[] = [];
  
  const hasSourceRef = Boolean(chunk.sourceRef || meta.sourceRef || (chunk.sourceRefs && chunk.sourceRefs.length > 0) || (meta.sourceRefs && (meta.sourceRefs as any).length > 0));
  const hasPage = chunk.page != null || meta.page != null;
  const hasSlide = chunk.slide != null || meta.slide != null;
  const hasBlock = Boolean((chunk.blockIds && chunk.blockIds.length > 0) || (meta.blockIds && (meta.blockIds as any).length > 0));
  const hasOffset = (chunk.startOffset != null && chunk.endOffset != null) || (meta.startOffset != null && meta.endOffset != null);
  
  if (hasSourceRef) badges.push("SourceRef");
  if (hasPage) badges.push("Page");
  if (hasSlide) badges.push("Slide");
  if (hasBlock) badges.push("Block");
  if (hasOffset) badges.push("Offset");
  
  if (badges.length === 0) {
    badges.push("No provenance");
  }
  
  return badges;
}

/**
 * 8. Checks if any provenance parameters exist (must not be 'No provenance')
 */
export function hasProvenance(chunk?: ChunkDto): boolean {
  const badges = getProvenanceBadges(chunk);
  return badges.length > 0 && badges[0] !== "No provenance";
}

/**
 * 9. Summarizes chunk quality stats for a list of chunks
 */
export function summarizeChunkQuality(chunks: ChunkDto[]): ChunkQualitySummary {
  const summary: ChunkQualitySummary = {
    total: chunks.length,
    valid: 0,
    reviewRequired: 0,
    strategyFallback: 0,
    missingProvenance: 0,
    unknown: 0,
    maxSizeExceeded: 0,
    status: "success",
  };
  
  if (chunks.length === 0) return summary;
  
  chunks.forEach((chunk) => {
    const meta = chunk.metadata || {};
    
    // Valid / Review / Unknown 집계
    if (meta.chunkQualityStatus === "VALID") {
      summary.valid += 1;
    } else if (meta.chunkQualityStatus === "REVIEW_REQUIRED") {
      summary.reviewRequired += 1;
    } else if (!meta.chunkQualityStatus) {
      summary.unknown += 1;
    }
    
    // Fallback 집계
    if (meta.fallbackStatus === "APPLIED") {
      summary.strategyFallback += 1;
    }
    
    // Provenance 집계
    if (!hasProvenance(chunk) || (meta.chunkQualityIssues && meta.chunkQualityIssues.includes("MISSING_PROVENANCE"))) {
      summary.missingProvenance += 1;
    }
    
    // Max Size Exceeded 집계
    if (meta.chunkQualityIssues && meta.chunkQualityIssues.includes("MAX_SIZE_EXCEEDED")) {
      summary.maxSizeExceeded += 1;
    }
  });
  
  // UI Status 결정
  if (summary.reviewRequired > 0 || summary.missingProvenance > 0) {
    summary.status = "warning";
  } else if (summary.strategyFallback > 0) {
    summary.status = "info";
  } else {
    summary.status = "success";
  }
  
  return summary;
}

/**
 * 10. Recommends chunk processing actions based on quality summary
 */
export function recommendChunkingActions(summary: ChunkQualitySummary): string[] {
  const recommendations: string[] = [];
  if (summary.total === 0) return recommendations;
  
  const threshold = summary.total * ACTION_RECOMMENDATION_THRESHOLD;
  
  if (summary.missingProvenance >= threshold) {
    recommendations.push("원문 위치 정보가 부족합니다. Markdown 또는 OCR 재추출을 검토하세요.");
  }
  
  if (summary.strategyFallback >= threshold) {
    recommendations.push("구조 기반 청킹이 일부 fallback되었습니다. recursive 또는 fixed-size 재청킹을 검토하세요.");
  }
  
  if (summary.maxSizeExceeded > 0) {
    recommendations.push("일부 chunk가 최대 크기를 초과했습니다. chunk 크기 설정을 늘려 재청킹하세요.");
  }
  
  if (summary.reviewRequired >= threshold) {
    recommendations.push("검토가 필요한 chunk가 많습니다. issue 유형을 확인한 뒤 재청킹 설정을 조정하세요.");
  }
  
  return recommendations;
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

export const getChunkStrategyDisplay = getStrategyFlowLabel;
export const hasChunkProvenance = hasProvenance;

export type NormalizationStatus = "VALID" | "REVIEW_REQUIRED";

export type NormalizationSource =
  | "NATIVE_PARSED_FILE"
  | "PANDOC_MARKDOWN"
  | "MARKDOWN_FALLBACK";

export interface NormalizedDocumentResourceMetadata {
  schemaVersion?: "normalized-document-v1";
  normalizationStatus?: NormalizationStatus;
  normalizationIssues?: string[];
  normalizationSource?: NormalizationSource;
  blockCount?: number;
  tableCount?: number;
  imageCount?: number;
  pageCount?: number;
}

export interface ChunkNormalizationMetadata {
  normalizedSnapshotUsed?: boolean;
  normalizationStatus?: NormalizationStatus;
  normalizationIssues?: string[];
  normalizationSource?: NormalizationSource;
}

export function findNormalizedDocumentResource(resources?: any[]): any | null {
  if (!resources || !Array.isArray(resources)) return null;
  return resources.find(
    (res) =>
      res.resourceType === "NORMALIZED_DOCUMENT" &&
      (res.metadataJson?.schemaVersion === "normalized-document-v1" ||
       (typeof res.metadataJson === "string" && res.metadataJson.includes("normalized-document-v1")))
  ) || null;
}

export function getNormalizationBadge(resource?: any): string {
  if (!resource) return "정규화 정보 없음";
  let meta = resource.metadataJson;
  if (typeof meta === "string") {
    try {
      meta = JSON.parse(meta);
    } catch {
      return "정규화 정보 없음";
    }
  }
  const status = meta?.normalizationStatus;
  if (status === "VALID") return "정규화 완료";
  if (status === "REVIEW_REQUIRED") return "정규화 검토 필요";
  return "정규화 정보 없음";
}

export function getNormalizationSourceLabel(source?: string): string {
  if (!source) return "-";
  switch (source) {
    case "NATIVE_PARSED_FILE":
      return "Native extraction";
    case "PANDOC_MARKDOWN":
      return "Pandoc markdown";
    case "MARKDOWN_FALLBACK":
      return "Markdown fallback";
    default:
      return source;
  }
}

export function getChunkNormalizationBadge(metadata?: any): string | undefined {
  if (!metadata) return undefined;
  if (metadata.normalizedSnapshotUsed === true) {
    return "Normalized blocks";
  }
  if (metadata.normalizedSnapshotUsed === false) {
    return "Markdown fallback";
  }
  return undefined;
}

export function hasNormalizedChunkInput(metadata?: any): boolean {
  return metadata?.normalizedSnapshotUsed === true;
}

