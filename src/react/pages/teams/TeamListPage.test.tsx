// @vitest-environment jsdom

import { forwardRef, useImperativeHandle } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ColDef, RowClickedEvent, SortModelItem } from "ag-grid-community";
import type { TeamDto } from "@/types/studio/team";
import { TeamListPage } from "./TeamListPage";

const { navigate, list, gridRefresh, captured } = vi.hoisted(() => ({
  navigate: vi.fn(),
  list: vi.fn(),
  gridRefresh: vi.fn(),
  captured: {
    grid: null as unknown,
    toolbar: null as unknown,
  },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
}));

vi.mock("@/react/pages/teams/api", () => ({
  reactTeamApi: {
    list,
    create: vi.fn(),
  },
}));

vi.mock("@/react/feedback", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/react/components/page/PageToolbar", () => ({
  PageToolbar: (props: { onSearch?: (value: string) => void; onRefresh?: () => void }) => {
    captured.toolbar = props;
    return (
      <div>
        <button type="button" onClick={() => props.onSearch?.(" 검색어 ")}>검색</button>
        <button type="button" onClick={() => props.onRefresh?.()}>새로고침</button>
      </div>
    );
  },
}));

vi.mock("@/react/components/ag-grid", () => ({
  PageableGridContent: forwardRef(function MockPageableGridContent(
    props: {
      datasource: unknown;
      columns?: ColDef<TeamDto>[];
      onRowClicked?: (event: RowClickedEvent<TeamDto>) => void;
    },
    ref,
  ) {
    captured.grid = props;
    useImperativeHandle(ref, () => ({ refresh: gridRefresh }));
    return (
      <div data-testid="team-grid">
        {props.columns?.map((column) => <span key={column.colId ?? column.field}>{column.headerName}</span>)}
      </div>
    );
  }),
}));

type TeamGridProps = {
  datasource: {
    fetchForAgGrid: (params: {
      startRow: number;
      endRow: number;
      sortModel?: SortModelItem[];
    }) => Promise<{ rows: TeamDto[]; total: number }>;
  };
  onRowClicked: (event: RowClickedEvent<TeamDto>) => void;
};

const team: TeamDto = {
  teamId: 7,
  name: "검색 팀",
  slug: "search-team",
  visibility: "PRIVATE",
  joinPolicy: "INVITE_ONLY",
  status: "ACTIVE",
  ragEnabled: true,
  ragReplyMode: "MENTION",
};

describe("TeamListPage", () => {
  beforeEach(() => {
    navigate.mockReset();
    list.mockReset();
    gridRefresh.mockReset();
    captured.grid = null;
    captured.toolbar = null;
    list.mockResolvedValue({ content: [team], totalElements: 1 });
  });

  afterEach(() => cleanup());

  it("uses the shared pageable AG Grid with server paging and sorting", async () => {
    render(<TeamListPage />);

    expect(screen.getByTestId("team-grid")).toBeDefined();
    expect(screen.getByText("Team")).toBeDefined();
    expect(screen.getByText("자료")).toBeDefined();

    const grid = captured.grid as TeamGridProps;
    const result = await grid.datasource.fetchForAgGrid({
      startRow: 15,
      endRow: 30,
      sortModel: [{ colId: "status", sort: "desc" }],
    });

    expect(list).toHaveBeenCalledWith({ page: 1, size: 15, sort: "status,desc", q: undefined });
    expect(result).toEqual({ rows: [team], total: 1 });
  });

  it("applies search through the grid datasource and opens a clicked Team", async () => {
    render(<TeamListPage />);

    fireEvent.click(screen.getByRole("button", { name: "검색" }));
    expect(gridRefresh).toHaveBeenCalledTimes(1);

    const grid = captured.grid as TeamGridProps;
    await grid.datasource.fetchForAgGrid({ startRow: 0, endRow: 15 });
    expect(list).toHaveBeenCalledWith({ page: 0, size: 15, sort: "name,asc", q: "검색어" });

    grid.onRowClicked({ data: team } as RowClickedEvent<TeamDto>);
    expect(navigate).toHaveBeenCalledWith("/admin/teams/7");
  });
});
