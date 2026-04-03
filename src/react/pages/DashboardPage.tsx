import { Alert, Paper, Stack, Typography } from "@mui/material";

export function DashboardPage() {
  return (
    <Stack spacing={3}>
      <Typography variant="h4">React Shell Ready</Typography>
      <Alert severity="info" variant="outlined">
        `#4`~`#6` 기준선이 적용된 상태입니다. 이후 페이지 이관은 이 React 셸과 auth
        bootstrap 흐름 위에서 진행합니다.
      </Alert>
      <Paper sx={{ p: 3 }}>
        <Typography variant="body1" color="text.secondary">
          이 화면은 보호 라우트, React 런타임, session restore 기준선이 정상적으로
          동작하는지 확인하기 위한 임시 대시보드입니다.
        </Typography>
      </Paper>
    </Stack>
  );
}
