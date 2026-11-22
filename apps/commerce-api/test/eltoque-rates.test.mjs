import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  evaluateRate,
  fetchRateFromApi,
  fetchRateFromWeb,
  looksBlocked,
  parseElToqueApi,
  parseElToqueHtml,
  RATE_BOUNDS,
} from "../src/lib/eltoque-rates.ts";

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const now = new Date("2026-11-22T12:00:00.000Z");

test("reads the USD/CUP rate and elTOQUE's own date from the Dataset JSON-LD", () => {
  // Sample taken from https://eltoque.com/tasas-de-cambio-cuba on 22 Nov 2026.
  assert.deepEqual(parseElToqueHtml(fixture("eltoque-dataset.sample")), {
    usd: 960,
    source_updated_at: "2026-11-22T10:44:08.000Z",
    origin: "dataset",
  });
});

test("falls back to the visible «Mercado informal» block when the JSON-LD is gone", () => {
  assert.deepEqual(parseElToqueHtml(fixture("eltoque-visible.sample")), {
    usd: 960,
    source_updated_at: null,
    origin: "text",
  });
});

test("accepts a @graph wrapper and a Dataset typed as a list", () => {
  const html = `<script type="application/ld+json">${JSON.stringify({
    "@graph": [
      { "@type": "WebSite" },
      {
        "@type": ["Thing", "Dataset"],
        dateModified: "2026-11-22T09:00:00Z",
        variableMeasured: [
          { name: "EUR/CUP", value: 1030 },
          { name: "USD/CUP", value: "961,5" },
        ],
      },
    ],
  })}</script>`;
  assert.deepEqual(parseElToqueHtml(html), {
    usd: 961.5,
    source_updated_at: "2026-11-22T09:00:00.000Z",
    origin: "dataset",
  });
});

test("returns null for a challenge page, an empty page or broken JSON-LD", () => {
  assert.equal(parseElToqueHtml("<html><title>Just a moment...</title></html>"), null);
  assert.equal(parseElToqueHtml(""), null);
  assert.equal(
    parseElToqueHtml('<script type="application/ld+json">{not json</script><p>nada</p>'),
    null,
  );
});

test("parses the official API answer", () => {
  assert.deepEqual(parseElToqueApi({ tasas: { USD: 960, EUR: 1030 }, date: "2026-11-22" }), {
    usd: 960,
    source_updated_at: "2026-11-22T00:00:00.000Z",
    origin: "api",
  });
  assert.equal(parseElToqueApi({ tasas: {} }), null);
  assert.equal(parseElToqueApi(null), null);
});

test("recognises Cloudflare's challenge", () => {
  assert.equal(looksBlocked(403, ""), true);
  assert.equal(looksBlocked(429, ""), true);
  assert.equal(looksBlocked(200, "<title>Un momento…</title>"), true);
  assert.equal(looksBlocked(200, "<title>Tasas de cambio en Cuba hoy</title>"), false);
});

const snapshot = (usd, date = "2026-11-22T10:44:08.000Z") => ({
  usd,
  source_updated_at: date,
  origin: "dataset",
});
const stored = (rate, source = "elTOQUE (web)", updated_at = "2026-11-22T06:00:00.000Z") => ({
  rate,
  source,
  updated_at,
});

test("accepts a normal value and the very first one", () => {
  assert.deepEqual(evaluateRate({ candidate: snapshot(960), current: null, now }), { ok: true });
  assert.deepEqual(evaluateRate({ candidate: snapshot(975), current: stored(960), now }), {
    ok: true,
  });
});

test("rejects out-of-range values", () => {
  for (const usd of [0, -5, RATE_BOUNDS.max + 1, Number.NaN]) {
    const verdict = evaluateRate({ candidate: snapshot(usd), current: null, now });
    assert.equal(verdict.ok, false);
    assert.equal(verdict.reason, "invalid");
  }
});

test("rejects data older than 48 hours but keeps data without a date", () => {
  const old = evaluateRate({
    candidate: snapshot(960, "2026-11-19T10:00:00.000Z"),
    current: null,
    now,
  });
  assert.equal(old.ok, false);
  assert.equal(old.reason, "stale");
  assert.equal(
    evaluateRate({
      candidate: { usd: 960, source_updated_at: null, origin: "text" },
      current: null,
      now,
    }).ok,
    true,
  );
});

test("holds back a jump above 25 % from a recent automatic value", () => {
  const verdict = evaluateRate({ candidate: snapshot(96), current: stored(960), now });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason, "jump");
});

test("a typo set by hand never blocks the automatic value from correcting it", () => {
  assert.equal(
    evaluateRate({ candidate: snapshot(960), current: stored(96, "manual"), now }).ok,
    true,
  );
});

test("after three quiet days the jump check no longer applies", () => {
  const verdict = evaluateRate({
    candidate: snapshot(1400),
    current: stored(960, "elTOQUE (web)", "2026-11-18T06:00:00.000Z"),
    now,
  });
  assert.equal(verdict.ok, true);
});

// The network layer, with a fake fetch: no request ever leaves the test.
const reply =
  (body, status = 200) =>
  async () =>
    new Response(body, { status });

test("web layer: reads the page, reports a challenge, an error status and a dead network", async () => {
  const ok = await fetchRateFromWeb(reply(fixture("eltoque-dataset.sample")));
  assert.equal(ok.ok, true);
  assert.equal(ok.snapshot.usd, 960);

  const blocked = await fetchRateFromWeb(reply("<title>Just a moment...</title>", 403));
  assert.deepEqual([blocked.ok, blocked.reason], [false, "blocked"]);

  const challenged200 = await fetchRateFromWeb(reply("<title>Un momento…</title>", 200));
  assert.deepEqual([challenged200.ok, challenged200.reason], [false, "blocked"]);

  const server = await fetchRateFromWeb(reply("boom", 500));
  assert.deepEqual([server.ok, server.reason], [false, "http"]);

  const empty = await fetchRateFromWeb(reply("<html>sin tasas</html>"));
  assert.deepEqual([empty.ok, empty.reason], [false, "unreadable"]);

  const down = await fetchRateFromWeb(async () => {
    throw new Error("ECONNRESET");
  });
  assert.deepEqual([down.ok, down.reason, down.detail], [false, "network", "ECONNRESET"]);
});

test("web layer: sends a phone user agent and no credentials", async () => {
  let seen;
  await fetchRateFromWeb(async (url, init) => {
    seen = { url: String(url), headers: init.headers };
    return new Response(fixture("eltoque-dataset.sample"));
  });
  assert.equal(seen.url, "https://eltoque.com/tasas-de-cambio-cuba");
  assert.match(seen.headers["user-agent"], /Android.*Mobile/);
  assert.equal(seen.headers.authorization, undefined);
});

test("API layer: sends the token only to the official host and parses the answer", async () => {
  let seen;
  const ok = await fetchRateFromApi("tok", now, async (url, init) => {
    seen = { url: new URL(String(url)), headers: init.headers };
    return Response.json({ tasas: { USD: 960 }, date: "2026-11-22" });
  });
  assert.equal(ok.ok, true);
  assert.equal(seen.url.host, "tasas.eltoque.com");
  assert.equal(seen.headers.authorization, "Bearer tok");

  const denied = await fetchRateFromApi("bad", now, reply("{}", 401));
  assert.deepEqual([denied.ok, denied.reason], [false, "http"]);
});
