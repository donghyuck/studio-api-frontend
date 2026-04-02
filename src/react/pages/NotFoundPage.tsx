import { Button, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

export function NotFoundPage() {
  return (
    <Stack
      spacing={2}
      alignItems="center"
      justifyContent="center"
      sx={{ minHeight: "100vh" }}
    >
      <Typography variant="h3">404</Typography>
      <Typography color="text.secondary">
        요청한 페이지를 찾을 수 없습니다.
      </Typography>
      <Button component={RouterLink} to="/" variant="contained">
        홈으로 이동
      </Button>
    </Stack>
  );
}
