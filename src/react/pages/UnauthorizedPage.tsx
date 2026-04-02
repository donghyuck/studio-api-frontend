import { Button, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

export function UnauthorizedPage() {
  return (
    <Stack
      spacing={2}
      alignItems="center"
      justifyContent="center"
      sx={{ minHeight: "100vh" }}
    >
      <Typography variant="h4">접근 권한이 없습니다.</Typography>
      <Typography color="text.secondary">
        현재 계정으로는 요청한 화면에 접근할 수 없습니다.
      </Typography>
      <Button component={RouterLink} to="/" variant="contained">
        홈으로 이동
      </Button>
    </Stack>
  );
}
