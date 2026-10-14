// ③ 전에 1회: 고정 템플릿으로 앱 뼈대 생성 + 의존성 설치. 이미 있는 파일은 건드리지 않는다.
// 사용: node harness/scripts/scaffold.mjs [--no-install]
import { execSync } from "node:child_process";
import { exists, readJSON, writeJSON, writeText, readText } from "./lib.mjs";

const files = {
  "index.html": `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>요금제 추천·구독</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
  "vite.config.ts": `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
`,
  "tsconfig.json": `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
`,
  "eslint.config.js": `import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
);
`,
  "src/main.tsx": `// 자동 생성 파일 — harness/scripts/scaffold.mjs. 직접 수정 금지.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { router } from "./router";
import "./styles/tokens.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
`,
};

const pkgAdd = {
  scripts: {
    dev: "vite",
    build: "vite build",
    preview: "vite preview",
    lint: "eslint src",
    typecheck: "tsc --noEmit",
  },
  dependencies: {
    react: "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.0.0",
  },
  devDependencies: {
    "@eslint/js": "^9.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    eslint: "^9.0.0",
    "eslint-plugin-react-hooks": "^5.2.0",
    globals: "^15.0.0",
    playwright: "^1.48.0",
    tailwindcss: "^4.0.0",
    typescript: "^5.6.0",
    "typescript-eslint": "^8.0.0",
    vite: "^6.0.0",
  },
};

for (const [rel, body] of Object.entries(files)) {
  if (exists(rel)) console.log(`  · ${rel} 있음 — 건너뜀`);
  else {
    writeText(rel, body);
    console.log(`  + ${rel}`);
  }
}

const pkg = readJSON("package.json");
for (const k of Object.keys(pkgAdd))
  pkg[k] = { ...pkgAdd[k], ...(pkg[k] ?? {}) };
writeJSON("package.json", pkg);
console.log("  ~ package.json 앱 스크립트·의존성 추가");

const gi = exists(".gitignore") ? readText(".gitignore") : "";
if (!/^dist\/?$/m.test(gi))
  writeText(".gitignore", gi.replace(/\n?$/, "\n") + "dist/\n");

if (!process.argv.includes("--no-install")) {
  execSync("npm install", { stdio: "inherit" });
  execSync("npx playwright install chromium", { stdio: "inherit" });
}
console.log("✅ 앱 뼈대 준비 완료. 다음: npm run harness:tokens");
