import { Alert, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { createApiQueryFn } from "@/react/query/fetcher";

interface SelfApiData {
  username: string;
  name?: string;
  email?: string;
}

export function DashboardPage() {
  const { data, isLoading, error } = useQuery<SelfApiData>({
    queryKey: ["selfData"],
    queryFn: createApiQueryFn<SelfApiData>("/api/self"),
  });

  return (
    <Stack spacing={3}>
      <Typography variant="h4">대시보드 콘텐츠</Typography>
      <Alert severity="info" variant="outlined">
        `#4`~`#6` 기준선이 적용된 상태입니다. 이후 페이지 이관은 이 React 셸과 auth
        bootstrap 흐름 위에서 진행합니다.
      </Alert>
      <Paper sx={{ p: 3 }}>
        {isLoading ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={20} />
            <Typography variant="body1" color="text.secondary">
              대시보드 데이터를 불러오는 중...
            </Typography>
          </Stack>
        ) : error ? (
          <Alert severity="error" variant="outlined">
            데이터 로딩 중 오류 발생: {error.message}
          </Alert>
        ) : (
          <Typography variant="body1" color="text.secondary">
            환영합니다, {data?.name ?? data?.username ?? "사용자"}!
            <br />
            이 화면은 보호 라우트, React 런타임, session restore 기준선이 정상적으로
            동작하는지 확인하기 위한 임시 대시보드입니다.
          </Typography>
        )}
      </Paper>
    </Stack>
  );
}