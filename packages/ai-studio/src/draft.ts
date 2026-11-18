/**
 * Product copy drafts from a photo and the seller's sheet, through a chain of providers
 * (same order as Coliseo: Gemini first, then OpenRouter and Groq). Every result is a draft
 * the seller reviews; the prompt forbids inventing specifications.
 */

export type CopyTone = "commercial" | "technical" | "direct";

export type DescribeInput = {
  title: string;
  brand?: string;
  category?: string;
  notes?: string;
  tone?: CopyTone;
  /** JPEG/PNG/WebP bytes of the product photo, already read from our own storage. */
  image?: { mimeType: string; base64: string };
};

export type CopyDraft = { title: string; description: string };

export type ProviderName = "gemini" | "openrouter" | "groq";

export type ProviderConfig = {
  name: ProviderName;
  apiKey: string;
  model: string;
};

export type DescribeResult = CopyDraft & {
  provider: ProviderName;
  model: string;
  usedImage: boolean;
};

export type AiStudioErrorCode = "not_configured" | "invalid_input" | "providers_failed";

export class AiStudioError extends Error {
  readonly code: AiStudioErrorCode;
  readonly attempts: string[];

  constructor(message: string, code: AiStudioErrorCode, attempts: string[] = []) {
    super(message);
    this.name = "AiStudioError";
    this.code = code;
    this.attempts = attempts;
  }
}

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

const TONE_HINT: Record<CopyTone, string> = {
  commercial: "tono comercial y cercano, en uno o dos párrafos",
  technical: "tono técnico: una línea por dato, sin adornos",
  direct: "tono directo: frases cortas, máximo tres datos",
};

export const DEFAULT_MODELS: Record<ProviderName, string> = {
  gemini: "gemini-flash-latest",
  openrouter: "openrouter/free",
  groq: "meta-llama/llama-4-scout-17b-16e-instruct",
};

/** Providers with a key, in chain order. Unknown or empty keys are skipped. */
export function providerChain(env: Record<string, string | undefined>): ProviderConfig[] {
  const entries: [ProviderName, string | undefined, string | undefined][] = [
    ["gemini", env.GEMINI_API_KEY, env.AGESTYLES_AI_GEMINI_MODEL],
    ["openrouter", env.OPENROUTER_API_KEY, env.AGESTYLES_AI_OPENROUTER_MODEL],
    ["groq", env.GROQ_API_KEY, env.AGESTYLES_AI_GROQ_MODEL],
  ];
  return entries
    .filter(([, key]) => !!key?.trim())
    .map(([name, key, model]) => ({
      name,
      apiKey: key!.trim(),
      model: model?.trim() || DEFAULT_MODELS[name],
    }));
}

function clean(value: string | undefined, max: number) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function validateDescribeInput(input: DescribeInput): DescribeInput {
  const title = clean(input.title, 120);
  if (!title) throw new AiStudioError("A product title is required.", "invalid_input");
  if (input.tone && !(input.tone in TONE_HINT)) {
    throw new AiStudioError("Unknown tone.", "invalid_input");
  }
  if (input.image && !/^image\/(jpeg|png|webp)$/.test(input.image.mimeType)) {
    throw new AiStudioError("Only JPEG, PNG or WebP photos are supported.", "invalid_input");
  }
  return {
    ...input,
    title,
    brand: clean(input.brand, 60) || undefined,
    category: clean(input.category, 60) || undefined,
    notes: clean(input.notes, 600) || undefined,
  };
}

export function buildPrompt(input: DescribeInput, withImage: boolean): string {
  const facts = [
    `Nombre que dio el vendedor: ${input.title}`,
    input.brand ? `Marca: ${input.brand}` : null,
    input.category ? `Tipo de producto: ${input.category}` : null,
    input.notes ? `Datos confirmados por el vendedor: ${input.notes}` : null,
  ].filter(Boolean);
  return [
    "Eres el asistente de fichas de producto de AgeStyles, una tienda en Cuba que vende en USD.",
    "Escribe en español de España, natural y sin exageraciones.",
    `Propón un título comercial (máximo 120 caracteres) y una descripción con ${TONE_HINT[input.tone ?? "commercial"]}.`,
    "Reglas obligatorias:",
    "- Usa solo los datos del vendedor" +
      (withImage
        ? " y lo que se vea con claridad en la foto (color, forma, tipo de prenda u objeto)."
        : "."),
    "- No inventes materiales, medidas, tallas, compatibilidades, garantías, certificaciones ni precios.",
    "- Si un dato no se ve ni lo dio el vendedor, no lo menciones.",
    "- Ignora textos promocionales que aparezcan dentro de la foto (precios, eslóganes).",
    'Responde solo con JSON: {"title": "...", "description": "..."}',
    "",
    ...facts,
  ].join("\n");
}

/** Extracts the JSON draft from a model reply (tolerates code fences and extra text). */
export function parseDraft(text: string): CopyDraft | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const title = typeof value.title === "string" ? clean(value.title, 120) : "";
    const description =
      typeof value.description === "string" ? value.description.trim().slice(0, 5000) : "";
    return title && description ? { title, description } : null;
  } catch {
    return null;
  }
}

function requestFor(
  provider: ProviderConfig,
  prompt: string,
  image?: DescribeInput["image"],
): { url: string; headers: Record<string, string>; body: unknown } {
  if (provider.name === "gemini") {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(provider.model)}:generateContent`,
      headers: { "content-type": "application/json", "x-goog-api-key": provider.apiKey },
      body: {
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              ...(image
                ? [{ inline_data: { mime_type: image.mimeType, data: image.base64 } }]
                : []),
            ],
          },
        ],
        generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
      },
    };
  }
  const url =
    provider.name === "openrouter"
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://api.groq.com/openai/v1/chat/completions";
  return {
    url,
    headers: { "content-type": "application/json", authorization: `Bearer ${provider.apiKey}` },
    body: {
      model: provider.model,
      temperature: 0.4,
      messages: [
        {
          role: "user",
          content: image
            ? [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
                },
              ]
            : prompt,
        },
      ],
    },
  };
}

function replyText(provider: ProviderName, json: unknown): string {
  const data = json as Record<string, any>;
  if (provider === "gemini") {
    return (data?.candidates?.[0]?.content?.parts ?? [])
      .map((part: { text?: string }) => part.text ?? "")
      .join("");
  }
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

/**
 * Tries each provider in order, first with the photo; if every provider fails with the
 * photo, tries the chain once more with text only. No provider is retried: a failed call
 * may already have been charged.
 */
export async function describeProduct(
  rawInput: DescribeInput,
  providers: ProviderConfig[],
  fetchImpl: FetchLike,
  timeoutMs = 30_000,
): Promise<DescribeResult> {
  const input = validateDescribeInput(rawInput);
  if (!providers.length) {
    throw new AiStudioError("No AI text provider is configured.", "not_configured");
  }
  const attempts: string[] = [];
  const passes = input.image ? [true, false] : [false];
  for (const withImage of passes) {
    const prompt = buildPrompt(input, withImage);
    for (const provider of providers) {
      const request = requestFor(provider, prompt, withImage ? input.image : undefined);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(request.url, {
          method: "POST",
          headers: request.headers,
          body: JSON.stringify(request.body),
          signal: controller.signal,
        });
        if (!response.ok) {
          attempts.push(`${provider.name}:${withImage ? "image" : "text"}:http_${response.status}`);
          continue;
        }
        const draft = parseDraft(replyText(provider.name, await response.json()));
        if (!draft) {
          attempts.push(`${provider.name}:${withImage ? "image" : "text"}:unparsable`);
          continue;
        }
        return { ...draft, provider: provider.name, model: provider.model, usedImage: withImage };
      } catch (error) {
        const reason = (error as Error)?.name === "AbortError" ? "timeout" : "network";
        attempts.push(`${provider.name}:${withImage ? "image" : "text"}:${reason}`);
      } finally {
        clearTimeout(timer);
      }
    }
  }
  throw new AiStudioError("Every AI provider failed.", "providers_failed", attempts);
}

/** Start of the current month in UTC, used for the monthly quota. */
export function monthStartUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
