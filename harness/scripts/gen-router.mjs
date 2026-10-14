// harness/out/01-spec.json 의 screens → src/router.tsx
// 사용: node harness/scripts/gen-router.mjs [--stdout]
import { readJSON, exists, writeText } from "./lib.mjs";

export function renderRouter() {
  if (!exists("harness/out/01-spec.json"))
    throw new Error("harness/out/01-spec.json 이 없습니다. ①부터 진행하세요.");
  const screens = [...readJSON("harness/out/01-spec.json").screens].sort(
    (a, b) => a.order - b.order,
  );
  const L = [];
  L.push("// 자동 생성 파일 — harness/scripts/gen-router.mjs. 직접 수정 금지.");
  L.push("// 출처: harness/out/01-spec.json screens");
  L.push('import { createBrowserRouter, Navigate } from "react-router";');
  // 아직 없는 페이지는 import하지 않고 pending 자리표시로 둔다 (④ 화면 1개씩 진행 중 빌드 유지)
  const ready = (s) => exists(`src/pages/${s.page}.tsx`);
  screens.filter(ready).forEach((s) =>
    L.push(`import { ${s.page} } from "./pages/${s.page}";`),
  );
  L.push("");
  L.push("export const router = createBrowserRouter([");
  L.push(
    `  { path: "/", element: <Navigate to="${screens[0].route}" replace /> },`,
  );
  screens.forEach((s) =>
    L.push(
      ready(s)
        ? `  { path: "${s.route}", element: <${s.page} /> }, // harness:screen ${s.name}`
        : `  { path: "${s.route}", element: <Navigate to="${screens[0].route}" replace /> }, // harness:pending ${s.name}`,
    ),
  );
  L.push("]);");
  return L.join("\n") + "\n";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = renderRouter();
  if (process.argv.includes("--stdout")) process.stdout.write(out);
  else {
    writeText("src/router.tsx", out);
    console.log("✅ src/router.tsx 생성");
  }
}
