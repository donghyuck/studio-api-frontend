import { useEffect } from "react";
import { Box, CircularProgress } from "@mui/material";
import { useAuthStore } from "@/react/auth/store";

type Props = {
  children: React.ReactNode;
};

export function AuthBootstrapGate({ children }: Props) {
  const bootstrapState = useAuthStore((state) => state.bootstrapState);
  const initializeSession = useAuthStore((state) => state.initializeSession);

  useEffect(() => {
    void initializeSession();
  }, [initializeSession]);

  if (bootstrapState !== "ready") {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return <>{children}</>;
}
