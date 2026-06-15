import { apiRequest } from "@/react/query/fetcher";
import type { PageParams, PageResponse } from "@/types/studio/api-common";
import type {
  SkillCandidate,
  SkillCandidateAutoApproveResult,
  SkillCandidateStatus,
  SkillCategory,
  SkillCategoryGraph,
  SkillCategoryRelation,
  SkillClusterPoint,
  SkillDictionaryItem,
  SkillGraphDashboard,
  SkillGraphJob,
  SkillGraphJobStatus,
  SkillGraphListParams,
  SkillGraphPageResponse,
  SkillRagChunkPageResponse,
  SkillRagExtractionJobItemPageResponse,
  SkillRagExtractionRequest,
  SkillRagExtractionJobResponse,
  SkillGraphSimulationRequest,
  SkillGraphSimulationResponse,
  SkillMapping,
  SkillRecommendationApplyResult,
  SkillRecommendationJob,
  SkillRecommendationResult,
  SkillRelation,
  SkillRelationType,
} from "@/types/studio/skillgraph";

const BASE = "/api/mgmt/skillgraph";
const EXTRACTION_BASE = `${BASE}/extraction-jobs`;
const EXTRACTION_SOURCE_BASE = `${BASE}/extraction-sources`;
const CANDIDATE_BASE = `${BASE}/candidates`;
const DICTIONARY_BASE = `${BASE}/dictionary`;
const VISUALIZATION_BASE = `${BASE}/visualization`;
const CATEGORY_BASE = `${BASE}/categories`;
const CATEGORY_DRAFT_BASE = `${BASE}/category-drafts`;
const CATEGORY_RELATION_BASE = `${CATEGORY_BASE}/relations`;
const RELATION_BASE = `${BASE}/relations`;
const MAPPING_BASE = `${BASE}/mappings`;
const RECOMMENDATION_BASE = `${BASE}/recommendations`;
const DATASET_BASE = `/api/mgmt/skillgraph/datasets`;

function pageItems<T>(response: SkillGraphPageResponse<T> | T[] | undefined) {
  if (Array.isArray(response)) return response;
  return response?.content ?? response?.items ?? response?.results ?? [];
}

function cleanParams<T extends Record<string, unknown>>(params?: T) {
  if (!params) return undefined;
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== "" && value != null)
  );
}

function candidateParams(params?: SkillGraphListParams) {
  return cleanParams({
    status: params?.status,
    q: params?.keyword,
    sourceType: params?.objectType,
    sourceId: params?.objectId,
    skillType: params?.skillType,
    page: params?.page,
    size: params?.size ?? params?.limit,
    sort: params?.sort,
  });
}

function normalizeCandidate(candidate: SkillCandidate): SkillCandidate {
  return {
    ...candidate,
    rawText: candidate.rawText ?? candidate.term ?? "",
    normalizedText: candidate.normalizedText ?? candidate.normalizedTerm ?? "",
    searchText: candidate.searchText ?? candidate.rawText ?? candidate.term ?? "",
    evidenceSentence: candidate.evidenceSentence ?? candidate.evidenceText,
    candidateType: candidate.candidateType ?? candidate.skillType,
    confidenceScore: candidate.confidenceScore ?? candidate.confidence,
    matchedSkillId: candidate.matchedSkillId ?? candidate.matchedSkill?.skillId,
    matchedSkillName: candidate.matchedSkillName ?? candidate.matchedSkill?.skillName ?? candidate.matchedSkill?.name,
    similarityScore: candidate.similarityScore ?? candidate.matchedSkill?.similarityScore,
    reviewedAt: candidate.reviewedAt ?? candidate.updatedAt,
  };
}

function normalizeCandidateResponse(response: SkillGraphPageResponse<SkillCandidate> | SkillCandidate[]) {
  if (Array.isArray(response)) {
    return response.map(normalizeCandidate);
  }

  if (response?.content) {
    return { ...response, content: response.content.map(normalizeCandidate) };
  }

  if (response?.items) {
    return { ...response, items: response.items.map(normalizeCandidate) };
  }

  if (response?.results) {
    return { ...response, results: response.results.map(normalizeCandidate) };
  }

  return response;
}

function normalizeDictionaryItem(item: SkillDictionaryItem): SkillDictionaryItem {
  return {
    ...item,
    skillName: item.skillName ?? item.name ?? "",
    active: item.active ?? item.status !== "INACTIVE",
    approved: item.approved ?? item.status === "APPROVED",
  };
}

function normalizeDictionaryResponse(response: SkillGraphPageResponse<SkillDictionaryItem> | SkillDictionaryItem[]) {
  if (Array.isArray(response)) {
    return response.map(normalizeDictionaryItem);
  }

  if (response?.content) {
    return { ...response, content: response.content.map(normalizeDictionaryItem) };
  }

  if (response?.items) {
    return { ...response, items: response.items.map(normalizeDictionaryItem) };
  }

  if (response?.results) {
    return { ...response, results: response.results.map(normalizeDictionaryItem) };
  }

  return response;
}

function normalizeCategory(category: SkillCategory): SkillCategory {
  return {
    ...category,
    categoryName: category.categoryName ?? category.name ?? "",
    parentId: category.parentId ?? category.parentCategoryId,
    sortOrder: category.sortOrder ?? category.displayOrder ?? 0,
    active: category.active ?? true,
    depth: category.depth ?? 0,
    skillCount: category.skillCount ?? 0,
  };
}

function normalizeClusterPoint(point: SkillClusterPoint): SkillClusterPoint {
  const targetId = point.targetId ?? point.skillId ?? "";
  return {
    ...point,
    targetType: point.targetType ?? "SKILL",
    targetId,
    label: point.label ?? point.skillId ?? String(targetId || "-"),
  };
}

function normalizeClusterResponse(response: SkillClusterResponse | SkillClusterPoint[]): SkillClusterResponse {
  if (Array.isArray(response)) {
    return { points: response.map(normalizeClusterPoint) };
  }

  return {
    ...response,
    points: response.points?.map(normalizeClusterPoint),
    content: response.content?.map(normalizeClusterPoint),
    items: response.items?.map(normalizeClusterPoint),
    results: response.results?.map(normalizeClusterPoint),
  };
}

function normalizeJob(job: SkillGraphJob & { options?: any }): SkillGraphJob {
  return {
    ...job,
    totalCount: job.totalCount ?? job.totalChunks,
    processedCount: job.processedCount ?? job.processedChunks,
    failedCount: job.failedCount ?? job.failedChunks,
    failureReason: job.failureReason ?? job.error,
    currentStep: job.currentStep ?? (job.status === "RUNNING" ? "RAG_CHUNK_EXTRACTION" : undefined),
    chunkingStrategy: job.chunkingStrategy ?? job.options?.chunkingStrategy ?? job.options?.chunking_strategy ?? undefined,
  };
}

export const skillGraphApi = {
  pageItems,

  async dashboard() {
    const [candidates, dictionary, categories, relations] = await Promise.all([
      skillGraphApi.listCandidates({ limit: 500 }),
      skillGraphApi.listDictionary({ limit: 500 }),
      skillGraphApi.listCategoryTree(),
      skillGraphApi.listRelations({ limit: 500 }),
    ]);
    const candidateRows = pageItems(candidates);
    const dictionaryRows = pageItems(dictionary);
    const categoryRows = categories ?? [];
    const relationRows = pageItems(relations);
    return {
      totalSkillCount: dictionaryRows.length,
      candidateCount: candidateRows.length,
      pendingReviewCount: candidateRows.filter((row) => row.status === "PENDING").length,
      aliasCandidateCount: candidateRows.filter((row) => row.status === "ALIAS_CANDIDATE").length,
      noiseCount: candidateRows.filter((row) => row.status === "NOISE").length,
      clusterCount: 0,
      recentSkills: dictionaryRows.slice(0, 5),
      categoryDistribution: categoryRows.map((category) => ({
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        skillCount: category.skillCount ?? 0,
      })),
      recentJobs: [],
      relationCount: relationRows.length,
    } as SkillGraphDashboard;
  },

  async listJobs(params?: SkillGraphListParams) {
    const response = await apiRequest<SkillGraphPageResponse<SkillGraphJob>>(
      "get",
      EXTRACTION_BASE,
      {
        params: cleanParams({
          status: params?.status,
          objectType: params?.objectType,
          objectId: params?.objectId,
          documentId: params?.keyword,
          page: params?.page ?? 0,
          size: params?.size ?? 100,
          sort: params?.sort ?? "updatedAt,desc",
        }),
      }
    );
    return response;
  },

  createExtractionJob(data: { sourceType: string; sourceId: string; chunkId?: string; text?: string }) {
    return apiRequest<unknown>("post", EXTRACTION_BASE, { data });
  },

  listRagChunks(params: {
    objectType: string;
    objectId?: string | number;
    documentId?: string;
    q?: string;
    page?: number;
    size?: number;
    sort?: string;
  }) {
    return apiRequest<SkillRagChunkPageResponse>("get", `${EXTRACTION_SOURCE_BASE}/rag/chunks`, {
      params: cleanParams(params),
    });
  },

  async extractRag(data: SkillRagExtractionRequest) {
    return apiRequest<SkillRagExtractionJobResponse>("post", `${EXTRACTION_BASE}/rag`, { data });
  },

  async getJob(jobId: string | number) {
    const response = await apiRequest<SkillGraphJob>(
      "get",
      `${EXTRACTION_BASE}/${encodeURIComponent(String(jobId))}`
    );
    return normalizeJob(response);
  },

  async retryJob(
    jobId: string | number,
    mode: "FAILED_ONLY" | "RESUME_INCOMPLETE" | "FORCE_RESTART" = "FAILED_ONLY"
  ) {
    const response = await apiRequest<SkillGraphJob>(
      "post",
      `${EXTRACTION_BASE}/${encodeURIComponent(String(jobId))}/retry`,
      { data: { mode } }
    );
    return normalizeJob(response);
  },

  listJobItems(jobId: string | number, offset = 0, limit = 100) {
    return apiRequest<SkillRagExtractionJobItemPageResponse>(
      "get",
      `${EXTRACTION_BASE}/${encodeURIComponent(String(jobId))}/items`,
      { params: { offset, limit } }
    );
  },

  async listJobCandidates(jobId: string | number, offset = 0, limit = 1000) {
    const response = await apiRequest<SkillGraphPageResponse<SkillCandidate> | SkillCandidate[]>(
      "get",
      `${EXTRACTION_BASE}/${encodeURIComponent(String(jobId))}/candidates`,
      { params: { offset, limit } }
    );
    return normalizeCandidateResponse(response);
  },

  async listCandidates(params?: SkillGraphListParams) {
    const response = await apiRequest<SkillGraphPageResponse<SkillCandidate> | SkillCandidate[]>(
      "get",
      CANDIDATE_BASE,
      { params: candidateParams(params) }
    );
    return normalizeCandidateResponse(response);
  },

  async getCandidate(candidateId: string | number) {
    const response = await apiRequest<SkillCandidate>(
      "get",
      `${CANDIDATE_BASE}/${encodeURIComponent(String(candidateId))}`
    );
    return normalizeCandidate(response);
  },

  async approveCandidate(candidateId: string | number, data?: Record<string, unknown>) {
    const response = await apiRequest<SkillCandidate>(
      "patch",
      `${CANDIDATE_BASE}/${encodeURIComponent(String(candidateId))}`,
      { data: { ...data, status: "APPROVED" } }
    );
    return normalizeCandidate(response);
  },

  async rejectCandidate(candidateId: string | number, data?: Record<string, unknown>) {
    const response = await apiRequest<SkillCandidate>(
      "patch",
      `${CANDIDATE_BASE}/${encodeURIComponent(String(candidateId))}`,
      { data: { ...data, status: "REJECTED" } }
    );
    return normalizeCandidate(response);
  },

  async markNoise(candidateId: string | number, data?: Record<string, unknown>) {
    const response = await apiRequest<SkillCandidate>(
      "patch",
      `${CANDIDATE_BASE}/${encodeURIComponent(String(candidateId))}`,
      { data: { ...data, status: "NOISE" } }
    );
    return normalizeCandidate(response);
  },

  async reviewCandidateSingle(candidateId: string | number, data: {
    status: "ALIAS_CANDIDATE" | "APPROVED" | "REJECTED" | "NOISE";
    matchedSkillId?: string;
    reviewerNote?: string;
  }) {
    const response = await apiRequest<SkillCandidate>(
      "patch",
      `${CANDIDATE_BASE}/${encodeURIComponent(String(candidateId))}/review`,
      { data }
    );
    return normalizeCandidate(response);
  },

  async reviewCandidates(data: {
    candidateIds: Array<string | number>;
    status: Extract<SkillCandidateStatus, "APPROVED" | "REJECTED" | "NOISE">;
    reviewerNote?: string;
  }) {
    const response = await apiRequest<SkillCandidate[]>(
      "patch",
      `${CANDIDATE_BASE}/reviews`,
      {
        data: {
          candidateIds: Array.from(new Set(data.candidateIds.map((id) => String(id)))),
          status: data.status,
          reviewerNote: data.reviewerNote,
        },
      }
    );
    return response.map(normalizeCandidate);
  },

  async autoApproveCandidates(data: {
    minConfidence: number;
    minSimilarityScore: number;
    generateEmbedding: boolean;
    reviewerNote?: string;
  }) {
    const candidates = await skillGraphApi.listCandidates({ status: "PENDING", limit: 500 });
    const candidateIds = pageItems(candidates)
      .map((candidate) => candidate.candidateId)
      .filter((candidateId) => candidateId !== undefined && candidateId !== null)
      .map((candidateId) => String(candidateId));
    const uniqueCandidateIds = Array.from(new Set(candidateIds));

    if (uniqueCandidateIds.length === 0) {
      return {
        requestedCount: 0,
        approvedCount: 0,
        skippedCount: 0,
        approved: [],
        skipped: [],
      };
    }

    const response = await apiRequest<SkillCandidateAutoApproveResult>(
      "patch",
      `${CANDIDATE_BASE}/auto-approve`,
      {
        data: {
          candidateIds: uniqueCandidateIds,
          minConfidence: data.minConfidence,
          minSimilarityScore: data.minSimilarityScore,
          generateEmbedding: data.generateEmbedding,
          reviewerNote: data.reviewerNote,
        },
      }
    );

    return {
      ...response,
      approved: response.approved?.map(normalizeCandidate) ?? [],
      skipped: response.skipped ?? [],
    };
  },

  async mergeCandidate(candidateId: string | number, data?: Record<string, unknown>) {
    const response = await apiRequest<SkillCandidate>(
      "patch",
      `${CANDIDATE_BASE}/${encodeURIComponent(String(candidateId))}`,
      { data: { ...data, status: "MATCHED" } }
    );
    return normalizeCandidate(response);
  },

  async listDictionary(params?: SkillGraphListParams) {
    const response = await apiRequest<SkillGraphPageResponse<SkillDictionaryItem> | SkillDictionaryItem[]>(
      "get",
      DICTIONARY_BASE,
      {
        params: cleanParams({
          q: params?.keyword,
          status: params?.status,
          categoryId: params?.categoryId,
          page: params?.page,
          size: params?.size ?? params?.limit,
          sort: params?.sort,
        }),
      }
    );
    return normalizeDictionaryResponse(response);
  },

  async getDictionaryItem(skillId: string | number) {
    const response = await apiRequest<SkillDictionaryItem>(
      "get",
      `${DICTIONARY_BASE}/${encodeURIComponent(String(skillId))}`
    );
    return normalizeDictionaryItem(response);
  },

  async createDictionaryItem(data: Partial<SkillDictionaryItem>) {
    const response = await apiRequest<SkillDictionaryItem>(
      "post",
      DICTIONARY_BASE,
      {
        data: {
          name: data.skillName ?? data.name,
          normalizedName: data.normalizedName,
          categoryId: data.categoryId,
          status: data.status,
          description: data.description,
        },
      }
    );
    return normalizeDictionaryItem(response);
  },

  generateMissingDictionaryEmbeddings(data: SkillCandidateEmbeddingRequest) {
    return apiRequest<SkillDictionaryEmbeddingResult>(
      "post",
      `${DICTIONARY_BASE}/embeddings/missing`,
      { data }
    );
  },

  getDictionaryEmbeddingJob(jobId: string) {
    return apiRequest<SkillDictionaryEmbeddingJob>(
      "get",
      `${DICTIONARY_BASE}/embeddings/jobs/${encodeURIComponent(jobId)}`
    );
  },

  generateMissingCandidateEmbeddings(data: SkillCandidateEmbeddingRequest) {
    return apiRequest<SkillDictionaryEmbeddingResult>(
      "post",
      `${CANDIDATE_BASE}/embeddings/missing`,
      { data }
    );
  },

  getCandidateEmbeddingJob(jobId: string) {
    return apiRequest<SkillDictionaryEmbeddingJob>(
      "get",
      `${CANDIDATE_BASE}/embeddings/jobs/${encodeURIComponent(jobId)}`
    );
  },

  getSkillGraphBatchJob(jobId: string) {
    return apiRequest<SkillGraphBatchJobEvent>(
      "get",
      `${BASE}/jobs/${encodeURIComponent(jobId)}`
    );
  },

  listSkillGraphBatchJobs(params?: PageParams & { jobType?: string; status?: string }) {
    return apiRequest<SkillGraphPageResponse<SkillGraphBatchJobEvent> | SkillGraphBatchJobEvent[]>(
      "get",
      `${BASE}/jobs`,
      {
        params: cleanParams({
          page: params?.page,
          size: params?.size,
          sort: params?.sort,
          jobType: params?.jobType,
          status: params?.status,
        }),
      }
    );
  },

  createCandidateRecommendationJob(data: SkillCandidateRecommendationJobRequest) {
    return apiRequest<SkillRecommendationJob>(
      "post",
      `${CANDIDATE_BASE}/recommendation-jobs`,
      { data }
    );
  },

  getRecommendationJobResults(jobId: string) {
    return apiRequest<SkillGraphPageResponse<SkillRecommendationResult> | SkillRecommendationResult[]>(
      "get",
      `${RECOMMENDATION_BASE}/jobs/${encodeURIComponent(jobId)}/results`
    );
  },

  listRecommendationJobs(params?: PageParams) {
    return apiRequest<SkillGraphPageResponse<SkillRecommendationJob> | SkillRecommendationJob[]>(
      "get",
      `${RECOMMENDATION_BASE}/jobs`,
      { params }
    );
  },

  getRecommendationJob(jobId: string) {
    return apiRequest<SkillRecommendationJob>(
      "get",
      `${RECOMMENDATION_BASE}/jobs/${encodeURIComponent(jobId)}`
    );
  },

  listRecommendationJobResults(jobId: string, params?: PageParams) {
    return apiRequest<SkillGraphPageResponse<SkillRecommendationResult> | SkillRecommendationResult[]>(
      "get",
      `${RECOMMENDATION_BASE}/jobs/${encodeURIComponent(jobId)}/results`,
      { params }
    );
  },

  applyRecommendationJob(jobId: string, data: SkillRecommendationApplyRequest) {
    return apiRequest<SkillRecommendationApplyResult>(
      "post",
      `${RECOMMENDATION_BASE}/jobs/${encodeURIComponent(jobId)}/apply`,
      { data }
    );
  },

  applyRecommendationResults(data: SkillRecommendationApplyResultsRequest) {
    return apiRequest<SkillRecommendationApplyResult>(
      "post",
      `${RECOMMENDATION_BASE}/results/apply`,
      { data }
    );
  },

  updateDictionaryItem(skillId: string | number, data: Partial<SkillDictionaryItem>) {
    void skillId;
    void data;
    return Promise.reject(new Error("서버가 Skill Dictionary 수정 API를 제공하지 않습니다."));
  },

  deleteDictionaryItem(skillId: string | number) {
    void skillId;
    return Promise.reject(new Error("서버가 Skill Dictionary 삭제 API를 제공하지 않습니다."));
  },

  async listCategories(params?: SkillGraphListParams) {
    const response = await apiRequest<SkillGraphPageResponse<SkillCategory> | SkillCategory[]>("get", CATEGORY_BASE, {
      params: cleanParams({
        q: params?.keyword,
        parentCategoryId: params?.parentCategoryId,
        page: params?.page,
        size: params?.size ?? params?.limit,
        sort: params?.sort,
      }),
    });
    const normalized = pageItems(response).map(normalizeCategory);
    if (Array.isArray(response)) return normalized;
    if (response?.content) return { ...response, content: normalized };
    if (response?.items) return { ...response, items: normalized };
    if (response?.results) return { ...response, results: normalized };
    return { ...response, content: normalized };
  },

  async listCategoryTree() {
    const response = await skillGraphApi.listCategories({ size: 500, sort: "displayOrder,asc" });
    return pageItems(response).map(normalizeCategory);
  },

  async createCategory(data: Partial<SkillCategory>) {
    const response = await apiRequest<SkillCategory>("post", CATEGORY_BASE, {
      data: {
        categoryId: data.categoryId,
        parentCategoryId: data.parentId ?? data.parentCategoryId,
        name: data.categoryName ?? data.name,
        displayOrder: data.sortOrder ?? data.displayOrder ?? 0,
      },
    });
    return normalizeCategory(response);
  },

  generateCategoryDrafts(projectionId: string, representativeLimit = 5, useLlm = false) {
    return apiRequest<SkillCategoryDraftResult>(
      "post",
      CATEGORY_DRAFT_BASE,
      {
        data: {
          projectionId,
          clusterIds: null,
          representativeLimit,
          includeNoise: false,
          useLlm,
        },
        params: cleanParams({ useLlm }),
      }
    );
  },

  reconcileCategoryDrafts(data?: {
    limit?: number;
    existingCategoryMinSimilarity?: number;
    newCategoryMinSimilarity?: number;
    minClusterSize?: number;
    representativeLimit?: number;
    useLlm?: boolean;
  }) {
    return apiRequest<SkillCategoryReconcileResult>(
      "post",
      `${CATEGORY_DRAFT_BASE}/reconcile`,
      {
        data: {
          limit: data?.limit,
          existingCategoryMinSimilarity: data?.existingCategoryMinSimilarity,
          newCategoryMinSimilarity: data?.newCategoryMinSimilarity,
          minClusterSize: data?.minClusterSize,
          representativeLimit: data?.representativeLimit,
          useLlm: data?.useLlm,
        },
      }
    );
  },

  async saveCategoryDrafts(drafts: Array<{ categoryId: string; parentCategoryId?: string; name: string; displayOrder?: number }>) {
    const response = await apiRequest<SkillCategory[]>(
      "post",
      `${CATEGORY_DRAFT_BASE}/save`,
      { data: { categories: drafts } }
    );
    return response.map(normalizeCategory);
  },

  async getCategory(categoryId: string | number) {
    const response = await apiRequest<SkillCategory>(
      "get",
      `${CATEGORY_BASE}/${encodeURIComponent(String(categoryId))}`
    );
    return normalizeCategory(response);
  },

  async updateCategory(categoryId: string | number, data: Partial<SkillCategory>) {
    const response = await apiRequest<SkillCategory>("put", `${CATEGORY_BASE}/${encodeURIComponent(String(categoryId))}`, {
      data: {
        categoryId: data.categoryId ?? categoryId,
        parentCategoryId: data.parentId ?? data.parentCategoryId,
        name: data.categoryName ?? data.name,
        displayOrder: data.sortOrder ?? data.displayOrder ?? 0,
      },
    });
    return normalizeCategory(response);
  },

  getCategoryDeletionImpact(categoryId: string | number) {
    return apiRequest<{
      categoryId: string;
      skillCount: number;
      childCount: number;
      deletable: boolean;
    }>(
      "get",
      `${CATEGORY_BASE}/${encodeURIComponent(String(categoryId))}/deletion-impact`
    );
  },

  deleteCategory(categoryId: string | number) {
    return apiRequest<void>(
      "delete",
      `${CATEGORY_BASE}/${encodeURIComponent(String(categoryId))}`
    );
  },

  async moveCategory(categoryId: string | number, data: { parentCategoryId?: string; displayOrder?: number }) {
    const response = await apiRequest<SkillCategory>(
      "post",
      `${CATEGORY_BASE}/${encodeURIComponent(String(categoryId))}/move`,
      { data }
    );
    return normalizeCategory(response);
  },

  assignCategorySkills(categoryId: string | number, skillIds: string[]) {
    return apiRequest<void>(
      "post",
      `${CATEGORY_BASE}/${encodeURIComponent(String(categoryId))}/skills`,
      { data: { skillIds } }
    );
  },

  assignCategoryFromCluster(categoryId: string | number, data: { projectionId: string; clusterId: string; includeNoise?: boolean }) {
    return apiRequest<void>(
      "post",
      `${CATEGORY_BASE}/${encodeURIComponent(String(categoryId))}/assign-from-cluster`,
      { data }
    );
  },

  mergeCategories(data: { sourceCategoryIds: string[]; targetCategoryId: string; deleteSources?: boolean }) {
    return apiRequest<void>(
      "post",
      `${CATEGORY_BASE}/merge`,
      { data }
    );
  },

  listCategoryHistory(categoryId: string | number, params?: SkillGraphListParams) {
    return apiRequest<SkillGraphPageResponse<Record<string, unknown>>>(
      "get",
      `${CATEGORY_BASE}/${encodeURIComponent(String(categoryId))}/history`,
      { params: cleanParams({ page: params?.page, size: params?.size ?? params?.limit, sort: params?.sort }) }
    );
  },

  listSkillCategoryHistory(skillId: string | number, params?: SkillGraphListParams) {
    return apiRequest<SkillGraphPageResponse<Record<string, unknown>>>(
      "get",
      `${BASE}/skills/${encodeURIComponent(String(skillId))}/category-history`,
      { params: cleanParams({ page: params?.page, size: params?.size ?? params?.limit, sort: params?.sort }) }
    );
  },

  async previewCategoryRelations(data?: {
    categoryIds?: Array<string | number>;
    representativeSkillLimit?: number;
    minScore?: number;
    includePersisted?: boolean;
    useLlm?: boolean;
  }) {
    const response = await apiRequest<SkillCategoryGraph>(
      "post",
      `${CATEGORY_RELATION_BASE}/preview`,
      {
        data: {
          categoryIds: data?.categoryIds?.map(String),
          representativeSkillLimit: data?.representativeSkillLimit ?? 8,
          minScore: data?.minScore ?? 0.25,
          includePersisted: data?.includePersisted ?? true,
          useLlm: data?.useLlm ?? false,
        },
      }
    );
    return {
      ...response,
      categories: response.categories?.map(normalizeCategory) ?? [],
      skills: response.skills?.map(normalizeDictionaryItem) ?? [],
      relations: response.relations ?? [],
    };
  },

  listCategoryRelations(params?: { categoryIds?: Array<string | number> }) {
    return apiRequest<SkillCategoryRelation[]>(
      "get",
      CATEGORY_RELATION_BASE,
      { params: cleanParams({ categoryIds: params?.categoryIds?.map(String) }) }
    );
  },

  saveCategoryRelations(relations: SkillCategoryRelation[]) {
    return apiRequest<SkillCategoryRelation[]>(
      "post",
      CATEGORY_RELATION_BASE,
      {
        data: {
          relations: relations.map((relation) => ({
            relationId: relation.relationId,
            sourceCategoryId: String(relation.sourceCategoryId),
            targetCategoryId: String(relation.targetCategoryId),
            relationType: relation.relationType,
            score: relation.score,
            confidence: relation.confidence,
            reason: relation.reason,
          })),
        },
      }
    );
  },

  deleteCategoryRelation(relationId: string | number) {
    return apiRequest<void>(
      "delete",
      `${CATEGORY_RELATION_BASE}/${encodeURIComponent(String(relationId))}`
    );
  },

  async listClusters(params?: SkillGraphListParams) {
    const projectionId = params?.objectId || params?.keyword;
    if (!projectionId) return Promise.resolve<SkillClusterResponse>({ points: [] });
    const response = await apiRequest<SkillClusterResponse | SkillClusterPoint[]>(
      "get",
      `${VISUALIZATION_BASE}/projections/${encodeURIComponent(String(projectionId))}/points`,
      {
        params: cleanParams({
          clusterId: params?.status,
          page: params?.page,
          size: params?.size ?? params?.limit,
          sort: params?.sort,
        }),
      }
    );
    return normalizeClusterResponse(response);
  },

  async listProjections(params?: SkillGraphListParams) {
    return apiRequest<SkillGraphProjectionListResponse | SkillGraphProjectionSummary[]>(
      "get",
      `${VISUALIZATION_BASE}/projections`,
      {
        params: cleanParams({
          page: params?.page,
          size: params?.size ?? params?.limit,
          sort: params?.sort,
        }),
      }
    );
  },

  listClusterRepresentatives(
    projectionId: string,
    clusterId: string,
    params?: SkillGraphListParams & { includeNoise?: boolean }
  ) {
    return apiRequest<SkillGraphPageResponse<SkillClusterRepresentative>>(
      "get",
      `${VISUALIZATION_BASE}/projections/${encodeURIComponent(projectionId)}/clusters/${encodeURIComponent(clusterId)}/representatives`,
      {
        params: cleanParams({
          includeNoise: params?.includeNoise,
          page: params?.page,
          size: params?.size ?? params?.limit,
          sort: params?.sort,
        }),
      }
    );
  },

  async createProjection(data: {
    projectionId?: string;
    limit?: number;
    skillType?: string;
    projectionType?: string;
    reductionAlgorithm?: "UMAP" | "PCA" | string;
    projectionDimension?: number;
    clusteringAlgorithm?: "HDBSCAN" | string;
    embeddingProvider?: string;
    embeddingModel?: string;
    embeddingDimension?: number;
    parameters?: string;
  }) {
    return apiRequest<SkillGraphBatchJobEvent>("post", `${VISUALIZATION_BASE}/projections`, { data });
  },

  listClusterItems(projectionId: string) {
    return apiRequest<SkillCluster[] | SkillGraphPageResponse<SkillCluster>>(
      "get",
      `${VISUALIZATION_BASE}/projections/${encodeURIComponent(projectionId)}/clusters`
    );
  },

  listClusterMembers(projectionId: string, clusterId: string) {
    return apiRequest<SkillClusterMember[] | SkillGraphPageResponse<SkillClusterMember>>(
      "get",
      `${VISUALIZATION_BASE}/projections/${encodeURIComponent(projectionId)}/clusters/${encodeURIComponent(clusterId)}/members`
    );
  },

  listRelations(params?: SkillGraphListParams & { skillId?: string | number; depth?: number; relationType?: SkillRelationType | "" }) {
    return apiRequest<SkillGraphPageResponse<SkillRelation> | SkillRelation[]>(
      "get",
      RELATION_BASE,
      { params: cleanParams({ skillId: params?.skillId, type: params?.relationType, limit: params?.limit }) }
    );
  },

  createRelation(data: Partial<SkillRelation>) {
    return apiRequest<SkillRelation>("post", RELATION_BASE, { data });
  },

  deleteRelation(relationId: string | number) {
    void relationId;
    return Promise.reject(new Error("서버가 Relation 삭제 API를 제공하지 않습니다."));
  },

  listNcsMappings(params?: SkillGraphListParams & { skillId?: string | number; ncsId?: string | number }) {
    return apiRequest<SkillGraphPageResponse<SkillMapping> | SkillMapping[]>(
      "get",
      `${MAPPING_BASE}/ncs`,
      { params: cleanParams({ ncsUnitId: params?.ncsId ?? params?.keyword, limit: params?.limit }) }
    );
  },

  approveNcsMapping(mappingId: string | number) {
    void mappingId;
    return Promise.reject(new Error("서버가 NCS Mapping 승인 API를 제공하지 않습니다."));
  },

  deleteNcsMapping(mappingId: string | number) {
    void mappingId;
    return Promise.reject(new Error("서버가 NCS Mapping 삭제 API를 제공하지 않습니다."));
  },

  listCourseMappings(params?: SkillGraphListParams & { courseId?: string | number }) {
    return apiRequest<SkillGraphPageResponse<SkillMapping> | SkillMapping[]>(
      "get",
      `${MAPPING_BASE}/courses`,
      { params: cleanParams({ courseId: params?.courseId ?? params?.keyword, limit: params?.limit }) }
    );
  },

  updateCourseMapping(mappingId: string | number, data: Partial<SkillMapping>) {
    void mappingId;
    return apiRequest<SkillMapping>("post", `${MAPPING_BASE}/courses`, { data });
  },

  simulate(kind: string, data: SkillGraphSimulationRequest) {
    if (kind === "course-recommendation") {
      return apiRequest<SkillGraphSimulationResponse>(
        "post",
        `${RECOMMENDATION_BASE}/courses`,
        {
          data: {
            targetSkillIds: data.query ? [data.query] : data.text ? [data.text] : [],
            ownedSkillIds: [],
            limit: data.topK ?? 10,
          },
        }
      );
    }
    if (kind === "extraction") {
      return apiRequest<SkillGraphSimulationResponse>(
        "post",
        EXTRACTION_BASE,
        {
          data: {
            sourceType: "SIMULATION",
            sourceId: `simulation-${Date.now()}`,
            text: data.text,
          },
        }
      );
    }
    return apiRequest<SkillGraphSimulationResponse>(
      "post",
      `${VISUALIZATION_BASE}/projections`,
      { data }
    );
  },

  listDatasetImportJobs(limit = 20) {
    return apiRequest<SkillDatasetImportJob[]>("get", DATASET_BASE, {
      params: cleanParams({ limit }),
    });
  },

  getDatasetImportJob(jobId: string) {
    return apiRequest<SkillDatasetImportJob>("get", `${DATASET_BASE}/import-jobs/${encodeURIComponent(jobId)}`);
  },

  createDatasetImportJob(data: SkillDatasetImportRequest) {
    return apiRequest<SkillDatasetImportJob>("post", `${DATASET_BASE}/import-jobs`, { data });
  },

  listDatasetIds(params?: PageParams) {
    return apiRequest<PageResponse<SkillReferenceDataset>>("get", `${DATASET_BASE}/dataset-ids`, {
      params: cleanParams({ page: params?.page, size: params?.size ?? 15, sort: params?.sort }),
    });
  },

  listReferenceConcepts(
    datasetId: string,
    params?: { conceptType?: string; q?: string } & PageParams
  ) {
    return apiRequest<PageResponse<SkillReferenceConcept>>(
      "get",
      `${DATASET_BASE}/${encodeURIComponent(datasetId)}/concepts`,
      { params: cleanParams({ conceptType: params?.conceptType, q: params?.q, page: params?.page, size: params?.size ?? 15, sort: params?.sort }) }
    );
  },

  getReferenceConcept(datasetId: string, conceptId: string) {
    return apiRequest<SkillReferenceConcept>(
      "get",
      `${DATASET_BASE}/${encodeURIComponent(datasetId)}/concepts/${encodeURIComponent(conceptId)}`
    );
  },

  listReferenceChildren(
    datasetId: string,
    conceptId: string,
    params?: { relationType?: string } & PageParams
  ) {
    return apiRequest<PageResponse<SkillReferenceConcept>>(
      "get",
      `${DATASET_BASE}/${encodeURIComponent(datasetId)}/concepts/${encodeURIComponent(conceptId)}/children`,
      { params: cleanParams({ relationType: params?.relationType, page: params?.page, size: params?.size ?? 15, sort: params?.sort }) }
    );
  },

  searchReferenceConcepts(data: SkillReferenceSearchRequest, params?: PageParams) {
    return apiRequest<PageResponse<SkillReferenceConcept>>("post", `${DATASET_BASE}/reference-search`, {
      data,
      params: cleanParams({ page: params?.page, size: params?.size ?? 15, sort: params?.sort }),
    });
  },

  vectorizeReferenceEmbeddings(data: SkillReferenceEmbeddingRequest) {
    return apiRequest<SkillReferenceEmbeddingResult>("post", `${DATASET_BASE}/embeddings/vectorize`, {
      data,
    });
  },

  getRoadmapContext(datasetId: string, conceptId: string) {
    return apiRequest<SkillReferenceRoadmapContext>(
      "get",
      `${DATASET_BASE}/${encodeURIComponent(datasetId)}/competency-units/${encodeURIComponent(conceptId)}/roadmap-context`
    );
  },
};

export interface SkillCluster {
  clusterId: string;
  label: string | null;
  algorithm: string;
  itemCount: number;
  skillType: string | null;
  jobId: string | null;
  clusterLabel: number | null;
  representativeSkillIds: string[];
  centroidProjectionId: string | null;
  confidence: number | null;
  metadata: string | null;
  createdAt: string;
}

export interface SkillClusterMember {
  clusterId: string;
  skillId: string;
  embeddingId: string | null;
  projectionId: string;
  membershipScore: number;
  distanceToCentroid: number;
  representative: boolean;
}

export interface SkillClusterResponse {
  projectionId?: string;
  itemCount?: number;
  clusterCount?: number;
  reductionAlgorithm?: string;
  clusteringAlgorithm?: string;
  embeddingProvider?: string;
  embeddingModel?: string;
  embeddingDimension?: number;
  clusters?: SkillCluster[];
  points?: import("@/types/studio/skillgraph").SkillClusterPoint[];
  content?: import("@/types/studio/skillgraph").SkillClusterPoint[];
  items?: import("@/types/studio/skillgraph").SkillClusterPoint[];
  results?: import("@/types/studio/skillgraph").SkillClusterPoint[];
}

export interface SkillGraphProjectionSummary {
  projectionId: string;
  name?: string;
  status?: string;
  algorithm?: string;
  reductionAlgorithm?: string;
  embeddingProvider?: string;
  embeddingModel?: string;
  embeddingDimension?: number;
  itemCount?: number;
  clusterCount?: number;
  skillType?: string | null;
  jobId?: string | null;
  projectionType?: string | null;
  projectionDimension?: number | null;
  metadata?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SkillGraphProjectionListResponse {
  content?: SkillGraphProjectionSummary[];
  items?: SkillGraphProjectionSummary[];
  results?: SkillGraphProjectionSummary[];
  totalElements?: number;
  total?: number;
  offset?: number;
  limit?: number;
  returned?: number;
  hasMore?: boolean;
}

export type SkillDictionaryEmbeddingJobStatus = "READY" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";

export interface SkillDictionaryEmbeddingResult {
  totalMissingCount?: number;
  requestedCount?: number;
  processedCount?: number;
  skippedCount?: number;
  failedCount?: number;
  jobId?: string;
  status?: SkillDictionaryEmbeddingJobStatus;
  message?: string;
}

export interface SkillDictionaryEmbeddingJob {
  jobId: string;
  status: SkillDictionaryEmbeddingJobStatus;
  totalCount: number;
  requestedCount: number;
  processedCount: number;
  failedCount: number;
  skippedCount: number;
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string;
  message?: string;
}

export interface SkillGraphBatchJobEvent {
  jobId: string;
  jobType?: "CANDIDATE_EMBEDDING" | "DICTIONARY_EMBEDDING" | "CANDIDATE_RECOMMENDATION" | "PROJECTION_GENERATION";
  status: SkillGraphJobStatus;
  totalCount?: number;
  requestedCount?: number;
  processedCount?: number;
  resultCount?: number;
  failedCount?: number;
  skippedCount?: number;
  embeddingProvider?: string;
  embeddingModel?: string;
  embeddingDimension?: number;
  requestSnapshot?: string;
  message?: string;
  errorMessage?: string;
  updatedAt?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface SkillCandidateEmbeddingRequest {
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDim: number;
  limit?: number;
}

export interface SkillCandidateRecommendationJobRequest {
  targetScope: "ALL" | "SELECTED" | "CURRENT_FILTER";
  candidateIds?: string[];
  status?: string;
  keyword?: string;
  sourceType?: string;
  sourceId?: string;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimension: number;
  targetTypes: string[];
  topK: number;
  minScore: number;
  newSkillMinConfidence: number;
  existingSkillMinScore: number;
}

export interface SkillRecommendationApplyRequest {
  applyMode: "ELIGIBLE_ONLY";
  recommendationTypes: string[];
  minConfidence: number;
  minSimilarityScore: number;
}

export interface SkillRecommendationApplyResultsRequest {
  resultIds: string[];
  applyMode: "ELIGIBLE_ONLY";
  recommendationTypes: string[];
  minConfidence: number;
  minSimilarityScore: number;
}

export interface SkillClusterRepresentative {
  skillId: string;
  skillName: string;
  normalizedName: string;
  clusterId: string;
  x: number;
  y: number;
  centroidDistance: number;
  occurrenceCount?: number;
  confidenceScore?: number;
  categoryId?: string;
  status?: string;
  representativeScore: number;
}

export interface SkillCategoryDraft {
  draftId: string;
  clusterId: string;
  proposedName?: string;
  suggestedCategoryName?: string;
  confidence: number;
  noise: boolean;
  itemCount: number;
  representativeSkillIds: string[];
  representativeSkillNames: string[];
  representativeSkills: SkillClusterRepresentative[];
}

export interface SkillCategoryDraftResult {
  projectionId: string;
  draftCount: number;
  noiseCount: number;
  drafts: SkillCategoryDraft[];
}

export interface SkillCategoryExistingAssignmentCandidate {
  skillId: string;
  skillName: string;
  categoryId: string;
  categoryName: string;
  similarity: number;
}

export interface SkillCategoryReconcileResult {
  scannedCount: number;
  matchedExistingCount: number;
  newCategoryDraftCount: number;
  noiseCount: number;
  matchedExisting: SkillCategoryExistingAssignmentCandidate[];
  newCategoryDrafts: SkillCategoryDraft[];
  noiseSkillIds: string[];
}

export type SkillDatasetImportJobStatus =
  | "CREATED"
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface SkillDatasetImportJob {
  jobId: string;
  provider: string;
  datasetId: string;
  datasetName?: string;
  status: SkillDatasetImportJobStatus;
  sourceLocation: string;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface SkillDatasetImportRequest {
  provider: string;
  datasetId: string;
  datasetName?: string;
  version?: string;
  language?: string;
  sourceLocation: string;
}

export interface SkillReferenceConcept {
  conceptId: string;
  datasetId: string;
  provider: string;
  conceptType: string;
  externalCode?: string;
  parentCode?: string;
  preferredLabel: string;
  description?: string;
  levelValue?: string;
  categoryPath?: string;
  normalizedLabel?: string;
}

export interface SkillReferenceRelation {
  relationId: string;
  datasetId: string;
  provider: string;
  sourceConceptId: string;
  targetConceptId: string;
  relationType: string;
  confidence?: number;
}

export interface SkillReferenceRoadmapContext {
  competencyUnit: SkillReferenceConcept;
  competencyElements: SkillReferenceConcept[];
  performanceCriteria: SkillReferenceConcept[];
  knowledgeSkillsAttitudes: SkillReferenceConcept[];
  relations: SkillReferenceRelation[];
}

export interface SkillReferenceSearchRequest {
  datasetId?: string;
  conceptType?: string;
  query: string;
}

export interface SkillReferenceEmbeddingRequest {
  datasetId: string;
  provider?: string;
  conceptType?: string;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDim: number;
  textType: string;
  textBuildStrategy?: string;
  batchSize: number;
  overwrite: boolean;
  normalize: boolean;
}

export interface SkillReferenceEmbeddingResult {
  datasetId: string;
  conceptType?: string;
  embeddingProvider: string;
  embeddingModel: string;
  textType: string;
  totalCount: number;
  processedCount: number;
  embeddedCount: number;
  skippedCount: number;
  failedCount: number;
}

export interface SkillReferenceDataset {
  datasetId: string;
  provider: string;
  datasetName?: string;
  version?: string;
  language?: string;
  sourceLocation?: string;
  importedAt?: string;
}
