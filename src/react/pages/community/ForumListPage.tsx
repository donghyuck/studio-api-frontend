import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Link,
  Pagination,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { ForumSummaryResponse } from "@/types/studio/forums";
import { reactForumsPublicApi } from "@/react/pages/community/api";
import { forumPublicQueryKeys } from "@/react/pages/community/queryKeys";
import { formatDateTime } from "@/react/pages/community/format";

const PAGE_SIZE = 10;

export function ForumListPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const forumsQuery = useQuery({
    queryKey: forumPublicQueryKeys.list({ page, q: search || undefined }),
    queryFn: () =>
      reactForumsPublicApi.listForums({
        page: page - 1,
        size: PAGE_SIZE,
        q: search || undefined,
        in: "name,description",
      }),
  });

  const forums = forumsQuery.data?.content ?? [];
  const totalPages = Math.max(forumsQuery.data?.totalPages ?? 1, 1);

  const submitSearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <Stack spacing={3}>
      <Breadcrumbs>
        <Typography color="text.primary">커뮤니티</Typography>
        <Typography color="text.secondary">게시판</Typography>
      </Breadcrumbs>

      <Box>
        <Typography variant="h4">게시판</Typography>
        <Typography variant="body2" color="text.secondary">
          공개 커뮤니티 게시판 목록입니다.
        </Typography>
      </Box>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          fullWidth
          label="검색어"
          placeholder="게시판 이름/설명을 입력하세요."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              submitSearch();
            }
          }}
        />
        <Button variant="contained" onClick={submitSearch}>
          검색
        </Button>
      </Stack>

      {forumsQuery.isLoading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : null}

      {forumsQuery.isError ? (
        <Alert severity="error">게시판 목록을 불러오지 못했습니다.</Alert>
      ) : null}

      {!forumsQuery.isLoading && !forumsQuery.isError ? (
        <Stack spacing={2}>
          {forums.length > 0 ? (
            forums.map((forum: ForumSummaryResponse) => (
              <Card key={forum.slug} variant="outlined">
                <CardContent>
                  <Stack spacing={1}>
                    <Link
                      component={RouterLink}
                      to={`/forums/${forum.slug}`}
                      underline="hover"
                      variant="h6"
                    >
                      {forum.name}
                    </Link>
                    <Typography variant="body2" color="text.secondary">
                      {forum.slug}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      최근 수정: {formatDateTime(forum.updatedAt)}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            ))
          ) : (
            <Alert severity="info">게시판이 없습니다.</Alert>
          )}
        </Stack>
      ) : null}

      <Box display="flex" justifyContent="flex-end">
        <Pagination
          page={page}
          count={totalPages}
          onChange={(_, nextPage) => setPage(nextPage)}
          color="primary"
          disabled={forumsQuery.isLoading}
        />
      </Box>
    </Stack>
  );
}
