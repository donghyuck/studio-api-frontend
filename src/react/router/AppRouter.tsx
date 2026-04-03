import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/react/auth/ProtectedRoute";
import { BlankLayout } from "@/react/layouts/BlankLayout";
import { FullLayout } from "@/react/layouts/FullLayout";
import { DashboardPage } from "@/react/pages/DashboardPage";
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

      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<FullLayout />}>
          <Route index element={<DashboardPage />} />
          {/* Admin and Security Pages */}
          <Route path="admin/*" element={<AdminRoutes />} />
        </Route>
      </Route>

      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
