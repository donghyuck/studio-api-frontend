import type {
  IndexedWebSourceRefDto,
  ResolvedRagSourcePolicyDto,
} from "@/types/studio/ai";
import { resolveAxiosError } from "@/utils/helpers";

export interface EvidenceSourceSelectionDto {
  documentScopeSelected?: boolean;
  indexedWebSourceCount?: number;
  officialExternalEnabled?: boolean;
  packedOrigins?: string[];
  usedOrigins?: string[];
}

export interface DeriveEvidenceSourceViewModelParams {
  selection?: EvidenceSourceSelectionDto | null;
  sourcePolicy?: ResolvedRagSourcePolicyDto | null;
  attachedDocumentName?: string | null;
  selectedWebSourcesCount?: number;
  packedOrigins?: string[];
  usedOrigins?: string[];
}

export interface EvidenceSourceViewModel {
  selectionLabel: string;
  packedOriginsLabel: string | null;
  usedOriginsLabel: string | null;
  documentScopeSelected: boolean;
  indexedWebSourceCount: number;
  officialExternalEnabled: boolean;
  packedOrigins: string[];
  usedOrigins: string[];
}

export function toIndexedWebSourcePayload(
  selectedSources: IndexedWebSourceRefDto[]
): IndexedWebSourceRefDto[] {
  return selectedSources.map((item) => {
    if (item.corpusRevisionId?.trim()) {
      return {
        sourceId: item.sourceId,
        corpusRevisionId: item.corpusRevisionId,
      };
    }
    if (item.revisionId?.trim()) {
      return {
        sourceId: item.sourceId,
        revisionId: item.revisionId,
      };
    }
    throw new Error("선택한 웹 자료에 고정된 revision 정보가 없습니다.");
  });
}

export function originToKorean(origin: string): string {
  switch (origin) {
    case "DOCUMENT":
      return "문서";
    case "INDEXED_WEB":
      return "수집한 웹";
    case "OFFICIAL_EXTERNAL":
      return "공식 외부 자료";
    default:
      return origin;
  }
}

export function deriveEvidenceSourceViewModel(
  params: DeriveEvidenceSourceViewModelParams
): EvidenceSourceViewModel {
  const {
    selection,
    sourcePolicy,
    attachedDocumentName,
    selectedWebSourcesCount = 0,
    packedOrigins: fallbackPackedOrigins = [],
    usedOrigins: fallbackUsedOrigins = [],
  } = params;

  const docSelected = selection?.documentScopeSelected ?? Boolean(attachedDocumentName);
  const webCount = selection?.indexedWebSourceCount ?? selectedWebSourcesCount;
  const officialEnabled =
    selection?.officialExternalEnabled ??
    sourcePolicy?.effectiveScope === "DOCUMENT_AND_OFFICIAL_EXTERNAL";

  const packedOrigins = selection?.packedOrigins ?? fallbackPackedOrigins;
  const usedOrigins = selection?.usedOrigins ?? fallbackUsedOrigins;

  const parts: string[] = [];
  if (docSelected) {
    parts.push(attachedDocumentName ? `첨부 문서 (${attachedDocumentName})` : "첨부 문서");
  }
  if (webCount > 0) {
    parts.push(`수집한 웹 ${webCount}개`);
  }
  if (officialEnabled) {
    parts.push("공식 외부 자료");
  }

  const selectionLabel = parts.length > 0 ? parts.join(" + ") : "선택된 자료 없음";

  const packedOriginsLabel =
    packedOrigins.length > 0
      ? `포함된 근거: ${packedOrigins.map(originToKorean).join(", ")}`
      : null;

  const usedOriginsLabel =
    usedOrigins.length > 0
      ? `답변 근거: ${usedOrigins.map(originToKorean).join(", ")}`
      : null;

  return {
    selectionLabel,
    packedOriginsLabel,
    usedOriginsLabel,
    documentScopeSelected: docSelected,
    indexedWebSourceCount: webCount,
    officialExternalEnabled: officialEnabled,
    packedOrigins,
    usedOrigins,
  };
}

export function mapWebKnowledgeError(
  err: unknown,
  defaultMsg = "수집 처리 중 오류가 발생했습니다."
): string {
  if (!err) return defaultMsg;
  const code =
    typeof err === "string"
      ? err
      : (err as { response?: { data?: { code?: string } } })?.response?.data?.code;

  if (code) {
    switch (code) {
      case "WEB_SOURCE_REVISION_NOT_READY":
        return "자료 수집 또는 색인이 아직 완료되지 않았습니다.";
      case "WEB_CORPUS_REVISION_REQUIRED":
        return "유효한 웹 수집 버전(Revision)이 필요합니다.";
      case "WEB_SOURCE_EMBEDDING_SPACE_MISMATCH":
        return "선택한 임베딩 모델과 호환되지 않는 웹 자료입니다. (임베딩 규격 불일치)";
      case "WEB_SOURCE_NOT_FOUND":
        return "요청한 웹 수집 자료를 찾을 수 없습니다.";
      case "INSUFFICIENT_SOURCE_COVERAGE":
        return "선택한 자료만으로는 답변에 필요한 근거가 부족합니다.";
      case "WEB_SOURCE_COLLECTION_MODE_CONFLICT":
        return "동일한 URL이 이미 다른 수집 모드로 등록되어 있습니다. 기존 자료를 삭제(Archive)한 뒤 원하는 모드(SITE)로 새로 등록해 주세요.";
      case "WEB_SITE_CRAWL_DISABLED":
        return "사이트 수집 기능이 비활성화되어 있습니다.";
      case "WEB_CRAWL_QUOTA_EXCEEDED":
        return "workspace 수집 한도(quota)를 초과하였습니다.";
      case "FORBIDDEN":
      case "403":
        return "workspace 또는 RAG 권한이 부족합니다.";
      case "URL_NOT_ALLOWED":
        return "공개 HTTPS URL만 허용됩니다.";
      case "HOST_NOT_PUBLIC":
        return "내부·로컬·metadata 주소는 수집할 수 없습니다.";
    }
  }

  const resolved = resolveAxiosError(err);
  return resolved || defaultMsg;
}
