// 하네스 상태 관리: start | stop | enter <agent> | exit | status | approve | reject <route> <사유>
// 상태 파일: harness/state.json (훅이 status·activeAgent를 읽는다)
import { execSync } from "node:child_process";
import { loadRules, loadState, saveState } from "./lib.mjs";

const sh = (cmd) =>
  execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const today = () => new Date().toISOString().slice(0, 10).replace(/-/g, "");
const die = (msg) => {
  console.error(`❌ ${msg}`);
  process.exit(1);
};

const [cmd, ...args] = process.argv.slice(2);
const rules = loadRules();
const state = loadState();

switch (cmd) {
  case "start": {
    if (state.status === "running")
      die(
        "이미 실행 중입니다. 이어 하려면 '이어서 해줘', 처음부터라면 harness:stop 후 다시 시작하세요.",
      );
    const branch = sh("git rev-parse --abbrev-ref HEAD");
    if (!branch.startsWith(rules.branchPrefix)) {
      const target = `${rules.branchPrefix}${today()}`;
      const has = sh(`git branch --list ${target}`);
      sh(has ? `git checkout ${target}` : `git checkout -b ${target}`);
      console.log(`🌿 브랜치: ${target}`);
    }
    saveState({
      status: "running",
      stage: state.stage ?? 1,
      activeAgent: null,
      screensDone: state.screensDone ?? [],
      attempts: state.attempts ?? {},
      startedAt: state.startedAt ?? new Date().toISOString(),
    });
    console.log(`▶ 하네스 실행 중 — 현재 단계 ${state.stage ?? 1}`);
    break;
  }
  case "stop":
    saveState({ ...state, status: "stopped", activeAgent: null });
    console.log("⏸ 하네스 중지. 기존 에이전트 차단이 해제됩니다.");
    break;
  case "enter": {
    const agent = args[0];
    if (!rules.agents[agent])
      die(
        `하네스 에이전트가 아닙니다: ${agent} (허용: ${Object.keys(rules.agents).join(", ")})`,
      );
    if (state.status !== "running")
      die("하네스가 실행 중이 아닙니다. 먼저 harness:start");
    saveState({ ...state, activeAgent: agent });
    console.log(
      `→ activeAgent = ${agent} (편집 범위: ${rules.agents[agent].edit.join(", ") || "없음"})`,
    );
    break;
  }
  case "exit":
    saveState({ ...state, activeAgent: null });
    console.log("← activeAgent 해제");
    break;
  case "approve": {
    if (state.stage !== "approval")
      die(
        `승인 대기 상태가 아닙니다 (현재 단계: ${state.stage}). G5를 먼저 통과해야 합니다.`,
      );
    saveState({ ...state, status: "done", stage: "done", activeAgent: null });
    sh("git add -A");
    sh(`git commit -m "harness: 승인 완료"`);
    console.log("🎉 승인 완료 — 커밋했습니다.");
    break;
  }
  case "reject": {
    const [route, ...why] = args;
    if (!route) die("사용: npm run harness:reject -- <route> <사유>");
    saveState({
      ...state,
      stage: 4,
      screensDone: (state.screensDone ?? []).filter((r) => r !== route),
      rejected: [
        ...(state.rejected ?? []),
        { route, reason: why.join(" "), at: new Date().toISOString() },
      ],
    });
    console.log(`↩ ${route} 반려 — ④로 되돌아갑니다. 사유: ${why.join(" ")}`);
    break;
  }
  case "status":
  default:
    console.log(JSON.stringify(state, null, 2));
}
