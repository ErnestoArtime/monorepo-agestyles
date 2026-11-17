import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";
import nextConfig from "eslint-config-next/core-web-vitals";
import globals from "globals";
import tseslint from "typescript-eslint";

const sourceFiles = ["**/*.{cjs,js,jsx,mjs,ts,tsx}"];

export default defineConfig([
  globalIgnores([
    "**/node_modules/**",
    "**/references/**",
    "**/.expo/**",
    "**/.medusa/**",
    "**/.next/**",
    "**/.nx/**",
    "**/.turbo/**",
    "**/android/**",
    "**/build/**",
    "**/coverage/**",
    "**/dist/**",
    "**/ios/**",
  ]),
  {
    files: sourceFiles,
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Existing AgeStyles/Mercur service DTOs contain 70 untyped escape hatches;
      // track this as migration debt instead of turning the first lint rollout red.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/array-type": "warn",
    },
  },
  {
    files: ["apps/buyer-app/**/*.{js,jsx,ts,tsx}", "apps/business-app/**/*.{js,jsx,ts,tsx}"],
    extends: [expoConfig],
    rules: {
      // Expo's import resolver does not read these apps' tsconfig path aliases.
      "import/no-unresolved": "off",
    },
  },
  {
    files: ["apps/storefront-web/**/*.{js,jsx,ts,tsx}"],
    extends: [nextConfig],
    settings: {
      next: {
        rootDir: "apps/storefront-web/",
      },
    },
    rules: {
      // Existing storefront navigation debt; keep visible without blocking the rollout.
      "@next/next/no-html-link-for-pages": "warn",
    },
  },
  {
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);
