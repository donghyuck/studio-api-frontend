import { useState } from "react";
import { Box, Button, Menu, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { CheckOutlined, ExpandMoreOutlined } from "@mui/icons-material";
import type {
  RagAnswerPresentationCapabilitiesDto,
  RagAnswerPresentationPreference,
} from "@/types/studio/ai";

interface Props {
  capabilities: RagAnswerPresentationCapabilitiesDto | null;
  value: RagAnswerPresentationPreference | null;
  onChange: (preference: RagAnswerPresentationPreference) => void;
  disabled?: boolean;
  hideHelperText?: boolean;
  variant?: "standard" | "compact-pill";
}

const labels: Record<RagAnswerPresentationPreference, string> = {
  AUTO: "자동 구성",
  TEXT_FOCUSED: "텍스트 중심",
  VISUAL_PREFERRED: "시각 자료 우선",
};

const descriptions: Record<RagAnswerPresentationPreference, string> = {
  AUTO: "질문과 근거에 맞춰 문단, 목록 또는 표를 선택합니다.",
  TEXT_FOCUSED: "간결한 문단과 목록을 우선합니다.",
  VISUAL_PREFERRED: "근거가 충분하면 표처럼 비교하기 쉬운 구성을 우선합니다.",
};

export function RagAnswerPresentationSelector({
  capabilities,
  value,
  onChange,
  disabled,
  hideHelperText,
  variant = "standard",
}: Props) {
  const preferences = capabilities?.availablePreferences ?? [];
  const selected = capabilities && !capabilities.clientSelectionEnabled
    ? capabilities.defaultPreference
    : value ?? capabilities?.defaultPreference ?? "";
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  if (variant === "compact-pill") {
    return (
      <>
        <Button
          size="small"
          disabled={disabled || !capabilities?.enabled || !capabilities.clientSelectionEnabled}
          onClick={(event) => setAnchorEl(event.currentTarget)}
          endIcon={<ExpandMoreOutlined sx={{ fontSize: 16, color: "text.secondary" }} />}
          sx={{
            textTransform: "none",
            fontWeight: 500,
            fontSize: 12.5,
            color: "text.secondary",
            px: 1,
            py: 0.3,
            borderRadius: "16px",
            "&:hover": { bgcolor: "action.hover", color: "text.primary" },
          }}
        >
          {selected ? labels[selected as RagAnswerPresentationPreference] : "답변 구성"}
        </Button>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          <Box sx={{ px: 2, py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              답변 구성 방식
            </Typography>
          </Box>
          {preferences.map((preference) => {
            const isSelected = preference === selected;
            return (
              <MenuItem
                key={preference}
                selected={isSelected}
                onClick={() => {
                  onChange(preference);
                  setAnchorEl(null);
                }}
                sx={{ py: 1.2, px: 2, minWidth: 300 }}
              >
                <Stack spacing={0.25} sx={{ width: "100%" }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" fontWeight={isSelected ? 700 : 500}>
                      {labels[preference]}
                    </Typography>
                    {isSelected ? <CheckOutlined fontSize="small" color="primary" /> : null}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {descriptions[preference]}
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
    <Stack spacing={0.5}>
      <TextField
        select
        label="답변 구성 방식"
        size="small"
        value={selected}
        disabled={disabled || !capabilities?.enabled || !capabilities.clientSelectionEnabled}
        onChange={(event) => onChange(event.target.value as RagAnswerPresentationPreference)}
        helperText={selected ? descriptions[selected as RagAnswerPresentationPreference] : "서버 기능을 확인하고 있습니다."}
        fullWidth
      >
        {preferences.map((preference) => (
          <MenuItem key={preference} value={preference}>{labels[preference]}</MenuItem>
        ))}
      </TextField>
      {!hideHelperText ? (
        <Typography variant="caption" color="text.secondary">
          질문에서 “표로 정리해줘”처럼 형식을 명시하면 그 요청을 우선합니다. 검색 범위와 근거 규칙은 바뀌지 않습니다.
        </Typography>
      ) : null}
    </Stack>
  );
}
