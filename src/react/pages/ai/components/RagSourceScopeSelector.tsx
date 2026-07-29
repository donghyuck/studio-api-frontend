import { useState } from "react";
import { Alert, Box, Button, Menu, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { CheckOutlined, ExpandMoreOutlined, PublicOutlined } from "@mui/icons-material";
import type {
  RagSourcePolicyCapabilitiesDto,
  RagSourceScope,
} from "@/types/studio/ai";

interface Props {
  capabilities: RagSourcePolicyCapabilitiesDto | null;
  value: RagSourceScope | null;
  onChange: (scope: RagSourceScope) => void;
  disabled?: boolean;
  hideHelperText?: boolean;
  variant?: "standard" | "compact-pill";
}

const labels: Record<RagSourceScope, string> = {
  DOCUMENT_ONLY: "첨부 문서만",
  DOCUMENT_AND_OFFICIAL_EXTERNAL: "공식 외부 자료도 참고",
};

const descriptions: Record<RagSourceScope, string> = {
  DOCUMENT_ONLY: "첨부 문서에서 확인된 근거만 검색합니다.",
  DOCUMENT_AND_OFFICIAL_EXTERNAL:
    "문서 근거와 검증된 공식 외부 자료를 분리하여 검색하고 비교합니다.",
};

export function RagSourceScopeSelector({
  capabilities,
  value,
  onChange,
  disabled,
  hideHelperText,
  variant = "standard",
}: Props) {
  const scopes = capabilities?.availableScopes ?? [];
  const selected =
    capabilities && !capabilities.clientSelectionEnabled
      ? capabilities.defaultScope
      : value ?? capabilities?.defaultScope ?? "";
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const unavailableReason =
    capabilities && !capabilities.externalProviderAvailable
      ? "서버에 공식 외부 자료 공급자가 설정되지 않아 첨부 문서만 사용할 수 있습니다."
      : null;

  if (variant === "compact-pill") {
    return (
      <>
        <Button
          size="small"
          disabled={disabled || !capabilities || !capabilities.clientSelectionEnabled}
          onClick={(event) => setAnchorEl(event.currentTarget)}
          startIcon={<PublicOutlined sx={{ fontSize: 15 }} />}
          endIcon={<ExpandMoreOutlined sx={{ fontSize: 16, color: "text.secondary" }} />}
          sx={{
            textTransform: "none",
            fontWeight: 500,
            fontSize: 12.5,
            color: "text.secondary",
            px: 1,
            py: 0.3,
            borderRadius: "16px",
          }}
        >
          {selected ? labels[selected as RagSourceScope] : "참고 자료"}
        </Button>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          slotProps={{ paper: { sx: { minWidth: 300, borderRadius: "12px" } } }}
        >
          <Box sx={{ px: 2, py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              참고 자료 범위
            </Typography>
          </Box>
          {scopes.map((scope) => {
            const isSelected = scope === selected;
            return (
              <MenuItem
                key={scope}
                selected={isSelected}
                onClick={() => {
                  onChange(scope);
                  setAnchorEl(null);
                }}
                sx={{ py: 1.2, px: 2 }}
              >
                <Stack spacing={0.25} sx={{ width: "100%" }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="body2" fontWeight={isSelected ? 700 : 500}>
                      {labels[scope]}
                    </Typography>
                    {isSelected ? <CheckOutlined fontSize="small" color="primary" /> : null}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                    {descriptions[scope]}
                  </Typography>
                </Stack>
              </MenuItem>
            );
          })}
          {unavailableReason ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", px: 2, py: 1 }}>
              {unavailableReason}
            </Typography>
          ) : null}
        </Menu>
      </>
    );
  }

  return (
    <Stack spacing={0.75}>
      <TextField
        select
        label="참고 자료 범위"
        size="small"
        value={selected}
        disabled={disabled || !capabilities || !capabilities.clientSelectionEnabled}
        onChange={(event) => onChange(event.target.value as RagSourceScope)}
        helperText={
          selected
            ? descriptions[selected as RagSourceScope]
            : "서버의 자료 범위 정책을 확인하고 있습니다."
        }
        fullWidth
      >
        {scopes.map((scope) => (
          <MenuItem key={scope} value={scope}>
            {labels[scope]}
          </MenuItem>
        ))}
      </TextField>
      {!hideHelperText && unavailableReason ? (
        <Alert severity="info" sx={{ py: 0 }}>
          {unavailableReason}
        </Alert>
      ) : !hideHelperText ? (
        <Typography variant="caption" color="text.secondary">
          참고 자료 범위는 검색 대상을 결정하며 답변의 해석 허용 범위와는 별개입니다.
        </Typography>
      ) : null}
    </Stack>
  );
}
