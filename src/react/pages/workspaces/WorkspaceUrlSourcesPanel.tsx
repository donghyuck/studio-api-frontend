import { useEffect, useState } from "react";
import { Alert, CircularProgress, Stack } from "@mui/material";
import { reactAiApi } from "@/react/pages/ai/api";
import { RagEvidenceSourcePicker } from "@/react/pages/ai/components/RagEvidenceSourcePicker";
import type {
  IndexedWebCapabilitiesDto,
  IndexedWebSourceRefDto,
} from "@/types/studio/ai";
import { resolveAxiosError } from "@/utils/helpers";

interface WorkspaceUrlSourcesPanelProps {
  workspaceId: number;
  disabled?: boolean;
}

export function WorkspaceUrlSourcesPanel({
  workspaceId,
  disabled = false,
}: WorkspaceUrlSourcesPanelProps) {
  const [capabilities, setCapabilities] = useState<IndexedWebCapabilitiesDto | null>(null);
  const [embeddingDeploymentId, setEmbeddingDeploymentId] = useState<string | null>(null);
  const [selectedSources, setSelectedSources] = useState<IndexedWebSourceRefDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      reactAiApi.fetchRagCapabilities(),
      reactAiApi.getEmbeddingOptions(),
    ])
      .then(([ragCapabilities, embeddingOptions]) => {
        if (!active) return;
        const options = embeddingOptions.options ?? [];
        const defaultOption = options.find((option) => option.defaultProfile)
          ?? options.find((option) => option.defaultProvider)
          ?? options[0];
        setCapabilities(ragCapabilities.indexedWeb);
        setEmbeddingDeploymentId(defaultOption?.deploymentId ?? null);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(resolveAxiosError(loadError) || "외부 URL 관리 기능을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <CircularProgress size={22} />;
  }
  if (error) {
    return <Alert severity="warning">{error}</Alert>;
  }
  if (capabilities?.enabled !== true) {
    return <Alert severity="info">현재 서버에서 외부 URL 자료 기능이 비활성화되어 있습니다.</Alert>;
  }
  if (!embeddingDeploymentId) {
    return <Alert severity="warning">사용 가능한 기본 embedding deployment가 없습니다.</Alert>;
  }

  return (
    <Stack spacing={1.5}>
      {disabled ? <Alert severity="info">보관된 Workspace에는 새 URL을 등록할 수 없습니다.</Alert> : null}
      <RagEvidenceSourcePicker
        workspaceId={workspaceId}
        embeddingDeploymentId={embeddingDeploymentId}
        capabilities={capabilities}
        value={selectedSources}
        maxSelectedSources={capabilities.maxSelectedSources}
        disabled={disabled}
        managementOnly
        listAllDeployments
        onChange={setSelectedSources}
      />
    </Stack>
  );
}
