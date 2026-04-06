import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { ColDef } from "ag-grid-community";
import { GridContent } from "@/react/components/ag-grid";
import { reactAiApi } from "@/react/pages/ai/api";
import type { AiInfoResponse, ProviderInfo, VectorSearchResultDto } from "@/types/studio/ai";
import { resolveAxiosError } from "@/utils/helpers";

export function RagPage() {
  const [aiInfo, setAiInfo] = useState<AiInfoResponse | null>(null);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState("3");
  const [expandedQuery, setExpandedQuery] = useState("");
  const [expandedKeywords, setExpandedKeywords] = useState<string[]>([]);
  const [rows, setRows] = useState<VectorSearchResultDto[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  const columnDefs = useMemo<ColDef<VectorSearchResultDto>[]>(
    () => [
      { field: "id", headerName: "ID", flex: 0.5 },
      { field: "score", headerName: "유사도", flex: 0.3, sortable: true },
      { field: "content", headerName: "콘텐츠", flex: 1.3 },
    ],
    []
  );

  async function handleSearch(usingExpandedQuery = false) {
    setError(null);
    try {
      const data = await reactAiApi.searchVector({
        query: usingExpandedQuery ? expandedQuery : query,
        topK: Number(topK) || 3,
        hybrid: true,
      });
      setRows(data);
    } catch (searchError) {
      setError(resolveAxiosError(searchError));
    }
  }

  async function handleRewrite() {
    setError(null);
    try {
      const data = await reactAiApi.rewriteQuery({ query });
      setExpandedQuery(data.expandedQuery);
      setExpandedKeywords(data.keywords);
    } catch (rewriteError) {
      setError(resolveAxiosError(rewriteError));
    }
  }

  return (
    <Stack spacing={2}>
      <Breadcrumbs separator="›">
        <Typography color="text.secondary">서비스 관리</Typography>
        <Typography color="text.secondary">AI</Typography>
        <Typography color="text.primary">RAG</Typography>
      </Breadcrumbs>
      <Typography variant="h5">RAG Search</Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <TextField
          select
          label="Provider"
          value={provider}
          onChange={(event) => {
            const nextProvider = event.target.value;
            setProvider(nextProvider);
            const match = providers.find((item) => item.name === nextProvider);
            setModel(match?.chat.model ?? "");
          }}
          fullWidth
        >
          {providers.map((item) => (
            <MenuItem key={item.name} value={item.name}>
              {item.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField label="Model" value={model} onChange={(event) => setModel(event.target.value)} fullWidth />
        <TextField label="topK" value={topK} onChange={(event) => setTopK(event.target.value)} sx={{ maxWidth: 140 }} />
      </Stack>
      <TextField label="쿼리" value={query} onChange={(event) => setQuery(event.target.value)} />
      <Stack direction="row" spacing={1}>
        <Button variant="contained" onClick={() => void handleSearch(false)} disabled={!query.trim()}>
          검색
        </Button>
        <Button variant="outlined" onClick={() => void handleRewrite()} disabled={!query.trim()}>
          쿼리 확장
        </Button>
        <Button variant="text" onClick={() => void handleSearch(true)} disabled={!expandedQuery.trim()}>
          확장 쿼리로 검색
        </Button>
      </Stack>
      {expandedKeywords.length > 0 ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="subtitle2">확장 키워드</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {expandedKeywords.map((keyword) => (
                  <Chip key={keyword} label={keyword} />
                ))}
              </Stack>
              <TextField label="확장 쿼리" value={expandedQuery} InputProps={{ readOnly: true }} />
            </Stack>
          </CardContent>
        </Card>
      ) : null}
      <GridContent<VectorSearchResultDto> columns={columnDefs} rowData={rows} height={360} />
    </Stack>
  );
}
