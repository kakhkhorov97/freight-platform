import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: ["**/dist/**", "**/build/**", "**/coverage/**"],
  },
  {
    files: ["**/*.{js,cjs,mjs}"],
    extends: [js.configs.recommended],
  },
  {
    files: ["**/*.{ts,cts,mts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
);
