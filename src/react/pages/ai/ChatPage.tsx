import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { reactAiApi } from "@/react/pages/ai/api";
import type { AiInfoResponse, ChatMessageDto, ProviderInfo } from "@/types/studio/ai";
import { resolveAxiosError } from "@/utils/helpers";

type ChatMessage = ChatMessageDto & { model?: string };

export function ChatPage() {
  const [aiInfo, setAiInfo] = useState<AiInfoResponse | null>(null);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const providers = useMemo<ProviderInfo[]>(() => aiInfo?.providers ?? [], [aiInfo]);

  useEffect(() => {
    reactAiApi
      .fetchProviders()
      .then((data) => {
        setAiInfo(data);
        setProvider(data.defaultProvider);
        const match = data.providers.find((item) => item.name === data.defaultProvider);
        setModel(match?.chat.model ?? "");
      })
      .catch((loadError) => setError(resolveAxiosError(loadError)));
  }, []);

  function handleProviderChange(nextProvider: string) {
    setProvider(nextProvider);
    const match = providers.find((item) => item.name === nextProvider);
    setModel(match?.chat.model ?? "");
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) {
      return;
    }
    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const nextMessages: ChatMessage[] = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError(null);
    try {
      const response = await reactAiApi.sendChat({
        provider: provider || undefined,
        model: model || undefined,
        messages: nextMessages,
        systemPrompt: systemPrompt.trim() || undefined,
      });
      const assistant = [...response.messages].reverse().find((item) => item.role === "assistant");
      if (assistant) {
        setMessages((current) => [...current, { ...assistant, model: response.model ?? model }]);
      }
    } catch (sendError) {
      const message = resolveAxiosError(sendError);
      setError(message);
      setMessages((current) => [...current, { role: "assistant", content: `오류: ${message}`, model }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <Stack spacing={2}>
      <Breadcrumbs separator="›">
        <Typography color="text.secondary">서비스 관리</Typography>
        <Typography color="text.secondary">AI</Typography>
        <Typography color="text.primary">Chat</Typography>
      </Breadcrumbs>
      <Typography variant="h5">AI Chat</Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <TextField
          select
          label="Provider"
          value={provider}
          onChange={(event) => handleProviderChange(event.target.value)}
          fullWidth
        >
          {providers.map((item) => (
            <MenuItem key={item.name} value={item.name}>
              {item.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField label="Model" value={model} onChange={(event) => setModel(event.target.value)} fullWidth />
      </Stack>
      <TextField
        label="System Prompt"
        value={systemPrompt}
        onChange={(event) => setSystemPrompt(event.target.value)}
        multiline
        minRows={2}
      />
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1.5}>
            {messages.length === 0 ? (
              <Typography color="text.secondary">대화를 시작하세요.</Typography>
            ) : (
              messages.map((message, index) => (
                <Box
                  key={`${message.role}-${index}`}
                  sx={{
                    alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "80%",
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: message.role === "user" ? "primary.light" : "grey.100",
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {message.role}
                    {message.model ? ` · ${message.model}` : ""}
                  </Typography>
                  <Typography>{message.content}</Typography>
                </Box>
              ))
            )}
          </Stack>
        </CardContent>
      </Card>
      <TextField
        label="Text"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        multiline
        minRows={3}
      />
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="contained" onClick={() => void handleSend()} disabled={sending || !input.trim()}>
          전송
        </Button>
      </Box>
    </Stack>
  );
}
