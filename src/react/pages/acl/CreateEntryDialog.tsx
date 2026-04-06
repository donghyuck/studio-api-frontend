import { useState } from "react";
import {
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
import type {
  AclActionMaskDto,
} from "@/types/studio/ai";
import type { AclClassDto, AclObjectIdentityDto, AclSidDto } from "@/types/studio/acl";
import { reactAclApi } from "./api";

interface Props {
  open: boolean;
  onClose: () => void;
  classes: AclClassDto[];
  sids: AclSidDto[];
  objects: AclObjectIdentityDto[];
  actions: AclActionMaskDto[];
  onCreated: () => void;
}

export function CreateEntryDialog({
  open,
  onClose,
  classes: _classes,
  sids,
  objects,
  actions,
  onCreated,
}: Props) {
  const toast = useToast();
  const [objectIdentityId, setObjectIdentityId] = useState("");
  const [sidId, setSidId] = useState("");
  const [mask, setMask] = useState("");
  const [granting, setGranting] = useState(true);
  const [aceOrder, setAceOrder] = useState("0");
  const [auditSuccess, setAuditSuccess] = useState(false);
  const [auditFailure, setAuditFailure] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!objectIdentityId || !sidId || !mask) return;

    setLoading(true);
    try {
      await reactAclApi.createEntry({
        objectIdentityId: Number(objectIdentityId),
        sidId: Number(sidId),
        mask: Number(mask),
        granting,
        aceOrder: Number(aceOrder),
        auditSuccess,
        auditFailure,
      });
      toast.success("ACL 엔트리가 생성되었습니다.");
      setObjectIdentityId("");
      setSidId("");
      setMask("");
      setGranting(true);
      setAceOrder("0");
      setAuditSuccess(false);
      setAuditFailure(false);
      onCreated();
      onClose();
    } catch {
      toast.error("ACL 엔트리 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>ACL 엔트리 생성</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            label="오브젝트 아이덴티티"
            size="small"
            fullWidth
            value={objectIdentityId}
            onChange={(event) => setObjectIdentityId(event.target.value)}
            required
          >
            {objects.map((objectIdentity) => (
              <MenuItem key={objectIdentity.id} value={objectIdentity.id}>
                {objectIdentity.className}#{String(objectIdentity.objectIdIdentity)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="SID"
            size="small"
            fullWidth
            value={sidId}
            onChange={(event) => setSidId(event.target.value)}
            required
          >
            {sids.map((sid) => (
              <MenuItem key={sid.id} value={sid.id}>
                {sid.sid}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="액션 마스크"
            size="small"
            fullWidth
            value={mask}
            onChange={(event) => setMask(event.target.value)}
            required
          >
            {actions.map((action) => (
              <MenuItem key={action.mask} value={action.mask}>
                {action.action} ({action.mask})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="ACE 순서"
            size="small"
            fullWidth
            type="number"
            value={aceOrder}
            onChange={(event) => setAceOrder(event.target.value)}
          />
          <FormControlLabel
            control={
              <Switch
                checked={granting}
                onChange={(event) => setGranting(event.target.checked)}
              />
            }
            label={granting ? "허용" : "거부"}
          />
          <FormControlLabel
            control={
              <Switch
                checked={auditSuccess}
                onChange={(event) => setAuditSuccess(event.target.checked)}
              />
            }
            label="성공 시 감사"
          />
          <FormControlLabel
            control={
              <Switch
                checked={auditFailure}
                onChange={(event) => setAuditFailure(event.target.checked)}
              />
            }
            label="실패 시 감사"
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
          disabled={loading || !objectIdentityId || !sidId || !mask}
        >
          {loading ? <CircularProgress size={20} /> : "생성"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
