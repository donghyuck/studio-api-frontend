import type {
  ChatMessageDto,
  ChatResponseMetadataDto,
  ConversationSummaryDto,
} from "@/types/studio/ai";

export type ChatMessage = ChatMessageDto & {
  id?: string;
  createdAt?: string;
  model?: string;
  metadata?: ChatResponseMetadataDto;
};

export type { ChatResponseMetadataDto, ConversationSummaryDto };
