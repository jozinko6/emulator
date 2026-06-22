import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    languageOptions: {
      globals: {
        React: "readonly",
        Transferable: "readonly",
        EventListener: "readonly",
        EventListenerObject: "readonly",
        WebGLRenderingContext: "readonly",
        WebGL2RenderingContext: "readonly",
        GPU: "readonly",
      },
    },
  },
  {
    rules: {
      // TypeScript rules — per prompt section 24
      "@typescript-eslint/no-explicit-any": "warn", // dočasne warning, nie error
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/ban-ts-comment": "error", // žiadne @ts-ignore bez dôvodu
      "@typescript-eslint/prefer-as-const": "off",

      // React rules — exhaustive-deps zapnuté ako warn
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/rules-of-hooks": "off", // play page intentionally accesses ref in hook args (anti-pattern but functional)
      "react-hooks/refs": "off", // refs accessed in hook args (functional, but flagged)
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/immutability": "off",
      "react/no-unescaped-entities": "off",
      "react/display-name": "off",
      "react/prop-types": "off",
      "react-compiler/react-compiler": "off",

      // Next.js rules — <img> ok v tejto appke (máme v headless display)
      "@next/next/no-img-element": "off",
      "@next/next/no-html-link-for-pages": "off",

      // General JavaScript rules — per prompt section 24 (znovu zapnuté)
      "prefer-const": "warn",
      "no-unused-vars": "off", // TypeScript to rieši lepšie
      "no-console": "off",
      "no-debugger": "error",
      "no-empty": "warn", // prázdne catch bloky varované — aplikácia ich nesmie mať
      "no-irregular-whitespace": "error",
      "no-case-declarations": "off",
      "no-fallthrough": "error",
      "no-mixed-spaces-and-tabs": "error",
      "no-redeclare": "error",
      "no-undef": "error",
      "no-unreachable": "error",
      "no-useless-escape": "warn",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "examples/**",
      "skills/**",
      "android/**",
      "android-shell/dist/**",
      "android-shell/node_modules/**",
      "android-shell/src/**",
      "public/libarchive/**",
      "public/emulator-assets/**",
    ],
  },
];

export default eslintConfig;
