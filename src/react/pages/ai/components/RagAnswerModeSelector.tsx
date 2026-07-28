import { useState } from "react";
import { Alert, Box, Button, Menu, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { CheckOutlined, ExpandMoreOutlined } from "@mui/icons-material";
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
  variant?: "standard" | "compact-pill";
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
  variant = "standard",
}: Props) {
  const modes = capabilities?.availableModes ?? [];
  const selected =
    capabilities && !capabilities.clientSelectionEnabled
      ? capabilities.defaultMode
      : value ?? capabilities?.defaultMode ?? "";
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  if (variant === "compact-pill") {
    const selectedLabel = selected === "STRICT_GROUNDED" ? "문서 직접 근거만" : "문서 기반 해석 허용";

    return (
      <>
        <Button
          size="small"
          disabled={disabled || !capabilities || !capabilities.clientSelectionEnabled}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          endIcon={<ExpandMoreOutlined sx={{ fontSize: 16, color: "text.secondary" }} />}
          sx={{
            textTransform: "none",
            fontWeight: 500,
            fontSize: 12.5,
            color: "text.secondary",
            px: 1,
            py: 0.3,
            borderRadius: "16px",
            bgcolor: "transparent",
            "&:hover": {
              bgcolor: (theme) => (theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)"),
              color: "text.primary",
            },
          }}
        >
          {selectedLabel}
        </Button>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          slotProps={{
            paper: {
              sx: {
                minWidth: 260,
                borderRadius: "12px",
                boxShadow: (theme) => (theme.palette.mode === "dark" ? "0 8px 24px rgba(0,0,0,0.6)" : "0 8px 24px rgba(0,0,0,0.12)"),
              },
            },
          }}
        >
          <Box sx={{ px: 2, py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              RAG 답변 범위 선택
            </Typography>
          </Box>
          {modes.map((mode) => {
            const isSelected = mode === selected;
            return (
              <MenuItem
                key={mode}
                selected={isSelected}
                onClick={() => {
                  onChange(mode as RagAnswerMode);
                  setAnchorEl(null);
                }}
                sx={{ py: 1.2, px: 2 }}
              >
                <Stack spacing={0.25} sx={{ width: "100%" }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="body2" sx={{ fontWeight: isSelected ? 700 : 500 }}>
                      {mode === "STRICT_GROUNDED" ? "문서 직접 근거만" : "문서 기반 해석 허용"}
                    </Typography>
                    {isSelected && <CheckOutlined fontSize="small" color="primary" />}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                    {modeDescription[mode as RagAnswerMode]}
                  </Typography>
                </Stack>
              </MenuItem>
            );
          })}
        </Menu>
      </>
    );
  }

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
          답변 모드는 검색 결과나 색인을 변경하지 않으며, 변경 이후 질문부터 적용됩니다.
        </Typography>
      ) : null}
    </Stack>
  );
}
