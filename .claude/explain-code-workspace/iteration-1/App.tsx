/**
 * 📌 이 파일은: 요금제 고르기부터 신청 완료까지, 이 앱의 모든 화면을 담고 있는 파일이에요.
 *
 * 큰 흐름 (위에서 아래 순서)
 *  1. 양식 정하기: 화면·요금제·신청서가 어떤 정보를 갖는지 정해요
 *  2. 데이터 준비: 실제 요금제 4개의 내용을 적어 둬요
 *  3. 작은 부품 만들기: 헤더, 버튼, 필터, 태그, 목록 한 줄, 하단 버튼 영역, 요금제 카드
 *  4. 화면 4개 만들기: 요금제 목록 → 상세 → 신청 → 완료
 *  5. 교통정리(App): 주소창을 보고 4개 화면 중 무엇을 보여줄지 골라요
 *
 * 처음 보는 용어
 *  - 컴포넌트: 화면을 이루는 레고 블록이에요. 버튼 하나도, 화면 전체도 컴포넌트예요.
 *    이 파일에서 대문자로 시작하는 function(Header, Button...)이 전부 컴포넌트예요.
 *  - props: 컴포넌트에 건네주는 재료예요. 같은 Button이라도 글자·색을 다르게 넣을 수 있어요.
 *  - type: "이 데이터는 이런 항목을 가져야 해요"라고 정해 둔 양식이에요. 화면에 보이지는 않고, 실수를 미리 잡아줘요.
 *  - state(상태): 화면이 기억하고 있는 값이에요. 값이 바뀌면 화면이 자동으로 다시 그려져요.
 *  - JSX: return ( ... ) 안에 있는 <태그> 모양의 코드예요. 화면에 무엇을 그릴지 적은 설계도예요.
 *  - className: 그 태그에 어떤 디자인(색·크기·여백)을 입힐지 가리키는 이름표예요. 실제 디자인은 index.css에 있어요.
 */

// 이 파일에서 쓸 도구를 React(화면을 만드는 도구 모음)에서 가져와요.
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"

// 이 앱에 있는 화면 4가지를 적어 둔 양식이에요.
// plans(요금제 목록), detail(상세), apply(신청), complete(완료) 중 하나만 될 수 있어요.
// 상세·신청 화면은 "어떤 요금제인지"(planId)도 함께 기억해요.
type Route = { name: "plans" } | { name: "detail" planId: string } | {
  name: "apply"
  planId: string
} | { name: "complete" }

// 요금제 하나가 가져야 할 정보의 양식이에요.
// 이름 뒤에 ?가 붙은 항목(originalPrice?, badge? 등)은 없어도 되는 선택 항목이에요.
type Plan = {
  id: string
  name: string
  price: number
  originalPrice?: number
  discount?: string
  data: string
  description: string
  badge?: string
  promo?: string
  categories: Array<"데이터 많이" | "가성비" | "구독 포함" | "통화 많이">
  benefits: string[]
}

// 신청서 한 장의 양식이에요: 신청 번호, 고른 요금제, 이름, 전화번호, 신청 일시.
type Application = {
  number: string
  plan: Plan
  name: string
  phone: string
  appliedAt: string
}

// 실제 요금제 4개의 내용이에요. 화면에 보이는 요금제 정보는 전부 여기서 나와요.
// 가격이나 문구를 바꾸고 싶으면 이 부분만 고치면 돼요.
const plans: Plan[] = [
  {
    id: "unlimited",
    name: "넉넉 무제한",
    price: 85000,
    originalPrice: 100000,
    discount: "15%",
    data: "무제한",
    description: "영상·게임을 하루 종일 해도 걱정 없어요",
    badge: "추천",
    promo: "24개월 할인 프로모션",
    categories: ["데이터 많이", "구독 포함", "통화 많이"],
    benefits: ["넷플릭스 스탠다드", "유튜브 프리미엄"],
  },
  {
    id: "standard",
    name: "스탠다드 110",
    price: 69000,
    originalPrice: 78000,
    discount: "12%",
    data: "110GB",
    description: "데이터 110GB · 통화 무제한",
    badge: "추천",
    promo: "24개월 할인 프로모션",
    categories: ["데이터 많이", "가성비", "통화 많이"],
    benefits: ["데이터 소진 후 5Mbps", "테더링 40GB"],
  },
  {
    id: "light",
    name: "라이트 30",
    price: 49000,
    data: "30GB",
    description: "데이터 30GB · 통화 무제한",
    badge: "추천",
    categories: ["데이터 많이", "가성비", "통화 많이"],
    benefits: ["데이터 소진 후 1Mbps", "테더링 10GB"],
  },
  {
    id: "slim",
    name: "슬림 10",
    price: 39000,
    originalPrice: 43000,
    discount: "10%",
    data: "10GB",
    description: "데이터 10GB · 통화 무제한",
    badge: "추천",
    categories: ["데이터 많이", "가성비", "통화 많이"],
    benefits: ["데이터 소진 후 1Mbps", "U+zone 무료"],
  },
]

// 목록 화면 위쪽에 나오는 필터 버튼 4개의 이름이에요.
// as const는 "이 목록은 앞으로 절대 바뀌지 않아요"라고 못 박는 표시예요.
const filters = ["데이터 많이", "가성비", "구독 포함", "통화 많이"] as const

// 85000 같은 숫자를 "85,000원" 모양의 글자로 바꿔줘요.
function formatPrice(price: number) {
  return `${price.toLocaleString("ko-KR")}원`
}

// 브라우저 주소창을 읽고, 지금 어떤 화면을 보여줘야 하는지 알아내는 함수예요.
// 예: 주소가 /plans/standard 이면 → "standard 요금제의 상세 화면"
function readRoute(): Route {
  const path = window.location.pathname
  // 주소가 "/plans/무언가" 모양인지 검사해요. 맞으면 그 "무언가"(요금제 id)를 match[1]에 담아줘요.
  // (/^...$/ 처럼 슬래시로 감싼 암호 같은 글자는 '정규식'이라고 해요. 글자의 모양을 검사하는 규칙이에요.)
  const match = path.match(/^\/plans\/([^/]+)$/)

  if (match) return { name: "detail", planId: match[1] }
  // 주소가 /apply?plan=standard 처럼 생겼으면 신청 화면이에요.
  // ?plan= 뒤에 적힌 요금제 id를 읽어요. A ?? B 는 "A가 비어 있으면 B를 써요"라는 뜻이라,
  // id가 없으면 첫 번째 요금제(plans[0])를 대신 써요.
  if (path === "/apply") {
    return {
      name: "apply",
      planId:
        new URLSearchParams(window.location.search).get("plan") ?? plans[0].id,
    }
  }
  if (path === "/complete") return { name: "complete" }
  return { name: "plans" }
}

// 바로 위 readRoute의 반대예요. 화면 정보를 받아서 주소창에 적을 주소를 만들어요.
// 예: 상세 화면 + standard → "/plans/standard"
function pathFor(route: Route) {
  if (route.name === "plans") return "/plans"
  if (route.name === "detail") return `/plans/${route.planId}`
  if (route.name === "apply") return `/apply?plan=${route.planId}`
  return "/complete"
}

// [부품] 화면 맨 위의 제목 줄이에요.
// root가 켜져 있으면 첫 화면용(제목 + U+ 로고), 아니면 뒤로가기 버튼 + 제목을 보여줘요.
// 중괄호 두 덩어리 중 앞쪽 { title, root, onBack }은 받는 재료(props)의 이름이고,
// 뒤쪽 { title: string ... }은 각 재료가 글자인지, 켜짐/꺼짐인지 같은 종류를 적은 거예요.
// root = false 는 "따로 안 알려주면 꺼짐으로 할게요"라는 기본값이에요.
function Header({
  title,
  root = false,
  onBack,
}: {
  title: string
  root?: boolean
  onBack?: () => void
}) {
  return (
    // 조건 ? A : B 는 "조건이 맞으면 A, 아니면 B"예요.
    // 여기서는 root일 때만 app-header--root 라는 디자인 이름표를 하나 더 붙여요.
    <header className={`app-header${root ? " app-header--root" : ""}`}>
      {root ? (
        <span className="header-title">{title}</span>
      ) : (
        // aria-label은 화면을 소리로 읽어주는 프로그램에게 "이 버튼은 이전 화면 버튼이에요"라고 알려줘요.
        <button
          className="icon-button"
          type="button"
          aria-label="이전 화면"
          onClick={onBack}
        >
          <img src="/assets/f152b.svg" alt="" />
        </button>
      )}
      {root ? (
        <img className="logo" src="/assets/38036.svg" alt="U+" />
      ) : (
        <>
          <span className="header-title">{title}</span>
          <span className="header-spacer" aria-hidden="true" />
        </>
      )}
    </header>
  )
}

// [부품] 버튼이에요. children은 버튼 안에 들어갈 내용(글자)이에요.
// variant로 모양을 골라요: primary(강조 버튼) 또는 secondary(보조 버튼).
// disabled가 켜지면 눌러도 반응하지 않는 버튼이 돼요.
function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled = false,
}: {
  children: ReactNode
  onClick?: () => void
  type?: "button" | "submit"
  variant?: "primary" | "secondary"
  disabled?: boolean
}) {
  return (
    <button
      className={`kit-button kit-button--${variant}`}
      type={type}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

// [부품] 필터 버튼 하나예요. selected가 켜져 있으면 '선택됨' 디자인이 입혀져요.
function FilterChip({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      className={`filter-chip${selected ? " filter-chip--selected" : ""}`}
      type="button"
      aria-pressed={selected}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

// [부품] "추천" 같은 짧은 글자를 담는 작은 꼬리표예요.
function Tag({ children }: { children: ReactNode }) {
  return <span className="tag w-fit self-start">{children}</span>
}

// [부품] "데이터 ··· 110GB"처럼 왼쪽에 항목 이름, 오른쪽에 값을 보여주는 한 줄이에요.
// check가 켜져 있으면 맨 앞에 체크 아이콘이 붙어요(혜택 목록에서 써요).
function ListRow({
  label,
  value,
  check = false,
}: {
  label: string
  value?: string
  check?: boolean
}) {
  return (
    <div className={`list-row${check ? " list-row--check" : ""}`}>
      {/* A && B 는 "A가 맞을 때만 B를 보여줘요"예요. check가 켜져 있을 때만 아이콘을 그려요. */}
      {check && (
        <img className="benefit-bullet" src="/assets/d5cc2.svg" alt="" />
      )}
      <span className={check ? "list-row-value" : "list-row-label"}>
        {label}
      </span>
      {value && <span className="list-row-value">{value}</span>}
    </div>
  )
}

// [부품] 화면 맨 아래의 버튼 영역이에요.
// summary를 건네주면 버튼 위에 "월 납부 금액 85,000원" 같은 금액 요약도 함께 보여줘요.
function BottomCta({
  children,
  summary,
}: {
  children: ReactNode
  summary?: { label: string amount: string }
}) {
  return (
    <div className={`bottom-cta${summary ? " bottom-cta--price" : ""}`}>
      {summary && (
        <div className="cta-summary">
          <span>{summary.label}</span>
          <strong>{summary.amount}</strong>
        </div>
      )}
      <div className="cta-actions">{children}</div>
    </div>
  )
}

// [부품] 목록 화면에 나오는 요금제 카드 한 장이에요.
// 배지, 이름, 설명, 가격을 보여주고 [자세히] 버튼을 누르면 onDetail이 실행돼요.
// 할인율·원래 가격·프로모션은 그 정보가 있는 요금제에서만 보여요(&& 덕분이에요).
function PlanCard({ plan, onDetail }: { plan: Plan onDetail: () => void }) {
  return (
    <article className="plan-card">
      {plan.badge && <Tag>{plan.badge}</Tag>}
      <span className="plan-name">{plan.name}</span>
      <span className="plan-description">{plan.description}</span>
      <div className="plan-price-row">
        <div className="plan-price-group">
          <div className="current-price">
            {plan.discount && (
              <strong className="discount">{plan.discount}</strong>
            )}
            <strong>월 {formatPrice(plan.price)}</strong>
          </div>
          {plan.originalPrice && (
            <span className="original-price">
              월 {formatPrice(plan.originalPrice)}
            </span>
          )}
          {plan.promo && <span className="promo-chip">{plan.promo}</span>}
        </div>
        <Button variant="secondary" onClick={onDetail}>
          자세히
        </Button>
      </div>
    </article>
  )
}

// [화면 1] 요금제 목록 화면이에요.
// navigate는 "다른 화면으로 이동시켜 주는 함수"로, 맨 아래 App에서 건네받아요.
function PlansScreen({ navigate }: { navigate: (route: Route) => void }) {
  // 지금 선택된 필터를 기억해요(state). filter는 현재 값, setFilter는 값을 바꾸는 함수예요.
  // 처음에는 "데이터 많이"가 선택되어 있어요.
  const [filter, setFilter] = useState<typeof filters[number]>("데이터 많이")
  // 전체 요금제 중에서 선택된 필터에 해당하는 것만 골라내요.
  // useMemo는 필터가 바뀔 때만 다시 계산하도록 결과를 기억해 두는 도구예요.
  const visiblePlans = useMemo(
    () => plans.filter((plan) => plan.categories.includes(filter)),
    [filter],
  )

  return (
    <main className="screen screen--muted">
      <Header title="요금제" root />
      <div className="scroll-content plans-content">
        <section className="title-group">
          <h1>
            나에게 맞는 요금제를
            <br />
            골라보세요
          </h1>
          <p>중요하게 보는 조건을 고르면 추천해 드려요</p>
        </section>
        <div className="filter-list" aria-label="요금제 필터">
          {/* 목록.map(...) 은 "목록의 항목마다 하나씩 만들어요"예요. 필터 이름 4개로 버튼 4개를 만들어요. */}
          {/* key는 React가 여러 개 중 각각을 구분하려고 붙이는 이름표예요. 화면에는 안 보여요. */}
          {filters.map((item) => (
            <FilterChip
              key={item}
              label={item}
              selected={filter === item}
              onClick={() => setFilter(item)}
            />
          ))}
        </div>
        <section className="plan-list">
          <p className="list-meta">추천순 · {visiblePlans.length}개</p>
          {/* 골라낸 요금제마다 카드를 한 장씩 만들어요. [자세히]를 누르면 그 요금제의 상세 화면으로 이동해요. */}
          {visiblePlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onDetail={() => navigate({ name: "detail", planId: plan.id })}
            />
          ))}
        </section>
      </div>
    </main>
  )
}

// [화면 2] 요금제 상세 화면이에요.
// 요금제 이름·가격, 기본 제공(데이터/통화/문자), 포함 혜택을 보여주고
// 맨 아래에 [구독 신청하기] 버튼이 있어요.
function DetailScreen({
  plan,
  navigate,
}: {
  plan: Plan
  navigate: (route: Route) => void
}) {
  return (
    <main className="screen">
      <Header title="요금제 상세" onBack={() => navigate({ name: "plans" })} />
      <div className="scroll-content screen-with-price-cta">
        <section className="detail-title">
          {plan.badge && <Tag>{plan.badge}</Tag>}
          <h1>{plan.name}</h1>
          <p>{plan.description}</p>
        </section>
        <section className="price-card">
          <span>월 요금</span>
          <div className="price-card-current">
            <strong>{formatPrice(plan.price)}</strong>
            {plan.discount && <b>{plan.discount}</b>}
          </div>
          {plan.originalPrice && (
            <small>
              <s>{formatPrice(plan.originalPrice)}/월</s> · 24개월 할인 프로모션
              적용
            </small>
          )}
        </section>
        <section className="detail-section">
          <h2>기본 제공</h2>
          <ListRow label="데이터" value={plan.data} />
          <ListRow label="통화" value="집·이동전화 무제한" />
          <ListRow label="문자" value="기본 제공" />
        </section>
        <section className="detail-section">
          <h2>포함 혜택</h2>
          {plan.benefits.map((benefit) => (
            <ListRow key={benefit} label={benefit} value="포함" check />
          ))}
        </section>
      </div>
      <BottomCta
        summary={{ label: "월 납부 금액", amount: formatPrice(plan.price) }}
      >
        <Button onClick={() => navigate({ name: "apply", planId: plan.id })}>
          구독 신청하기
        </Button>
      </BottomCta>
    </main>
  )
}

// [화면 3] 구독 신청 화면이에요. 이름·전화번호를 입력받고 동의 체크를 받아요.
// onComplete는 "신청이 끝났어요"라고 App에게 신청서를 전달하는 함수예요.
function ApplyScreen({
  plan,
  navigate,
  onComplete,
}: {
  plan: Plan
  navigate: (route: Route) => void
  onComplete: (application: Application) => void
}) {
  // 입력 중인 값 3가지를 기억해요: 이름, 전화번호, 동의 체크 여부.
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [agreed, setAgreed] = useState(false)
  // 신청 버튼을 눌러도 되는지 검사해요. 아래 3가지를 모두 만족해야 valid가 참이 돼요.
  //  - 이름이 2글자 이상 (trim은 앞뒤 빈칸을 떼어내요)
  //  - 전화번호의 숫자가 10자리 이상
  //  - 동의에 체크함
  const valid =
    name.trim().length > 1 && phone.replace(/\D/g, "").length >= 10 && agreed

  // 전화번호 입력을 다듬는 함수예요.
  // 사용자가 무엇을 치든 숫자만 남기고, 010-1234-5678 모양으로 하이픈을 넣어줘요.
  function handlePhone(value: string) {
    // \D는 "숫자가 아닌 글자"라는 뜻이에요. 숫자가 아닌 건 전부 지우고, 앞에서 11자리만 남겨요.
    const digits = value.replace(/\D/g, "").slice(0, 11)
    // 숫자 개수에 따라 모양을 정해요(? : 가 두 번 겹쳐 있어요).
    //  - 3자리 이하: 그대로 (010)
    //  - 4~7자리: 앞 3자리 뒤에 하이픈 (010-1234)
    //  - 8자리 이상: 하이픈 2개 (010-1234-5678)
    // slice(0, 3)은 "앞에서 3글자를 잘라내요"예요.
    const formatted =
      digits.length < 4
        ? digits
        : digits.length < 8
          ? `${digits.slice(0, 3)}-${digits.slice(3)}`
          : `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
    setPhone(formatted)
  }

  // [신청하기] 버튼을 눌렀을 때 실행되는 함수예요.
  function submit(event: FormEvent) {
    // 원래 브라우저는 입력 양식을 제출하면 페이지를 새로 불러와요. 그 기본 동작을 막아요.
    event.preventDefault()
    // 입력이 올바르지 않으면 여기서 멈춰요.
    if (!valid) return
    const now = new Date()
    // 신청서를 만들어 App에게 전달해요.
    //  - number(신청 번호): "UP" + 오늘 날짜 + "-01" 이에요. 예: UP20250616-01
    //    getMonth()는 1월을 0으로 세기 때문에 +1을 해요.
    //    padStart(2, "0")은 6을 06처럼 두 자리로 맞춰줘요. 끝의 -01은 항상 같은 값이에요.
    //  - appliedAt(신청 일시): 지금 시각을 한국식 날짜 모양의 글자로 바꿔요. hour12: false는 오후 2시를 14시로 표시해요.
    onComplete({
      number: `UP${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-01`,
      plan,
      name: name.trim(),
      phone,
      appliedAt: new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(now),
    })
  }

  return (
    <main className="screen">
      <Header
        title="구독 신청"
        onBack={() => navigate({ name: "detail", planId: plan.id })}
      />
      {/* form은 입력 칸들을 하나로 묶는 양식이에요. 제출되면(onSubmit) 위의 submit 함수가 실행돼요. */}
      <form className="application-form" onSubmit={submit}>
        <div className="scroll-content screen-with-cta">
          <section className="title-group title-only">
            <h1>
              신청 정보를
              <br />
              입력해주세요
            </h1>
          </section>
          <section className="apply-summary">
            <ListRow label="선택 요금제" value={plan.name} />
            <ListRow label="월 요금" value={formatPrice(plan.price)} />
          </section>
          <div className="fields">
            <label className="field">
              <span>이름</span>
              {/* 이름 칸이에요. 글자를 칠 때마다(onChange) 한글·영문·띄어쓰기가 아닌 글자(숫자, 특수문자)는 바로 지워요. */}
              {/* value={name}은 "이 칸에는 항상 기억해 둔 name 값을 보여줘요"예요. */}
              <input
                value={name}
                onChange={(event) =>
                  setName(
                    event.target.value.replace(
                      /[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z\s]/g,
                      "",
                    ),
                  )
                }
                placeholder="이름을 입력해주세요"
                autoComplete="name"
                inputMode="text"
              />
            </label>
            <label className="field">
              <span>휴대폰 번호</span>
              {/* 전화번호 칸이에요. inputMode="numeric"은 휴대폰에서 숫자 키보드가 뜨게 해요. */}
              <input
                value={phone}
                onChange={(event) => handlePhone(event.target.value)}
                placeholder="010-0000-0000"
                inputMode="numeric"
                autoComplete="tel"
              />
            </label>
            <label className="agreement">
              {/* 진짜 체크박스(input)는 index.css에서 투명하게 숨겨져 있어요. */}
              {/* 대신 바로 아래 span이 눈에 보이는 체크 모양을 그리고, 체크했을 때만 체크 그림을 보여줘요. */}
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
              />
              <span className="check-control" aria-hidden="true">
                {agreed && <img src="/assets/e8d68.svg" alt="" />}
              </span>
              <span>[필수] 개인정보 수집·이용에 동의합니다</span>
            </label>
          </div>
        </div>
        <BottomCta>
          {/* 입력이 올바르지 않은 동안에는(!valid) 버튼이 눌리지 않아요. !는 "반대"라는 뜻이에요. */}
          <Button type="submit" disabled={!valid}>
            신청하기
          </Button>
        </BottomCta>
      </form>
    </main>
  )
}

// [화면 4] 신청 완료 화면이에요. 방금 신청한 내역을 보여줘요.
// 개인정보 보호를 위해 이름과 전화번호는 일부를 *로 가려서 보여줘요.
function CompleteScreen({
  application,
  navigate,
}: {
  application: Application
  navigate: (route: Route) => void
}) {
  // 이름의 첫 글자와 마지막 글자만 남기고 가운데를 *로 바꿔요. 예: 홍길동 → 홍*동, 남궁민수 → 남**수
  // (이름이 1글자면 그대로 보여줘요. 2글자면 가릴 가운데가 없어서 홍길 → 홍*길 이 돼요.)
  // name[0]은 첫 글자, name.at(-1)은 마지막 글자, "*".repeat(2)는 "**"예요.
  const maskedName =
    application.name.length > 1
      ? `${application.name[0]}${"*".repeat(Math.max(1, application.name.length - 2))}${application.name.at(-1)}`
      : application.name
  // 전화번호는 숫자만 뽑아낸 뒤 가운데 자리를 가려요. 예: 010-1234-5678 → 010-****-5678
  const phoneDigits = application.phone.replace(/\D/g, "")
  const maskedPhone =
    phoneDigits.length >= 7
      ? `${phoneDigits.slice(0, 3)}-****-${phoneDigits.slice(-4)}`
      : application.phone

  return (
    <main className="screen">
      <Header title="신청 완료" onBack={() => window.history.back()} />
      <div className="scroll-content screen-with-cta complete-content">
        <section className="complete-result">
          <span className="done-mark" aria-hidden="true">
            <img src="/assets/7c149.svg" alt="" />
          </span>
          <h1>구독 신청이 완료됐어요</h1>
          <p>개통 안내는 문자로 보내드려요</p>
        </section>
        <section className="application-card">
          <h2>신청 내역</h2>
          <ListRow label="신청 번호" value={application.number} />
          <ListRow label="요금제" value={application.plan.name} />
          <ListRow
            label="월 요금"
            value={formatPrice(application.plan.price)}
          />
          <ListRow label="신청 일시" value={application.appliedAt} />
          <ListRow label="신청자" value={`${maskedName} · ${maskedPhone}`} />
        </section>
      </div>
      <BottomCta>
        <Button onClick={() => window.location.assign("/plans")}>
          요금제 더 보기
        </Button>
      </BottomCta>
    </main>
  )
}

// [교통정리] 앱의 시작점이에요. 지금 어떤 화면을 보여줄지 여기서 결정해요.
// export default는 "다른 파일(main.tsx)에서 이 App을 가져다 쓸 수 있게 내보내요"라는 뜻이에요.
export default function App() {
  // route: 지금 보여주고 있는 화면이에요. 처음에는 주소창을 읽어서(readRoute) 정해요.
  // application: 방금 작성한 신청서예요. 아직 신청 전이면 null(비어 있음)이에요.
  const [route, setRoute] = useState<Route>(() => readRoute())
  const [application, setApplication] = useState<Application | null>(null)

  // useEffect는 "화면이 그려진 뒤에 따로 해 둘 일"을 적는 곳이에요.
  // 맨 끝의 [] 때문에 앱이 처음 켜질 때 딱 한 번만 실행돼요. 여기서 하는 일은 두 가지예요.
  //  1) 주소가 그냥 "/"이면 "/plans"로 바꿔 둬요.
  //  2) 브라우저의 뒤로/앞으로 버튼이 눌리면(popstate) 주소를 다시 읽어 화면을 바꾸도록 등록해요.
  // 마지막 return 줄은 뒷정리예요. 앱이 꺼질 때 2)에서 등록한 것을 해제해요.
  useEffect(() => {
    if (window.location.pathname === "/") {
      window.history.replaceState({}, "", "/plans")
    }
    const onPopState = () => setRoute(readRoute())
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  // 화면을 이동시키는 함수예요. 각 화면에 navigate라는 이름으로 건네줘요.
  //  1) 주소창의 주소를 바꿔요(pushState: 페이지를 새로 불러오지 않고 주소만 바꿔요)
  //  2) 현재 화면(route)을 바꿔요 → 화면이 다시 그려져요
  //  3) 스크롤을 맨 위로 올려요
  function navigate(next: Route) {
    window.history.pushState({}, "", pathFor(next))
    setRoute(next)
    window.scrollTo(0, 0)
  }

  // 여기부터는 route에 따라 화면 하나를 골라 보여줘요. return을 만나면 거기서 끝나요.
  // 요금제 목록 화면
  if (route.name === "plans") return <PlansScreen navigate={navigate} />

  // 완료 화면. 신청서가 없으면(주소창에 /complete 를 직접 쳐서 들어온 경우) 아래의 예시 신청서를 대신 보여줘요.
  // satisfies Application은 "이 예시가 신청서 양식에 맞는지 검사해 주세요"라는 표시예요.
  if (route.name === "complete") {
    const completed =
      application ??
      {
        number: "UP20250616-01",
        plan: plans[0],
        name: "신청자",
        phone: "010-0000-0000",
        appliedAt: "2025. 06. 16. 14:30",
      } satisfies Application
    return <CompleteScreen application={completed} navigate={navigate} />
  }

  // 상세·신청 화면에서 쓸 요금제를 찾아요. 주소에 적힌 id와 같은 요금제를 찾고, 없으면 첫 번째 요금제를 써요.
  const selectedPlan =
    plans.find((plan) => plan.id === route.planId) ?? plans[0]

  // 신청 화면. 신청이 끝나면(onComplete) 신청서를 기억해 두고 완료 화면으로 이동해요.
  if (route.name === "apply") {
    return (
      <ApplyScreen
        plan={selectedPlan}
        navigate={navigate}
        onComplete={(completed) => {
          setApplication(completed)
          navigate({ name: "complete" })
        }}
      />
    )
  }

  // 위의 어느 경우도 아니면 상세 화면이에요.
  return <DetailScreen plan={selectedPlan} navigate={navigate} />
}
