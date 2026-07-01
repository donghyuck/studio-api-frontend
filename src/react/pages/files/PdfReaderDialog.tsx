import { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  IconButton,
  Tooltip,
  Typography,
  CircularProgress,
  Alert,
  Stack,
} from "@mui/material";
import {
  CloseOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  PictureAsPdfOutlined,
} from "@mui/icons-material";
import { apiClient } from "@/react/api/client";

interface Props {
  open: boolean;
  onClose: () => void;
  url: string;
  filename: string;
}

export function PdfReaderDialog({ open, onClose, url, filename }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!open || !url) return;

    let isMounted = true;
    let objectUrl = "";

    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      setPdfUrl(null);

      try {
        const res = await apiClient.get<Blob>(url, {
          responseType: "blob",
        });

        if (!isMounted) return;

        const blob = new Blob([res.data], { type: "application/pdf" });
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
        setLoading(false);
      } catch (err: unknown) {
        if (isMounted) {
          setError(`PDF 로딩 실패: ${err instanceof Error ? err.message : String(err)}`);
          setLoading(false);
        }
      }
    };

    void loadPdf();

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [open, url]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      fullScreen={isFullscreen}
      slotProps={{
        backdrop: {
          sx: {
            backdropFilter: "blur(4px)",
            backgroundColor: "rgba(0, 0, 0, 0.4)",
          },
        },
      }}
      PaperProps={{
        sx: {
          height: isFullscreen ? "100vh" : "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          py: 1.25,
          px: 2,
          pr: "16px !important", // Override theme's paddingRight: 48px
          borderBottom: "1px solid",
          borderColor: "divider",
          minHeight: 52,
          flexShrink: 0,
          "& .custom-close-button": {
            display: "none",
          },
        }}
      >
        <PictureAsPdfOutlined fontSize="small" color="error" />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap>{filename}</Typography>
        </Box>

        <Stack direction="row" spacing={0.5} alignItems="center">
          {/* Fullscreen toggle */}
          <Tooltip title={isFullscreen ? "창 모드" : "전체화면"}>
            <IconButton size="small" onClick={() => setIsFullscreen((v) => !v)}>
              {isFullscreen ? <FullscreenExitOutlined fontSize="small" /> : <FullscreenOutlined fontSize="small" />}
            </IconButton>
          </Tooltip>

          {/* Close button */}
          <IconButton size="small" onClick={onClose}>
            <CloseOutlined fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      {/* Content area */}
      <DialogContent sx={{ flex: "1 1 0%", minHeight: 0, p: 0, display: "flex", overflow: "hidden", position: "relative" }}>
        {loading && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              bgcolor: "background.paper",
              zIndex: 10,
            }}
          >
            <CircularProgress size={40} />
            <Typography variant="body2" color="text.secondary">
              PDF 파일을 불러오는 중...
            </Typography>
          </Box>
        )}

        {error && (
          <Box sx={{ p: 3, width: "100%" }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}

        {pdfUrl && (
          <Box
            component="iframe"
            src={`${pdfUrl}#navpanes=0`}
            sx={{
              width: "100%",
              height: "100%",
              border: "none",
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
