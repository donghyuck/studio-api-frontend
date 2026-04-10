import { useState } from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { useToast } from "@/react/feedback";
import { useAuthStore } from "@/react/auth/store";
import { reactObjectTypeApi } from "./api";
import type { ObjectTypeDto, ObjectTypeStatus } from "@/types/studio/objecttype";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (objectType: ObjectTypeDto) => void;
}

const statusOptions: Array<{ label: string; value: ObjectTypeStatus }> = [
  { label: "활성", value: "ACTIVE" },
  { label: "Deprecated", value: "DEPRECATED" },
  { label: "비활성", value: "DISABLED" },
];

export function CreateObjectTypeDialog({ open, onClose, onCreated }: Props) {
  const toast = useToast();
  const { user } = useAuthStore();
  const [objectType, setObjectType] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [status, setStatus] = useState<ObjectTypeStatus>("ACTIVE");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const trimmedCode = code.trim();
  const isCodeValid = /^[a-z][a-z0-9_-]{1,79}$/.test(trimmedCode);
  const objectTypeNumber = objectType.trim() === "" ? null : Number(objectType);
  const isObjectTypeValid =
    objectTypeNumber == null ||
    (Number.isInteger(objectTypeNumber) && objectTypeNumber >= 0);
  const canSubmit =
    !!user &&
    isObjectTypeValid &&
    isCodeValid &&
    !!name.trim() &&
    !!domain.trim();

  function resetForm() {
    setObjectType("");
    setCode("");
    setName("");
    setDomain("");
    setStatus("ACTIVE");
    setDescription("");
  }

  function handleClose() {
    if (saving) return;
    onClose();
  }

  async function handleCreate() {
    if (!user || !canSubmit) return;

    setSaving(true);
    try {
      const created = await reactObjectTypeApi.create({
        objectType: objectTypeNumber,
        code: trimmedCode,
        name: name.trim(),
        domain: domain.trim(),
        status,
        description: description.trim() || null,
        createdBy: user.username,
        createdById: user.userId,
        updatedBy: user.username,
        updatedById: user.userId,
      });
      toast.success("오브젝트 타입이 생성되었습니다.");
      resetForm();
      onCreated(created);
      onClose();
    } catch {
      toast.error("오브젝트 타입 생성에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <DialogTitle>오브젝트 타입 생성</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="객체 유형"
            size="small"
            fullWidth
            value={objectType}
            onChange={(event) => setObjectType(event.target.value)}
            type="number"
            helperText="비워두면 서버에서 새 ID를 할당합니다."
            error={!isObjectTypeValid}
          />
          <TextField
            label="코드"
            size="small"
            fullWidth
            value={code}
            onChange={(event) => setCode(event.target.value)}
            error={!!trimmedCode && !isCodeValid}
            helperText="소문자로 시작하고 소문자, 숫자, _, - 조합으로 2~80자 입력합니다."
            required
          />
          <TextField
            label="이름"
            size="small"
            fullWidth
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <TextField
            label="도메인"
            size="small"
            fullWidth
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            required
          />
          <TextField
            select
            label="상태"
            size="small"
            fullWidth
            value={status}
            onChange={(event) => setStatus(event.target.value as ObjectTypeStatus)}
            required
          >
            {statusOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="설명"
            size="small"
            fullWidth
            multiline
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={handleClose} disabled={saving}>
          취소
        </Button>
        <Button
          variant="outlined"
          onClick={() => void handleCreate()}
          disabled={saving || !canSubmit}
        >
          {saving ? <CircularProgress size={20} /> : "생성"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
