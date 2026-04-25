import {
  CircularProgress,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { DeleteOutlineOutlined, RefreshOutlined } from "@mui/icons-material";
import type { ConversationSummaryDto } from "@/react/pages/ai/components/chatTypes";

function formatRelative(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  conversationId: string;
  conversations: ConversationSummaryDto[];
  loading: boolean;
  onOpen: (conversationId: string) => void;
  onDelete: (conversationId: string) => void;
  onRefresh: () => void;
}

export function ConversationSidebar({
  conversationId,
  conversations,
  loading,
  onOpen,
  onDelete,
  onRefresh,
}: Props) {
  return (
    <Paper
      variant="outlined"
      sx={{ width: { xs: "100%", md: 320 }, p: 1.5, borderRadius: 3, flexShrink: 0 }}
    >
      <Stack spacing={1}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="subtitle2">대화 목록</Typography>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {loading ? <CircularProgress size={16} /> : null}
            <Tooltip title="목록 새로고침">
              <IconButton size="small" onClick={onRefresh}>
                <RefreshOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
        <List dense sx={{ py: 0 }}>
          {conversations.map((conversation) => (
            <ListItemButton
              key={conversation.conversationId}
              selected={conversation.conversationId === conversationId}
              onClick={() => onOpen(conversation.conversationId)}
              sx={{ borderRadius: 1, alignItems: "flex-start" }}
            >
              <ListItemText
                primary={conversation.title || conversation.conversationId}
                secondary={
                  <>
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block" }}
                    >
                      {conversation.summary || "요약 없음"}
                    </Typography>
                    <Typography component="span" variant="caption" color="text.secondary">
                      {conversation.messageCount ?? 0} messages ·{" "}
                      {formatRelative(conversation.lastUpdatedAt)}
                    </Typography>
                  </>
                }
              />
              <Tooltip title="대화 삭제">
                <IconButton
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(conversation.conversationId);
                  }}
                >
                  <DeleteOutlineOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            </ListItemButton>
          ))}
          {conversations.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              저장된 대화가 없습니다.
            </Typography>
          ) : null}
        </List>
      </Stack>
    </Paper>
  );
}
