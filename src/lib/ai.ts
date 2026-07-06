import Anthropic from "@anthropic-ai/sdk";

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const MODEL = "claude-haiku-4-5-20251001";

export function isAIEnabled(): boolean {
  return client !== null;
}

export type AIError =
  | "not_configured"
  | "no_credit"
  | "rate_limited"
  | "auth"
  | "unknown";

export type AIResult<T> = { ok: true; value: T } | { ok: false; error: AIError };

export function aiErrorMessage(error: AIError): string {
  switch (error) {
    case "not_configured":
      return "AI is not configured";
    case "no_credit":
      return "AI credit balance is empty — top up at console.anthropic.com/settings/billing";
    case "rate_limited":
      return "AI rate limit hit — try again in a moment";
    case "auth":
      return "AI key is invalid";
    default:
      return "Generation failed";
  }
}

function classifyError(err: unknown): AIError {
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status?: number }).status;
    const message = String(
      (err as { error?: { error?: { message?: string } } }).error?.error?.message ?? ""
    ).toLowerCase();
    if (status === 401 || status === 403) return "auth";
    if (status === 429) return "rate_limited";
    if (status === 400 && message.includes("credit")) return "no_credit";
  }
  return "unknown";
}

export async function generateText(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1024
): Promise<AIResult<string>> {
  if (!client) return { ok: false, error: "not_configured" };

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const block = response.content[0];
    if (block?.type !== "text") return { ok: false, error: "unknown" };
    return { ok: true, value: block.text };
  } catch (err) {
    console.error("[ai] generateText failed:", err);
    return { ok: false, error: classifyError(err) };
  }
}

export async function generateJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1024
): Promise<AIResult<T>> {
  const result = await generateText(
    systemPrompt +
      "\n\nRespond with valid JSON only. No markdown, no code fences, no prose.",
    userPrompt,
    maxTokens
  );
  if (!result.ok) return result;

  try {
    const cleaned = result.value
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    return { ok: true, value: JSON.parse(cleaned) as T };
  } catch {
    return { ok: false, error: "unknown" };
  }
}
