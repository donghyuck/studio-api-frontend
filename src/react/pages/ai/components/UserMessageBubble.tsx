import { alpha, Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { ContentCopyOutlined, EditNoteOutlined } from "@mui/icons-material";
import type { ChatMessage } from "@/react/pages/ai/components/chatTypes";

function formatMessageTime(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  message: ChatMessage;
  onCopy: (content: string) => void;
  onEdit: (messageId: string | undefined, content: string) => void;
}

export function UserMessageBubble({ message, onCopy, onEdit }: Props) {
  return (
    <Stack spacing={0.5} alignItems="flex-end" sx={{ width: "100%" }}>
      <Box
        sx={{
          maxWidth: { xs: "92%", md: "86%" },
          px: 2,
          py: 1.15,
          borderRadius: "8px",
          bgcolor: (theme) =>
            theme.palette.mode === "dark"
              ? alpha(theme.palette.primary.main, 0.28)
              : theme.palette.primary.main,
          color: "primary.contrastText",
          border: "none",
        }}
      >
        <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 14, lineHeight: 1.7 }}>
          {message.content}
        </Typography>
      </Box>
      <Stack className="user-message-actions" direction="row" spacing={0.5} alignItems="center" sx={{ pr: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {formatMessageTime(message.createdAt)}
        </Typography>
        <Tooltip title="복사">
          <IconButton size="small" onClick={() => onCopy(message.content)}>
            <ContentCopyOutlined fontSize="inherit" />
          </IconButton>
        </Tooltip>
        <Tooltip title="편집">
          <IconButton size="small" onClick={() => onEdit(message.id, message.content)}>
            <EditNoteOutlined fontSize="inherit" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Stack>
  );
}
