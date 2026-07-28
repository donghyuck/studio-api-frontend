import { Alert, MenuItem, Stack, TextField, Typography } from "@mui/material";
import type {
  RagAnswerMode,
  RagAnswerPolicyCapabilitiesDto,
} from "@/types/studio/ai";

interface Props {
  capabilities: RagAnswerPolicyCapabilitiesDto | null;
  value: RagAnswerMode | null;
  onChange: (mode: RagAnswerMode) => void;
  disabled?: boolean;
  hideHelperText?: boolean;
}

const modeDescription: Record<RagAnswerMode, string> = {
  STRICT_GROUNDED: "문서에 직접 명시된 내용만 답변합니다.",
  GROUNDED_INFERENCE: "문서 근거와 합리적 해석까지 포함하여 답변합니다.",
};

export function RagAnswerModeSelector({
  capabilities,
  value,
  onChange,
  disabled,
  hideHelperText,
}: Props) {
  const modes = capabilities?.availableModes ?? [];
  const selected =
    capabilities && !capabilities.clientSelectionEnabled
      ? capabilities.defaultMode
      : value ?? capabilities?.defaultMode ?? "";

  return (
    <Stack spacing={0.75}>
      <TextField
        select
        label="RAG 답변 범위"
        size="small"
        value={selected}
        disabled={disabled || !capabilities || !capabilities.clientSelectionEnabled}
        onChange={(event) => onChange(event.target.value as RagAnswerMode)}
        helperText={
          selected
            ? modeDescription[selected as RagAnswerMode]
            : "서버의 답변 정책을 확인하고 있습니다."
        }
        FormHelperTextProps={{
          sx: {
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            overflow: "hidden",
            mx: 0,
            mt: 0.5,
          },
        }}
        fullWidth
      >
        {modes.map((mode) => (
          <MenuItem key={mode} value={mode}>
            {mode === "STRICT_GROUNDED" ? "문서 직접 근거만" : "문서 기반 해석 허용"}
          </MenuItem>
        ))}
      </TextField>
      {!hideHelperText && capabilities && !capabilities.clientSelectionEnabled ? (
        <Alert severity="info" sx={{ py: 0, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
          서버 정책에 따라 {capabilities.defaultMode === "STRICT_GROUNDED" ? "문서 직접 근거만" : "문서 기반 해석 허용"} 모드가 적용됩니다.
        </Alert>
      ) : !hideHelperText ? (
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
          답변 모드는 검색 결과나 색인을 변경하지 않습니다. 범위를 바꾸면 새 대화가 시작됩니다.
        </Typography>
      ) : null}
    </Stack>
  );
}
