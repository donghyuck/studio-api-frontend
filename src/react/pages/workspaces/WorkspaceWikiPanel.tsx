import { useCallback, useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AddOutlined,
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  RefreshOutlined,
  RestoreOutlined,
  SaveOutlined,
} from "@mui/icons-material";
import { useConfirm, useToast } from "@/react/feedback";
import { reactWorkspaceWikiApi } from "@/react/pages/workspaces/wikiApi";
import type { PageResponse } from "@/types/studio/api-common";
import type {
  WikiPageDto,
  WikiPageSummaryDto,
  WikiRevisionSummaryDto,
} from "@/types/studio/wiki";
import { resolveAxiosError } from "@/utils/helpers";

function unwrapList<T>(payload: T[] | PageResponse<T>) {
  return Array.isArray(payload) ? payload : payload.content ?? [];
}

function revisionLabel(page?: WikiPageDto | null) {
  return page?.revisionNo ? `r${page.revisionNo}` : "-";
}

function normalizeSlug(value: string) {
  return value.trim().replace(/\s+/g, "-");
}

function WikiPreview({ html }: { html?: string | null }) {
  const safeHtml = useMemo(() => DOMPurify.sanitize(html ?? ""), [html]);
  if (!safeHtml) {
    return (
      <Typography color="text.secondary" sx={{ py: 2 }}>
        미리보기가 없습니다.
      </Typography>
    );
  }
  return (
    <Box
      sx={{
        "& h1, & h2, & h3": { mt: 1.5, mb: 1 },
        "& p": { my: 1 },
        "& pre": {
          p: 1.5,
          borderRadius: 1,
          bgcolor: "action.hover",
          overflowX: "auto",
        },
        "& code": {
          px: 0.5,
          py: 0.25,
          borderRadius: 0.5,
          bgcolor: "action.hover",
        },
        "& table": {
          borderCollapse: "collapse",
          width: "100%",
          my: 1,
        },
        "& th, & td": {
          border: "1px solid",
          borderColor: "divider",
          p: 1,
        },
      }}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}

export function WorkspaceWikiPanel({
  workspaceId,
  archived,
}: {
  workspaceId: number;
  archived?: boolean;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [pages, setPages] = useState<WikiPageSummaryDto[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [page, setPage] = useState<WikiPageDto | null>(null);
  const [revisions, setRevisions] = useState<WikiRevisionSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ slug: "", title: "", markdown: "" });

  const selectedSummary = pages.find((item) => item.slug === selectedSlug);
  const sortedRevisions = useMemo(
    () => [...revisions].sort((a, b) => (b.revisionNo ?? 0) - (a.revisionNo ?? 0)),
    [revisions]
  );

  const loadPage = useCallback(
    async (slug: string) => {
      if (!slug) return;
      setPageLoading(true);
      try {
        const [nextPage, nextRevisions] = await Promise.all([
          reactWorkspaceWikiApi.page(workspaceId, slug),
          reactWorkspaceWikiApi.revisions(workspaceId, slug).catch(() => []),
        ]);
        setSelectedSlug(slug);
        setPage(nextPage);
        setRevisions(unwrapList(nextRevisions));
        setDraft({
          slug: nextPage.slug,
          title: nextPage.title ?? "",
          markdown: nextPage.markdown ?? "",
        });
        setCreating(false);
        setEditing(false);
        setError(null);
      } catch (err) {
        setError(resolveAxiosError(err) || "Wiki page를 불러오지 못했습니다.");
      } finally {
        setPageLoading(false);
      }
    },
    [workspaceId]
  );

  const loadPages = useCallback(
    async (preferredSlug?: string | null) => {
      setLoading(true);
      try {
        const nextPages = unwrapList(await reactWorkspaceWikiApi.pages(workspaceId));
        setPages(nextPages);

        const nextSlug = preferredSlug && nextPages.some((item) => item.slug === preferredSlug)
          ? preferredSlug
          : nextPages[0]?.slug ?? null;

        if (nextSlug) {
          await loadPage(nextSlug);
        } else {
          setSelectedSlug(null);
          setPage(null);
          setRevisions([]);
          setDraft({ slug: "", title: "", markdown: "" });
          setCreating(false);
          setEditing(false);
        }
        setError(null);
      } catch (err) {
        setError(resolveAxiosError(err) || "Wiki page 목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    },
    [loadPage, workspaceId]
  );

  useEffect(() => {
    void loadPages();
  }, [loadPages]);

  function handleNewPage() {
    setSelectedSlug(null);
    setPage(null);
    setRevisions([]);
    setDraft({ slug: "", title: "", markdown: "" });
    setCreating(true);
    setEditing(true);
    setError(null);
  }

  async function handleSave() {
    const slug = normalizeSlug(draft.slug);
    if (!slug || !draft.title.trim()) {
      toast.warning("Slug와 제목을 입력해주세요.");
      return;
    }

    setSaving(true);
    try {
      const saved = await reactWorkspaceWikiApi.putPage(workspaceId, slug, {
        title: draft.title.trim(),
        markdown: draft.markdown,
        baseRevisionId: page?.currentRevisionId ?? null,
      });
      toast.success("Wiki page가 저장되었습니다.");
      setSelectedSlug(saved.slug);
      setPage(saved);
      setDraft({
        slug: saved.slug,
        title: saved.title ?? "",
        markdown: saved.markdown ?? "",
      });
      setCreating(false);
      setEditing(false);
      await loadPages(saved.slug);
    } catch (err) {
      toast.error(resolveAxiosError(err) || "Wiki page 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!page) return;
    const ok = await confirm({
      title: "Wiki page 보관",
      message: `${page.title} page를 보관하시겠습니까?`,
      okText: "보관",
      cancelText: "취소",
    });
    if (!ok) return;

    setSaving(true);
    try {
      await reactWorkspaceWikiApi.archivePage(workspaceId, page.slug, {
        baseRevisionId: page.currentRevisionId ?? null,
      });
      toast.success("Wiki page가 보관되었습니다.");
      await loadPages();
    } catch (err) {
      toast.error(resolveAxiosError(err) || "Wiki page 보관에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevert(revision: WikiRevisionSummaryDto) {
    if (!page) return;
    const ok = await confirm({
      title: "Revision 되돌리기",
      message: `Revision r${revision.revisionNo ?? revision.revisionId}로 되돌리시겠습니까?`,
      okText: "되돌리기",
      cancelText: "취소",
    });
    if (!ok) return;

    setSaving(true);
    try {
      const reverted = await reactWorkspaceWikiApi.revert(workspaceId, page.slug, revision.revisionId, {
        baseRevisionId: page.currentRevisionId ?? null,
      });
      toast.success("Revision이 되돌려졌습니다.");
      setPage(reverted);
      setDraft({
        slug: reverted.slug,
        title: reverted.title ?? "",
        markdown: reverted.markdown ?? "",
      });
      await loadPages(reverted.slug);
    } catch (err) {
      toast.error(resolveAxiosError(err) || "Revision 되돌리기에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 3 }}>
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle1">Pages</Typography>
              <Stack direction="row" spacing={0.25}>
                <Tooltip title="새로고침">
                  <IconButton size="small" onClick={() => void loadPages(selectedSlug)}>
                    <RefreshOutlined fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Page 생성">
                  <span>
                    <IconButton size="small" disabled={archived || saving} onClick={handleNewPage}>
                      <AddOutlined fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </Stack>
            <Divider />
            {pages.length === 0 && !creating ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                표시할 page가 없습니다.
              </Typography>
            ) : null}
            <Stack spacing={0.5}>
              {creating ? (
                <Button variant="contained" size="small" sx={{ justifyContent: "flex-start" }}>
                  새 page
                </Button>
              ) : null}
              {pages.map((item) => (
                <Button
                  key={item.slug}
                  variant={item.slug === selectedSlug ? "contained" : "text"}
                  size="small"
                  onClick={() => void loadPage(item.slug)}
                  sx={{
                    justifyContent: "space-between",
                    textTransform: "none",
                    overflow: "hidden",
                  }}
                >
                  <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.title || item.slug}
                  </Box>
                  {item.archived ? <Chip size="small" variant="outlined" label="보관" sx={{ ml: 1, height: 20 }} /> : null}
                </Button>
              ))}
            </Stack>
          </Stack>
        </Paper>
      </Grid>

      <Grid size={{ xs: 12, md: 9 }}>
        <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Paper variant="outlined" sx={{ p: 2, minHeight: 420 }}>
            {!page && !creating ? (
              <Typography color="text.secondary">선택된 Wiki page가 없습니다.</Typography>
            ) : (
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" useFlexGap flexWrap="wrap">
                  <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                    <Typography variant="h6">{creating ? "새 page" : page?.title ?? selectedSummary?.title}</Typography>
                    <Chip size="small" variant="outlined" label={creating ? "new" : revisionLabel(page)} />
                    {page?.archived ? <Chip size="small" variant="outlined" label="보관" /> : null}
                  </Stack>
                  <Stack direction="row" spacing={0.75}>
                    {editing ? (
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<SaveOutlined />}
                        disabled={archived || saving}
                        onClick={() => void handleSave()}
                      >
                        {saving ? <CircularProgress size={16} /> : "저장"}
                      </Button>
                    ) : (
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<EditOutlined />}
                        disabled={archived || saving || !page}
                        onClick={() => setEditing(true)}
                      >
                        수정
                      </Button>
                    )}
                    <Button
                      variant="outlined"
                      size="small"
                      color="warning"
                      startIcon={<DeleteOutlined />}
                      disabled={archived || saving || !page}
                      onClick={() => void handleArchive()}
                    >
                      보관
                    </Button>
                  </Stack>
                </Stack>

                {pageLoading ? (
                  <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : editing ? (
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Stack spacing={1.5}>
                        <TextField
                          label="Slug"
                          size="small"
                          value={draft.slug}
                          disabled={!creating || saving}
                          onChange={(event) => setDraft((current) => ({ ...current, slug: event.target.value }))}
                          fullWidth
                        />
                        <TextField
                          label="제목"
                          size="small"
                          value={draft.title}
                          disabled={saving}
                          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                          fullWidth
                        />
                        <TextField
                          label="Markdown"
                          value={draft.markdown}
                          disabled={saving}
                          onChange={(event) => setDraft((current) => ({ ...current, markdown: event.target.value }))}
                          multiline
                          minRows={18}
                          fullWidth
                        />
                      </Stack>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Paper variant="outlined" sx={{ p: 2, minHeight: 360, bgcolor: "background.default" }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                          Preview
                        </Typography>
                        <WikiPreview html={page?.sanitizedHtml} />
                      </Paper>
                    </Grid>
                  </Grid>
                ) : (
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: "background.default" }}>
                    <WikiPreview html={page?.sanitizedHtml} />
                  </Paper>
                )}
              </Stack>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.25}>
              <Stack direction="row" spacing={1} alignItems="center">
                <HistoryOutlined fontSize="small" />
                <Typography variant="subtitle1">Revisions</Typography>
              </Stack>
              {sortedRevisions.length === 0 ? (
                <Typography color="text.secondary">표시할 revision이 없습니다.</Typography>
              ) : (
                <Stack spacing={0.75}>
                  {sortedRevisions.map((revision) => (
                    <Stack
                      key={revision.revisionId}
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                        <Chip size="small" label={`r${revision.revisionNo ?? revision.revisionId}`} />
                        <Typography variant="body2">{revision.title}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {revision.createdAt ?? ""}
                        </Typography>
                      </Stack>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<RestoreOutlined />}
                        disabled={archived || saving || !page || revision.revisionId === page.currentRevisionId}
                        onClick={() => void handleRevert(revision)}
                      >
                        되돌리기
                      </Button>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Stack>
          </Paper>
        </Stack>
      </Grid>
    </Grid>
  );
}
