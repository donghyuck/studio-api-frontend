import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  CategoryOutlined,
  GroupOutlined,
  RefreshOutlined,
  SaveOutlined,
  SecurityOutlined,
  SummarizeOutlined,
} from "@mui/icons-material";
import { useConfirm, useToast } from "@/react/feedback";
import {
  reactForumsAdminApi,
} from "@/react/pages/forums/admin/api";
import { ForumCategoryDialog } from "@/react/pages/forums/admin/ForumCategoryDialog";
import { ForumMembershipDialog } from "@/react/pages/forums/admin/ForumMembershipDialog";
import { FORUM_TYPES, FORUM_TYPE_HINTS, type ForumType } from "@/types/studio/forums";
import { resolveAxiosError } from "@/utils/helpers";

const VIEW_TYPES = ["GENERAL", "GALLERY", "VIDEO", "LIBRARY", "NOTICE"];

export function ForumSettingsPage() {
  const navigate = useNavigate();
  const { forumSlug = "" } = useParams();
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [viewType, setViewType] = useState("GENERAL");
  const [type, setType] = useState<ForumType>("COMMON");
  const [propertiesText, setPropertiesText] = useState("{}");
  const [etag, setEtag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [membershipOpen, setMembershipOpen] = useState(false);

  const forumTypeHint = useMemo(() => FORUM_TYPE_HINTS[type], [type]);

  async function loadForum() {
    if (!forumSlug) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await reactForumsAdminApi.getForum(forumSlug);
      setName(result.data.name ?? "");
      setSlug(result.data.slug ?? forumSlug);
      setDescription(result.data.description ?? "");
      setViewType(result.data.viewType ?? "GENERAL");
      setType((result.data.type ?? "COMMON") as ForumType);
      setPropertiesText(JSON.stringify(result.data.properties ?? {}, null, 2));
      setEtag(result.etag ?? null);
    } catch (loadError) {
      setError(resolveAxiosError(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadForum();
  }, [forumSlug]);

  async function handleSave() {
    if (!forumSlug || !etag) {
      toast.error("최신 정보를 다시 불러온 뒤 저장하세요.");
      return;
    }

    let properties: Record<string, string> | undefined;
    try {
      const parsed = JSON.parse(propertiesText || "{}") as Record<string, unknown>;
      properties = Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [key, String(value)])
      );
    } catch {
      toast.error("속성 JSON 형식이 올바르지 않습니다.");
      return;
    }

    const ok = await confirm({
      title: "설정 저장",
      message: `"${name.trim()}" 게시판 설정을 저장하시겠습니까?`,
      okText: "저장",
      cancelText: "취소",
    });
    if (!ok) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await reactForumsAdminApi.updateForumSettings(
        forumSlug,
        {
          name: name.trim(),
          description: description.trim() || undefined,
          viewType: viewType || undefined,
          type,
          properties,
        },
        etag
      );
      setEtag(result.etag ?? etag);
      setPropertiesText(JSON.stringify(result.data.properties ?? {}, null, 2));
      toast.success("설정이 저장되었습니다.");
    } catch (saveError) {
      const message = resolveAxiosError(saveError);
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Stack spacing={2}>
        <Breadcrumbs separator="›">
          <Typography
            color="text.secondary"
            sx={{ cursor: "pointer" }}
            onClick={() => navigate("/admin/forums")}
          >
            포럼
          </Typography>
          <Typography color="text.primary">{name || forumSlug}</Typography>
        </Breadcrumbs>

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h5">포럼 설정</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button
              variant="text"
              startIcon={<CategoryOutlined />}
              onClick={() => setCategoryOpen(true)}
            >
              카테고리
            </Button>
            <Button
              variant="text"
              startIcon={<GroupOutlined />}
              onClick={() => setMembershipOpen(true)}
            >
              멤버
            </Button>
            <Button
              variant="text"
              startIcon={<SecurityOutlined />}
              onClick={() => navigate(`/admin/forums/${forumSlug}/acl`)}
            >
              ACL
            </Button>
            <Button
              variant="text"
              startIcon={<SummarizeOutlined />}
              onClick={() => navigate(`/admin/forums/${forumSlug}/audit`)}
            >
              감사 로그
            </Button>
            <Button
              variant="text"
              startIcon={<RefreshOutlined />}
              onClick={() => void loadForum()}
            >
              새로고침
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveOutlined />}
              onClick={() => void handleSave()}
              disabled={saving}
            >
              저장
            </Button>
          </Stack>
        </Box>

        {error ? <Alert severity="error">{error}</Alert> : null}
        {!etag ? (
          <Alert severity="warning">
            ETag 정보를 받지 못했습니다. 최신 정보를 다시 불러온 후 저장을 시도하세요.
          </Alert>
        ) : null}

        <Stack spacing={2} sx={{ maxWidth: 720 }}>
          <TextField
            label="게시판 이름"
            value={name}
            onChange={(event) => setName(event.target.value)}
            size="small"
            fullWidth
          />
          <TextField label="슬러그" value={slug} size="small" fullWidth InputProps={{ readOnly: true }} />
          <FormControl fullWidth size="small">
            <InputLabel id="forum-settings-view-type-label">보기 유형</InputLabel>
            <Select
              labelId="forum-settings-view-type-label"
              value={viewType}
              label="보기 유형"
              onChange={(event) => setViewType(String(event.target.value))}
            >
              {VIEW_TYPES.map((item) => (
                <MenuItem key={item} value={item}>
                  {item}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel id="forum-settings-type-label">게시판 유형</InputLabel>
            <Select
              labelId="forum-settings-type-label"
              value={type}
              label="게시판 유형"
              onChange={(event) => setType(event.target.value as ForumType)}
            >
              {FORUM_TYPES.map((item) => (
                <MenuItem key={item} value={item}>
                  {item}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="유형 설명" value={forumTypeHint} multiline minRows={2} InputProps={{ readOnly: true }} />
          <TextField
            label="설명"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            multiline
            minRows={4}
            fullWidth
          />
          <TextField
            label="속성(JSON)"
            value={propertiesText}
            onChange={(event) => setPropertiesText(event.target.value)}
            multiline
            minRows={8}
            fullWidth
          />
        </Stack>
      </Stack>

      <ForumCategoryDialog
        open={categoryOpen}
        forumSlug={forumSlug}
        onClose={() => setCategoryOpen(false)}
      />
      <ForumMembershipDialog
        open={membershipOpen}
        forumSlug={forumSlug}
        onClose={() => setMembershipOpen(false)}
      />
    </>
  );
}
