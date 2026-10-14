// docs/tokens.json + rules.layout → src/styles/tokens.css (CSS 변수 + Tailwind v4 @theme)
// 사용: node harness/scripts/gen-tokens.mjs [--out <경로>] [--stdout]
import { tokenModel, loadRules, writeText } from "./lib.mjs";

export function renderTokensCss() {
  const m = tokenModel();
  const rules = loadRules();
  const L = [];
  L.push(
    "/* 자동 생성 파일 — harness/scripts/gen-tokens.mjs. 직접 수정 금지. */",
  );
  L.push("/* 출처: docs/tokens.json (SSOT), harness/rules.json#layout */");
  L.push('@import "tailwindcss";');
  L.push("");
  L.push("/* Tailwind 기본 테마를 비우고 토큰만 등록한다. */");
  L.push("@theme static {");
  L.push("  --*: initial;");
  L.push("");
  L.push("  /* color (semantic) */");
  m.colors.forEach((c) => L.push(`  --color-${c.key}: ${c.value};`));
  L.push("");
  L.push("  /* spacing */");
  m.spacing.forEach((s) => L.push(`  --spacing-${s.key}: ${s.value};`));
  m.layout.forEach((l) => L.push(`  --spacing-layout-${l.key}: ${l.value};`));
  L.push("");
  L.push("  /* radius */");
  m.radius.forEach((r) => L.push(`  --radius-${r.key}: ${r.value};`));
  L.push("");
  L.push("  /* font family */");
  m.fonts.forEach((f) => L.push(`  --font-${f.key}: ${f.value};`));
  L.push("");
  L.push("  /* text styles: text-<스타일> 하나로 크기·줄높이·굵기·자간 */");
  m.textStyles.forEach((s) => {
    L.push(`  --text-${s.key}: ${s.size};`);
    L.push(`  --text-${s.key}--line-height: ${s.lineHeight};`);
    L.push(`  --text-${s.key}--font-weight: ${s.weight};`);
    L.push(`  --text-${s.key}--letter-spacing: ${s.letterSpacing};`);
  });
  L.push("}");
  L.push("");
  L.push(":root {");
  L.push(`  /* layout — ${rules.layout.source} */`);
  m.layout.forEach((l) => L.push(`  --layout-${l.key}: ${l.value};`));
  L.push("");
  L.push("  /* font size (var 사용 전용) */");
  m.fontSizes.forEach((f) => L.push(`  --font-size-${f.key}: ${f.value};`));
  L.push("}");
  L.push("");
  L.push("@layer base {");
  L.push("  body {");
  L.push("    background: var(--color-bg-default);");
  L.push("    color: var(--color-text-primary);");
  L.push(`    font-family: var(--font-${m.fonts[0].key});`);
  L.push("  }");
  L.push("  #root {");
  L.push("    max-width: var(--spacing-390);");
  L.push("    min-height: 100dvh;");
  L.push("    margin-inline: auto;");
  L.push("    background: var(--color-bg-default);");
  L.push("  }");
  L.push("}");
  return L.join("\n") + "\n";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const css = renderTokensCss();
  if (args.includes("--stdout")) process.stdout.write(css);
  else {
    const i = args.indexOf("--out");
    const out = i >= 0 ? args[i + 1] : "src/styles/tokens.css";
    writeText(out, css);
    console.log(`✅ ${out} 생성 (${css.split("\n").length}줄)`);
  }
}
