// 렌더링 판정: 빌드된 앱(vite preview)을 Playwright로 열어 O/X 규칙·⛔(A)(B)·필수 문구를 DOM에서 센다.
// 화면 역할은 01-spec.json screens 순서로 정한다: [목록, 상세(:id), 신청, 완료]
// 사용(단독): node harness/scripts/render-check.mjs [route|all]
import { spawn } from "node:child_process";
import fs from "node:fs";
import {
  abs,
  readJSON,
  loadRules,
  formatWon,
  failure,
  printResult,
} from "./lib.mjs";

const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}`;

const routeRe = (route) => new RegExp(`^${route.replace(/:\w+/g, "[^/]+")}/?$`);
const fill = (route, id) => route.replace(/:\w+/, id);

async function startServer() {
  const proc = spawn(
    "npx",
    [
      "vite",
      "preview",
      "--port",
      String(PORT),
      "--strictPort",
      "--host",
      "127.0.0.1",
    ],
    {
      cwd: abs("."),
      stdio: "ignore",
    },
  );
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return proc;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  proc.kill();
  throw new Error(
    "vite preview 서버가 30초 안에 뜨지 않았습니다. npm run build 를 먼저 확인하세요.",
  );
}

export async function renderCheck(target = "all") {
  const rules = loadRules();
  const spec = readJSON("harness/out/01-spec.json");
  const [LIST, DETAIL, APPLY, COMPLETE] = [...spec.screens].sort(
    (a, b) => a.order - b.order,
  );
  const A = rules.critical.find((c) => c.id === "A");
  const B = rules.critical.find((c) => c.id === "B");
  const plans = spec.plans;
  const planById = Object.fromEntries(plans.map((p) => [p.id, p]));
  const trigger = (from, to) =>
    spec.flows.find((f) => f.from === from.route && f.to === to.route)?.trigger;
  const out = [];
  const fail = (rule, message, screen) =>
    out.push(
      failure(rule, message, { file: screen.route, back: `④ ${screen.route}` }),
    );

  const amounts = (text) =>
    [...text.matchAll(new RegExp(A.moneyPattern, "g"))].map((m) =>
      Number(m[1].replace(/,/g, "")),
    );
  const checkA = (text, plan, where, screen) => {
    const distinct = [...new Set(amounts(text))];
    const allowed = [plan.monthly_price, plan.price_after_discount].filter(
      (x) => x != null,
    );
    const extra = distinct.filter((n) => !allowed.includes(n));
    if (distinct.length > A.maxDistinctAmounts || extra.length)
      fail(
        A.name,
        `${where}: 금액 ${distinct.length}종 [${distinct.map(formatWon).join(", ")}], 허용 [${allowed.map(formatWon).join(", ")}]`,
        screen,
      );
    const hasMarker = text.includes(A.afterDiscountMarker);
    if (hasMarker !== (plan.price_after_discount != null))
      fail(
        A.name,
        `${where}: '${A.afterDiscountMarker}' ${hasMarker ? "있음(할인 없는 요금제)" : "없음(할인 요금제)"}`,
        screen,
      );
  };
  const checkB = (text, plan, where, screen) => {
    if (!plan.name.includes(B.planNameIncludes)) return;
    const n = [...text.matchAll(new RegExp(B.throttlePattern, "g"))].length;
    if (n !== B.exactCount)
      fail(
        B.name,
        `${where}: 속도 문구 ${n}개 (기대 ${B.exactCount}개)`,
        screen,
      );
  };
  const checkCopy = async (page, screen) => {
    const text = await page.locator("body").innerText();
    for (const c of screen.requiredCopy ?? [])
      if (!text.includes(c)) fail("필수 문구", `'${c}' 없음`, screen);
  };
  const checkExcluded = async (page, screen) => {
    for (const sel of rules.excluded.selectors) {
      const n = await page.locator(sel).count();
      if (n) fail("확인 필요 항목 노출", `${sel} ${n}개`, screen);
    }
    const text = await page.locator("body").innerText();
    for (const w of rules.excluded.textByRoute?.[screen.route] ?? [])
      if (text.includes(w)) fail("확인 필요 항목 노출", `'${w}' 문구`, screen);
  };
  const shot = async (page, screen) => {
    fs.mkdirSync(abs("harness/out/screens"), { recursive: true });
    await page.screenshot({
      path: abs(`harness/out/screens/${screen.order}-${screen.page}.png`),
    });
  };
  const atRoute = (page, screen) =>
    routeRe(screen.route).test(new URL(page.url()).pathname);

  const want = (s) => target === "all" || target === s.route;
  const needFlow =
    target === "all" || target === APPLY.route || target === COMPLETE.route;

  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    return [
      failure(
        "환경",
        "playwright 미설치 — npm run harness:scaffold 를 먼저 실행하세요.",
        { back: "③ 전 scaffold" },
      ),
    ];
  }
  const server = await startServer();
  const browser = await playwright.chromium.launch();
  const ctx = await browser.newContext({
    viewport: rules.viewport,
    locale: "ko-KR",
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(5000);

  try {
    // ---------- 목록 ----------
    if (want(LIST)) {
      try {
        await page.goto(BASE + LIST.route);
        const cards = page.locator('[data-component="Card/Plan"]');
        await cards.first().waitFor();
        const n = await cards.count();
        if (n !== plans.length)
          fail("O/X #1 카드 수", `${n}개 (기대 ${plans.length}개)`, LIST);
        const tags = page.locator('[data-component="Tag"]');
        const tagCount = await tags.count();
        const recommended = plans.filter((p) => p.recommended).map((p) => p.id);
        if (tagCount !== recommended.length)
          fail(
            "O/X #2 추천 Tag 수",
            `${tagCount}개 (기대 ${recommended.length}개)`,
            LIST,
          );
        for (let i = 0; i < tagCount; i++) {
          const id = await tags
            .nth(i)
            .evaluate((el) =>
              el
                .closest('[data-component="Card/Plan"]')
                ?.getAttribute("data-plan-id"),
            );
          if (!recommended.includes(id))
            fail(
              "O/X #2 추천 Tag 위치",
              `Tag가 ${id ?? "카드 밖"}에 있음 (기대 ${recommended.join(",")})`,
              LIST,
            );
        }
        for (let i = 0; i < n; i++) {
          const card = cards.nth(i);
          const id = await card.getAttribute("data-plan-id");
          const plan = planById[id];
          if (!plan) {
            fail(
              "DOM 규칙",
              `카드 ${i + 1}의 data-plan-id='${id}'가 spec에 없음`,
              LIST,
            );
            continue;
          }
          const text = await card.innerText();
          checkA(text, plan, `카드 ${id}`, LIST);
          checkB(text, plan, `카드 ${id}`, LIST);
        }
        await checkCopy(page, LIST);
        await checkExcluded(page, LIST);
        await shot(page, LIST);
      } catch (e) {
        fail("렌더링", `목록 검사 중단: ${e.message.split("\n")[0]}`, LIST);
      }
    }

    // ---------- 상세 (요금제마다) ----------
    if (want(DETAIL)) {
      for (const plan of plans) {
        try {
          await page.goto(BASE + fill(DETAIL.route, plan.id));
          await page.waitForLoadState("networkidle");
          const text = await page.locator("body").innerText();
          checkA(text, plan, `상세 ${plan.id}`, DETAIL);
          checkB(text, plan, `상세 ${plan.id}`, DETAIL);
          await checkExcluded(page, DETAIL);
          if (plan.id === rules.sample.detailPlanId) {
            await checkCopy(page, DETAIL);
            await shot(page, DETAIL);
          }
        } catch (e) {
          fail(
            "렌더링",
            `상세 ${plan.id} 검사 중단: ${e.message.split("\n")[0]}`,
            DETAIL,
          );
        }
      }
    }

    // ---------- 흐름: 목록 → 상세 → 신청 → 완료 (O/X #6, #7) ----------
    if (needFlow) {
      const plan = planById[rules.sample.flowPlanId];
      const { name, phone } = rules.sample.applicant;
      try {
        await page.goto(BASE + LIST.route);
        await page
          .locator(`[data-component="Card/Plan"][data-plan-id="${plan.id}"]`)
          .getByRole("button", { name: trigger(LIST, DETAIL), exact: true })
          .click();
        await page.waitForURL((u) => routeRe(DETAIL.route).test(u.pathname));
        await page
          .getByRole("button", { name: trigger(DETAIL, APPLY), exact: true })
          .click();
        await page.waitForURL((u) => routeRe(APPLY.route).test(u.pathname));
      } catch (e) {
        fail(
          "흐름",
          `목록→상세→신청 이동 실패: ${e.message.split("\n")[0]}`,
          APPLY,
        );
        throw new Error("STOP_FLOW");
      }

      // 신청 화면
      const submit = page.getByRole("button", {
        name: trigger(APPLY, COMPLETE),
        exact: true,
      });
      const nameIn = page.locator('[data-field="name"] input');
      const phoneIn = page.locator('[data-field="phone"] input');
      const agree = page.locator(
        '[data-component="Checkbox"] input[type="checkbox"]',
      );
      const seen = new Set();
      const collect = async () => {
        const t = await page.locator("body").innerText();
        for (const c of APPLY.conditionalCopy ?? [])
          if (t.includes(c.text)) seen.add(c.text);
      };
      try {
        await checkCopy(page, APPLY);
        await shot(page, APPLY);
        const disabledCase = async (label, n, p, a) => {
          await nameIn.fill(n);
          await phoneIn.fill(p);
          await agree.setChecked(a);
          await page.locator("body").click({ position: { x: 1, y: 1 } });
          await collect();
          if (!(await submit.isDisabled()))
            fail("O/X #6 신청하기 비활성", `${label}인데 버튼이 활성`, APPLY);
        };
        if (!(await submit.isDisabled()))
          fail("O/X #6 신청하기 비활성", "초기 상태인데 버튼이 활성", APPLY);
        await nameIn.focus();
        await phoneIn.focus();
        await collect();
        await disabledCase("이름 빈 값", "", phone, true);
        await disabledCase("휴대폰 10자리", name, phone.slice(0, 10), true);
        await disabledCase("동의 안 함", name, phone, false);
        await nameIn.fill(name);
        await phoneIn.fill(phone);
        await agree.setChecked(true);
        if (await submit.isDisabled())
          fail(
            "O/X #6 신청하기 활성",
            "모든 조건 충족인데 버튼이 비활성",
            APPLY,
          );

        // 저장 실패 시나리오
        await page.evaluate(() => {
          window.__setItem = Storage.prototype.setItem;
          Storage.prototype.setItem = () => {
            throw new Error("harness: 저장 실패 모의");
          };
        });
        await submit.click();
        await page.waitForTimeout(300);
        if (!atRoute(page, APPLY))
          fail("저장 실패 처리", "저장 실패인데 신청 화면을 벗어남", APPLY);
        await collect();
        if (await submit.isDisabled())
          fail("저장 실패 처리", "저장 실패 후 신청하기 버튼이 비활성", APPLY);
        await page.evaluate(() => {
          Storage.prototype.setItem = window.__setItem;
        });
        for (const c of APPLY.conditionalCopy ?? [])
          if (!seen.has(c.text))
            fail("조건부 문구", `'${c.text}' 표시 안 됨 (${c.when})`, APPLY);
      } catch (e) {
        fail(
          "렌더링",
          `신청 화면 검사 중단: ${e.message.split("\n")[0]}`,
          APPLY,
        );
      }

      // 완료 화면
      if (target === "all" || target === COMPLETE.route) {
        try {
          if (atRoute(page, APPLY)) await submit.click();
          await page.waitForURL((u) =>
            routeRe(COMPLETE.route).test(u.pathname),
          );
          const text = await page.locator("body").innerText();
          if (!text.includes(plan.name))
            fail(
              "O/X #7 완료 화면 값 일치",
              `요금제 이름 '${plan.name}' 없음`,
              COMPLETE,
            );
          if (!text.includes(formatWon(plan.monthly_price)))
            fail(
              "O/X #7 완료 화면 값 일치",
              `매달 내는 금액 '${formatWon(plan.monthly_price)}' 없음`,
              COMPLETE,
            );
          await checkCopy(page, COMPLETE);
          await shot(page, COMPLETE);
        } catch (e) {
          fail(
            "렌더링",
            `완료 화면 검사 중단: ${e.message.split("\n")[0]}`,
            COMPLETE,
          );
        }
      }
    }
  } catch (e) {
    if (e.message !== "STOP_FLOW")
      out.push(failure("렌더링", e.message.split("\n")[0], { back: "④" }));
  } finally {
    await browser.close();
    server.kill();
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const target = process.argv[2] ?? "all";
  const f = await renderCheck(target);
  printResult(`렌더링 판정 (${target})`, f);
  process.exit(f.length ? 1 : 0);
}
