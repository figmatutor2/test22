// PreToolUse 훅 (Agent | Task)
// 하네스 실행 중에는 rules.agents에 있는 5개 에이전트만, 그리고 harness:enter로 지정한 activeAgent만 호출 가능.
import { loadRules, loadState } from "../scripts/lib.mjs";

let input = "";
for await (const chunk of process.stdin) input += chunk;
const { tool_input = {} } = JSON.parse(input || "{}");

const state = loadState();
if (state.status !== "running") process.exit(0);

const rules = loadRules();
const allowed = Object.keys(rules.agents);
const agent = tool_input.subagent_type ?? "general-purpose";

if (!allowed.includes(agent)) {
  process.stderr.write(
    `⛔ 하네스 훅 거부: 하네스 실행 중에는 '${agent}' 에이전트를 쓸 수 없습니다. 허용: ${allowed.join(", ")}\n` +
      `  (하네스 밖에서 쓰려면 npm run harness:stop)\n`,
  );
  process.exit(2);
}
if (state.activeAgent !== agent) {
  process.stderr.write(
    `⛔ 하네스 훅 거부: activeAgent가 '${state.activeAgent ?? "없음"}'입니다. 먼저 npm run harness:enter -- ${agent}\n`,
  );
  process.exit(2);
}
process.exit(0);
