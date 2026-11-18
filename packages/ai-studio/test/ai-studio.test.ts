import assert from "node:assert/strict";
import {
  AiStudioError,
  buildPrompt,
  describeProduct,
  monthStartUtc,
  parseDraft,
  providerChain,
} from "../src/draft.ts";

// Chain order and defaults follow the configured keys only.
assert.deepEqual(
  providerChain({ GROQ_API_KEY: "g", GEMINI_API_KEY: "x", OPENROUTER_API_KEY: " " }).map(
    (p) => `${p.name}:${p.model}`,
  ),
  ["gemini:gemini-flash-latest", "groq:meta-llama/llama-4-scout-17b-16e-instruct"],
);
assert.equal(providerChain({}).length, 0);

assert.deepEqual(parseDraft('```json\n{"title":"Camiseta","description":"Negra."}\n```'), {
  title: "Camiseta",
  description: "Negra.",
});
assert.equal(parseDraft("sin json"), null);
assert.equal(parseDraft('{"title":"","description":"x"}'), null);

const prompt = buildPrompt({ title: "Camiseta", brand: "Nike", tone: "direct" }, true);
assert.match(prompt, /No inventes materiales/);
assert.match(prompt, /Marca: Nike/);
assert.match(prompt, /foto/);

const image = { mimeType: "image/jpeg", base64: "AAAA" };
const providers = providerChain({ GEMINI_API_KEY: "k1", GROQ_API_KEY: "k2" });

// Gemini fails with the photo, Groq answers with the photo.
{
  const calls: string[] = [];
  const result = await describeProduct(
    { title: "Camiseta", image },
    providers,
    async (url, init) => {
      calls.push(url);
      if (url.includes("googleapis")) return { ok: false, status: 429, json: async () => ({}) };
      assert.match(init.body, /data:image\/jpeg;base64,AAAA/);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '{"title":"T","description":"D"}' } }],
        }),
      };
    },
  );
  assert.equal(result.provider, "groq");
  assert.equal(result.usedImage, true);
  assert.equal(calls.length, 2);
}

// Every provider rejects the photo: one text-only pass, then success from Gemini.
{
  let call = 0;
  const result = await describeProduct(
    { title: "Camiseta", image },
    providers,
    async (url, init) => {
      call += 1;
      if (call <= 2) return { ok: false, status: 400, json: async () => ({}) };
      assert.doesNotMatch(init.body, /inline_data/);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"title":"T","description":"D"}' }] } }],
        }),
      };
    },
  );
  assert.equal(result.provider, "gemini");
  assert.equal(result.usedImage, false);
  assert.equal(call, 3);
}

// No keys, bad input and total failure are explicit errors.
await assert.rejects(
  describeProduct({ title: "x" }, [], async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
  })),
  (e: unknown) => e instanceof AiStudioError && e.code === "not_configured",
);
await assert.rejects(
  describeProduct({ title: "  " }, providers, async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
  })),
  (e: unknown) => e instanceof AiStudioError && e.code === "invalid_input",
);
await assert.rejects(
  describeProduct({ title: "x" }, providers, async () => {
    throw new Error("offline");
  }),
  (e: unknown) =>
    e instanceof AiStudioError && e.code === "providers_failed" && e.attempts.length === 2,
);

assert.equal(
  monthStartUtc(new Date("2026-11-18T23:00:00-05:00")).toISOString(),
  "2026-11-01T00:00:00.000Z",
);
console.log("ai-studio: ok");
