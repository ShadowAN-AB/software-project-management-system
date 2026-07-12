import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Clear the rate-limit bucket map that lives on globalThis in non-prod env.
function clearBuckets() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).__aiRateBuckets;
}

describe("lib/ai", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    clearBuckets();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── isAIEnabled ─────────────────────────────────────────────────

  describe("isAIEnabled", () => {
    it("returns false when GITHUB_MODELS_TOKEN is missing", async () => {
      vi.stubEnv("GITHUB_MODELS_TOKEN", "");
      const { isAIEnabled } = await import("@/lib/ai");
      expect(isAIEnabled()).toBe(false);
    });

    it("returns true when token is set", async () => {
      vi.stubEnv("GITHUB_MODELS_TOKEN", "abc");
      const { isAIEnabled } = await import("@/lib/ai");
      expect(isAIEnabled()).toBe(true);
    });
  });

  // ── aiErrorMessage ──────────────────────────────────────────────

  describe("aiErrorMessage", () => {
    it("maps every variant to a distinct human message", async () => {
      const { aiErrorMessage } = await import("@/lib/ai");
      expect(aiErrorMessage("not_configured")).toMatch(/not configured/i);
      expect(aiErrorMessage("no_credit")).toMatch(/quota/i);
      expect(aiErrorMessage("rate_limited")).toMatch(/rate limit/i);
      expect(aiErrorMessage("auth")).toMatch(/invalid/i);
      expect(aiErrorMessage("no_access")).toMatch(/Models: Read/i);
      expect(aiErrorMessage("bad_json")).toMatch(/malformed JSON/i);
      expect(aiErrorMessage("unknown")).toMatch(/failed/i);
    });
  });

  // ── checkAIRateLimit ────────────────────────────────────────────

  describe("checkAIRateLimit", () => {
    it("allows up to 20 calls in a 5-minute window", async () => {
      const { checkAIRateLimit } = await import("@/lib/ai");
      for (let i = 0; i < 20; i++) {
        expect(checkAIRateLimit("u1").ok).toBe(true);
      }
    });

    it("blocks the 21st call with a positive retryAfterSec", async () => {
      const { checkAIRateLimit } = await import("@/lib/ai");
      for (let i = 0; i < 20; i++) checkAIRateLimit("u2");
      const result = checkAIRateLimit("u2");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.retryAfterSec).toBeGreaterThan(0);
        expect(result.retryAfterSec).toBeLessThanOrEqual(300);
      }
    });

    it("allows calls again after the window slides past", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0));
      const { checkAIRateLimit } = await import("@/lib/ai");

      for (let i = 0; i < 20; i++) checkAIRateLimit("u3");
      expect(checkAIRateLimit("u3").ok).toBe(false);

      vi.setSystemTime(new Date(2026, 0, 1, 12, 5, 1)); // +5m 1s
      expect(checkAIRateLimit("u3").ok).toBe(true);
    });

    it("tracks separate buckets per user", async () => {
      const { checkAIRateLimit } = await import("@/lib/ai");
      for (let i = 0; i < 20; i++) checkAIRateLimit("u4");
      expect(checkAIRateLimit("u4").ok).toBe(false);
      expect(checkAIRateLimit("u5").ok).toBe(true);
    });
  });

  // ── generateText ────────────────────────────────────────────────

  describe("generateText", () => {
    it("returns not_configured when API_KEY is missing", async () => {
      vi.stubEnv("GITHUB_MODELS_TOKEN", "");
      const { generateText } = await import("@/lib/ai");
      const result = await generateText("sys", "user");
      expect(result).toEqual({ ok: false, error: "not_configured" });
    });

    it("returns the model content on 200", async () => {
      vi.stubEnv("GITHUB_MODELS_TOKEN", "test");
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "hello world" } }] }),
      });
      vi.stubGlobal("fetch", fetchMock);
      const { generateText } = await import("@/lib/ai");

      const result = await generateText("sys", "user", 500);

      expect(result).toEqual({ ok: true, value: "hello world" });
      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://models.github.ai/inference/chat/completions");
      const body = JSON.parse(init.body);
      expect(body.model).toBe("openai/gpt-4o-mini");
      expect(body.max_tokens).toBe(500);
      expect(body.messages).toEqual([
        { role: "system", content: "sys" },
        { role: "user", content: "user" },
      ]);
      // Plain text mode: no response_format
      expect(body.response_format).toBeUndefined();
      expect(init.headers.Authorization).toBe("Bearer test");
    });

    it("maps 401 → auth", async () => {
      vi.stubEnv("GITHUB_MODELS_TOKEN", "bad");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "unauthorized" })
      );
      const { generateText } = await import("@/lib/ai");
      expect(await generateText("s", "u")).toEqual({ ok: false, error: "auth" });
    });

    it("maps 403 containing 'no_access' → no_access", async () => {
      vi.stubEnv("GITHUB_MODELS_TOKEN", "x");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => "no_access to models" })
      );
      const { generateText } = await import("@/lib/ai");
      expect(await generateText("s", "u")).toEqual({ ok: false, error: "no_access" });
    });

    it("maps generic 403 → auth", async () => {
      vi.stubEnv("GITHUB_MODELS_TOKEN", "x");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => "forbidden" })
      );
      const { generateText } = await import("@/lib/ai");
      expect(await generateText("s", "u")).toEqual({ ok: false, error: "auth" });
    });

    it("maps 429 with 'quota' → no_credit", async () => {
      vi.stubEnv("GITHUB_MODELS_TOKEN", "x");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => "quota exhausted" })
      );
      const { generateText } = await import("@/lib/ai");
      expect(await generateText("s", "u")).toEqual({ ok: false, error: "no_credit" });
    });

    it("maps plain 429 → rate_limited", async () => {
      vi.stubEnv("GITHUB_MODELS_TOKEN", "x");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => "too many requests" })
      );
      const { generateText } = await import("@/lib/ai");
      expect(await generateText("s", "u")).toEqual({ ok: false, error: "rate_limited" });
    });

    it("maps other non-ok statuses → unknown", async () => {
      vi.stubEnv("GITHUB_MODELS_TOKEN", "x");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "internal" })
      );
      const { generateText } = await import("@/lib/ai");
      expect(await generateText("s", "u")).toEqual({ ok: false, error: "unknown" });
    });

    it("returns unknown when fetch throws", async () => {
      vi.stubEnv("GITHUB_MODELS_TOKEN", "x");
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
      const { generateText } = await import("@/lib/ai");
      expect(await generateText("s", "u")).toEqual({ ok: false, error: "unknown" });
    });

    it("returns unknown when response body has no content", async () => {
      vi.stubEnv("GITHUB_MODELS_TOKEN", "x");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) })
      );
      const { generateText } = await import("@/lib/ai");
      expect(await generateText("s", "u")).toEqual({ ok: false, error: "unknown" });
    });
  });

  // ── generateJSON ────────────────────────────────────────────────

  describe("generateJSON", () => {
    it("parses valid JSON content", async () => {
      vi.stubEnv("GITHUB_MODELS_TOKEN", "x");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ choices: [{ message: { content: '{"foo":"bar","n":1}' } }] }),
        })
      );
      const { generateJSON } = await import("@/lib/ai");
      const result = await generateJSON<{ foo: string; n: number }>("s", "u");
      expect(result).toEqual({ ok: true, value: { foo: "bar", n: 1 } });
    });

    it("returns bad_json when the content isn't valid JSON", async () => {
      vi.stubEnv("GITHUB_MODELS_TOKEN", "x");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ choices: [{ message: { content: "not json at all" } }] }),
        })
      );
      const { generateJSON } = await import("@/lib/ai");
      expect(await generateJSON("s", "u")).toEqual({ ok: false, error: "bad_json" });
    });

    it("requests response_format json_object and appends a JSON-only nudge to the system prompt", async () => {
      vi.stubEnv("GITHUB_MODELS_TOKEN", "x");
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "{}" } }] }),
      });
      vi.stubGlobal("fetch", fetchMock);
      const { generateJSON } = await import("@/lib/ai");

      await generateJSON("Original system prompt.", "u");

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.response_format).toEqual({ type: "json_object" });
      expect(body.messages[0].content).toContain("Original system prompt.");
      expect(body.messages[0].content).toContain("valid JSON only");
    });

    it("propagates upstream errors without attempting to parse", async () => {
      vi.stubEnv("GITHUB_MODELS_TOKEN", "x");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => "quota" })
      );
      const { generateJSON } = await import("@/lib/ai");
      expect(await generateJSON("s", "u")).toEqual({ ok: false, error: "no_credit" });
    });
  });
});
