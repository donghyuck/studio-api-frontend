import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Uppy from "@uppy/core";
import Dashboard from "@uppy/dashboard";
import XHRUpload from "@uppy/xhr-upload";
import Korean from "@uppy/locales/lib/ko_KR";
import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";
import { API_BASE_URL } from "@/config/backend";
import { authStore } from "@/react/auth/store";
import { reactObjectTypeApi } from "@/react/pages/objecttype/api";
import type { ObjectTypeDto, ObjectTypePolicyDto } from "@/types/studio/objecttype";
import { resolveAxiosError } from "@/utils/helpers";

interface Props {
  open: boolean;
  initialObjectType?: number | null;
  initialObjectId?: number | null;
  onClose: () => void;
  onUploaded: () => Promise<void> | void;
}

export function FileUploadDialog({
  open,
  initialObjectType = null,
  initialObjectId = null,
  onClose,
  onUploaded,
}: Props) {
  const uppyContainerRef = useRef<HTMLDivElement | null>(null);
  const uppyRef = useRef<Uppy | null>(null);
  const objectTypeRef = useRef("");
  const objectIdRef = useRef("");
  const [uppyContainer, setUppyContainer] = useState<HTMLDivElement | null>(null);
  const [objectType, setObjectType] = useState<string>(
    initialObjectType == null ? "" : String(initialObjectType)
  );
  const [objectId, setObjectId] = useState<string>(
    initialObjectId == null ? "" : String(initialObjectId)
  );
  const [objectTypes, setObjectTypes] = useState<ObjectTypeDto[]>([]);
  const [policy, setPolicy] = useState<ObjectTypePolicyDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  function destroyUppy() {
    uppyRef.current?.destroy();
    uppyRef.current = null;
  }

  function reset(nextObjectType = initialObjectType, nextObjectId = initialObjectId) {
    const nextType = nextObjectType == null ? "" : String(nextObjectType);
    const nextId = nextObjectId == null ? "" : String(nextObjectId);
    setObjectType(nextType);
    setObjectId(nextId);
    setPolicy(null);
    setError(null);
    objectTypeRef.current = nextType;
    objectIdRef.current = nextId;
  }

  function handleClose() {
    destroyUppy();
    reset();
    onClose();
  }

  const handleUppyContainerRef = useCallback((element: HTMLDivElement | null) => {
    uppyContainerRef.current = element;
    setUppyContainer(element);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    reactObjectTypeApi
      .list({ status: "ACTIVE" })
      .then((items) => setObjectTypes(items))
      .catch((loadError) => setError(resolveAxiosError(loadError)));
  }, [open]);

  useEffect(() => {
    if (!open || objectType === "") {
      setPolicy(null);
      return;
    }

    let ignored = false;
    reactObjectTypeApi
      .getPolicy(Number(objectType))
      .then((nextPolicy) => {
        if (!ignored) {
          setPolicy(nextPolicy);
        }
      })
      .catch(() => {
        if (!ignored) {
          setPolicy(null);
        }
      });

    return () => {
      ignored = true;
    };
  }, [open, objectType]);

  useEffect(() => {
    if (!open || !uppyContainer || uppyRef.current) {
      return;
    }

    reset(initialObjectType, initialObjectId);

    const uppy = new Uppy({
      autoProceed: false,
      locale: Korean,
      restrictions: {
        maxFileSize: 50 * 1024 * 1024,
        maxNumberOfFiles: 1,
      },
      onBeforeUpload: () => {
        if (objectTypeRef.current === "" || objectIdRef.current === "") {
          setError("등록된 객체 유형과 객체 식별자를 입력해야 업로드할 수 있습니다.");
          return false;
        }
        return true;
      },
    });

    uppy.use(Dashboard, {
      inline: true,
      target: uppyContainer,
      height: 300,
      proudlyDisplayPoweredByUppy: false,
    });

    uppy.use(XHRUpload, {
      method: "POST",
      formData: true,
      fieldName: "file",
      endpoint: `${API_BASE_URL}/api/mgmt/files`,
      headers: () => {
        const token = authStore.getState().token;
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
      withCredentials: true,
    });

    uppy.on("upload", () => {
      for (const file of uppy.getFiles()) {
        uppy.setFileMeta(file.id, {
          objectType: Number(objectTypeRef.current),
          objectId: Number(objectIdRef.current),
        });
      }
    });

    uppy.on("complete", (result) => {
      if (result.successful.length > 0) {
        void onUploaded();
      }
    });

    uppyRef.current = uppy;

    return () => {
      destroyUppy();
    };
  }, [open, uppyContainer, initialObjectId, initialObjectType, onUploaded]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
          },
        },
      }}
    >
      <DialogTitle>파일 업로드</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="객체 유형"
              size="small"
              select
              value={objectType}
              onChange={(event) => {
                setObjectType(event.target.value);
                objectTypeRef.current = event.target.value;
                setError(null);
              }}
              helperText="등록된 ACTIVE 객체 유형만 업로드할 수 있습니다."
              fullWidth
              SelectProps={{
                renderValue: (selected) => {
                  const selectedType = objectTypes.find(
                    (item) => String(item.objectType) === String(selected)
                  );
                  return selectedType
                    ? `${selectedType.code} #${selectedType.objectType}`
                    : "선택";
                },
              }}
            >
              <MenuItem value="">선택</MenuItem>
              {objectTypes.map((item) => (
                <MenuItem key={item.objectType} value={String(item.objectType)}>
                  <Stack spacing={0}>
                    <Typography variant="body2">
                      {item.code} #{item.objectType}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.name}
                    </Typography>
                  </Stack>
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="객체 식별자"
              type="number"
              size="small"
              value={objectId}
              onChange={(event) => {
                setObjectId(event.target.value);
                objectIdRef.current = event.target.value;
                setError(null);
              }}
              inputProps={{ min: 0 }}
              helperText="파일을 연결할 대상 객체의 ID입니다."
              fullWidth
            />
          </Stack>
          {policy ? (
            <Typography variant="caption" color="text.secondary">
              파일 정책: 최대 {policy.maxFileMb ?? "-"}MB
              {policy.allowedExt ? ` · 확장자 ${policy.allowedExt}` : ""}
              {policy.allowedMime ? ` · MIME ${policy.allowedMime}` : ""}
            </Typography>
          ) : objectType ? (
            <Typography variant="caption" color="text.secondary">
              선택한 객체 유형에는 별도 파일 정책이 없습니다.
            </Typography>
          ) : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Box
            ref={handleUppyContainerRef}
            className="file-upload-uppy"
            sx={{
              "& .uppy-Dashboard-AddFiles-title": { fontSize: 14 },
              "& .uppy-Dashboard-AddFiles-info": { fontSize: 12 },
              "& .uppy-Dashboard-note": { fontSize: 12 },
              "& .uppy-DashboardContent-title": { fontSize: 14 },
              "& .uppy-Dashboard-Item-name": { fontSize: 12 },
              "& .uppy-Dashboard-Item-status": { fontSize: 11 },
              "& .uppy-DashboardContent-back, & .uppy-DashboardContent-addMore": { fontSize: 12 },
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={handleClose}>
          취소
        </Button>
      </DialogActions>
    </Dialog>
  );
}
