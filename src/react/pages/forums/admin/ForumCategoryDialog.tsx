import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { DeleteOutlined, RefreshOutlined } from "@mui/icons-material";
import { useConfirm, useToast } from "@/react/feedback";
import { reactForumsAdminApi } from "@/react/pages/forums/admin/api";
import type { CategoryResponse } from "@/types/studio/forums";
import { resolveAxiosError } from "@/utils/helpers";

interface Props {
  open: boolean;
  forumSlug: string;
  onClose: () => void;
}

export function ForumCategoryDialog({ open, forumSlug, onClose }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [position, setPosition] = useState("1");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const nextPosition = useMemo(
    () => Math.max(1, ...categories.map((item) => item.position || 0)) + 1,
    [categories]
  );

  async function loadCategories() {
    if (!forumSlug) {
      return;
    }

    setLoading(true);
    try {
      const data = await reactForumsAdminApi.listCategories(forumSlug);
      setCategories(data);
      setPosition(String(Math.max(1, ...data.map((item) => item.position || 0)) + 1));
    } catch (error) {
      toast.error(resolveAxiosError(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    setName("");
    setDescription("");
    setPosition(String(nextPosition));
    void loadCategories();
  }, [nextPosition, open]);

  async function handleCreate() {
    const parsedPosition = Number(position);
    if (!name.trim() || !Number.isFinite(parsedPosition) || parsedPosition < 1) {
      return;
    }

    setSaving(true);
    try {
      await reactForumsAdminApi.createCategory(forumSlug, {
        name: name.trim(),
        description: description.trim() || undefined,
        position: parsedPosition,
      });
      toast.success("카테고리가 추가되었습니다.");
      setName("");
      setDescription("");
      await loadCategories();
    } catch (error) {
      toast.error(resolveAxiosError(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(category: CategoryResponse) {
    const ok = await confirm({
      title: "카테고리 삭제",
      message: `"${category.name}" 카테고리를 삭제하시겠습니까?`,
      okText: "삭제",
      cancelText: "취소",
    });
    if (!ok) {
      return;
    }

    setSaving(true);
    try {
      await reactForumsAdminApi.deleteCategory(forumSlug, category.id);
      toast.success("카테고리가 삭제되었습니다.");
      await loadCategories();
    } catch (error) {
      toast.error(resolveAxiosError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>카테고리 관리</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={1}>
            <TextField
              label="이름"
              value={name}
              onChange={(event) => setName(event.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="설명"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="순서"
              value={position}
              onChange={(event) => setPosition(event.target.value)}
              type="number"
              size="small"
              sx={{ width: 120 }}
            />
            <Button variant="contained" onClick={handleCreate} disabled={saving || !name.trim()}>
              추가
            </Button>
          </Stack>

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2">카테고리 목록</Typography>
            <IconButton onClick={() => void loadCategories()} disabled={loading || saving}>
              <RefreshOutlined />
            </IconButton>
          </Stack>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>이름</TableCell>
                <TableCell>설명</TableCell>
                <TableCell>순서</TableCell>
                <TableCell align="right">작업</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    {loading ? "불러오는 중..." : "카테고리가 없습니다."}
                  </TableCell>
                </TableRow>
              ) : (
                categories.map((category) => (
                  <TableRow key={category.id} hover>
                    <TableCell>{category.id}</TableCell>
                    <TableCell>{category.name}</TableCell>
                    <TableCell>{category.description || "-"}</TableCell>
                    <TableCell>{category.position}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => void handleDelete(category)}
                        disabled={saving}
                      >
                        <DeleteOutlined fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          닫기
        </Button>
      </DialogActions>
    </Dialog>
  );
}
