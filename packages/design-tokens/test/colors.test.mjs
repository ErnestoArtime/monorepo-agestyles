import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { colors } from "../src/index.ts";

function luminance(hex) {
  const rgb = hex.match(/[\da-f]{2}/gi)?.map((part) => Number.parseInt(part, 16) / 255);
  assert.equal(rgb?.length, 3, `Expected a six-digit hex color: ${hex}`);

  const linear = rgb.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );

  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrastRatio(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const css = await readFile(new URL("../tokens.css", import.meta.url), "utf8");

for (const [mode, tokenSet] of Object.entries(colors)) {
  for (const [foreground, background] of [
    [tokenSet.text, tokenSet.background],
    [tokenSet.onAction, tokenSet.action],
    [tokenSet.onError, tokenSet.error],
    [tokenSet.onSuccess, tokenSet.success],
  ]) {
    assert.ok(
      contrastRatio(foreground, background) >= 4.5,
      `${mode} contrast ${foreground} on ${background} must meet WCAG AA for normal text`,
    );
  }

  for (const [name, value] of Object.entries({
    text: tokenSet.text,
    background: tokenSet.background,
    surface: tokenSet.surface,
    action: tokenSet.action,
    "on-action": tokenSet.onAction,
    error: tokenSet.error,
    "on-error": tokenSet.onError,
    success: tokenSet.success,
    "on-success": tokenSet.onSuccess,
  })) {
    assert.match(
      css,
      new RegExp(`--as-color-${name}:\\s*${value}`, "i"),
      `${mode} CSS token ${name} must match TypeScript`,
    );
  }
}

console.log("PASS: light/dark semantic color pairs meet WCAG AA and match web CSS tokens");
