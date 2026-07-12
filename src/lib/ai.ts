const API_KEY = process.env.GITHUB_MODELS_TOKEN;
const ENDPOINT = "https://models.github.ai/inference/chat/completions";
const MODEL = "openai/gpt-4o-mini";

export function isAIEnabled(): boolean {
  return !!API_KEY;
}

// Per-user rate limit: sliding 5-minute window, cap at 20 requests.
// Stored on globalThis so it survives Next dev HMR (same trick as prisma.ts).
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX = 20;

const globalForAI = globalThis as unknown as {
  __aiRateBuckets?: Map<string, number[]>;
};
const buckets = globalForAI.__aiRateBuckets ?? new Map<string, number[]>();
if (process.env.NODE_ENV !== "production") globalForAI.__aiRateBuckets = buckets;

export function checkAIRateLimit(userId: string): {
  ok: true;
} | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const recent = (buckets.get(userId) ?? []).filter((t) => t > cutoff);
  if (recent.length >= RATE_LIMIT_MAX) {
    const oldest = recent[0];
    return { ok: false, retryAfterSec: Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000) };
  }
  recent.push(now);
  buckets.set(userId, recent);
  return { ok: true };
}

export type AIError =
  | "not_configured"
  | "no_credit"
  | "rate_limited"
  | "auth"
  | "no_access"
  | "bad_json"
  | "unknown";

export type AIResult<T> = { ok: true; value: T } | { ok: false; error: AIError };

export function aiErrorMessage(error: AIError): string {
  switch (error) {
    case "not_configured":
      return "AI is not configured";
    case "no_credit":
      return "AI quota exhausted — check your GitHub Models usage";
    case "rate_limited":
      return "AI rate limit hit — try again in a moment";
    case "auth":
      return "AI token is invalid";
    case "no_access":
      return "GitHub PAT is missing the Models: Read permission";
    case "bad_json":
      return "AI returned malformed JSON — try again";
    default:
      return "Generation failed";
  }
}

function classifyStatus(status: number, message: string): AIError {
  const lower = message.toLowerCase();
  if (status === 403 && lower.includes("no_access")) return "no_access";
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return lower.includes("quota") ? "no_credit" : "rate_limited";
  return "unknown";
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function chatCompletion(
  messages: ChatMessage[],
  maxTokens: number,
  jsonMode: boolean
): Promise<AIResult<string>> {
  if (!API_KEY) return { ok: false, error: "not_configured" };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: maxTokens,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (process.env.NODE_ENV !== "production") {
        console.error("[ai] request failed:", res.status, body);
      }
      return { ok: false, error: classifyStatus(res.status, body) };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { ok: false, error: "unknown" };
    return { ok: true, value: content };
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[ai] request threw:", err);
    }
    return { ok: false, error: "unknown" };
  }
}

export async function generateText(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1024
): Promise<AIResult<string>> {
  return chatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    maxTokens,
    false
  );
}

export async function generateJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1024
): Promise<AIResult<T>> {
  const result = await chatCompletion(
    [
      {
        role: "system",
        content:
          systemPrompt +
          "\n\nRespond with valid JSON only. No markdown, no code fences, no prose.",
      },
      { role: "user", content: userPrompt },
    ],
    maxTokens,
    true
  );
  if (!result.ok) return result;

  try {
    return { ok: true, value: JSON.parse(result.value) as T };
  } catch {
    return { ok: false, error: "bad_json" };
  }
}
