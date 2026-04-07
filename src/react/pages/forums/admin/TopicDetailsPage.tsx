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
import DOMPurify from "dompurify";
import { reactForumsPublicApi } from "@/react/pages/community/api";
import { forumAdminQueryKeys } from "@/react/pages/forums/admin/queryKeys";
import { formatDateTime, formatTopicStatus } from "@/react/pages/community/format";
import type { PostResponse } from "@/types/studio/forums";

export function TopicDetailsPage() {
  const { forumSlug = "", topicId = "" } = useParams();
  const parsedTopicId = Number(topicId);
  const hasValidTopicId = Number.isFinite(parsedTopicId) && parsedTopicId > 0;

  const forumQuery = useQuery({
    queryKey: forumAdminQueryKeys.detail(forumSlug),
    queryFn: () => reactForumsPublicApi.getForum(forumSlug),
    enabled: Boolean(forumSlug),
  });

  const topicQuery = useQuery({
    queryKey: forumAdminQueryKeys.custom("topic", forumSlug, parsedTopicId),
    queryFn: () => reactForumsPublicApi.getTopic(forumSlug, parsedTopicId),
    enabled: Boolean(forumSlug) && hasValidTopicId,
  });

  const postsQuery = useQuery({
    queryKey: forumAdminQueryKeys.custom("topic-posts", forumSlug, parsedTopicId),
    queryFn: () => reactForumsPublicApi.listPosts(forumSlug, parsedTopicId),
    enabled: Boolean(forumSlug) && hasValidTopicId,
  });

  const isLoading = forumQuery.isLoading || topicQuery.isLoading || postsQuery.isLoading;
  const isError = forumQuery.isError || topicQuery.isError || postsQuery.isError;
  const forumName = forumQuery.data?.name ?? forumSlug;
  const topic = topicQuery.data;
  const posts = postsQuery.data ?? [];
  const firstPost = posts[0];
  const replies = posts.slice(1);

  return (
    <Stack spacing={3}>
      <Breadcrumbs separator="›">
        <Link component={RouterLink} to="/admin/forums" underline="hover">
          포럼
        </Link>
        <Link component={RouterLink} to={`/admin/forums/${forumSlug}/settings`} underline="hover">
          {forumName}
        </Link>
        <Typography color="text.primary">{topic?.title ?? `토픽 #${topicId}`}</Typography>
      </Breadcrumbs>

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : null}

      {isError ? <Alert severity="error">토픽 상세를 불러오지 못했습니다.</Alert> : null}

      {!isLoading && !isError ? (
        <>
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h4">{topic?.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  상태: {formatTopicStatus(topic?.status)}
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
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(firstPost.content),
                      }}
                    />
                  </>
                ) : (
                  <Alert severity="info">본문이 없습니다.</Alert>
                )}
              </Stack>
            </CardContent>
          </Card>

          <Stack spacing={2}>
            <Typography variant="h6">댓글</Typography>
            {replies.length === 0 ? (
              <Alert severity="info">댓글이 없습니다.</Alert>
            ) : (
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
                        dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(post.content),
                        }}
                      />
                    </Stack>
                  </CardContent>
                </Card>
              ))
            )}
          </Stack>

          <Box>
            <Button component={RouterLink} to={`/admin/forums/${forumSlug}/settings`} variant="outlined">
              설정으로
            </Button>
          </Box>
        </>
      ) : null}
    </Stack>
  );
}
