import { Box, Button, Stack, Typography } from "@mui/material";

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
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        borderRadius: 2,
        px: 1.5,
        py: 1.25,
      }}
    >
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between">
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            대화 요약
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>
            {summaryText || "긴 대화의 최근 흐름을 요약합니다."}
          </Typography>
        </Box>
        <Button size="small" variant="text" onClick={onToggle}>
          {collapsedMessageCount > 0
            ? `이전 메시지 ${collapsedMessageCount}개 펼치기`
            : "이전 메시지 접기"}
        </Button>
      </Stack>
    </Box>
  );
}
