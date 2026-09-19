import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Alert, Button, CircularProgress, Stack } from "@mui/material";
import { apiRequest } from "@/react/query/fetcher";
import { type ServerFeatures, supportsRoute } from "./serverFeatures";

const FeaturesContext = createContext<ServerFeatures>({});
export const useServerFeatures = () => useContext(FeaturesContext);

export function ServerFeaturesProvider({ children }: { children: ReactNode }) {
  const [features, setFeatures] = useState<ServerFeatures | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    apiRequest<{ contractVersion: string; features: ServerFeatures }>("get", "/api/platform/capabilities")
      .then((response) => {
        if (response.contractVersion !== "1" || !response.features ||
            Object.values(response.features).some((value) => typeof value !== "boolean")) {
          throw new Error("Unsupported server capabilities");
        }
        if (active) setFeatures(response.features);
      })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [attempt]);
  if (error) return <Alert severity="warning" action={<Button onClick={() => setAttempt(attempt + 1)}>다시 시도</Button>}>
    서버에서 사용 가능한 기능을 확인하지 못했습니다. 서버 연결과 버전을 확인해 주세요.
  </Alert>;
  if (!features) return <Stack alignItems="center" sx={{ p: 4 }}><CircularProgress aria-label="서버 기능 확인 중" /></Stack>;
  return <FeaturesContext.Provider value={features}>{children}</FeaturesContext.Provider>;
}

export function ServerFeatureGate({ path, children }: { path: string; children: ReactNode }) {
  const features = useServerFeatures();
  return supportsRoute(path, features) ? children : <Alert severity="info">이 서버에서는 해당 기능을 제공하지 않습니다.</Alert>;
}
