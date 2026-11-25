import assert from "node:assert/strict";
import { test } from "node:test";
import { ResendNotificationService } from "../src/modules/resend-notification/service.ts";

const sender = "AgeStyles <no-reply@agestyles.eav-labs.com>";
const provider = new ResendNotificationService({}, { apiKey: "test-key", from: sender });
const email = {
  to: "buyer@example.com",
  channel: "email",
  template: "order-update",
  content: { subject: "Tu pedido", html: "<p>Pedido listo</p>" },
  provider_data: { idempotency_key: "agestyles-delivery:sample" },
};

test("sends rendered notification with the configured sender and idempotency key", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json({ id: "mail_1" }));

  assert.deepEqual(await provider.send(email), { id: "mail_1" });
  const [url, request] = fetch.mock.calls[0].arguments;
  assert.equal(url, "https://api.resend.com/emails");
  assert.equal(request.method, "POST");
  assert.equal(request.headers.authorization, "Bearer test-key");
  assert.equal(request.headers["idempotency-key"], "agestyles-delivery:sample");
  assert.deepEqual(JSON.parse(request.body), {
    from: sender,
    to: [email.to],
    subject: email.content.subject,
    html: email.content.html,
  });
});

test("throws a retryable failure when Resend rejects the request without exposing its body", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ message: "recipient data" }, { status: 429 }),
  );

  await assert.rejects(provider.send(email), { message: "Resend rejected the email (HTTP 429)." });
});
