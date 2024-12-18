import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [
  ...compat.extends("eslint:recommended"),
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        chrome: true,
        browser: true,
        bootstrap: true
      },

      ecmaVersion: 13,
      sourceType: "module"
    },

    rules: {
      "no-prototype-builtins": 0,
      "no-unused-vars": 1,
      "comma-dangle": 1,
      "no-redeclare": 0,
      "prefer-const": 1,
      "no-useless-escape": 0,
      "no-mixed-spaces-and-tabs": 0,
      semi: 1,
      "no-useless-catch": 0,
      "no-empty": 0,
      "use-isnan": 0,
      "no-extra-semi": 1,
      "no-async-promise-executor": 0,
      "no-unreachable": 1,
      "no-var": 1,
      "no-fallthrough": 1,
      curly: ["warn", "all"]
    }
  }
];
