import {
  Alert,
  Box,
  Button,
  Dialog,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { CloseOutlined } from "@mui/icons-material";
import type { IndexedWebCapabilitiesDto, IndexedWebSourceRefDto } from "@/types/studio/ai";
import type { WorkspaceRef } from "@/types/studio/workspace";
import { RagEvidenceSourcePicker } from "./RagEvidenceSourcePicker";

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceId?: number | null;
  workspaces?: WorkspaceRef[];
  onWorkspaceChange?: (workspaceId: number | null) => void;
  embeddingDeploymentId?: string | null;
  value: IndexedWebSourceRefDto[];
  maxSelectedSources?: number;
  capabilities?: IndexedWebCapabilitiesDto | null;
  capabilitiesLoading?: boolean;
  capabilitiesError?: string | null;
  disabled?: boolean;
  selectionOnly?: boolean;
  onChange: (value: IndexedWebSourceRefDto[]) => void;
};

export function RagEvidenceSourceDrawer({
  open,
  onClose,
  workspaceId,
  workspaces,
  onWorkspaceChange,
  embeddingDeploymentId,
  value,
  maxSelectedSources,
  capabilities,
  capabilitiesLoading = false,
  capabilitiesError = null,
  disabled = false,
  selectionOnly = false,
  onChange,
}: Props) {
  const isCapabilityDisabled = capabilities && capabilities.enabled === false;
  const showPicker = Boolean(!isCapabilityDisabled && workspaceId);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "16px",
          p: 3,
          maxHeight: "85vh",
        },
      }}
    >
      <Stack spacing={2.5} sx={{ height: "100%", overflowY: "auto" }}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {selectionOnly ? "추가 자료 선택" : "참고자료 관리"}
          </Typography>
          <IconButton size="small" onClick={onClose} aria-label="닫기">
            <CloseOutlined fontSize="small" />
          </IconButton>
        </Stack>

        {/* Capability / Workspace status alerts */}
        {capabilitiesLoading ? (
          <Alert severity="info">URL 자료 기능을 확인하고 있습니다</Alert>
        ) : null}

        {capabilitiesError ? (
          <Alert severity="error">
            URL 자료 기능 상태를 확인하지 못했습니다: {capabilitiesError}
          </Alert>
        ) : null}

        {capabilities && !capabilities.enabled ? (
          <Alert severity="warning">서버에서 URL 수집 기능이 비활성화되어 있습니다</Alert>
        ) : null}

        {/* Workspace Selector */}
        {selectionOnly ? (
          <Alert severity="info">
            URL 등록·수집·수정은 Team의 Workspace `외부 URL` 탭에서 관리합니다.
          </Alert>
        ) : null}

        {!selectionOnly && workspaces && workspaces.length > 0 && onWorkspaceChange ? (
          <TextField
            select
            label="웹 자료 workspace"
            size="small"
            value={workspaceId ?? ""}
            onChange={(event) => {
              const val = event.target.value;
              onWorkspaceChange(val ? Number(val) : null);
            }}
            disabled={disabled}
            fullWidth
          >
            {workspaces.map((workspace) => (
              <MenuItem key={workspace.id} value={workspace.id}>
                {workspace.name}
              </MenuItem>
            ))}
          </TextField>
        ) : null}

        {!workspaceId ? (
          <Alert severity="info">
            {selectionOnly
              ? "현재 문서가 속한 Workspace를 확인할 수 없어 추가 자료를 선택할 수 없습니다."
              : "자료를 저장할 workspace를 선택하세요"}
          </Alert>
        ) : null}

        {/* Picker */}
        {showPicker ? (
          <RagEvidenceSourcePicker
            workspaceId={workspaceId}
            embeddingDeploymentId={embeddingDeploymentId}
            capabilities={capabilities}
            value={value}
            maxSelectedSources={maxSelectedSources ?? capabilities?.maxSelectedSources ?? 10}
            disabled={disabled}
            selectionOnly={selectionOnly}
            onChange={onChange}
          />
        ) : null}

        <Box sx={{ flex: 1 }} />

        <Button variant="outlined" onClick={onClose} fullWidth>
          닫기
        </Button>
      </Stack>
    </Dialog>
  );
}
