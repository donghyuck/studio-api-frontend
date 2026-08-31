import { useEffect, useRef, useState, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  CircularProgress,
  IconButton,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  Slider,
  Stack,
  Tooltip,
  Typography,
  Alert,
} from "@mui/material";
import {
  ArrowBackIosNewOutlined,
  ArrowForwardIosOutlined,
  CloseOutlined,
  FormatSizeOutlined,
  MenuBookOutlined,
  TocOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
} from "@mui/icons-material";
import Epub from "epubjs";

import { apiClient } from "@/react/api/client";
import {
  createEpubReaderSession,
  disposeEpubReaderSession,
  epubProgress,
  type EpubFactory,
  type EpubNavItem,
  type EpubReaderSession,
} from "./epubReaderSession";

interface Props {
  open: boolean;
  onClose: () => void;
  /** 파일 다운로드 URL 또는 Blob URL */
  url: string;
  filename: string;
}

export function EpubReaderDialog({ open, onClose, url, filename }: Props) {
  const [viewerElement, setViewerElement] = useState<HTMLDivElement | null>(null);
  const sessionRef = useRef<EpubReaderSession | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toc, setToc] = useState<EpubNavItem[]>([]);
  const [tocOpen, setTocOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fontSize, setFontSize] = useState(16);
  const [currentLabel, setCurrentLabel] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const destroy = useCallback(() => {
    const session = sessionRef.current;
    sessionRef.current = null;
    disposeEpubReaderSession(session);
  }, []);

  useEffect(() => {
    console.log("[EpubReaderDialog] useEffect triggered", { open, url, hasViewerElement: !!viewerElement });
    if (!open || !url || !viewerElement) {
      console.log("[EpubReaderDialog] useEffect skipped due to missing requirements", { open, url, hasViewerElement: !!viewerElement });
      return;
    }

    let isMounted = true;
    const loadBook = async () => {
      console.log("[EpubReaderDialog] Starting loadBook. url:", url);
      setLoading(true);
      setError(null);
      setProgress(0);
      setToc([]);
      setCurrentLabel("");

      try {
        console.log("[EpubReaderDialog] Calling apiClient.get (arraybuffer) for", url);
        const res = await apiClient.get<ArrayBuffer>(url, {
          responseType: "arraybuffer",
        });

        console.log("[EpubReaderDialog] Fetch success. Status:", res.status, "Buffer size:", res.data?.byteLength);

        if (!isMounted) {
          console.log("[EpubReaderDialog] Component unmounted before load finished.");
          return;
        }

        const arrayBuffer = res.data;
        const session = await createEpubReaderSession(
          Epub as unknown as EpubFactory,
          arrayBuffer,
          viewerElement,
        );
        if (!isMounted) {
          disposeEpubReaderSession(session);
          return;
        }
        sessionRef.current = session;
        const { book, rendition, sectionCount } = session;

        rendition.themes.fontSize(`${fontSize}px`);
        rendition.themes.default({
          body: {
            "font-family": "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif !important",
            "line-height": "1.8 !important",
            color: "#1a1a1a !important",
          },
        });

        const navigation = Array.isArray(book.toc) ? book.toc : [];

        rendition.on("relocated", (location) => {
          if (!isMounted) return;
          setProgress(epubProgress(location, sectionCount));

          const href = location.start.href;
          const findLabel = (items: EpubNavItem[]): string => {
            for (const item of items) {
              if (href.includes(item.href)) return item.label.trim();
              if (item.subitems?.length) {
                const sub = findLabel(item.subitems);
                if (sub) return sub;
              }
            }
            return "";
          };
          setCurrentLabel(findLabel(navigation));
        });

        await rendition.display();
        if (!isMounted) return;
        setToc(navigation);
        setLoading(false);

      } catch (err: unknown) {
        console.error("[EpubReaderDialog] Error loading book:", err);
        destroy();
        if (isMounted) {
          setError(`EPUB 로딩 실패: ${err instanceof Error ? err.message : String(err)}`);
          setLoading(false);
        }
      }
    };

    void loadBook();

    return () => {
      console.log("[EpubReaderDialog] useEffect cleanup");
      isMounted = false;
      destroy();
    };
  }, [destroy, open, url, viewerElement]);

  // Sync font size to rendition
  useEffect(() => {
    if (sessionRef.current) {
      sessionRef.current.rendition.themes.fontSize(`${fontSize}px`);
    }
  }, [fontSize]);

  const handlePrev = () => sessionRef.current?.rendition.prev();
  const handleNext = () => sessionRef.current?.rendition.next();

  const handleTocClick = (href: string) => {
    void sessionRef.current?.rendition.display(href);
    setTocOpen(false);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowLeft") sessionRef.current?.rendition.prev();
    if (e.key === "ArrowRight") sessionRef.current?.rendition.next();
  }, [open]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const renderTocItems = (items: EpubNavItem[], depth = 0): React.ReactNode =>
    items.map((item) => (
      <Box key={item.id ?? item.href}>
        <ListItemButton
          onClick={() => handleTocClick(item.href)}
          sx={{ pl: 2 + depth * 2, py: 0.75 }}
        >
          <ListItemText
            primary={item.label.trim()}
            primaryTypographyProps={{ variant: "body2", sx: { fontSize: 13 - depth } }}
          />
        </ListItemButton>
        {item.subitems?.length ? renderTocItems(item.subitems, depth + 1) : null}
      </Box>
    ));

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
        <MenuBookOutlined fontSize="small" color="action" />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap>{filename}</Typography>
          {currentLabel && (
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {currentLabel}
            </Typography>
          )}
        </Box>

        <Stack direction="row" spacing={0.5} alignItems="center">
          {/* Font size */}
          <Tooltip title="글자 크기">
            <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1 }}>
              <FormatSizeOutlined fontSize="small" color="action" />
              <Slider
                value={fontSize}
                min={12}
                max={28}
                step={1}
                onChange={(_, val) => setFontSize(val as number)}
                sx={{ width: 80 }}
                size="small"
              />
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 28 }}>
                {fontSize}px
              </Typography>
            </Stack>
          </Tooltip>

          {/* TOC toggle */}
          <Tooltip title="목차">
            <IconButton size="small" onClick={() => setTocOpen((v) => !v)}>
              <TocOutlined fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Fullscreen toggle */}
          <Tooltip title={isFullscreen ? "창 모드" : "전체화면"}>
            <IconButton size="small" onClick={() => setIsFullscreen((v) => !v)}>
              {isFullscreen ? <FullscreenExitOutlined fontSize="small" /> : <FullscreenOutlined fontSize="small" />}
            </IconButton>
          </Tooltip>

          {/* Manual close button (aligned inline) */}
          <IconButton size="small" onClick={onClose}>
            <CloseOutlined fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      {/* Progress bar */}
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{ height: 3, flexShrink: 0 }}
      />

      {/* Content area */}
      <DialogContent sx={{ flex: "1 1 0%", minHeight: 0, p: 0, display: "flex", overflow: "hidden" }}>
        {/* TOC Drawer (left panel) */}
        {tocOpen && toc.length > 0 && (
          <Box
            sx={{
              width: 240,
              flexShrink: 0,
              borderRight: "1px solid",
              borderColor: "divider",
              overflowY: "auto",
              bgcolor: "background.paper",
            }}
          >
            <Typography
              variant="caption"
              sx={{ display: "block", px: 2, py: 1.25, fontWeight: 700, color: "text.secondary" }}
            >
              목차
            </Typography>
            <List dense disablePadding>
              {renderTocItems(toc)}
            </List>
          </Box>
        )}

        {/* Epub viewer */}
        <Box sx={{ flex: 1, minWidth: 0, position: "relative", bgcolor: "background.default" }}>
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
                EPUB 파일을 불러오는 중...
              </Typography>
            </Box>
          )}

          {error && (
            <Box sx={{ p: 3 }}>
              <Alert severity="error">{error}</Alert>
            </Box>
          )}

          <Box
            ref={setViewerElement}
            sx={{
              width: "100%",
              height: "100%",
              "& iframe": { border: "none" },
            }}
          />
        </Box>
      </DialogContent>

      {/* Footer navigation */}
      <DialogActions
        sx={{
          borderTop: "1px solid",
          borderColor: "divider",
          px: 2,
          py: 1,
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <Button
          startIcon={<ArrowBackIosNewOutlined fontSize="small" />}
          onClick={handlePrev}
          disabled={loading || !!error}
          variant="outlined"
          size="small"
        >
          이전
        </Button>

        <Typography variant="caption" color="text.secondary">
          {progress}% 읽음
        </Typography>

        <Button
          endIcon={<ArrowForwardIosOutlined fontSize="small" />}
          onClick={handleNext}
          disabled={loading || !!error}
          variant="outlined"
          size="small"
        >
          다음
        </Button>
      </DialogActions>
    </Dialog>
  );
}
