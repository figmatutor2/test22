// PreToolUse 훅 (Write | Edit | MultiEdit | NotebookEdit)
// 거부 = 종료 코드 2 + stderr 메시지(Claude에게 전달됨). 통과 = 종료 코드 0.
//  - 항상: src/ 코드에 토큰 밖 값이 있으면 거부
//  - 하네스 실행 중: docs/·reference/·생성 파일 쓰기 거부, activeAgent 편집 범위 밖 쓰기 거부
import path from "node:path";
import { ROOT, loadRules, loadState } from "../scripts/lib.mjs";
import { lintText } from "../scripts/token-lint.mjs";

const deny = (msg) => {
  process.stderr.write(`⛔ 하네스 훅 거부: ${msg}\n`);
  process.exit(2);
};

let input = "";
for await (const chunk of process.stdin) input += chunk;
const { tool_name, tool_input = {} } = JSON.parse(input || "{}");

const file = tool_input.file_path ?? tool_input.notebook_path;
if (!file) process.exit(0);
const rel = path.relative(ROOT, path.resolve(file)).split(path.sep).join("/");
if (rel.startsWith("..")) process.exit(0); // 저장소 밖(스크래치 등)은 관여하지 않음

const rules = loadRules();
const state = loadState();

if (state.status === "running") {
  if (rules.protected.some((p) => rel.startsWith(p)))
    deny(`${rel} — docs/·reference/는 읽기 전용입니다.`);
  if (rules.generated.includes(rel))
    deny(
      `${rel} — 스크립트 생성 파일입니다. tokens.json 또는 01-spec.json을 고친 뒤 생성 스크립트를 다시 돌리세요.`,
    );
  const agent = state.activeAgent;
  if (!agent)
    deny(
      `${rel} — 오케스트레이터(메인 대화)는 직접 구현하지 않습니다. harness:enter -- <agent> 후 에이전트를 부르세요.`,
    );
  const scope = rules.agents[agent]?.edit ?? [];
  if (!scope.some((p) => (p.endsWith("/") ? rel.startsWith(p) : rel === p)))
    deny(
      `${rel} — ${agent}의 편집 범위(${scope.join(", ") || "없음"}) 밖입니다.`,
    );
}

if (
  rel.startsWith("src/") &&
  /\.(tsx?|jsx?|css)$/.test(rel) &&
  !rules.generated.includes(rel)
) {
  const pieces =
    tool_name === "Write"
      ? [tool_input.content ?? ""]
      : tool_name === "Edit"
        ? [tool_input.new_string ?? ""]
        : tool_name === "MultiEdit"
          ? (tool_input.edits ?? []).map((e) => e.new_string ?? "")
          : [];
  const v = pieces.flatMap((p) => lintText(p, rel));
  if (v.length)
    deny(
      `${rel} 에 토큰 밖 값 ${v.length}건\n` +
        v
          .slice(0, 15)
          .map((x) => `  - ${x.line}행 ${x.rule}: ${x.detail}`)
          .join("\n") +
        "\n  → var(--color-*|--spacing-*|--radius-*|--text-*|--layout-*) 또는 @theme 토큰 클래스로 바꾸세요.",
    );
}
process.exit(0);
