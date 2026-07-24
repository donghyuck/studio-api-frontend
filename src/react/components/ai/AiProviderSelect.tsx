import { useEffect, useMemo, useState } from "react";
import { Alert, Autocomplete, TextField } from "@mui/material";
import { reactAiApi } from "@/react/pages/ai/api";
import type { ProviderInfo } from "@/types/studio/ai";

interface Props {
  provider: string;
  model: string;
  deploymentId?: string;
  onChange: (provider: string, model: string, deploymentId?: string) => void;
  size?: "small" | "medium";
}

export interface ModelOption {
  provider: string;
  model: string;
  deploymentId?: string;
}

const DEPLOYMENT_MODEL_MAP: Record<string, { model: string; provider: string }> = {
  "chat-default": { model: "gemini-2.5-flash", provider: "google-ai" },
  "chat-pro": { model: "gemini-2.5-pro", provider: "google-ai" },
  "local-gemma-v1": { model: "gemma-3-4b", provider: "local-gemma" },
};

const DEFAULT_FALLBACK_OPTIONS: ModelOption[] = [
  { deploymentId: "chat-default", model: "gemini-2.5-flash", provider: "google-ai" },
  { deploymentId: "chat-pro", model: "gemini-2.5-pro", provider: "google-ai" },
  { deploymentId: "local-gemma-v1", model: "gemma-3-4b", provider: "local-gemma" },
];

export function AiProviderSelect({ provider, model, deploymentId, onChange, size = "small" }: Props) {
  const [deployOptions, setDeployOptions] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadChatModels() {
      try {
        const deployments = await reactAiApi.fetchDeployments({ workload: "CHAT" });
        if (active && Array.isArray(deployments) && deployments.length > 0) {
          const list: ModelOption[] = deployments.map((d: any) => {
            const depId = d.deploymentId || d.id || d.name || "";
            const known = DEPLOYMENT_MODEL_MAP[depId];
            const modelName = d.model || d.apiModel || d.modelId || d.targetModel || known?.model || "";
            const providerName = d.provider || d.providerName || d.providerId || known?.provider || "google-ai";
            return {
              deploymentId: depId,
              model: modelName,
              provider: providerName,
            };
          });
          setDeployOptions(list);
          if ((!deploymentId && !model) || (!deploymentId && list.length > 0)) {
            const defaultItem = list.find((item) => item.deploymentId === "chat-default") || list[0];
            if (defaultItem) {
              onChange(defaultItem.provider, defaultItem.model, defaultItem.deploymentId);
            }
          }
          setLoading(false);
          return;
        }
      } catch {
        // Fallback to providers API if deployments API fails
      }

      try {
        const data = await reactAiApi.fetchProviders();
        if (!active) return;
        const list: ModelOption[] = [];
        (data.providers ?? []).forEach((p) => {
          if (p.chat?.model) {
            list.push({ provider: p.name, model: p.chat.model, deploymentId: "chat-default" });
          }
        });
        if (list.length > 0) {
          setDeployOptions(list);
          if (!model && !deploymentId) {
            onChange(list[0].provider, list[0].model, list[0].deploymentId);
          }
        } else {
          setDeployOptions(DEFAULT_FALLBACK_OPTIONS);
          if (!model && !deploymentId) {
            onChange("google-ai", "gemini-2.5-flash", "chat-default");
          }
        }
      } catch {
        if (active) {
          setDeployOptions(DEFAULT_FALLBACK_OPTIONS);
          if (!model && !deploymentId) {
            onChange("google-ai", "gemini-2.5-flash", "chat-default");
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadChatModels();
    return () => {
      active = false;
    };
  }, []);

  const options = useMemo<ModelOption[]>(() => {
    return deployOptions.length > 0 ? deployOptions : DEFAULT_FALLBACK_OPTIONS;
  }, [deployOptions]);

  const value = useMemo<ModelOption | string>(() => {
    if (deploymentId) {
      const match = options.find((o) => o.deploymentId === deploymentId);
      if (match) return match;
    }
    const matchModel = options.find((o) => o.model === model && o.provider === provider);
    if (matchModel) return matchModel;
    if (deploymentId) {
      const known = DEPLOYMENT_MODEL_MAP[deploymentId];
      return {
        provider: provider || known?.provider || "google-ai",
        model: model && model !== "undefined" ? model : known?.model || deploymentId,
        deploymentId,
      };
    }
    return model ? { provider: provider || "google-ai", model } : "";
  }, [options, model, provider, deploymentId]);

  return (
    <Autocomplete<ModelOption | string, false, false, true>
      freeSolo
      loading={loading}
      options={options}
      groupBy={(option) => (typeof option === "string" ? "기타" : option.provider)}
      getOptionLabel={(option) => {
        if (typeof option === "string") return option;
        if (option.deploymentId && option.model && option.model !== "undefined") {
          return `${option.deploymentId} (${option.model})`;
        }
        return option.deploymentId || option.model || "";
      }}
      value={value}
      onChange={(event, newValue) => {
        if (newValue === null) {
          onChange("", "", "");
        } else if (typeof newValue === "string") {
          const match = options.find((o) => o.deploymentId === newValue || o.model === newValue);
          if (match) {
            onChange(match.provider, match.model, match.deploymentId);
          } else {
            onChange(provider || "google-ai", newValue, newValue);
          }
        } else if (typeof newValue === "object") {
          onChange(newValue.provider, newValue.model, newValue.deploymentId);
        }
      }}
      onInputChange={(event, newInputValue) => {
        const match = options.find((o) => o.deploymentId === newInputValue || o.model === newInputValue);
        if (match) {
          onChange(match.provider, match.model, match.deploymentId);
        }
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="답변 생성 Chat Deployment"
          placeholder="Deployment 선택 (예: chat-default)"
          size={size}
        />
      )}
      sx={{ minWidth: 280 }}
    />
  );
}
