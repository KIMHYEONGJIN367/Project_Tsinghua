import { useMemo, useState } from 'react'

type TradeDraft = 'quick' | 'position' | 'guided'
type TradeDirection = 'buy' | 'sell' | 'short' | 'cover'
type OrderType = 'market' | 'limit'

type DirectionMeta = {
  label: string
  helper: string
  sourceTitle: string
}

const directionMeta: Record<TradeDirection, DirectionMeta> = {
  buy: {
    label: '매수',
    helper: '롱 포지션 늘리기',
    sourceTitle: '거래 가능 종목',
  },
  sell: {
    label: '매도',
    helper: '롱 포지션 줄이기',
    sourceTitle: '내 Long 보유종목',
  },
  short: {
    label: '공매도',
    helper: '하락 방향 포지션',
    sourceTitle: '공매도 가능 종목',
  },
  cover: {
    label: '공매도 상환',
    helper: '숏 포지션 줄이기',
    sourceTitle: '내 Short 보유종목',
  },
}

const stockOptions: Record<TradeDirection, Array<{ name: string; code: string; detail: string; value: string }>> = {
  buy: [
    { name: '삼성전자', code: '005930', detail: '+2.1%', value: '71,300원' },
    { name: 'SK하이닉스', code: '000660', detail: '+1.4%', value: '188,200원' },
  ],
  sell: [
    { name: '삼성전자', code: '42주 보유', detail: '+8.4%', value: '2,994,600원' },
    { name: '현대차', code: '8주 보유', detail: '-1.2%', value: '1,936,000원' },
  ],
  short: [
    { name: '에코프로', code: '086520', detail: '대여 가능', value: '92,500원' },
    { name: '카카오', code: '035720', detail: '대여 가능', value: '43,600원' },
  ],
  cover: [
    { name: '에코프로', code: '12주 Short', detail: '+3.1%', value: '1,110,000원' },
    { name: '카카오', code: '20주 Short', detail: '-2.4%', value: '872,000원' },
  ],
}

const draftTabs: Array<{ key: TradeDraft; label: string }> = [
  { key: 'quick', label: 'A 빠른 주문' },
  { key: 'position', label: 'B 포지션' },
  { key: 'guided', label: 'C 단계별' },
]

function DirectionSelector({
  direction,
  onChange,
  shortAllowed,
  compact = false,
}: {
  direction: TradeDirection
  onChange: (direction: TradeDirection) => void
  shortAllowed: boolean
  compact?: boolean
}) {
  const directions = (Object.keys(directionMeta) as TradeDirection[])
    .filter((item) => shortAllowed || (item !== 'short' && item !== 'cover'))

  return (
    <div className={`trade-direction-grid ${compact ? 'is-compact' : ''}`} aria-label="거래 방향">
      {directions.map((item) => (
        <button
          type="button"
          className={item === direction ? 'is-selected' : ''}
          aria-pressed={item === direction}
          data-direction={item}
          key={item}
          onClick={() => onChange(item)}
        >
          <strong>{directionMeta[item].label}</strong>
          {!compact && <span>{directionMeta[item].helper}</span>}
        </button>
      ))}
    </div>
  )
}

function StockPicker({ direction }: { direction: TradeDirection }) {
  const options = stockOptions[direction]

  return (
    <section className="trade-field-group">
      <div className="trade-field-heading">
        <strong>{directionMeta[direction].sourceTitle}</strong>
        {(direction === 'buy' || direction === 'short') && <button type="button">검색</button>}
      </div>
      <div className="trade-stock-list">
        {options.map((stock, index) => (
          <button type="button" className={index === 0 ? 'is-selected' : ''} key={`${direction}-${stock.name}`}>
            <span className="trade-stock-name">
              <strong>{stock.name}</strong>
              <small>{stock.code}</small>
            </span>
            <span className="trade-stock-price">
              <strong>{stock.value}</strong>
              <small>{stock.detail}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function AccountStrip({ direction }: { direction: TradeDirection }) {
  const secondary = direction === 'cover'
    ? '상환 가능 12주'
    : direction === 'sell'
      ? '보유 42주'
      : direction === 'short'
        ? '가용 증거금 6,980,000원'
        : '주문 가능 8,420,000원'

  return (
    <div className="trade-account-strip">
      <span>
        <small>현재</small>
        <strong>{secondary}</strong>
      </span>
      <span>
        <small>주문 후 예상</small>
        <strong>{direction === 'buy' ? '현금 7,707,000원' : direction === 'sell' ? '보유 32주' : direction === 'short' ? '숏 10주' : '숏 2주'}</strong>
      </span>
    </div>
  )
}

function OrderControls({
  direction,
  orderType,
  onOrderTypeChange,
  quantity,
  onQuantityChange,
  showAction = true,
}: {
  direction: TradeDirection
  orderType: OrderType
  onOrderTypeChange: (orderType: OrderType) => void
  quantity: number
  onQuantityChange: (quantity: number) => void
  showAction?: boolean
}) {
  const estimatedValue = useMemo(() => `${(quantity * 71_300).toLocaleString('ko-KR')}원`, [quantity])

  return (
    <>
      <div className="trade-order-row">
        <span className="trade-order-label">가격 방식</span>
        <div className="trade-order-segment" aria-label="주문 가격 방식">
          <button type="button" className={orderType === 'market' ? 'is-selected' : ''} aria-pressed={orderType === 'market'} onClick={() => onOrderTypeChange('market')}>시장가</button>
          <button type="button" className={orderType === 'limit' ? 'is-selected' : ''} aria-pressed={orderType === 'limit'} onClick={() => onOrderTypeChange('limit')}>지정가</button>
        </div>
      </div>
      <div className="trade-order-row trade-quantity-row">
        <span className="trade-order-label">수량</span>
        <div className="trade-quantity-control">
          <button type="button" aria-label="수량 줄이기" onClick={() => onQuantityChange(Math.max(1, quantity - 1))}>−</button>
          <strong>{quantity}<small>주</small></strong>
          <button type="button" aria-label="수량 늘리기" onClick={() => onQuantityChange(quantity + 1)}>＋</button>
        </div>
      </div>
      <div className="trade-quick-amounts" aria-label="빠른 수량 선택">
        {[10, 25, 50, 100].map((value) => (
          <button type="button" key={value} onClick={() => onQuantityChange(value)}>{value === 100 ? '최대' : `${value}주`}</button>
        ))}
      </div>
      <div className="trade-estimate">
        <span>예상 주문금액</span>
        <strong>{estimatedValue}</strong>
        <small>체결 가격에 따라 달라질 수 있어요</small>
      </div>
      {showAction && <button type="button" className="trade-review-action">{directionMeta[direction].label} 검토하기</button>}
    </>
  )
}

function QuickDraft({
  direction,
  onDirectionChange,
  shortAllowed,
  orderType,
  onOrderTypeChange,
  quantity,
  onQuantityChange,
}: {
  direction: TradeDirection
  onDirectionChange: (direction: TradeDirection) => void
  shortAllowed: boolean
  orderType: OrderType
  onOrderTypeChange: (orderType: OrderType) => void
  quantity: number
  onQuantityChange: (quantity: number) => void
}) {
  return (
    <div className="trade-draft-scroll">
      <div className="trade-rule-note"><span />{shortAllowed ? '이 대회는 공매도를 허용합니다' : '이 대회는 Long 거래만 허용합니다'}</div>
      <DirectionSelector direction={direction} onChange={onDirectionChange} shortAllowed={shortAllowed} />
      <StockPicker direction={direction} />
      <AccountStrip direction={direction} />
      <OrderControls direction={direction} orderType={orderType} onOrderTypeChange={onOrderTypeChange} quantity={quantity} onQuantityChange={onQuantityChange} />
    </div>
  )
}

function PositionDraft({
  direction,
  onDirectionChange,
  shortAllowed,
  orderType,
  onOrderTypeChange,
  quantity,
  onQuantityChange,
}: {
  direction: TradeDirection
  onDirectionChange: (direction: TradeDirection) => void
  shortAllowed: boolean
  orderType: OrderType
  onOrderTypeChange: (orderType: OrderType) => void
  quantity: number
  onQuantityChange: (quantity: number) => void
}) {
  return (
    <div className="trade-draft-scroll">
      <div className="trade-position-summary">
        <span><small>현금</small><strong>8,420,000원</strong></span>
        <span><small>Long</small><strong>3종목</strong></span>
        <span><small>Short</small><strong>1종목</strong></span>
      </div>
      <section className="trade-field-group">
        <div className="trade-field-heading"><strong>현재 포지션에서 시작</strong><button type="button">전체</button></div>
        <div className="trade-position-list">
          <button type="button" className="is-selected">
            <span><strong>삼성전자</strong><small>Long · 42주</small></span>
            <span><strong>+8.4%</strong><small>+232,100원</small></span>
          </button>
          <button type="button">
            <span><strong>에코프로</strong><small>Short · 12주</small></span>
            <span><strong>+3.1%</strong><small>+34,800원</small></span>
          </button>
        </div>
      </section>
      <div className="trade-position-prompt">선택한 포지션을 어떻게 바꿀까요?</div>
      <DirectionSelector direction={direction} onChange={onDirectionChange} shortAllowed={shortAllowed} compact />
      <AccountStrip direction={direction} />
      <OrderControls direction={direction} orderType={orderType} onOrderTypeChange={onOrderTypeChange} quantity={quantity} onQuantityChange={onQuantityChange} />
    </div>
  )
}

function GuidedDraft({
  direction,
  onDirectionChange,
  shortAllowed,
  step,
  onStepChange,
  orderType,
  onOrderTypeChange,
  quantity,
  onQuantityChange,
}: {
  direction: TradeDirection
  onDirectionChange: (direction: TradeDirection) => void
  shortAllowed: boolean
  step: number
  onStepChange: (step: number) => void
  orderType: OrderType
  onOrderTypeChange: (orderType: OrderType) => void
  quantity: number
  onQuantityChange: (quantity: number) => void
}) {
  return (
    <div className="trade-guided-draft">
      <div className="trade-stepper" aria-label={`3단계 중 ${step}단계`}>
        {[1, 2, 3].map((item) => <span className={item <= step ? 'is-active' : ''} key={item} />)}
      </div>
      <div className="trade-guided-scroll" aria-live="polite">
        {step === 1 && (
          <section className="trade-guided-step">
            <small>1 · 방향</small>
            <h3>어떤 포지션을 만들까요?</h3>
            <p>용어보다 결과를 먼저 보고 선택하세요.</p>
            <DirectionSelector direction={direction} onChange={onDirectionChange} shortAllowed={shortAllowed} />
            <div className="trade-direction-explanation">
              <strong>{directionMeta[direction].label}</strong>
              <span>{directionMeta[direction].helper}</span>
            </div>
          </section>
        )}
        {step === 2 && (
          <section className="trade-guided-step">
            <small>2 · 종목</small>
            <h3>{directionMeta[direction].sourceTitle}에서 선택</h3>
            <p>현재 선택과 맞지 않는 종목은 처음부터 숨깁니다.</p>
            <StockPicker direction={direction} />
          </section>
        )}
        {step === 3 && (
          <section className="trade-guided-step">
            <small>3 · 주문</small>
            <h3>수량과 주문 방식을 확인하세요</h3>
            <AccountStrip direction={direction} />
            <OrderControls direction={direction} orderType={orderType} onOrderTypeChange={onOrderTypeChange} quantity={quantity} onQuantityChange={onQuantityChange} showAction={false} />
          </section>
        )}
      </div>
      <div className="trade-guided-footer">
        <button type="button" className="trade-guided-back" disabled={step === 1} onClick={() => onStepChange(Math.max(1, step - 1))}>이전</button>
        {step < 3
          ? <button type="button" className="trade-guided-next" onClick={() => onStepChange(Math.min(3, step + 1))}>다음</button>
          : <button type="button" className="trade-guided-next">{directionMeta[direction].label} 검토하기</button>}
      </div>
    </div>
  )
}

export default function TradeDrafts({ shortAllowed = true }: { shortAllowed?: boolean }) {
  const [draft, setDraft] = useState<TradeDraft>('quick')
  const [direction, setDirection] = useState<TradeDirection>('buy')
  const [orderType, setOrderType] = useState<OrderType>('market')
  const [quantity, setQuantity] = useState(10)
  const [guidedStep, setGuidedStep] = useState(1)

  const selectDraft = (nextDraft: TradeDraft) => {
    setDraft(nextDraft)
    setDirection(nextDraft === 'position' ? 'sell' : 'buy')
    if (nextDraft === 'guided') setGuidedStep(1)
  }

  return (
    <div className="trade-drafts">
      <div className="trade-draft-tabs" role="tablist" aria-label="매매 UI 초안">
        {draftTabs.map((tab) => (
          <button
            type="button"
            role="tab"
            aria-selected={draft === tab.key}
            className={draft === tab.key ? 'is-selected' : ''}
            key={tab.key}
            onClick={() => selectDraft(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="trade-draft-panel" role="tabpanel">
        {draft === 'quick' && (
          <QuickDraft direction={direction} onDirectionChange={setDirection} shortAllowed={shortAllowed} orderType={orderType} onOrderTypeChange={setOrderType} quantity={quantity} onQuantityChange={setQuantity} />
        )}
        {draft === 'position' && (
          <PositionDraft direction={direction} onDirectionChange={setDirection} shortAllowed={shortAllowed} orderType={orderType} onOrderTypeChange={setOrderType} quantity={quantity} onQuantityChange={setQuantity} />
        )}
        {draft === 'guided' && (
          <GuidedDraft direction={direction} onDirectionChange={setDirection} shortAllowed={shortAllowed} step={guidedStep} onStepChange={setGuidedStep} orderType={orderType} onOrderTypeChange={setOrderType} quantity={quantity} onQuantityChange={setQuantity} />
        )}
      </div>
    </div>
  )
}
