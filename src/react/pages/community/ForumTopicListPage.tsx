import { useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
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
import { forumPublicQueryKeys } from "@/react/pages/community/queryKeys";
import { reactForumsPublicApi } from "@/react/pages/community/api";
import type { TopicSummaryResponse } from "@/types/studio/forums";
import {
  formatDateTime,
  formatTopicStatus,
} from "@/react/pages/community/format";

const PAGE_SIZE = 20;

export function ForumTopicListPage() {
  const { forumSlug = "" } = useParams();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const forumQuery = useQuery({
    queryKey: forumPublicQueryKeys.detail(forumSlug),
    queryFn: () => reactForumsPublicApi.getForum(forumSlug),
    enabled: Boolean(forumSlug),
  });

  const topicsQuery = useQuery({
    queryKey: forumPublicQueryKeys.custom(
      forumSlug,
      "topics",
      forumSlug,
      page,
      search || null
    ),
    queryFn: () =>
      reactForumsPublicApi.listTopics(forumSlug, {
        page: page - 1,
        size: PAGE_SIZE,
        q: search || undefined,
        in: "title",
      }),
    enabled: Boolean(forumSlug),
  });

  const forumName = forumQuery.data?.name ?? forumSlug;
  const topics = topicsQuery.data?.content ?? [];
  const totalPages = Math.max(topicsQuery.data?.totalPages ?? 1, 1);
  const isLoading = forumQuery.isLoading || topicsQuery.isLoading;
  const isError = forumQuery.isError || topicsQuery.isError;

  const submitSearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const description = forumQuery.data?.description ?? "게시글 목록을 확인합니다.";

  return (
    <Stack spacing={3}>
      <Breadcrumbs>
        <Link component={RouterLink} to="/forums" underline="hover">
          커뮤니티
        </Link>
        <Typography color="text.primary">{forumName}</Typography>
      </Breadcrumbs>

      <Box>
        <Typography variant="h4">{forumName}</Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Box>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          fullWidth
          label="검색어"
          placeholder="게시글 제목을 입력하세요."
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

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : null}

      {isError ? (
        <Alert severity="error">게시글 목록을 불러오지 못했습니다.</Alert>
      ) : null}

      {!isLoading && !isError ? (
        <Stack spacing={2}>
          {topics.length > 0 ? (
            topics.map((topic: TopicSummaryResponse) => (
              <Card key={topic.id} variant="outlined">
                <CardContent>
                  <Stack spacing={1}>
                    <Link
                      component={RouterLink}
                      to={`/forums/${forumSlug}/topics/${topic.id}`}
                      underline="hover"
                      variant="h6"
                    >
                      {topic.title}
                    </Link>
                    <Typography variant="body2" color="text.secondary">
                      상태: {formatTopicStatus(topic.status)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      최근 활동: {formatDateTime(topic.lastActivityAt ?? topic.updatedAt)}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            ))
          ) : (
            <Alert severity="info">게시글이 없습니다.</Alert>
          )}
        </Stack>
      ) : null}

      <Box display="flex" justifyContent="space-between">
        <Button component={RouterLink} to="/forums" variant="text">
          게시판 목록
        </Button>
        <Pagination
          page={page}
          count={totalPages}
          onChange={(_, nextPage) => setPage(nextPage)}
          color="primary"
          disabled={isLoading}
        />
      </Box>
    </Stack>
  );
}
