import { useEffect, useMemo, useState } from "react";
import { Alert, Autocomplete, TextField } from "@mui/material";
import { reactAiApi } from "@/react/pages/ai/api";
import type { ProviderInfo } from "@/types/studio/ai";

interface Props {
  provider: string;
  model: string;
  onChange: (provider: string, model: string) => void;
  size?: "small" | "medium";
}

interface ModelOption {
  provider: string;
  model: string;
}

export function AiProviderSelect({ provider, model, onChange, size = "small" }: Props) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    reactAiApi
      .fetchProviders()
      .then((data) => {
        const chatEnabledProviders = data.providers.filter((p) => p.chat?.enabled);
        setProviders(chatEnabledProviders);
        if (!provider && data.defaultProvider) {
          const match = chatEnabledProviders.find((p) => p.name === data.defaultProvider);
          if (match) {
            onChange(data.defaultProvider, match.chat.model ?? "");
          } else if (chatEnabledProviders.length > 0) {
            onChange(chatEnabledProviders[0].name, chatEnabledProviders[0].chat.model ?? "");
          }
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const options = useMemo<ModelOption[]>(() => {
    const list: ModelOption[] = [];
    providers.forEach((p) => {
      if (p.chat?.model) {
        list.push({ provider: p.name, model: p.chat.model });
      }
    });
    return list;
  }, [providers]);

  const value = useMemo<ModelOption | string>(() => {
    const match = options.find((o) => o.model === model && o.provider === provider);
    return match || model || "";
  }, [options, model, provider]);

  if (error) {
    return <Alert severity="error" sx={{ py: 0 }}>프로바이더 목록을 불러오지 못했습니다.</Alert>;
  }

  return (
    <Autocomplete<ModelOption | string, false, false, true>
      freeSolo
      loading={loading}
      options={options}
      groupBy={(option) => (typeof option === "string" ? "기타" : option.provider)}
      getOptionLabel={(option) => {
        if (typeof option === "string") return option;
        return option.model;
      }}
      value={value}
      onChange={(event, newValue) => {
        if (newValue === null) {
          onChange("", "");
        } else if (typeof newValue === "string") {
          const match = options.find((o) => o.model === newValue);
          if (match) {
            onChange(match.provider, match.model);
          } else {
            onChange(provider || (providers[0]?.name ?? ""), newValue);
          }
        } else if (typeof newValue === "object") {
          onChange(newValue.provider, newValue.model);
        }
      }}
      onInputChange={(event, newInputValue) => {
        const match = options.find((o) => o.model === newInputValue);
        if (match) {
          onChange(match.provider, match.model);
        } else {
          onChange(provider || (providers[0]?.name ?? ""), newInputValue);
        }
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="답변 생성 Chat 모델"
          placeholder="모델 선택 또는 입력"
          size={size}
        />
      )}
      sx={{ minWidth: 260 }}
    />
  );
}
