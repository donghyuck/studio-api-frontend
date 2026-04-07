import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const activeRuntimeFiles = [
  "*.config.{js,mjs,cjs,ts,mts,cts}",
  "env.d.ts",
  "src/main.tsx",
  "src/react/**/*.{ts,tsx}",
  "src/config/**/*.ts",
  "src/utils/**/*.ts",
  "src/types/**/*.ts",
];

export default tseslint.config(
  {
    ignores: [
      ".claude/**",
      ".codex/**",
      ".policy-backup-*/**",
      ".vscode/**",
      "dist/**",
      "node_modules/**",
      "public/**",
      "coverage/**",
      "*.min.*",
    ],
  },
  {
    files: activeRuntimeFiles,
    ...js.configs.recommended,
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: activeRuntimeFiles,
  })),
  {
    files: activeRuntimeFiles,
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-prototype-builtins": "warn",
      "no-useless-assignment": "warn",
      "no-useless-catch": "warn",
      "no-useless-escape": "warn",
      "preserve-caught-error": "warn",
      "prefer-const": "warn",
      "no-var": "warn",
    },
  }
);
