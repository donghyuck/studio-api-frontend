import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/react/auth/ProtectedRoute";
import { BlankLayout } from "@/react/layouts/BlankLayout";
import { FullLayout } from "@/react/layouts/FullLayout";
import { PublicLayout } from "@/react/layouts/PublicLayout";
import { ForumListPage } from "@/react/pages/community/ForumListPage";
import { ForumTopicDetailPage } from "@/react/pages/community/ForumTopicDetailPage";
import { ForumTopicListPage } from "@/react/pages/community/ForumTopicListPage";
import { DashboardPage } from "@/react/pages/DashboardPage";
import { DocumentEditorPage } from "@/react/pages/documents/DocumentEditorPage";
import { FilesPage } from "@/react/pages/files/FilesPage";
import { LoginPage } from "@/react/pages/LoginPage";
import { NotFoundPage } from "@/react/pages/NotFoundPage";
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
          <Route path="application/files" element={<FilesPage />} />
          <Route
            path="application/documents/:documentId"
            element={<DocumentEditorPage />}
          />
          {/* Admin and Security Pages */}
          <Route path="admin/*" element={<AdminRoutes />} />
        </Route>
      </Route>

      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
