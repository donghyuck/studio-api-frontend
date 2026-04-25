import { alpha, Box, Button, Stack, Typography } from "@mui/material";
import { NotesOutlined } from "@mui/icons-material";

interface Props {
  collapsedMessageCount: number;
  summaryText?: string;
  onToggle: () => void;
}

export function SummaryCard({
  collapsedMessageCount,
  summaryText,
  onToggle,
}: Props) {
  return (
    <Box
      sx={{
        borderLeft: "3px solid",
        borderLeftColor: "primary.main",
        bgcolor: (theme) =>
          alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.12 : 0.06),
        borderRadius: 2,
        px: 1.25,
        py: 1,
      }}
    >
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "flex-start" }}>
        <NotesOutlined color="primary" sx={{ fontSize: 18, mt: 0.25 }} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontWeight: 600 }}>
            대화 요약
          </Typography>
          <Typography
            variant="body2"
            color="text.primary"
            sx={{ mt: 0.25, whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.6 }}
          >
            {summaryText || "긴 대화의 최근 흐름을 요약합니다."}
          </Typography>
        </Box>
        <Button size="small" variant="text" onClick={onToggle} sx={{ flexShrink: 0, minWidth: 0 }}>
          {collapsedMessageCount > 0 ? `펼치기 ${collapsedMessageCount}` : "접기"}
        </Button>
      </Stack>
    </Box>
  );
}
