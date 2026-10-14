// 하네스 공통 함수: docs 파싱, 토큰 모델, 상태 파일, 리포트 형식.
// 서비스별 값은 하드코딩하지 않고 docs/와 harness/rules.json에서 읽는다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
export const abs = (rel) => path.join(ROOT, rel);
export const exists = (rel) => fs.existsSync(abs(rel));
export const readText = (rel) => fs.readFileSync(abs(rel), "utf8");
export const readJSON = (rel) => JSON.parse(readText(rel));
export const writeText = (rel, text) => {
  fs.mkdirSync(path.dirname(abs(rel)), { recursive: true });
  fs.writeFileSync(abs(rel), text);
};
export const writeJSON = (rel, data) =>
  writeText(rel, JSON.stringify(data, null, 2) + "\n");

export const loadRules = () => readJSON("harness/rules.json");

// ---------- docs 파싱 ----------

// "/plans/[id]" → "/plans/:id"
export const normRoute = (r) =>
  r
    .trim()
    .replace(/`/g, "")
    .replace(/\[(\w+)\]/g, ":$1");

// screens.md: "## 화면이름" 섹션마다 라우트와 구성 요소 목록
export function parseScreens() {
  const md = readText("docs/screens.md");
  const sections = md.split(/^## /m).slice(1);
  return sections.map((sec) => {
    const lines = sec.split("\n");
    const name = lines[0].trim();
    const block = (title) => {
      const m = sec.match(
        new RegExp(`### ${title}\\n([\\s\\S]*?)(?=\\n### |$)`),
      );
      return m ? m[1].trim() : "";
    };
    const route = normRoute(block("라우트").split("\n")[0]);
    const components = block("구성 요소")
      .split("\n")
      .map((l) => l.match(/^- ([^:]+):/))
      .filter(Boolean)
      .map((m) => m[1].trim());
    return { name, route, components };
  });
}

// PRD.md "요금제 데이터" 표 → Plan[] (PRD 5장 데이터 모델 형식)
export function parsePrdPlans() {
  const md = readText("docs/PRD.md");
  const num = (s) => Number(s.replace(/[^\d]/g, ""));
  return md
    .split("\n")
    .filter((l) => /^\|\s*p\d+\s*\|/.test(l))
    .map((l) => {
      const c = l
        .split("|")
        .slice(1, -1)
        .map((x) => x.trim());
      const [id, name, price, data, throttle, after, rec, description] = c;
      const months = price.match(/(\d+)개월/);
      const afterM = after.match(/([\d,]+)원/);
      return {
        id,
        name,
        monthly_price: num(price.match(/[\d,]+원/)[0]),
        data,
        throttle_after: throttle === "속도 제한 없음" ? null : throttle,
        price_after_discount: afterM ? num(afterM[1]) : null,
        discount_months: months ? Number(months[1]) : null,
        description,
        recommended: rec === "추천",
      };
    });
}

// PRD.md "어기면 안 되는 것" 번호 목록 개수
export function countPrdOx() {
  const md = readText("docs/PRD.md");
  const m = md.match(/### 어기면 안 되는 것[^\n]*\n([\s\S]*?)(?=\n#|\n---)/);
  return m ? m[1].split("\n").filter((l) => /^\d+\.\s/.test(l)).length : 0;
}

// Design.md 4장 "#### `이름`" → 컴포넌트 이름 목록
export function parseDesignComponents() {
  return [...readText("docs/Design.md").matchAll(/^#### `([^`]+)`/gm)].map(
    (m) => m[1],
  );
}

// "Card/Plan" → "CardPlan", "icon/arrowLeft" → "IconArrowLeft"
export const componentDir = (name) =>
  name
    .split(/[\/\s-]+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");

// ---------- 토큰 모델 (tokens.json + rules.layout) ----------

export function tokenModel() {
  const t = readJSON("docs/tokens.json");
  const rules = loadRules();
  const key = (name) => name.replace(/\//g, "-");
  const pick = (col) => t.tokens.filter((x) => x.collection === col);
  const val = (x) => {
    const v = x.values.Default;
    return typeof v === "object" ? v.resolved : v;
  };

  const colors = pick("semantic").map((x) => ({
    key: key(x.name),
    value: val(x),
  }));
  const spacing = pick("spacing").map((x) => ({
    key: x.name.split("/")[1],
    value: `${val(x)}px`,
  }));
  const radius = pick("radius").map((x) => ({
    key: x.name.split("/")[1],
    value: `${val(x)}px`,
  }));
  const typo = pick("typography");
  const fonts = typo
    .filter((x) => x.name.startsWith("font-family/"))
    .map((x) => ({
      key: x.name.split("/")[1],
      value: `"${val(x)}", sans-serif`,
    }));
  const fontSizes = typo
    .filter((x) => x.name.startsWith("font-size/"))
    .map((x) => ({ key: x.name.split("/")[1], value: `${val(x)}px` }));
  const textStyles = t.textStyles.map((s) => ({
    key: key(s.name),
    size: `${typeof s.fontSize === "object" ? s.fontSize.resolved : s.fontSize}px`,
    lineHeight: `${s.lineHeight}px`,
    weight: s.fontWeight,
    letterSpacing: `${s.letterSpacing / 100}em`,
  }));
  const layout = Object.entries(rules.layout.values).map(([k, v]) => ({
    key: k,
    value: `${v}px`,
  }));

  const cssVars = new Set([
    ...colors.map((c) => `--color-${c.key}`),
    ...spacing.map((s) => `--spacing-${s.key}`),
    ...radius.map((r) => `--radius-${r.key}`),
    ...fonts.map((f) => `--font-${f.key}`),
    ...fontSizes.map((f) => `--font-size-${f.key}`),
    ...textStyles.flatMap((s) => [
      `--text-${s.key}`,
      `--text-${s.key}--line-height`,
      `--text-${s.key}--font-weight`,
      `--text-${s.key}--letter-spacing`,
    ]),
    ...layout.flatMap((l) => [
      `--layout-${l.key}`,
      `--spacing-layout-${l.key}`,
    ]),
  ]);

  const classValues = {
    color: new Set(colors.map((c) => c.key)),
    spacing: new Set([
      ...spacing.map((s) => s.key),
      ...layout.map((l) => `layout-${l.key}`),
    ]),
    radius: new Set(radius.map((r) => r.key)),
    text: new Set(textStyles.map((s) => s.key)),
    font: new Set(fonts.map((f) => f.key)),
  };

  return {
    colors,
    spacing,
    radius,
    fonts,
    fontSizes,
    textStyles,
    layout,
    cssVars,
    classValues,
  };
}

// ---------- 상태 파일 ----------

const STATE = "harness/state.json";
export const loadState = () =>
  exists(STATE)
    ? readJSON(STATE)
    : {
        status: "idle",
        stage: 1,
        activeAgent: null,
        screensDone: [],
        attempts: {},
      };
export const saveState = (s) => writeJSON(STATE, s);

// ---------- 공통 ----------

export const formatWon = (n) => `${n.toLocaleString("ko-KR")}원`;

// 실패 1건: { rule, message, file?, line?, back }
export const failure = (rule, message, extra = {}) => ({
  rule,
  message,
  ...extra,
});

export function printResult(title, failures) {
  if (failures.length === 0) {
    console.log(`✅ ${title} 통과`);
    return;
  }
  console.log(`❌ ${title} 실패 ${failures.length}건`);
  for (const f of failures) {
    const loc = f.file ? ` — ${f.file}${f.line ? `:${f.line}` : ""}` : "";
    const back = f.back ? ` → 되돌아갈 단계: ${f.back}` : "";
    console.log(`  ✗ ${f.rule}: ${f.message}${loc}${back}`);
  }
}
