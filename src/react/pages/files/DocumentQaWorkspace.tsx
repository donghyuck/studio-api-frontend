import {
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  AddOutlined,
  ArrowUpwardOutlined,
  TuneOutlined,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ChatMessageList } from "../ai/components/ChatMessageList";
import type { ChatMessage } from "../ai/components/chatTypes";
import type { DocumentQuestionSuggestionsResponseDto } from "@/types/studio/ai";

type Props = {
  fileName: string;
  messages: ChatMessage[];
  sending: boolean;
  error: string | null;
  input: string;
  selectedWebSourcesCount: number;
  settingsLabel: string;
  settingsContent: ReactNode;
  questionSuggestions: DocumentQuestionSuggestionsResponseDto | null;
  questionSuggestionsLoading: boolean;
  questionSuggestionsError: string | null;
  onInputChange: (value: string) => void;
  onSelectSuggestedQuestion: (query: string) => void;
  onRetryQuestionSuggestions: () => void;
  onSubmit: () => void;
  onOpenSources: () => void;
  onCopy: (content: string) => void;
  onEditUser: (messageId: string | undefined, content: string) => void;
  onRegenerate: () => void;
  onRetryLastUser: () => void;
};

export function DocumentQaWorkspace({
  fileName,
  messages,
  sending,
  error,
  input,
  selectedWebSourcesCount,
  settingsLabel,
  settingsContent,
  questionSuggestions,
  questionSuggestionsLoading,
  questionSuggestionsError,
  onInputChange,
  onSelectSuggestedQuestion,
  onRetryQuestionSuggestions,
  onSubmit,
  onOpenSources,
  onCopy,
  onEditUser,
  onRegenerate,
  onRetryLastUser,
}: Props) {
  const [settingsAnchorEl, setSettingsAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        height: "calc(100vh - 120px)",
        minHeight: 0,
        overflow: "hidden",
        bgcolor: "background.default",
      }}
    >
      <ChatMessageList
        messages={messages}
        sending={sending}
        onCopy={onCopy}
        onEditUser={onEditUser}
        onRegenerate={onRegenerate}
        onRetryLastUser={onRetryLastUser}
        emptyTitle="이 문서에서 무엇을 찾을까요?"
        emptyDescription="요약부터 세부 근거까지, 문서에 기반해 답합니다."
        sendingLabel="문서에서 근거를 찾고 답변을 작성하는 중..."
        assistantMetadataDensity="compact"
        emptyActions={
          questionSuggestionsLoading ? (
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ pt: 1.25 }}>
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">
                문서에 맞는 질문을 준비하는 중...
              </Typography>
            </Stack>
          ) : questionSuggestionsError ? (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={onRetryQuestionSuggestions}>
                  추천 질문 다시 시도
                </Button>
              }
              sx={{ mt: 1.25, borderRadius: 1.5 }}
            >
              추천 질문을 불러오지 못했습니다: {questionSuggestionsError}
            </Alert>
          ) : questionSuggestions?.availability.status === "AVAILABLE" ? (
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" justifyContent="center" sx={{ pt: 1.25 }}>
              {questionSuggestions.suggestions.map((suggestion) => (
                <Chip
                  key={suggestion.id}
                  label={suggestion.query}
                  variant="outlined"
                  disabled={sending}
                  onClick={() => onSelectSuggestedQuestion(suggestion.query)}
                  sx={{
                    height: 34,
                    borderRadius: 1.5,
                    bgcolor: "background.paper",
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                />
              ))}
            </Stack>
          ) : questionSuggestions?.availability.status === "NOT_READY" ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", pt: 1.25 }}>
              문서 색인이 준비되면 추천 질문을 표시합니다.
            </Typography>
          ) : questionSuggestions?.availability.status === "NO_SIGNALS" ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", pt: 1.25 }}>
              추천할 질문을 찾지 못했습니다. 직접 질문해 주세요.
            </Typography>
          ) : null
        }
      />

      <Box
        sx={{
          px: { xs: 1.5, md: 5 },
          pt: 1,
          pb: 2,
          background: (theme) =>
            `linear-gradient(180deg, ${alpha(theme.palette.background.default, 0)} 0%, ${theme.palette.background.default} 22%)`,
        }}
      >
        {error ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={onRegenerate} disabled={sending}>
                다시 시도
              </Button>
            }
            sx={{ maxWidth: 920, mx: "auto", mb: 1, borderRadius: 1.5 }}
          >
            {error}
          </Alert>
        ) : null}

        <Paper
          elevation={0}
          sx={{
            maxWidth: 920,
            mx: "auto",
            p: 1.25,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            boxShadow: (theme) =>
              `0 10px 28px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.24 : 0.08)}`,
            transition: "border-color 120ms ease, box-shadow 120ms ease",
            "&:focus-within": {
              borderColor: "text.secondary",
              boxShadow: (theme) =>
                `0 10px 30px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.3 : 0.11)}`,
            },
          }}
        >
          <Box
            component="textarea"
            aria-label="문서 질문"
            value={input}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onInputChange(event.target.value)}
            onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSubmit();
              }
            }}
            disabled={sending}
            placeholder="문서에 대해 질문하세요"
            rows={2}
            sx={{
              width: "100%",
              minHeight: 54,
              maxHeight: 150,
              resize: "none",
              border: 0,
              outline: 0,
              px: 0.5,
              py: 0.25,
              bgcolor: "transparent",
              color: "text.primary",
              font: "inherit",
              fontSize: 14.5,
              lineHeight: 1.65,
              "&::placeholder": { color: "text.secondary", opacity: 1 },
            }}
          />

          <Stack direction="row" spacing={0.75} alignItems="center">
            <Tooltip title={`현재 문서(${fileName})는 기본 근거로 포함됩니다. 같은 Workspace의 추가 자료를 선택합니다.`}>
              <Button
                size="small"
                color="inherit"
                startIcon={<AddOutlined fontSize="small" />}
                onClick={onOpenSources}
                disabled={sending}
                sx={{
                  maxWidth: { xs: 150, sm: 240 },
                  minWidth: 0,
                  px: 1,
                  borderRadius: 1.5,
                  color: "text.secondary",
                  textTransform: "none",
                  "& .MuiButton-startIcon": { mr: 0.5 },
                }}
              >
                <Typography component="span" variant="caption" noWrap sx={{ fontWeight: 700 }}>
                  추가 자료{selectedWebSourcesCount > 0 ? ` ${selectedWebSourcesCount}` : ""}
                </Typography>
              </Button>
            </Tooltip>

            <Tooltip title="응답 설정">
              <Button
                size="small"
                color="inherit"
                startIcon={<TuneOutlined fontSize="small" />}
                onClick={(event) => setSettingsAnchorEl(event.currentTarget)}
                disabled={sending}
                sx={{
                  minWidth: 0,
                  maxWidth: { xs: 120, sm: 220 },
                  px: 1,
                  borderRadius: 1.5,
                  color: "text.secondary",
                  textTransform: "none",
                }}
              >
                <Typography component="span" variant="caption" noWrap sx={{ fontWeight: 700 }}>
                  {settingsLabel || "응답 설정"}
                </Typography>
              </Button>
            </Tooltip>

            <Box sx={{ flex: 1 }} />
            <Tooltip title="보내기 (Enter)">
              <span>
                <IconButton
                  aria-label="질문 보내기"
                  onClick={onSubmit}
                  disabled={sending || !input.trim()}
                  sx={{
                    width: 34,
                    height: 34,
                    bgcolor: "text.primary",
                    color: "background.paper",
                    "&:hover": { bgcolor: "text.secondary" },
                    "&.Mui-disabled": {
                      bgcolor: "action.disabledBackground",
                      color: "action.disabled",
                    },
                  }}
                >
                  <ArrowUpwardOutlined sx={{ fontSize: 18 }} />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Paper>
      </Box>

      <Popover
        open={Boolean(settingsAnchorEl)}
        anchorEl={settingsAnchorEl}
        onClose={() => setSettingsAnchorEl(null)}
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              width: 400,
              maxWidth: "calc(100vw - 32px)",
              p: 2,
              mb: 1,
              borderRadius: 2,
            },
          },
        }}
      >
        <Stack spacing={1.75}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              응답 설정
            </Typography>
            <Typography variant="caption" color="text.secondary">
              변경한 설정은 다음 질문부터 적용됩니다.
            </Typography>
          </Box>
          {settingsContent}
        </Stack>
      </Popover>
    </Box>
  );
}
