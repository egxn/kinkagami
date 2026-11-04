import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

// UI stays presentational: text arrives via props, data via props, behavior via callbacks.
const FORBIDDEN = [
  "react-i18next",
  "i18next",
  "i18next-*",
  "react-router",
  "react-router-dom",
  "@tensorflow/*",
  "@tensorflow-models/*",
  "@mediapipe/*",
  "pouchdb",
  "pouchdb-*",
];

export default defineConfig([
  globalIgnores(["node_modules"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: { ecmaVersion: 2020, globals: globals.browser },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: FORBIDDEN,
              message:
                "@kgm/ui must stay presentational: no i18n, routing, TF.js or storage. Pass text/data via props.",
            },
          ],
        },
      ],
    },
  },
]);
