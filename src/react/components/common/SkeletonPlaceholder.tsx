import { Box, Card, Grid, Skeleton, Stack } from "@mui/material";

interface Props {
  variant?: "table" | "detail";
  rows?: number;
}

export function SkeletonPlaceholder({ variant = "detail", rows = 5 }: Props) {
  if (variant === "table") {
    return (
      <Stack spacing={2} sx={{ width: "100%", py: 2 }}>
        {/* Table Header Skeleton */}
        <Box sx={{ display: "flex", gap: 2, pb: 1, borderBottom: "1px solid", borderColor: "divider" }}>
          <Skeleton variant="text" width="10%" height={24} />
          <Skeleton variant="text" width="40%" height={24} />
          <Skeleton variant="text" width="20%" height={24} />
          <Skeleton variant="text" width="15%" height={24} />
          <Skeleton variant="text" width="15%" height={24} />
        </Box>
        {/* Table Rows Skeletons */}
        {Array.from({ length: rows }).map((_, index) => (
          <Box key={index} sx={{ display: "flex", gap: 2, alignItems: "center", py: 0.5 }}>
            <Skeleton variant="rectangular" width="10%" height={20} sx={{ borderRadius: "4px" }} />
            <Skeleton variant="rectangular" width="40%" height={20} sx={{ borderRadius: "4px" }} />
            <Skeleton variant="rectangular" width="20%" height={20} sx={{ borderRadius: "4px" }} />
            <Skeleton variant="rectangular" width="15%" height={20} sx={{ borderRadius: "4px" }} />
            <Skeleton variant="rectangular" width="15%" height={20} sx={{ borderRadius: "4px" }} />
          </Box>
        ))}
      </Stack>
    );
  }

  // default variant === "detail"
  return (
    <Box sx={{ width: "100%", py: 1 }}>
      <Stack spacing={3}>
        {/* Header Title Area */}
        <Stack spacing={1}>
          <Skeleton variant="text" width="30%" height={40} />
          <Skeleton variant="text" width="50%" height={20} />
        </Stack>

        {/* Detailed Grid Info */}
        <Grid container spacing={3}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
              <Card
                variant="outlined"
                sx={{
                  p: 2.5,
                  borderRadius: "12px",
                  borderColor: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(255, 255, 255, 0.08)"
                      : "rgba(0, 0, 0, 0.06)",
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(255, 255, 255, 0.01)"
                      : "rgba(0, 0, 0, 0.01)",
                }}
              >
                <Stack spacing={1.5}>
                  <Skeleton variant="text" width="40%" height={18} />
                  <Skeleton variant="rectangular" width="90%" height={28} sx={{ borderRadius: "6px" }} />
                </Stack>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Large Text Area */}
        <Stack spacing={1.5} sx={{ pt: 2 }}>
          <Skeleton variant="text" width="15%" height={24} />
          <Skeleton variant="rectangular" width="100%" height={120} sx={{ borderRadius: "8px" }} />
        </Stack>
      </Stack>
    </Box>
  );
}
