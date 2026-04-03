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
  Divider,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { reactForumsPublicApi } from "@/react/pages/community/api";
import { forumTopicDetailQueryKeys } from "@/react/pages/community/queryKeys";
import type { PostResponse } from "@/types/studio/forums";

function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }

  return dayjs(value).format("YYYY-MM-DD HH:mm:ss");
}

export function ForumTopicDetailPage() {
  const { forumSlug = "", topicId = "" } = useParams();
  const parsedTopicId = Number(topicId);

  const forumQuery = useQuery({
    queryKey: forumTopicDetailQueryKeys.detail(`${forumSlug}-forum`),
    queryFn: () => reactForumsPublicApi.getForum(forumSlug),
    enabled: Boolean(forumSlug),
  });

  const topicQuery = useQuery({
    queryKey: forumTopicDetailQueryKeys.detail(`${forumSlug}-${topicId}`),
    queryFn: () => reactForumsPublicApi.getTopic(forumSlug, parsedTopicId),
    enabled: Boolean(forumSlug) && Number.isFinite(parsedTopicId),
  });

  const postsQuery = useQuery({
    queryKey: forumTopicDetailQueryKeys.custom(forumSlug, "posts", parsedTopicId),
    queryFn: () => reactForumsPublicApi.listPosts(forumSlug, parsedTopicId),
    enabled: Boolean(forumSlug) && Number.isFinite(parsedTopicId),
  });

  const isLoading =
    forumQuery.isLoading || topicQuery.isLoading || postsQuery.isLoading;
  const isError = forumQuery.isError || topicQuery.isError || postsQuery.isError;

  const forumName = forumQuery.data?.name ?? forumSlug;
  const topic = topicQuery.data;
  const posts = postsQuery.data ?? [];
  const firstPost = posts[0];
  const replies = posts.slice(1);

  return (
    <Stack spacing={3}>
      <Breadcrumbs>
        <Link component={RouterLink} to="/forums" underline="hover">
          커뮤니티
        </Link>
        <Link component={RouterLink} to={`/forums/${forumSlug}`} underline="hover">
          {forumName}
        </Link>
        <Typography color="text.primary">{topic?.title ?? `토픽 #${topicId}`}</Typography>
      </Breadcrumbs>

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : null}

      {isError ? (
        <Alert severity="error">게시글 상세를 불러오지 못했습니다.</Alert>
      ) : null}

      {!isLoading && !isError ? (
        <>
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h4">{topic?.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  상태: {topic?.status ?? "OPEN"}
                </Typography>
                <Divider />
                {firstPost ? (
                  <>
                    <Typography variant="subtitle2">{firstPost.createdBy}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      작성일: {formatDateTime(firstPost.createdAt)}
                    </Typography>
                    <Box
                      sx={{ "& img": { maxWidth: "100%" } }}
                      dangerouslySetInnerHTML={{ __html: firstPost.content }}
                    />
                  </>
                ) : (
                  <Alert severity="info">본문이 없습니다.</Alert>
                )}
              </Stack>
            </CardContent>
          </Card>

          <Stack spacing={2}>
            <Typography variant="h5">댓글</Typography>
            {replies.length > 0 ? (
              replies.map((post: PostResponse) => (
                <Card key={post.id} variant="outlined">
                  <CardContent>
                    <Stack spacing={1}>
                      <Typography variant="subtitle2">{post.createdBy}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        작성일: {formatDateTime(post.createdAt)}
                      </Typography>
                      <Box
                        sx={{ "& img": { maxWidth: "100%" } }}
                        dangerouslySetInnerHTML={{ __html: post.content }}
                      />
                    </Stack>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Alert severity="info">댓글이 없습니다.</Alert>
            )}
          </Stack>

          <Box display="flex" justifyContent="space-between">
            <Button component={RouterLink} to={`/forums/${forumSlug}`} variant="text">
              목록
            </Button>
          </Box>
        </>
      ) : null}
    </Stack>
  );
}
