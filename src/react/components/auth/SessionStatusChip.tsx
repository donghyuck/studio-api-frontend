import { useEffect, useMemo, useState } from "react";
import { Button, Chip, Stack, Tooltip } from "@mui/material";
import { RefreshOutlined } from "@mui/icons-material";
import { parseJwtExp } from "@/utils/jwt";
import { useToast } from "@/react/feedback";

function nowEpoch() {
  return Math.floor(Date.now() / 1000);
}

function formatHHMMSS(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(seconds / 3600);
  const mm = Math.floor((seconds % 3600) / 60);
  const ss = seconds % 60;
  return [hh, mm, ss].map((value) => String(value).padStart(2, "0")).join(":");
}

interface Props {
  token: string | null;
  refreshTokens: () => Promise<string>;
  graceSeconds?: number;
  warningSeconds?: number;
}

export function SessionStatusChip({
  token,
  refreshTokens,
  graceSeconds = 60,
  warningSeconds = 10 * 60,
}: Props) {
  const toast = useToast();
  const [now, setNow] = useState(nowEpoch);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(nowEpoch()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const exp = useMemo(() => parseJwtExp(token), [token]);
  const leftToExpiry = exp == null ? -Infinity : exp - now;
  const secondsToExpiry = Math.max(0, leftToExpiry);
  const expired = leftToExpiry <= 0;
  const graceLeft = exp == null ? 0 : Math.max(0, exp + graceSeconds - now);
  const inGrace = expired && graceLeft > 0;
  const expiringSoon = !expired && secondsToExpiry <= warningSeconds;

  const status = useMemo(() => {
    if (!token || !exp) {
      return {
        label: "세션 없음",
        color: "default" as const,
        tooltip: "로그인 세션을 찾을 수 없습니다.",
        canRefresh: false,
      };
    }

    if (inGrace) {
      return {
        label: `연장 가능 ${formatHHMMSS(graceLeft)}`,
        color: "warning" as const,
        tooltip: "세션이 만료되었지만 아직 갱신할 수 있습니다.",
        canRefresh: true,
      };
    }

    if (expired) {
      return {
        label: "세션 만료",
        color: "error" as const,
        tooltip: "세션이 만료되었습니다.",
        canRefresh: false,
      };
    }

    return {
      label: `세션 ${formatHHMMSS(secondsToExpiry)}`,
      color: expiringSoon ? ("warning" as const) : ("default" as const),
      tooltip: expiringSoon ? "세션 만료가 임박했습니다." : "세션 남은 시간",
      canRefresh: expiringSoon,
    };
  }, [expired, exp, expiringSoon, graceLeft, inGrace, secondsToExpiry, token]);

  async function handleRefresh() {
    if (!status.canRefresh || refreshing) {
      return;
    }

    setRefreshing(true);
    try {
      await refreshTokens();
      toast.success("세션을 연장했습니다.");
    } catch {
      toast.error("세션 연장에 실패했습니다.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Tooltip title={status.tooltip}>
        <Chip
          size="small"
          color={status.color}
          label={status.label}
          variant={status.color === "default" ? "outlined" : "filled"}
          sx={{
            height: 22,
            fontSize: 11,
            "& .MuiChip-label": {
              px: 0.9,
            },
          }}
        />
      </Tooltip>
      {status.canRefresh ? (
        <Button
          size="small"
          variant="text"
          startIcon={<RefreshOutlined fontSize="small" />}
          onClick={() => void handleRefresh()}
          disabled={refreshing}
          sx={{
            minWidth: 0,
            px: 0.75,
            fontSize: 11,
            lineHeight: 1.2,
            "& .MuiButton-startIcon": {
              mr: 0.4,
            },
          }}
        >
          연장
        </Button>
      ) : null}
    </Stack>
  );
}
