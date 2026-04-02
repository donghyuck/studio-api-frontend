import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/react/auth/store";

type Props = {
  roles?: string[];
};

export function ProtectedRoute({ roles = [] }: Props) {
  const location = useLocation();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  if (!token) {
    const returnUrl = `${location.pathname}${location.search}${location.hash}`;
    return (
      <Navigate
        to={`/auth/login?returnUrl=${encodeURIComponent(returnUrl)}`}
        replace
      />
    );
  }

  if (roles.length > 0) {
    const userRoles = user?.roles ?? [];
    const allowed = roles.some((role) => userRoles.includes(role));
    if (!allowed) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <Outlet />;
}
