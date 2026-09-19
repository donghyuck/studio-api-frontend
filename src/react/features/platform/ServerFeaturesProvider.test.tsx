// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { apiRequest } from "@/react/query/fetcher";
import { ServerFeatureGate, ServerFeaturesProvider } from "./ServerFeaturesProvider";
import { supportsRoute } from "./serverFeatures";

vi.mock("@/react/query/fetcher", () => ({ apiRequest: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("server feature composition", () => {
  it("does not mount a removed feature or issue its requests", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ contractVersion: "1", features: { team: true } });
    const mount = vi.fn();
    function AiPage() { mount(); return <div>AI content</div>; }
    render(<ServerFeaturesProvider><ServerFeatureGate path="/services/ai/chat"><AiPage /></ServerFeatureGate></ServerFeaturesProvider>);
    expect(await screen.findByText("이 서버에서는 해당 기능을 제공하지 않습니다.")).toBeTruthy();
    expect(mount).not.toHaveBeenCalled();
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  it("mounts only after an advertised feature is confirmed", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ contractVersion: "1", features: { team: true } });
    render(<ServerFeaturesProvider><ServerFeatureGate path="/admin/teams/1"><div>Team content</div></ServerFeatureGate></ServerFeaturesProvider>);
    expect(await screen.findByText("Team content")).toBeTruthy();
  });

  it("blocks feature probing on incompatible or failed capability responses", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ contractVersion: "2", features: {} });
    render(<ServerFeaturesProvider><div>hidden content</div></ServerFeaturesProvider>);
    expect(await screen.findByText(/서버에서 사용 가능한 기능을 확인하지 못했습니다/)).toBeTruthy();
    expect(screen.queryByText("hidden content")).toBeNull();
  });

  it("uses distinct route keys for chat, RAG jobs and vectors", () => {
    expect(supportsRoute("/services/ai/rag-chat", { "ai-chat": true })).toBe(true);
    expect(supportsRoute("/services/ai/rag/jobs/1", { "ai-chat": true })).toBe(false);
    expect(supportsRoute("/services/ai/vector-visualization", { "ai-vector": false })).toBe(false);
    expect(supportsRoute("/services/ai/vector-visualization", { "ai-vector": true })).toBe(false);
    expect(supportsRoute("/services/ai/vector-visualization", { "ai-vector-visualization": true })).toBe(true);
    expect(supportsRoute("/services/ai/rag-visualization", { "ai-vector-visualization": false })).toBe(false);
  });
});
