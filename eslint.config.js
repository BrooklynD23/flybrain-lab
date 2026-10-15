import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const reactHooksConfig = reactHooks.configs?.flat?.recommended ??
  reactHooks.configs?.["recommended-latest"] ?? {
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  };

export default tseslint.config(
  {
    ignores: [
      ".claude/**",
      "pipeline/**",
      "dist/**",
      "coverage/**",
      "playwright-report/**",
      "public/**",
    ],
  },
  ...tseslint.configs.recommended,
  reactHooksConfig,
);
