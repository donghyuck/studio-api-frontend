import { useEffect, useMemo, useRef, useState } from "react";
import type { Config, Data, Layout, PlotMouseEvent } from "plotly.js";
import { useTheme } from "@mui/material";
import type { ProjectionPoint, SearchResultPoint } from "@/types/studio/ai";

const TARGET_STYLE: Record<string, { color: string; symbol: string }> = {
  NCS_UNIT: { color: "#7C3AED", symbol: "diamond" },
  COURSE: { color: "#2563EB", symbol: "square" },
  COURSE_CHUNK: { color: "#059669", symbol: "circle" },
  DOCUMENT: { color: "#D97706", symbol: "triangle-up" },
  DOCUMENT_CHUNK: { color: "#E11D48", symbol: "circle" },
  QUERY: { color: "#111827", symbol: "star" },
};

type PlotElement = HTMLDivElement & {
  on?: (eventName: "plotly_click", listener: (event: PlotMouseEvent) => void) => void;
  removeAllListeners?: (eventName: "plotly_click") => void;
};
type PlotlyStatic = typeof import("plotly.js-dist-min")["default"];

export function targetStyle(targetType?: string) {
  return TARGET_STYLE[targetType ?? ""] ?? { color: "#6B7280", symbol: "circle" };
}

function hoverText(point: ProjectionPoint | SearchResultPoint) {
  return [
    `<b>${point.label || point.vectorItemId}</b>`,
    `objectType: ${point.targetType || "-"}`,
    `sourceId: ${point.sourceId || "-"}`,
    "clusterId" in point ? `clusterId: ${point.clusterId || "-"}` : "",
    "similarity" in point && point.similarity != null ? `similarity: ${point.similarity.toFixed(4)}` : "",
  ]
    .filter(Boolean)
    .join("<br>");
}

interface Props {
  points: ProjectionPoint[];
  searchResults: SearchResultPoint[];
  queryPoint?: { label?: string | null; x?: number | null; y?: number | null } | null;
  selectedVectorItemId?: string | null;
  selectedPoint?: ProjectionPoint | SearchResultPoint | null;
  activeTargetTypes?: string[];
  showHeatmap?: boolean;
  showSearchTrajectory?: boolean;
  hideLowSimilarity?: boolean;
  minSimilarity?: number | null;
  onSelectPoint: (vectorItemId: string) => void;
}

export function VectorScatterMap({
  points,
  searchResults,
  queryPoint,
  selectedVectorItemId,
  selectedPoint,
  activeTargetTypes,
  showHeatmap,
  showSearchTrajectory,
  hideLowSimilarity,
  minSimilarity,
  onSelectPoint,
}: Props) {
  const theme = useTheme();
  const plotRef = useRef<HTMLDivElement | null>(null);
  const plotlyRef = useRef<PlotlyStatic | null>(null);
  const [plotlyReady, setPlotlyReady] = useState(false);
  const activeTargetTypeSet = useMemo(() => new Set(activeTargetTypes ?? []), [activeTargetTypes]);

  useEffect(() => {
    let ignored = false;
    void import("plotly.js-dist-min").then((module) => {
      if (!ignored) {
        plotlyRef.current = module.default;
        setPlotlyReady(true);
      }
    });
    return () => {
      ignored = true;
    };
  }, []);

  const baseTraces = useMemo<Data[]>(() => {
    const grouped = points.reduce<Record<string, ProjectionPoint[]>>((acc, point) => {
      const key = point.targetType || "UNKNOWN";
      acc[key] = acc[key] ?? [];
      acc[key].push(point);
      return acc;
    }, {});

    const baseTraces = Object.entries(grouped).map(([targetType, rows]) => {
      const style = targetStyle(targetType);
      const isDimmed = activeTargetTypeSet.size > 0 && !activeTargetTypeSet.has(targetType);
      return {
        type: "scattergl",
        mode: "markers",
        name: targetType,
        x: rows.map((point) => point.x),
        y: rows.map((point) => point.y),
        text: rows.map(hoverText),
        hoverinfo: "text",
        customdata: rows.map((point) => point.vectorItemId),
        marker: {
          color: style.color,
          symbol: style.symbol,
          size: 7,
          opacity: isDimmed ? 0.16 : 0.78,
          line: {
            color: "#FFFFFF",
            width: 0.5,
          },
        },
      } satisfies Data;
    });
    return baseTraces;
  }, [activeTargetTypeSet, points]);

  const overlayTraces = useMemo<Data[]>(() => {
    const hasQueryPoint = queryPoint?.x != null && queryPoint.y != null;
    const similarityOpacity = (point: SearchResultPoint) => {
      if (minSimilarity == null || point.similarity == null || point.similarity >= minSimilarity) {
        return 0.95;
      }
      return hideLowSimilarity ? 0 : 0.18;
    };
    const visibleSearchResults = searchResults.filter((point) => !hideLowSimilarity || minSimilarity == null || point.similarity == null || point.similarity >= minSimilarity);
    const displayedSearchResults = hideLowSimilarity ? visibleSearchResults : searchResults;
    const searchOpacities = displayedSearchResults.map(similarityOpacity);
    const trajectoryTraces =
      showSearchTrajectory && hasQueryPoint && visibleSearchResults.length > 0
        ? visibleSearchResults.map((point, index) => ({
            type: "scattergl",
            mode: "lines",
            name: index === 0 ? "검색 궤적" : "검색 궤적",
            x: [queryPoint.x, point.x],
            y: [queryPoint.y, point.y],
            hoverinfo: "skip",
            line: {
              color: "rgba(245, 158, 11, 0.24)",
              width: Math.max(1, 4 - Math.min(index, 3) * 0.75),
            },
            showlegend: index === 0,
          } satisfies Data))
        : [];

    const heatmapTrace =
      showHeatmap && points.length > 0
        ? ([
            {
              type: "histogram2dcontour",
              name: "분포 밀도",
              x: points.map((point) => point.x),
              y: points.map((point) => point.y),
              contours: { coloring: "heatmap" },
              colorscale: [
                [0, "rgba(37, 99, 235, 0)"],
                [0.35, "rgba(37, 99, 235, 0.16)"],
                [1, "rgba(124, 58, 237, 0.32)"],
              ],
              line: { width: 0 },
              opacity: 0.75,
              showscale: false,
              hoverinfo: "skip",
            } satisfies Data,
          ] as Data[])
        : [];

    const resultTrace =
      displayedSearchResults.length > 0
        ? ([
            {
              type: "scattergl",
              mode: "markers",
              name: "Top-K 결과",
              x: displayedSearchResults.map((point) => point.x),
              y: displayedSearchResults.map((point) => point.y),
              text: displayedSearchResults.map(hoverText),
              hoverinfo: "text",
              customdata: displayedSearchResults.map((point) => point.vectorItemId),
              marker: {
                color: "rgba(245, 158, 11, 0.95)",
                symbol: "circle-open",
                size: 16,
                opacity: searchOpacities,
                line: { color: theme.palette.warning.dark, width: 2 },
              },
            } satisfies Data,
          ] as Data[])
        : [];

    const queryTrace =
      hasQueryPoint
        ? ([
            {
              type: "scattergl",
              mode: "markers",
              name: "QUERY",
              x: [queryPoint.x],
              y: [queryPoint.y],
              text: [`<b>${queryPoint.label || "검색어"}</b><br>objectType: QUERY`],
              hoverinfo: "text",
              customdata: [""],
              marker: {
                color: TARGET_STYLE.QUERY.color,
                symbol: TARGET_STYLE.QUERY.symbol,
                size: 18,
                line: { color: "#FFFFFF", width: 2 },
              },
            } satisfies Data,
          ] as Data[])
        : [];

    const selectedTrace =
      selectedPoint && selectedVectorItemId
        ? ([
            {
              type: "scattergl",
              mode: "markers",
              name: "선택 항목",
              x: [selectedPoint.x],
              y: [selectedPoint.y],
              text: [hoverText(selectedPoint)],
              hoverinfo: "text",
              customdata: [selectedPoint.vectorItemId],
              marker: {
                color: theme.palette.primary.dark,
                symbol: "circle",
                size: 18,
                line: { color: theme.palette.common.black, width: 2 },
              },
              showlegend: false,
            } satisfies Data,
          ] as Data[])
        : [];

    return [...heatmapTrace, ...trajectoryTraces, ...resultTrace, ...queryTrace, ...selectedTrace];
  }, [
    hideLowSimilarity,
    minSimilarity,
    points,
    queryPoint,
    searchResults,
    selectedPoint,
    selectedVectorItemId,
    showHeatmap,
    showSearchTrajectory,
    theme.palette.common.black,
    theme.palette.primary.dark,
    theme.palette.warning.dark,
  ]);

  const traces = useMemo(() => [...baseTraces, ...overlayTraces], [baseTraces, overlayTraces]);

  useEffect(() => {
    const plot = plotRef.current as PlotElement | null;
    const plotly = plotlyRef.current;
    if (!plot || !plotlyReady || !plotly) return;

    const layout: Partial<Layout> = {
      autosize: true,
      margin: { l: 32, r: 16, t: 16, b: 32 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "#FAFAFA",
      hovermode: "closest",
      dragmode: "pan",
      xaxis: {
        zeroline: false,
        showgrid: true,
        gridcolor: theme.palette.divider,
        title: { text: "" },
      },
      yaxis: {
        zeroline: false,
        showgrid: true,
        gridcolor: theme.palette.divider,
        title: { text: "" },
      },
      legend: {
        orientation: "h",
        x: 0,
        y: -0.18,
        font: { size: 11 },
      },
    };
    const config: Partial<Config> = {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ["lasso2d", "select2d"],
    };

    void plotly.react(plot, traces, layout, config).then(() => {
      plot.removeAllListeners?.("plotly_click");
      plot.on?.("plotly_click", (event) => {
        const vectorItemId = event.points?.[0]?.customdata;
        if (typeof vectorItemId === "string" && vectorItemId) {
          onSelectPoint(vectorItemId);
        }
      });
    });

    return () => {
      plot.removeAllListeners?.("plotly_click");
    };
  }, [onSelectPoint, plotlyReady, theme, traces]);

  useEffect(() => {
    const plot = plotRef.current;
    const plotly = plotlyRef.current;
    if (!plot || !plotlyReady || !plotly) return;
    let frame = 0;
    const resizeObserver = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        void plotly.Plots.resize(plot);
      });
    });
    resizeObserver.observe(plot);
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [plotlyReady]);

  useEffect(() => () => {
    const plotly = plotlyRef.current;
    if (plotRef.current && plotly) {
      plotly.purge(plotRef.current);
    }
  }, []);

  return <div ref={plotRef} style={{ width: "100%", height: "100%", minHeight: 460 }} />;
}
