import { useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  Stack,
  TextField,
} from "@mui/material";
import { SearchOutlined } from "@mui/icons-material";
import type { ColDef } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { LoginFailuresDataSource } from "@/react/pages/audit/LoginFailuresDataSource";
import type { LoginFailureEvent } from "@/react/pages/audit/loginFailuresApi";
import { PageToolbar } from "@/react/components/page/PageToolbar";

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPresetRange(days: number) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  return {
    start: formatDateInputValue(start),
    end: formatDateInputValue(end),
  };
}

function getSixMonthsRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    start: formatDateInputValue(start),
    end: formatDateInputValue(end),
  };
}

function getThisMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: formatDateInputValue(start),
    end: formatDateInputValue(end),
  };
}

function startOfDayLocalToIso(dateStr: string) {
  const [y = 0, m = 1, d = 1] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

function endOfDayExclusiveLocalToIso(dateStr: string) {
  const [y = 0, m = 1, d = 1] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d + 1, 0, 0, 0, 0).toISOString();
}

function buildLoginFailureFilter(
  dateStart: string,
  dateEnd: string,
  usernameLike: string,
) {
  const filter: Record<string, string> = {};
  if (dateStart) {
    filter.from = startOfDayLocalToIso(dateStart);
  }
  if (dateEnd) {
    filter.to = endOfDayExclusiveLocalToIso(dateEnd);
  }
  if (usernameLike.trim()) {
    filter.usernameLike = usernameLike.trim();
  }
  return filter;
}

export function LoginFailureLogPage() {
  const gridRef = useRef<PageableGridContentHandle<LoginFailureEvent>>(null);
  const [searching, setSearching] = useState(false);
  const initialRange = useMemo(() => getPresetRange(7), []);
  const dataSource = useMemo(() => {
    const nextDataSource = new LoginFailuresDataSource(setSearching);
    nextDataSource.applyFilter(
      buildLoginFailureFilter(initialRange.start, initialRange.end, ""),
    );
    return nextDataSource;
  }, [initialRange.end, initialRange.start]);
  const [dateStart, setDateStart] = useState(initialRange.start);
  const [dateEnd, setDateEnd] = useState(initialRange.end);
  const [usernameLike, setUsernameLike] = useState("");

  const columnDefs = useMemo<ColDef<LoginFailureEvent>[]>(
    () => [
      {
        field: "id",
        headerName: "ID",
        sortable: true,
        flex: 0.5,
        filter: false,
      },
      {
        field: "username",
        headerName: "사용자명",
        sortable: true,
        flex: 1,
        filter: false,
      },
      {
        field: "remoteIp",
        headerName: "IP 주소",
        sortable: true,
        flex: 1,
        filter: false,
      },
      {
        field: "failureType",
        headerName: "예외 유형",
        sortable: true,
        flex: 1.25,
        filter: false,
      },
      {
        field: "message",
        headerName: "메시지",
        sortable: true,
        flex: 1.75,
        filter: false,
      },
      {
        field: "userAgent",
        headerName: "User-Agent",
        sortable: true,
        flex: 2.5,
        filter: false,
      },
      {
        field: "occurredAt",
        headerName: "시각",
        sortable: true,
        flex: 1.5,
        filter: false,
        valueFormatter: (params) =>
          params.value ? new Date(params.value).toLocaleString() : "",
      },
    ],
    [],
  );

  const handleRefresh = () => {
    gridRef.current?.refresh();
  };

  function setPreset(days: number) {
    const range = getPresetRange(days);
    setDateStart(range.start);
    setDateEnd(range.end);
  }

  function setToday() {
    setPreset(1);
  }

  function set7days() {
    setPreset(7);
  }

  function set30days() {
    setPreset(30);
  }

  function set6Months() {
    const range = getSixMonthsRange();
    setDateStart(range.start);
    setDateEnd(range.end);
  }

  function setThisMonth() {
    const range = getThisMonthRange();
    setDateStart(range.start);
    setDateEnd(range.end);
  }

  const validRange = !dateStart || !dateEnd || dateStart <= dateEnd;

  const handleSearch = () => {
    if (!validRange) {
      return;
    }

    dataSource.applyFilter(
      buildLoginFailureFilter(dateStart, dateEnd, usernameLike),
    );
    gridRef.current?.refresh();
  };

  return (
    <Stack spacing={0.5}>
      <PageToolbar
        breadcrumbs={["시스템관리", "감사", "로그인 실패"]}
        label="로그인 실패 이력을 기간과 아이디 조건으로 조회합니다."
        onRefresh={handleRefresh}
        divider={false}
      />

      <Stack spacing={1}>
        <Box
          sx={{
            border: 1,
            borderColor: "rgb(191 191 191)",
            borderRadius: 2,
            px: 1.5,
            py: 1.5,
          }}
        >
          <Stack spacing={1}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
              <TextField
                label="시작일(포함)"
                type="date"
                size="small"
                value={dateStart}
                onChange={(event) => setDateStart(event.target.value)}
                InputLabelProps={{ shrink: true }}
                error={!validRange}
                fullWidth
              />
              <TextField
                label="종료일(포함)"
                type="date"
                size="small"
                value={dateEnd}
                onChange={(event) => setDateEnd(event.target.value)}
                InputLabelProps={{ shrink: true }}
                error={!validRange}
                helperText={
                  !validRange
                    ? "시작일이 종료일보다 늦을 수 없습니다."
                    : undefined
                }
                fullWidth
              />
              <TextField
                label="아이디"
                size="small"
                value={usernameLike}
                onChange={(event) => setUsernameLike(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleSearch();
                  }
                }}
                fullWidth
              />
            </Stack>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 1,
              }}
            >
              <ButtonGroup size="small" variant="text">
                <Button onClick={setToday}>오늘</Button>
                <Button onClick={set7days}>7일</Button>
                <Button onClick={set30days}>30일</Button>
                <Button onClick={set6Months}>6개월</Button>
                <Button onClick={setThisMonth}>이번달</Button>
              </ButtonGroup>
              <Button
                variant="outlined"
                startIcon={
                  searching ? (
                    <CircularProgress size={16} />
                  ) : (
                    <SearchOutlined />
                  )
                }
                onClick={handleSearch}
                disabled={!validRange || searching}
              >
                {searching ? "조회 중..." : "조회"}
              </Button>
            </Box>
          </Stack>
        </Box>
      </Stack>

      <PageableGridContent<LoginFailureEvent>
        ref={gridRef}
        datasource={dataSource}
        columns={columnDefs}
      />
    </Stack>
  );
}
