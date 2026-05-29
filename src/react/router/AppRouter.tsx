import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/react/auth/ProtectedRoute";
import { BlankLayout } from "@/react/layouts/BlankLayout";
import { FullLayout } from "@/react/layouts/FullLayout";
import { PublicLayout } from "@/react/layouts/PublicLayout";
import { SKILLGRAPH_ROLES } from "@/react/pages/ai/skillgraph/permissions";
import { profileRoutes } from "@/react/features/profile/routes";
import { AdminRoutes } from "@/react/router/AdminRoutes";
import { Box, LinearProgress } from "@mui/material";

// Lazy-loaded pages
const ForumListPage = lazy(() => import("@/react/pages/community/ForumListPage").then(m => ({ default: m.ForumListPage })));
const ForumTopicDetailPage = lazy(() => import("@/react/pages/community/ForumTopicDetailPage").then(m => ({ default: m.ForumTopicDetailPage })));
const ForumTopicListPage = lazy(() => import("@/react/pages/community/ForumTopicListPage").then(m => ({ default: m.ForumTopicListPage })));
const DashboardPage = lazy(() => import("@/react/pages/DashboardPage").then(m => ({ default: m.DashboardPage })));
const ChatPage = lazy(() => import("@/react/pages/ai/ChatPage").then(m => ({ default: m.ChatPage })));
const RagChatPage = lazy(() => import("@/react/pages/ai/RagChatPage").then(m => ({ default: m.RagChatPage })));
const RagChunkingSimulatorPage = lazy(() => import("@/react/pages/ai/RagChunkingSimulatorPage").then(m => ({ default: m.RagChunkingSimulatorPage })));
const RagJobDetailPage = lazy(() => import("@/react/pages/ai/RagJobDetailPage").then(m => ({ default: m.RagJobDetailPage })));
const RagJobListPage = lazy(() => import("@/react/pages/ai/RagJobListPage").then(m => ({ default: m.RagJobListPage })));

// SkillGraphPages
const SkillGraphDashboardPage = lazy(() => import("@/react/pages/ai/skillgraph/SkillGraphPages").then(m => ({ default: m.SkillGraphDashboardPage })));
const SkillGraphJobsPage = lazy(() => import("@/react/pages/ai/skillgraph/SkillGraphPages").then(m => ({ default: m.SkillGraphJobsPage })));
const SkillGraphCandidatesPage = lazy(() => import("@/react/pages/ai/skillgraph/SkillGraphPages").then(m => ({ default: m.SkillGraphCandidatesPage })));
const SkillGraphDictionaryPage = lazy(() => import("@/react/pages/ai/skillgraph/SkillGraphPages").then(m => ({ default: m.SkillGraphDictionaryPage })));
const SkillGraphCategoriesPage = lazy(() => import("@/react/pages/ai/skillgraph/SkillGraphPages").then(m => ({ default: m.SkillGraphCategoriesPage })));
const SkillGraphCategoryManagementPage = lazy(() => import("@/react/pages/ai/skillgraph/SkillGraphPages").then(m => ({ default: m.SkillGraphCategoryManagementPage })));
const SkillGraphClustersPage = lazy(() => import("@/react/pages/ai/skillgraph/SkillGraphPages").then(m => ({ default: m.SkillGraphClustersPage })));
const SkillGraphViewerPage = lazy(() => import("@/react/pages/ai/skillgraph/SkillGraphPages").then(m => ({ default: m.SkillGraphViewerPage })));
const SkillGraphNcsMappingPage = lazy(() => import("@/react/pages/ai/skillgraph/SkillGraphPages").then(m => ({ default: m.SkillGraphNcsMappingPage })));
const SkillGraphCourseMappingPage = lazy(() => import("@/react/pages/ai/skillgraph/SkillGraphPages").then(m => ({ default: m.SkillGraphCourseMappingPage })));
const SkillGraphSimulationPage = lazy(() => import("@/react/pages/ai/skillgraph/SkillGraphPages").then(m => ({ default: m.SkillGraphSimulationPage })));

const SkillDatasetImportPage = lazy(() => import("@/react/pages/ai/skillgraph/SkillDatasetImportPage").then(m => ({ default: m.SkillDatasetImportPage })));
const SkillReferenceDatasetPage = lazy(() => import("@/react/pages/ai/skillgraph/SkillReferenceDatasetPage").then(m => ({ default: m.SkillReferenceDatasetPage })));
const VectorVisualizationPage = lazy(() => import("@/react/pages/ai/VectorVisualizationPage").then(m => ({ default: m.VectorVisualizationPage })));
const DocumentListPage = lazy(() => import("@/react/pages/documents/DocumentListPage").then(m => ({ default: m.DocumentListPage })));
const DocumentEditorPage = lazy(() => import("@/react/pages/documents/DocumentEditorPage").then(m => ({ default: m.DocumentEditorPage })));
const FilesPage = lazy(() => import("@/react/pages/files/FilesPage").then(m => ({ default: m.FilesPage })));
const LoginPage = lazy(() => import("@/react/pages/LoginPage").then(m => ({ default: m.LoginPage })));
const MailInboxPage = lazy(() => import("@/react/pages/mail/MailInboxPage").then(m => ({ default: m.MailInboxPage })));
const MailPage = lazy(() => import("@/react/pages/mail/MailPage").then(m => ({ default: m.MailPage })));
const MailSyncPage = lazy(() => import("@/react/pages/mail/MailSyncPage").then(m => ({ default: m.MailSyncPage })));
const NotFoundPage = lazy(() => import("@/react/pages/NotFoundPage").then(m => ({ default: m.NotFoundPage })));
const ObjectTypeDetailPage = lazy(() => import("@/react/pages/objecttype/ObjectTypeDetailPage").then(m => ({ default: m.ObjectTypeDetailPage })));
const ObjectTypeListPage = lazy(() => import("@/react/pages/objecttype/ObjectTypeListPage").then(m => ({ default: m.ObjectTypeListPage })));
const ObjectStorageListPage = lazy(() => import("@/react/pages/objectstorage/ObjectStorageListPage").then(m => ({ default: m.ObjectStorageListPage })));
const ObjectStoragePage = lazy(() => import("@/react/pages/objectstorage/ObjectStoragePage").then(m => ({ default: m.ObjectStoragePage })));
const TemplateDetailsPage = lazy(() => import("@/react/pages/templates/TemplateDetailsPage").then(m => ({ default: m.TemplateDetailsPage })));
const TemplatesPage = lazy(() => import("@/react/pages/templates/TemplatesPage").then(m => ({ default: m.TemplatesPage })));
const UnauthorizedPage = lazy(() => import("@/react/pages/UnauthorizedPage").then(m => ({ default: m.UnauthorizedPage })));
const WorkspaceDetailPage = lazy(() => import("@/react/pages/workspaces/WorkspaceDetailPage").then(m => ({ default: m.WorkspaceDetailPage })));
const WorkspaceListPage = lazy(() => import("@/react/pages/workspaces/WorkspaceListPage").then(m => ({ default: m.WorkspaceListPage })));

function PageLoader() {
  return (
    <Box sx={{ width: "100%", position: "fixed", top: 0, left: 0, zIndex: 9999 }}>
      <LinearProgress color="primary" />
    </Box>
  );
}

export function AppRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<BlankLayout />}>
          <Route path="/auth/login" element={<LoginPage />} />
        </Route>

        <Route element={<PublicLayout />}>
          <Route path="/forums" element={<ForumListPage />} />
          <Route path="/forums/:forumSlug" element={<ForumTopicListPage />} />
          <Route
            path="/forums/:forumSlug/topics/:topicId"
            element={<ForumTopicDetailPage />}
          />
        </Route>

        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<FullLayout />}>
            <Route index element={<DashboardPage />} />
            {profileRoutes}
            <Route path="application/files" element={<FilesPage />} />
            <Route path="application/workspaces" element={<WorkspaceListPage />} />
            <Route
              path="application/workspaces/:workspaceId"
              element={<WorkspaceDetailPage />}
            />
            <Route path="application/mail" element={<MailPage />}>
              <Route index element={<Navigate to="inbox" replace />} />
              <Route path="inbox" element={<MailInboxPage />} />
              <Route path="sync" element={<MailSyncPage />} />
            </Route>
            <Route path="application/documents" element={<DocumentListPage />} />
            <Route
              path="application/documents/:documentId"
              element={<DocumentEditorPage />}
            />
            <Route path="application/templates" element={<TemplatesPage />} />
            <Route
              path="application/templates/:templateId"
              element={<TemplateDetailsPage />}
            />
            <Route path="policy/object-types" element={<ObjectTypeListPage />} />
            <Route
              path="policy/object-types/:objectTypeId"
              element={<ObjectTypeDetailPage />}
            />
            <Route path="services/object-storage" element={<ObjectStorageListPage />} />
            <Route
              path="services/object-storage/:providerId"
              element={<ObjectStoragePage />}
            />
            <Route path="services/ai/chat" element={<ChatPage />} />
            <Route path="services/ai/rag-chat" element={<RagChatPage />} />
            <Route path="services/ai/rag" element={<RagJobListPage />} />
            <Route path="services/ai/rag/chunking-simulator" element={<RagChunkingSimulatorPage />} />
            <Route
              path="services/ai/vector-visualization"
              element={<VectorVisualizationPage />}
            />
            <Route
              path="services/ai/rag-visualization"
              element={<Navigate to="/services/ai/vector-visualization" replace />}
            />
            <Route path="services/ai/rag/jobs/:jobId" element={<RagJobDetailPage />} />
            <Route element={<ProtectedRoute roles={SKILLGRAPH_ROLES} />}>
              <Route
                path="services/ai/skillgraph"
                element={<Navigate to="/services/ai/skillgraph/dashboard" replace />}
              />
              <Route path="services/ai/skillgraph/dashboard" element={<SkillGraphDashboardPage />} />
              <Route path="services/ai/skillgraph/jobs" element={<SkillGraphJobsPage />} />
              <Route path="services/ai/skillgraph/candidates" element={<SkillGraphCandidatesPage />} />
              <Route path="services/ai/skillgraph/review" element={<Navigate to="/services/ai/skillgraph/candidates" replace />} />
              <Route path="services/ai/skillgraph/dictionary" element={<SkillGraphDictionaryPage />} />
              <Route path="services/ai/skillgraph/categories" element={<SkillGraphCategoriesPage />} />
              <Route path="services/ai/skillgraph/category-management" element={<SkillGraphCategoryManagementPage />} />
              <Route path="services/ai/skillgraph/clusters" element={<SkillGraphClustersPage />} />
              <Route path="services/ai/skillgraph/graph" element={<SkillGraphViewerPage />} />
              <Route path="services/ai/skillgraph/ncs-mapping" element={<SkillGraphNcsMappingPage />} />
              <Route path="services/ai/skillgraph/course-mapping" element={<SkillGraphCourseMappingPage />} />
              <Route path="services/ai/skillgraph/simulation" element={<SkillGraphSimulationPage />} />
              <Route path="services/ai/skillgraph/dataset-import" element={<SkillDatasetImportPage />} />
              <Route path="services/ai/skillgraph/reference-dataset" element={<SkillReferenceDatasetPage />} />
            </Route>
            {/* Admin and Security Pages */}
            <Route path="admin/*" element={<AdminRoutes />} />
          </Route>
        </Route>

        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </Suspense>
  );
}
