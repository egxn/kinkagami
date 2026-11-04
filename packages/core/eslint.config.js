import js from "@eslint/js";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

// `lib` in tsconfig has no DOM, so DOM globals fail type-checking. This rule
// keeps framework/runtime packages out of core, which must run everywhere.
const FORBIDDEN = [
  "react",
  "react-*",
  "react/*",
  "@tensorflow/*",
  "@tensorflow-models/*",
  "@mediapipe/*",
  "pouchdb",
  "pouchdb-*",
  "i18next",
  "i18next-*",
];

export default defineConfig([
  globalIgnores(["node_modules"]),
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: FORBIDDEN,
              message:
                "@kgm/core must stay platform-agnostic: no React, TF.js, MediaPipe, PouchDB or i18n.",
            },
          ],
        },
      ],
    },
  },
]);
