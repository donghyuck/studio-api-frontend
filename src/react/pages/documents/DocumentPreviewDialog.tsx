import { useMemo } from "react";
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DOMPurify from "dompurify";
import { generateHTML } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Youtube from "@tiptap/extension-youtube";
import { createLowlight, common } from "lowlight";
import type { DocumentBlock, DocumentBlockNode } from "@/types/studio/document";

interface Props {
  blocks: DocumentBlockNode[];
  open: boolean;
  title?: string | null;
  onClose: () => void;
}

const lowlight = createLowlight(common);

const previewExtensions = [
  StarterKit.configure({ codeBlock: false }),
  Link,
  Image,
  Placeholder.configure({ placeholder: "" }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  CodeBlockLowlight.configure({
    lowlight,
    defaultLanguage: "javascript",
  }),
  Youtube.configure({
    controls: true,
    modestBranding: true,
  }),
];

function flattenTree(nodes: DocumentBlockNode[]) {
  const items: DocumentBlock[] = [];
  const walk = (list: DocumentBlockNode[]) => {
    const sorted = [...list].sort((a, b) => {
      const left = a.block.sortOrder;
      const right = b.block.sortOrder;
      if (left == null && right == null) return a.block.blockId - b.block.blockId;
      if (left == null) return 1;
      if (right == null) return -1;
      return left - right;
    });

    for (const node of sorted) {
      items.push(node.block);
      if (node.children.length > 0) {
        walk(node.children);
      }
    }
  };

  walk(nodes);
  return items;
}

function parseBlockData(raw?: string | null) {
  if (!raw) {
    return { type: "doc", content: [] };
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: raw }],
        },
      ],
    };
  }
}

export function DocumentPreviewDialog({ blocks, open, title, onClose }: Props) {
  const previewBlocks = useMemo(() => {
    return flattenTree(blocks).map((block) => {
      const doc = parseBlockData(block.blockData);
      const html = generateHTML(doc, previewExtensions);
      return {
        id: block.blockId,
        blockType: block.blockType,
        html: DOMPurify.sanitize(html),
      };
    });
  }, [blocks]);

  return (
    <Dialog fullScreen open={open} onClose={onClose}>
      <DialogTitle sx={{ pr: 8 }}>
        {title ? `미리보기: ${title}` : "문서 미리보기"}
        <IconButton
          aria-label="닫기"
          onClick={onClose}
          sx={{ position: "absolute", right: 16, top: 16 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {previewBlocks.length === 0 ? (
            <Typography color="text.secondary">미리보기할 블록이 없습니다.</Typography>
          ) : (
            previewBlocks.map((block) => (
              <Box key={block.id}>
                <Typography variant="caption" color="text.secondary">
                  #{block.id} · {block.blockType || "block"}
                </Typography>
                <Box
                  sx={{
                    mt: 1,
                    "& img": { maxWidth: "100%" },
                    "& iframe": { maxWidth: "100%" },
                    "& pre": {
                      overflowX: "auto",
                      borderRadius: 1,
                      p: 2,
                      backgroundColor: "grey.100",
                    },
                    "& table": {
                      width: "100%",
                      borderCollapse: "collapse",
                    },
                    "& td, & th": {
                      border: "1px solid",
                      borderColor: "divider",
                      p: 1,
                    },
                  }}
                  dangerouslySetInnerHTML={{ __html: block.html }}
                />
              </Box>
            ))
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
