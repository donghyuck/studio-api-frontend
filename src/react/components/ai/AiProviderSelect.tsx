import { useEffect, useState } from "react";
import { Alert, MenuItem, Stack, TextField } from "@mui/material";
import { reactAiApi } from "@/react/pages/ai/api";
import type { ProviderInfo } from "@/types/studio/ai";

interface Props {
  provider: string;
  model: string;
  onChange: (provider: string, model: string) => void;
  size?: "small" | "medium";
}

export function AiProviderSelect({ provider, model, onChange, size = "small" }: Props) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    reactAiApi
      .fetchProviders()
      .then((data) => {
        setProviders(data.providers);
        if (!provider && data.defaultProvider) {
          const match = data.providers.find((p) => p.name === data.defaultProvider);
          onChange(data.defaultProvider, match?.chat.model ?? "");
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleProviderChange(next: string) {
    const match = providers.find((p) => p.name === next);
    onChange(next, match?.chat.model ?? "");
  }

  if (error) {
    return <Alert severity="error" sx={{ py: 0 }}>프로바이더 목록을 불러오지 못했습니다.</Alert>;
  }

  return (
    <Stack direction="row" spacing={1}>
      <TextField
        select
        label="Provider"
        value={provider}
        onChange={(e) => handleProviderChange(e.target.value)}
        size={size}
        sx={{ minWidth: 140 }}
        disabled={loading}
      >
        {providers.map((p) => (
          <MenuItem key={p.name} value={p.name}>
            {p.name}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label="Model"
        value={model}
        onChange={(e) => onChange(provider, e.target.value)}
        size={size}
        sx={{ minWidth: 160 }}
        disabled={loading}
      />
    </Stack>
  );
}
