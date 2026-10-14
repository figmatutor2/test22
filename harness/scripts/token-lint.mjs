// 토큰 밖 값 검출기. 훅(guard-write)과 G3·G4·G5가 함께 쓴다.
// 사용: node harness/scripts/token-lint.mjs <파일|폴더>...   (위반 있으면 종료 코드 1)
import fs from "node:fs";
import path from "node:path";
import { ROOT, tokenModel, loadRules, printResult, failure } from "./lib.mjs";

const CODE_EXT = /\.(tsx?|jsx?|css)$/;
const NAMED_COLORS =
  "red|blue|green|white|black|gray|grey|yellow|orange|purple|pink|brown|cyan|magenta|silver|gold|navy|teal|maroon|olive|lime|aqua|fuchsia|indigo|violet";

// Tailwind 유틸리티 접두사 → 허용 값 종류
const SPACING_PREFIX =
  "p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y|w|h|min-w|min-h|max-w|max-h|size|inset|inset-x|inset-y|top|right|bottom|left|start|end|translate-x|translate-y|basis|scroll-m|scroll-p";
const SPACING_KEYWORDS = new Set([
  "0",
  "auto",
  "full",
  "screen",
  "fit",
  "min",
  "max",
  "none",
  "dvh",
  "svh",
  "lvh",
  "dvw",
]);
const COLOR_PREFIX =
  "bg|border|border-t|border-r|border-b|border-l|border-x|border-y|outline|ring|fill|stroke|decoration|divide|placeholder|caret|accent";
const COLOR_KEYWORDS = new Set(["transparent", "current", "inherit"]);
const BORDER_KEYWORDS = new Set([
  "0",
  "solid",
  "dashed",
  "dotted",
  "none",
  "collapse",
  "separate",
]);
const TEXT_KEYWORDS = new Set([
  "left",
  "center",
  "right",
  "justify",
  "start",
  "end",
  "wrap",
  "nowrap",
  "balance",
  "pretty",
  "ellipsis",
  "clip",
]);
const RADIUS_PREFIX =
  "rounded|rounded-t|rounded-r|rounded-b|rounded-l|rounded-tl|rounded-tr|rounded-bl|rounded-br|rounded-s|rounded-e|rounded-ss|rounded-se|rounded-es|rounded-ee";

// 긴 접두사부터 맞추도록 정렬 (border-t 가 border 보다 먼저)
const alt = (s) => s.split("|").sort((a, b) => b.length - a.length).join("|");

let MODEL;
const model = () => (MODEL ??= tokenModel());

// 주석 제거(줄 번호 유지)
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(
      /(^|[^:"'`])\/\/[^\n]*/g,
      (m, p) => p + " ".repeat(m.length - p.length),
    );

function checkClass(cls) {
  const { classValues: cv } = model();
  const base = cls.split(":").pop().replace(/^!/, "").replace(/^-/, "");
  if (base.includes("/") && !/^w-|^h-/.test(base) && /\/\d+$/.test(base))
    return "색 투명도 수식어(/숫자)";
  let m;
  if ((m = base.match(new RegExp(`^(${alt(SPACING_PREFIX)})-(.+)$`)))) {
    const v = m[2];
    if (v.startsWith("(")) return null; // 변수 축약은 var 검사에서
    if (/^\d+\/\d+$/.test(v)) return `분수 크기 '${cls}'`;
    if (v === "px") return `'${cls}'(1px)`;
    return SPACING_KEYWORDS.has(v) || cv.spacing.has(v)
      ? null
      : `간격 토큰에 없는 값 '${cls}'`;
  }
  if ((m = base.match(new RegExp(`^(${alt(RADIUS_PREFIX)})(?:-(.+))?$`)))) {
    if (!m[2]) return `값 없는 '${cls}'(기본 radius)`;
    return m[2] === "none" || cv.radius.has(m[2])
      ? null
      : `radius 토큰에 없는 값 '${cls}'`;
  }
  if ((m = base.match(/^text-(.+)$/))) {
    const v = m[1];
    return cv.color.has(v) ||
      cv.text.has(v) ||
      COLOR_KEYWORDS.has(v) ||
      TEXT_KEYWORDS.has(v)
      ? null
      : `텍스트 토큰에 없는 값 '${cls}'`;
  }
  if ((m = base.match(/^font-(.+)$/)))
    return cv.font.has(m[1]) ? null : `'${cls}'(굵기·서체는 텍스트 스타일로)`;
  if (/^(leading|tracking)-/.test(base))
    return `'${cls}'(줄높이·자간은 텍스트 스타일로)`;
  if (/^shadow(-|$)/.test(base) && base !== "shadow-none")
    return `'${cls}'(그림자 토큰 없음)`;
  if ((m = base.match(/^opacity-(.+)$/)))
    return ["0", "100"].includes(m[1]) ? null : `'${cls}'(투명도 토큰 없음)`;
  if ((m = base.match(new RegExp(`^(${alt(COLOR_PREFIX)})(?:-(.+))?$`)))) {
    const v = m[2];
    if (v === undefined) return null; // border, outline 단독(1px)
    if (/^border/.test(m[1]) && BORDER_KEYWORDS.has(v)) return null;
    if (/^\d+$/.test(v)) return `'${cls}'(두께는 border 1px만)`;
    return cv.color.has(v) || COLOR_KEYWORDS.has(v)
      ? null
      : `색 토큰에 없는 값 '${cls}'`;
  }
  return null;
}

// text: 파일 내용(또는 Edit 조각), filename: 확장자 판단용
export function lintText(text, filename = "x.tsx") {
  const { cssVars } = model();
  const out = [];
  const src = stripComments(text);
  const lines = src.split("\n");
  const isCss = filename.endsWith(".css");
  const add = (i, rule, detail) => out.push({ line: i + 1, rule, detail });

  lines.forEach((line, i) => {
    // 1. 색 리터럴
    for (const m of line.matchAll(/#([0-9a-fA-F]{3,8})\b/g))
      if (
        [3, 4, 6, 8].includes(m[1].length) &&
        !/&#/.test(line.slice(Math.max(0, m.index - 1), m.index + 1))
      )
        add(i, "색 리터럴", m[0]);
    for (const m of line.matchAll(
      /\b(rgba?|hsla?|oklch|oklab|lab|lch|color)\(/g,
    ))
      add(i, "색 리터럴", `${m[1]}(`);
    for (const m of line.matchAll(
      new RegExp(
        `(color|background|background-color|border-color|fill|stroke|outline-color|borderColor|backgroundColor)\\s*:\\s*['"]?(${NAMED_COLORS})\\b`,
        "gi",
      ),
    ))
      add(i, "색 리터럴", m[2]);
    if (!isCss)
      for (const m of line.matchAll(
        new RegExp(`\\b(fill|stroke|color)=["'](${NAMED_COLORS})["']`, "gi"),
      ))
        add(i, "색 리터럴", m[0]);

    // 2. 단위 붙은 숫자 (0, 100% 제외)
    for (const m of line.matchAll(
      /(?<![\w-])(\d*\.?\d+)(px|rem|em|vh|vw|dvh|svh|lvh|%)(?![\w])/g,
    )) {
      const n = Number(m[1]);
      if (n === 0 || (m[2] === "%" && n === 100)) continue;
      add(i, "단위 붙은 숫자", m[0]);
    }

    // 3. Tailwind 임의값 + 알 수 없는 var()
    for (const m of line.matchAll(
      /[\w-]*-\[[^\]\s]+\]|(?<=["'`\s])\[[a-z-]+:[^\]\s]+\]/g,
    ))
      add(i, "Tailwind 임의값", m[0]);
    for (const m of line.matchAll(/var\(\s*(--[\w-]+)/g))
      if (!cssVars.has(m[1]) && !m[1].startsWith("--tw-"))
        add(i, "토큰에 없는 변수", m[1]);
    for (const m of line.matchAll(/[\w-]+-\((--[\w-]+)\)/g))
      if (!cssVars.has(m[1])) add(i, "토큰에 없는 변수", m[0]);
  });

  // 4. Tailwind 기본 스케일 클래스 (문자열 리터럴 안의 단어만)
  if (!isCss) {
    for (const m of src.matchAll(/(["'`])((?:(?!\1)[^\n\\]|\\.)*)\1/g)) {
      const lineNo = src.slice(0, m.index).split("\n").length - 1;
      for (const cls of m[2].split(/\s+/).filter(Boolean)) {
        if (!/^[!-]?[a-z][\w:/.!-]*$/.test(cls)) continue;
        const why = checkClass(cls);
        if (why) add(lineNo, "Tailwind 기본·비토큰 클래스", why);
      }
    }
    // 5. style={{ }} 안 숫자 리터럴 (0 제외)
    for (const m of src.matchAll(/style=\{\{([\s\S]*?)\}\}/g)) {
      const start = src.slice(0, m.index).split("\n").length - 1;
      for (const n of m[1].matchAll(/:\s*(-?\d*\.?\d+)\b/g))
        if (Number(n[1]) !== 0)
          add(
            start + m[1].slice(0, n.index).split("\n").length - 1,
            "style 안 숫자",
            n[1],
          );
    }
  }
  return out;
}

export function lintPaths(paths) {
  const rules = loadRules();
  const skip = new Set(rules.generated.map((g) => path.join(ROOT, g)));
  const files = [];
  const walk = (p) => {
    if (!fs.existsSync(p)) return;
    if (fs.statSync(p).isDirectory())
      fs.readdirSync(p).forEach((f) => walk(path.join(p, f)));
    else if (CODE_EXT.test(p) && !skip.has(p)) files.push(p);
  };
  paths.forEach((p) => walk(path.resolve(ROOT, p)));
  return files.flatMap((f) =>
    lintText(fs.readFileSync(f, "utf8"), f).map((v) => ({
      file: path.relative(ROOT, f),
      ...v,
    })),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const targets = process.argv.slice(2);
  const v = lintPaths(targets.length ? targets : ["src"]);
  printResult(
    "토큰 밖 값 검사",
    v.map((x) =>
      failure(`토큰 밖 값(${x.rule})`, x.detail, {
        file: x.file,
        line: x.line,
      }),
    ),
  );
  process.exit(v.length ? 1 : 0);
}
