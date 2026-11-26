import assert from "node:assert/strict";
import { test } from "node:test";
import { EMAIL_LIMITS, mayEmail } from "../src/lib/email-throttle.ts";

const now = new Date("2026-11-26T12:00:00.000Z");
const fake = (count) => ({
  calls: [],
  async listNotifications(filters, config) {
    this.calls.push({ filters, config });
    return Array.from({ length: count }, (_, i) => ({ id: `n${i}` }));
  },
});

test("lets an address through until its limit and holds it back afterwards", async () => {
  const max = EMAIL_LIMITS["password-reset"].max;
  assert.equal(await mayEmail(fake(max - 1), "a@b.cu", "password-reset", now), true);
  assert.equal(await mayEmail(fake(max), "a@b.cu", "password-reset", now), false);
});

test("counts only that address and template inside the window", async () => {
  const lister = fake(0);
  await mayEmail(lister, "a@b.cu", "member-invite", now);
  const { filters } = lister.calls[0];
  assert.equal(filters.to, "a@b.cu");
  assert.equal(filters.template, "member-invite");
  assert.equal(
    filters.created_at.$gte.toISOString(),
    new Date(now.getTime() - EMAIL_LIMITS["member-invite"].windowMs).toISOString(),
  );
});

test("a failed lookup never locks someone out of recovering their account", async () => {
  const broken = {
    async listNotifications() {
      throw new Error("db down");
    },
  };
  assert.equal(await mayEmail(broken, "a@b.cu", "password-reset", now), true);
});
