import { defineConfig, globalIgnores } from "eslint/config";
import nextPlugin from "@next/eslint-plugin-next";

const eslintConfig = defineConfig([
  nextPlugin.configs.recommended,
  nextPlugin.configs["core-web-vitals"],
  globalIgnores([
    ".next/",
    "out/",
    "node_modules/",
    "public/brand/",
    "accord/",
    "content/snippets/",
  ]),
]);

export default eslintConfig;
