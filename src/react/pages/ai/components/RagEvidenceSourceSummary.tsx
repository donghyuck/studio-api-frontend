import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { DescriptionOutlined, LanguageOutlined, PublicOutlined, TuneOutlined } from "@mui/icons-material";
import type { ResolvedRagSourcePolicyDto } from "@/types/studio/ai";
import {
  deriveEvidenceSourceViewModel,
  type EvidenceSourceSelectionDto,
} from "../utils/evidenceSource";

type Props = {
  attachedDocumentName?: string | null;
  selectedWebSourcesCount: number;
  onOpenDrawer: () => void;
  disabled?: boolean;
  selection?: EvidenceSourceSelectionDto | null;
  sourcePolicy?: ResolvedRagSourcePolicyDto | null;
  packedOrigins?: string[];
  usedOrigins?: string[];
};

export function RagEvidenceSourceSummary({
  attachedDocumentName,
  selectedWebSourcesCount,
  onOpenDrawer,
  disabled = false,
  selection,
  sourcePolicy,
  packedOrigins,
  usedOrigins,
}: Props) {
  const vm = deriveEvidenceSourceViewModel({
    selection,
    sourcePolicy,
    attachedDocumentName,
    selectedWebSourcesCount,
    packedOrigins,
    usedOrigins,
  });

  return (
    <Box
      sx={{
        px: 2,
        py: 1,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
      >
        <Stack direction="column" spacing={0.75}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ rowGap: 0.75 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary", mr: 0.5 }}>
              참고자료
            </Typography>

            {vm.documentScopeSelected ? (
              <Chip
                size="small"
                icon={<DescriptionOutlined fontSize="small" />}
                label={attachedDocumentName ? `문서 1개 (${attachedDocumentName})` : "첨부 문서"}
                variant="outlined"
                color="primary"
                sx={{ fontWeight: 600 }}
              />
            ) : null}

            <Chip
              size="small"
              icon={<LanguageOutlined fontSize="small" />}
              label={`수집한 웹 ${vm.indexedWebSourceCount}개`}
              variant="outlined"
              color={vm.indexedWebSourceCount > 0 ? "secondary" : "default"}
              sx={{ fontWeight: 600 }}
            />

            {vm.officialExternalEnabled ? (
              <Chip
                size="small"
                icon={<PublicOutlined fontSize="small" />}
                label="공식 외부 자료"
                variant="outlined"
                color="info"
                sx={{ fontWeight: 600 }}
              />
            ) : null}
          </Stack>

          {vm.packedOriginsLabel || vm.usedOriginsLabel ? (
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
              {vm.packedOriginsLabel ? (
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {vm.packedOriginsLabel}
                </Typography>
              ) : null}
              {vm.usedOriginsLabel ? (
                <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700 }}>
                  {vm.usedOriginsLabel}
                </Typography>
              ) : null}
            </Stack>
          ) : null}
        </Stack>

        <Button
          size="small"
          variant="outlined"
          startIcon={<TuneOutlined fontSize="small" />}
          onClick={onOpenDrawer}
          disabled={disabled}
          sx={{ whiteSpace: "nowrap", borderRadius: 1.5, textTransform: "none", fontWeight: 600 }}
        >
          자료 관리
        </Button>
      </Stack>
    </Box>
  );
}
