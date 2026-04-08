import { useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from "@mui/material";
import { useToast } from "@/react/feedback";
import type { AclClassDto, AclSidDto } from "@/types/studio/acl";
import { reactAclApi } from "./api";

interface Props {
  open: boolean;
  onClose: () => void;
  classes: AclClassDto[];
  sids: AclSidDto[];
  onCreated: () => void;
}

export function CreateObjectDialog({
  open,
  onClose,
  classes,
  sids,
  onCreated,
}: Props) {
  const toast = useToast();
  const [classId, setClassId] = useState("");
  const [objectIdIdentity, setObjectIdIdentity] = useState("");
  const [ownerSidId, setOwnerSidId] = useState("");
  const [entriesInheriting, setEntriesInheriting] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!classId || !objectIdIdentity.trim()) return;

    setLoading(true);
    try {
      await reactAclApi.createObject({
        classId: Number(classId),
        objectIdIdentity: objectIdIdentity.trim(),
        ownerSidId: ownerSidId ? Number(ownerSidId) : null,
        entriesInheriting,
      });
      toast.success("오브젝트 아이덴티티가 생성되었습니다.");
      setClassId("");
      setObjectIdIdentity("");
      setOwnerSidId("");
      setEntriesInheriting(false);
      onCreated();
      onClose();
    } catch {
      toast.error("오브젝트 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>오브젝트 아이덴티티 생성</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="info">
            종류(도메인 또는 클래스)에 해당하는 객체를 정의합니다. 전체를 표현하려면 대상 ID 값으로
            `__root__`를 입력하세요.
          </Alert>
          <TextField
            select
            label="ACL 클래스"
            size="small"
            fullWidth
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
            required
          >
            {classes.map((aclClass) => (
              <MenuItem key={aclClass.id} value={aclClass.id}>
                {aclClass.className}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="오브젝트 ID"
            size="small"
            fullWidth
            value={objectIdIdentity}
            onChange={(event) => setObjectIdIdentity(event.target.value)}
            helperText="숫자 또는 __root__"
            required
          />
          <TextField
            select
            label="Owner SID"
            size="small"
            fullWidth
            value={ownerSidId}
            onChange={(event) => setOwnerSidId(event.target.value)}
          >
            <MenuItem value="">없음</MenuItem>
            {sids.map((sid) => (
              <MenuItem key={sid.id} value={sid.id}>
                {sid.sid}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            control={
              <Switch
                checked={entriesInheriting}
                onChange={(event) => setEntriesInheriting(event.target.checked)}
              />
            }
            label="상위 ACL에서 권한 상속"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          취소
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleCreate()}
          disabled={loading || !classId || !objectIdIdentity.trim()}
        >
          {loading ? <CircularProgress size={20} /> : "생성"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
