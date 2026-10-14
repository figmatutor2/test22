// 게이트 실행기. 사용: node harness/scripts/gate.mjs <1|2|3|4|5> [route]
// 결과: 콘솔 리포트 + harness/out/05-report.json. 통과 시(하네스 실행 중) 자동 커밋, 실패 시 재시도 횟수 증가.
import { execSync } from "node:child_process";
import fs from "node:fs";
import {
  abs,
  exists,
  readJSON,
  readText,
  writeJSON,
  writeText,
  loadRules,
  loadState,
  saveState,
  parseScreens,
  parsePrdPlans,
  countPrdOx,
  parseDesignComponents,
  componentDir,
  failure,
  printResult,
} from "./lib.mjs";
import { lintPaths } from "./token-lint.mjs";
import { renderTokensCss } from "./gen-tokens.mjs";
import { renderRouter } from "./gen-router.mjs";

const [n, route] = process.argv.slice(2);
const rules = loadRules();
const SPEC = "harness/out/01-spec.json";
const LAYOUT = "harness/out/02-layout.json";

const run = (cmd) => {
  try {
    execSync(cmd, {
      cwd: abs("."),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return null;
  } catch (e) {
    const tail = `${e.stdout ?? ""}${e.stderr ?? ""}`
      .trim()
      .split("\n")
      .slice(-12)
      .join("\n    ");
    return tail || e.message;
  }
};
const lintFailures = (paths, back) =>
  lintPaths(paths).map((v) =>
    failure(`토큰 밖 값(${v.rule})`, v.detail, {
      file: v.file,
      line: v.line,
      back,
    }),
  );
const toolFailures = (back) => {
  const out = [];
  for (const [name, cmd] of [
    ["typecheck", "npm run typecheck"],
    ["lint", "npm run lint"],
    ["build", "npm run build"],
  ]) {
    const err = run(cmd);
    if (err) out.push(failure(`${name} 실패`, `\n    ${err}`, { back }));
  }
  return out;
};
const sameSet = (a, b) =>
  a.length === b.length && a.every((x) => b.includes(x));

// ---------- G1 스펙 ----------
function g1() {
  const back = "①";
  const f = [];
  if (!exists(SPEC)) return [failure("G1 스펙", `${SPEC} 없음`, { back })];
  const spec = readJSON(SPEC);
  const doc = parseScreens();
  const screens = [...(spec.screens ?? [])].sort((a, b) => a.order - b.order);
  if (screens.length !== doc.length)
    f.push(
      failure("화면 수", `${screens.length}개 (screens.md ${doc.length}개)`, {
        back,
      }),
    );
  doc.forEach((d, i) => {
    const s = screens[i];
    if (!s) return;
    if (s.name !== d.name)
      f.push(
        failure(
          "화면 이름",
          `${i + 1}번 '${s.name}' (screens.md '${d.name}')`,
          { back },
        ),
      );
    if (s.route !== d.route)
      f.push(
        failure("라우트", `${i + 1}번 '${s.route}' (screens.md '${d.route}')`, {
          back,
        }),
      );
  });
  const pages = screens.map((s) => s.page);
  pages.forEach(
    (p) =>
      !/^[A-Z][A-Za-z0-9]*$/.test(p ?? "") &&
      f.push(failure("페이지 이름", `'${p}'는 PascalCase가 아님`, { back })),
  );
  if (new Set(pages).size !== pages.length)
    f.push(failure("페이지 이름", "중복 있음", { back }));

  const prd = parsePrdPlans();
  if ((spec.plans ?? []).length !== prd.length)
    f.push(
      failure(
        "요금제 수",
        `${spec.plans?.length ?? 0}개 (PRD ${prd.length}개)`,
        { back },
      ),
    );
  for (const p of prd) {
    const s = spec.plans?.find((x) => x.id === p.id);
    if (!s) {
      f.push(failure("요금제 값", `${p.id} 없음`, { back }));
      continue;
    }
    for (const k of Object.keys(p))
      if (JSON.stringify(s[k]) !== JSON.stringify(p[k]))
        f.push(
          failure(
            "요금제 값",
            `${p.id}.${k} = ${JSON.stringify(s[k])} (PRD ${JSON.stringify(p[k])})`,
            { back },
          ),
        );
  }

  const oxN = countPrdOx();
  if ((spec.ox ?? []).length !== oxN)
    f.push(
      failure("O/X 규칙 수", `${spec.ox?.length ?? 0}개 (PRD ${oxN}개)`, {
        back,
      }),
    );

  const source = readText("docs/PRD.md") + readText("docs/screens.md");
  for (const s of screens) {
    for (const c of [
      ...(s.requiredCopy ?? []),
      ...(s.conditionalCopy ?? []).map((x) => x.text),
    ])
      if (!source.includes(c))
        f.push(
          failure(
            "지어낸 문구",
            `'${c}' (${s.route})가 PRD·screens.md에 없음`,
            { back },
          ),
        );
  }
  const routes = screens.map((s) => s.route);
  for (const fl of spec.flows ?? [])
    if (!routes.includes(fl.from) || !routes.includes(fl.to))
      f.push(
        failure("흐름", `${fl.from} → ${fl.to} 에 spec에 없는 라우트`, {
          back,
        }),
      );
  return f;
}

// ---------- G2 구성 ----------
function g2() {
  const back = "②";
  const f = [];
  if (!exists(LAYOUT)) return [failure("G2 구성", `${LAYOUT} 없음`, { back })];
  const layout = readJSON(LAYOUT);
  const doc = parseScreens();
  const design = parseDesignComponents();
  const excluded = rules.excluded.components;
  const specRoutes = readJSON(SPEC).screens.map((s) => s.route);
  const layoutRoutes = (layout.screens ?? []).map((s) => s.route);
  if (!sameSet(specRoutes, layoutRoutes))
    f.push(
      failure("라우트", `layout [${layoutRoutes}] ≠ spec [${specRoutes}]`, {
        back,
      }),
    );
  for (const d of doc) {
    const s = layout.screens?.find((x) => x.route === d.route);
    if (!s) continue;
    const names = [
      ...new Set(
        (s.components ?? []).flatMap((c) => [c.name, ...(c.children ?? [])]),
      ),
    ];
    const expected = d.components.filter((c) => !excluded.includes(c));
    const missing = expected.filter((c) => !names.includes(c));
    const extra = names.filter((c) => !expected.includes(c));
    if (missing.length)
      f.push(
        failure("구성 누락", `${d.route}: ${missing.join(", ")}`, { back }),
      );
    if (extra.length)
      f.push(
        failure(
          "구성 초과",
          `${d.route}: ${extra.join(", ")} (screens.md 구성 요소에 없음 또는 제외 대상)`,
          { back },
        ),
      );
    for (const c of names)
      if (!design.includes(c))
        f.push(
          failure("Design.md 밖 컴포넌트", `${d.route}: '${c}'`, { back }),
        );
  }
  return f;
}

// ---------- G3 토큰 ----------
function g3() {
  const back = "③";
  const f = [];
  if (!exists("eslint.config.js") || !exists("node_modules"))
    return [
      failure("환경", "앱 뼈대 없음 — npm run harness:scaffold", {
        back: "③ 사전 스크립트",
      }),
    ];
  if (
    !exists("src/styles/tokens.css") ||
    readText("src/styles/tokens.css") !== renderTokensCss()
  )
    f.push(
      failure(
        "생성 파일 불일치",
        "src/styles/tokens.css ≠ tokens.json 생성 결과 — npm run harness:tokens",
        { back: "③ 사전 스크립트" },
      ),
    );
  f.push(...lintFailures(["src/components/ui"], back));

  const layout = readJSON(LAYOUT);
  const uniq = [
    ...new Set(
      layout.screens.flatMap((s) =>
        s.components.flatMap((c) => [c.name, ...(c.children ?? [])]),
      ),
    ),
  ];
  const want = uniq.map(componentDir);
  const dir = abs("src/components/ui");
  const have = fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((d) => fs.statSync(`${dir}/${d}`).isDirectory())
    : [];
  const missing = want.filter((d) => !have.includes(d));
  const extra = have.filter((d) => !want.includes(d));
  if (missing.length)
    f.push(failure("컴포넌트 누락", missing.join(", "), { back }));
  if (extra.length)
    f.push(failure("구성표에 없는 컴포넌트", extra.join(", "), { back }));
  if (have.length !== want.length)
    f.push(
      failure("컴포넌트 수", `${have.length}개 (구성표 ${want.length}개)`, {
        back,
      }),
    );
  for (const d of have.filter((x) => want.includes(x)))
    for (const file of [`${d}.tsx`, "index.ts"])
      if (!exists(`src/components/ui/${d}/${file}`))
        f.push(
          failure("파일 구성", `src/components/ui/${d}/${file} 없음`, { back }),
        );

  const files = have
    .flatMap((d) => [
      `src/components/ui/${d}/${d}.tsx`,
      `src/components/ui/${d}/index.ts`,
    ])
    .filter(exists);
  if (files.length) {
    const tsc = run(
      `npx tsc --noEmit --strict --jsx react-jsx --module esnext --moduleResolution bundler --target es2022 --skipLibCheck --types vite/client ${files.join(" ")}`,
    );
    if (tsc) f.push(failure("typecheck 실패", `\n    ${tsc}`, { back }));
    const es = run("npx eslint src/components/ui");
    if (es) f.push(failure("lint 실패", `\n    ${es}`, { back }));
  }
  return f;
}

// ---------- G4 화면 ----------
async function g4() {
  const spec = readJSON(SPEC);
  const screens = [...spec.screens].sort((a, b) => a.order - b.order);
  const screen = screens.find((s) => s.route === route);
  if (!screen)
    return [
      failure(
        "사용법",
        `npm run gate:4 -- <route>  (route: ${screens.map((s) => s.route).join(" | ")})`,
        {},
      ),
    ];
  const back = `④ ${route}`;
  const f = [];
  const done = loadState().screensDone ?? [];
  const before = screens.filter(
    (s) => s.order < screen.order && !done.includes(s.route),
  );
  if (before.length)
    f.push(
      failure(
        "순서",
        `먼저 통과해야 할 화면: ${before.map((s) => s.route).join(", ")}`,
        { back: `④ ${before[0].route}` },
      ),
    );
  if (!exists(`src/pages/${screen.page}.tsx`))
    return [
      ...f,
      failure("페이지 없음", `src/pages/${screen.page}.tsx`, { back }),
    ];
  writeText("src/router.tsx", renderRouter());
  f.push(...lintFailures(["src/pages", "src/components/ui"], back));
  const tools = toolFailures(back);
  f.push(...tools);
  if (!tools.some((t) => t.rule.startsWith("build"))) {
    const { renderCheck } = await import("./render-check.mjs");
    f.push(...(await renderCheck(route)));
  }
  return f;
}

// ---------- G5 최종 ----------
async function g5() {
  const f = [];
  const spec = readJSON(SPEC);
  writeText("src/router.tsx", renderRouter());
  const router = readText("src/router.tsx");
  const real = (router.match(/\/\/ harness:screen /g) ?? []).length;
  const pending = (router.match(/\/\/ harness:pending /g) ?? []).length;
  if (real !== spec.screens.length || pending)
    f.push(
      failure(
        "라우트 수 = 화면 수",
        `구현 라우트 ${real}개, 미구현 ${pending}개 (화면 ${spec.screens.length}개)`,
        { back: "④" },
      ),
    );
  f.push(...lintFailures(["src"], "④"));
  const tools = toolFailures("④");
  f.push(...tools);
  if (!tools.some((t) => t.rule.startsWith("build"))) {
    fs.rmSync(abs("harness/out/screens"), { recursive: true, force: true });
    const { renderCheck } = await import("./render-check.mjs");
    f.push(...(await renderCheck("all")));
    const shots = exists("harness/out/screens")
      ? fs
          .readdirSync(abs("harness/out/screens"))
          .filter((x) => x.endsWith(".png"))
      : [];
    if (shots.length !== spec.screens.length)
      f.push(
        failure(
          "스크린샷",
          `${shots.length}장 (기대 ${spec.screens.length}장)`,
          { back: "④" },
        ),
      );
  }
  return f;
}

// ---------- 실행 · 기록 · 커밋 ----------
const GATES = {
  1: ["G1 스펙", g1, "harness(①): 스펙 통과"],
  2: ["G2 구성", g2, "harness(②): 구성 통과"],
  3: ["G3 토큰", g3, "harness(③): 토큰 적용 통과"],
  4: [`G4 화면 ${route ?? ""}`, g4, null],
  5: ["G5 최종", g5, "harness(⑤): 최종 통과"],
};
if (!GATES[n]) {
  console.error("사용: node harness/scripts/gate.mjs <1|2|3|4|5> [route]");
  process.exit(2);
}
const [title, fn, commitMsg] = GATES[n];
if (n >= 2 && !exists(SPEC)) {
  printResult(title, [failure("선행 단계", `${SPEC} 없음`, { back: "①" })]);
  process.exit(1);
}
if (n >= 3 && !exists(LAYOUT)) {
  printResult(title, [failure("선행 단계", `${LAYOUT} 없음`, { back: "②" })]);
  process.exit(1);
}

const failures = await fn();
printResult(title, failures);

const reportPath = "harness/out/05-report.json";
const report = exists(reportPath) ? readJSON(reportPath) : { gates: {} };
report.gates[title.trim()] = {
  at: new Date().toISOString(),
  pass: failures.length === 0,
  failures,
};
writeJSON(reportPath, report);

const state = loadState();
const key = title.trim();
state.attempts ??= {};
if (failures.length) {
  state.attempts[key] = (state.attempts[key] ?? 0) + 1;
  console.log(`재시도: ${state.attempts[key]}/${rules.maxAttempts}`);
  if (state.attempts[key] >= rules.maxAttempts)
    console.log("⛔ 재시도 한도 도달 — 멈추고 사람 확인 필요");
  if (state.status === "running") saveState(state);
  process.exit(1);
}

delete state.attempts[key];
if (Number(n) === 4) {
  state.screensDone = [...new Set([...(state.screensDone ?? []), route])];
  const all = readJSON(SPEC).screens.every((s) =>
    state.screensDone.includes(s.route),
  );
  state.stage = all ? 5 : 4;
} else state.stage = Number(n) === 5 ? "approval" : Number(n) + 1;

if (state.status === "running") {
  saveState(state);
  const branch = execSync("git rev-parse --abbrev-ref HEAD", {
    encoding: "utf8",
  }).trim();
  const msg =
    commitMsg ??
    `harness(④${route}): ${readJSON(SPEC).screens.find((s) => s.route === route).name} 통과`;
  if (branch.startsWith(rules.branchPrefix)) {
    execSync("git add -A", { cwd: abs(".") });
    if (run("git diff --cached --quiet"))
      execSync(`git commit -m "${msg}"`, { cwd: abs("."), stdio: "ignore" });
    console.log(`📌 커밋: ${msg}`);
  } else
    console.log(
      `⚠ ${branch} 브랜치라 커밋하지 않음 (harness:start 로 하네스 브랜치에서 실행하세요)`,
    );
}
if (Number(n) === 5)
  console.log(
    "👤 harness/out/screens/ 스크린샷을 확인하고 '승인' 또는 '반려 <route> <사유>'로 답해 주세요.",
  );
process.exit(0);
