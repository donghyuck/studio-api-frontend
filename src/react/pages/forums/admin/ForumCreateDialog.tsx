import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from "@mui/material";
import { useConfirm, useToast } from "@/react/feedback";
import { reactForumsAdminApi } from "@/react/pages/forums/admin/api";
import { FORUM_TYPE_HINTS, FORUM_TYPES, type ForumType } from "@/types/studio/forums";
import { resolveAxiosError } from "@/utils/helpers";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (slug: string) => void;
}

const VIEW_TYPES = ["GENERAL", "GALLERY", "VIDEO", "LIBRARY", "NOTICE"];

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function ForumCreateDialog({ open, onClose, onCreated }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [viewType, setViewType] = useState("GENERAL");
  const [type, setType] = useState<ForumType>("COMMON");
  const [createDefaultCategories, setCreateDefaultCategories] = useState(true);
  const [loading, setLoading] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setName("");
    setSlug("");
    setDescription("");
    setViewType("GENERAL");
    setType("COMMON");
    setCreateDefaultCategories(true);
    setLoading(false);
    setSlugTouched(false);
  }, [open]);

  const typeHint = useMemo(() => FORUM_TYPE_HINTS[type], [type]);
  const slugError =
    slug.trim().length === 0
      ? "슬러그를 입력하세요."
      : /^[a-z0-9-]{3,50}$/.test(slug) && !slug.startsWith("-") && !slug.endsWith("-")
        ? ""
        : "소문자/숫자/하이픈만 허용하며 3~50자여야 합니다.";

  const canSubmit = name.trim().length > 0 && slugError.length === 0;

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    const ok = await confirm({
      title: "게시판 생성",
      message: `"${name.trim()}" 게시판을 생성하시겠습니까?`,
      okText: "생성",
      cancelText: "취소",
    });
    if (!ok) {
      return;
    }

    setLoading(true);
    try {
      const normalizedSlug = slug.trim();
      await reactForumsAdminApi.createForum({
        slug: normalizedSlug,
        name: name.trim(),
        description: description.trim() || undefined,
        viewType: viewType || undefined,
        type,
      });

      if (createDefaultCategories) {
        const defaults = [
          { name: "공지", description: "공지 사항", position: 1 },
          { name: "자유", description: "자유 게시판", position: 2 },
          { name: "질문", description: "질문/답변", position: 3 },
          { name: "자료", description: "자료 공유", position: 4 },
        ];
        for (const item of defaults) {
          await reactForumsAdminApi.createCategory(normalizedSlug, item);
        }
      }

      toast.success("게시판이 생성되었습니다.");
      onCreated(normalizedSlug);
    } catch (error) {
      toast.error(resolveAxiosError(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>새 게시판</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="게시판 이름"
            value={name}
            onChange={(event) => {
              const nextName = event.target.value;
              setName(nextName);
              if (!slugTouched) {
                setSlug(slugify(nextName));
              }
            }}
            required
            fullWidth
            size="small"
          />
          <TextField
            label="슬러그"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(slugify(event.target.value));
            }}
            error={slug.length > 0 && slugError.length > 0}
            helperText={slugError || "소문자/숫자/하이픈(-)만 허용합니다."}
            required
            fullWidth
            size="small"
          />
          <TextField
            label="설명"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            fullWidth
            multiline
            minRows={3}
          />
          <FormControl fullWidth size="small">
            <InputLabel id="forum-create-view-type-label">보기 유형</InputLabel>
            <Select
              labelId="forum-create-view-type-label"
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
            <InputLabel id="forum-create-type-label">게시판 유형</InputLabel>
            <Select
              labelId="forum-create-type-label"
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
          <TextField
            label="유형 설명"
            value={typeHint}
            multiline
            minRows={2}
            InputProps={{ readOnly: true }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={createDefaultCategories}
                onChange={(event) => setCreateDefaultCategories(event.target.checked)}
              />
            }
            label="기본 카테고리(공지/자유/질문/자료) 자동 생성"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          취소
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading || !canSubmit}>
          생성
        </Button>
      </DialogActions>
    </Dialog>
  );
}
