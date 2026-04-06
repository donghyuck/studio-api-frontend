import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
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
import { reactForumsAdminApi } from "@/react/pages/forums/admin/api";
import { forumAdminQueryKeys } from "@/react/pages/forums/admin/queryKeys";
import { formatDateTime, formatTopicStatus } from "@/react/pages/community/format";
import type { PostResponse } from "@/types/studio/forums";

export function TopicDetailsPage() {
  const navigate = useNavigate();
  const { forumSlug = "", topicId = "" } = useParams();
  const parsedTopicId = Number(topicId);

  const forumQuery = useQuery({
    queryKey: forumAdminQueryKeys.detail(forumSlug),
    queryFn: () => reactForumsAdminApi.getForum(forumSlug),
    enabled: Boolean(forumSlug),
  });

  const topicQuery = useQuery({
    queryKey: forumAdminQueryKeys.custom("topic", forumSlug, parsedTopicId),
    queryFn: () => reactForumsAdminApi.getTopic(forumSlug, parsedTopicId),
    enabled: Boolean(forumSlug) && Number.isFinite(parsedTopicId),
  });

  const postsQuery = useQuery({
    queryKey: forumAdminQueryKeys.custom("topic-posts", forumSlug, parsedTopicId),
    queryFn: () => reactForumsAdminApi.listPosts(forumSlug, parsedTopicId),
    enabled: Boolean(forumSlug) && Number.isFinite(parsedTopicId),
  });

  const isLoading = forumQuery.isLoading || topicQuery.isLoading || postsQuery.isLoading;
  const isError = forumQuery.isError || topicQuery.isError || postsQuery.isError;
  const forumName = forumQuery.data?.data.name ?? forumSlug;
  const topic = topicQuery.data?.data;
  const posts = postsQuery.data ?? [];
  const firstPost = posts[0];
  const replies = posts.slice(1);

  return (
    <Stack spacing={3}>
      <Breadcrumbs>
        <Link component={RouterLink} to="/admin/forums" underline="hover">
          포럼
        </Link>
        <Link
          component={RouterLink}
          to={`/admin/forums/${forumSlug}/settings`}
          underline="hover"
        >
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

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              onClick={() => navigate(`/admin/forums/${forumSlug}/settings`)}
            >
              설정으로
            </Button>
            <Button variant="text" onClick={() => navigate(-1)}>
              뒤로
            </Button>
          </Stack>
        </>
      ) : null}
    </Stack>
  );
}
