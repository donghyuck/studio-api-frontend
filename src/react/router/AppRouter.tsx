import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/react/auth/ProtectedRoute";
import { BlankLayout } from "@/react/layouts/BlankLayout";
import { FullLayout } from "@/react/layouts/FullLayout";
import { PublicLayout } from "@/react/layouts/PublicLayout";
import { ForumListPage } from "@/react/pages/community/ForumListPage";
import { ForumTopicDetailPage } from "@/react/pages/community/ForumTopicDetailPage";
import { ForumTopicListPage } from "@/react/pages/community/ForumTopicListPage";
import { DashboardPage } from "@/react/pages/DashboardPage";
import { ChatPage } from "@/react/pages/ai/ChatPage";
import { RagChatPage } from "@/react/pages/ai/RagChatPage";
import { RagJobDetailPage } from "@/react/pages/ai/RagJobDetailPage";
import { RagJobListPage } from "@/react/pages/ai/RagJobListPage";
import { DocumentListPage } from "@/react/pages/documents/DocumentListPage";
import { DocumentEditorPage } from "@/react/pages/documents/DocumentEditorPage";
import { FilesPage } from "@/react/pages/files/FilesPage";
import { LoginPage } from "@/react/pages/LoginPage";
import { MailInboxPage } from "@/react/pages/mail/MailInboxPage";
import { MailPage } from "@/react/pages/mail/MailPage";
import { MailSyncPage } from "@/react/pages/mail/MailSyncPage";
import { NotFoundPage } from "@/react/pages/NotFoundPage";
import { ObjectTypeDetailPage } from "@/react/pages/objecttype/ObjectTypeDetailPage";
import { ObjectTypeListPage } from "@/react/pages/objecttype/ObjectTypeListPage";
import { ObjectStorageListPage } from "@/react/pages/objectstorage/ObjectStorageListPage";
import { ObjectStoragePage } from "@/react/pages/objectstorage/ObjectStoragePage";
import { profileRoutes } from "@/react/features/profile/routes";
import { TemplateDetailsPage } from "@/react/pages/templates/TemplateDetailsPage";
import { TemplatesPage } from "@/react/pages/templates/TemplatesPage";
import { UnauthorizedPage } from "@/react/pages/UnauthorizedPage";
import { AdminRoutes } from "@/react/router/AdminRoutes";

export function AppRouter() {
  return (
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
          <Route path="services/ai/rag/jobs/:jobId" element={<RagJobDetailPage />} />
          {/* Admin and Security Pages */}
          <Route path="admin/*" element={<AdminRoutes />} />
        </Route>
      </Route>

      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
