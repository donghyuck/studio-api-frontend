import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { DescriptionOutlined, LanguageOutlined, TuneOutlined } from "@mui/icons-material";

type Props = {
  attachedDocumentName?: string | null;
  selectedWebSourcesCount: number;
  onOpenDrawer: () => void;
  disabled?: boolean;
};

export function RagEvidenceSourceSummary({
  attachedDocumentName,
  selectedWebSourcesCount,
  onOpenDrawer,
  disabled = false,
}: Props) {
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
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ rowGap: 0.75 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary", mr: 0.5 }}>
            참고자료
          </Typography>

          {attachedDocumentName ? (
            <Chip
              size="small"
              icon={<DescriptionOutlined fontSize="small" />}
              label={`문서 1개 (${attachedDocumentName})`}
              variant="outlined"
              color="primary"
              sx={{ fontWeight: 600 }}
            />
          ) : null}

          <Chip
            size="small"
            icon={<LanguageOutlined fontSize="small" />}
            label={
              selectedWebSourcesCount > 0
                ? `수집한 웹 ${selectedWebSourcesCount}개`
                : "수집한 웹 0개"
            }
            variant="outlined"
            color={selectedWebSourcesCount > 0 ? "secondary" : "default"}
            sx={{ fontWeight: 600 }}
          />
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
