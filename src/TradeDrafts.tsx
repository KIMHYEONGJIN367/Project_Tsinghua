import { useEffect, useMemo, useState } from 'react'

type TicketPrototype = 'balanced' | 'allocation' | 'outcome'
type TradeDirection = 'buy' | 'sell' | 'short' | 'cover'
type OrderType = 'market' | 'limit'

type Instrument = {
  name: string
  code: string
  price: number
  change: number
  longQuantity?: number
  shortQuantity?: number
}

const CASH_BALANCE = 8_420_000

const instruments: Instrument[] = [
  { name: '삼성전자', code: '005930', price: 71_300, change: 2.1, longQuantity: 42 },
  { name: 'SK하이닉스', code: '000660', price: 188_200, change: 1.4, longQuantity: 18 },
  { name: '에코프로', code: '086520', price: 92_500, change: -1.1, shortQuantity: 12 },
  { name: '현대차', code: '005380', price: 242_000, change: -0.3, longQuantity: 8 },
  { name: '카카오', code: '035720', price: 43_600, change: 0.8, shortQuantity: 20 },
  { name: 'NAVER', code: '035420', price: 214_500, change: 0.4, longQuantity: 11 },
  { name: 'LG에너지솔루션', code: '373220', price: 381_000, change: -0.7, longQuantity: 5 },
  { name: 'POSCO홀딩스', code: '005490', price: 348_500, change: -0.5, shortQuantity: 6 },
]

const directionMeta: Record<TradeDirection, {
  tabLabel: string
  label: string
  searchLabel: string
  quantityBasis: string
}> = {
  buy: {
    tabLabel: '매수',
    label: '매수',
    searchLabel: '종목명·코드 검색',
    quantityBasis: '현금 기준',
  },
  sell: {
    tabLabel: '매도',
    label: '매도',
    searchLabel: '내 Long 보유종목',
    quantityBasis: '보유 수량 기준',
  },
  short: {
    tabLabel: '공매도',
    label: '공매도',
    searchLabel: '공매도 가능 종목 검색',
    quantityBasis: '주문 가능 금액 기준',
  },
  cover: {
    tabLabel: '상환',
    label: '공매도 상환',
    searchLabel: '내 Short 보유종목',
    quantityBasis: 'Short 보유 수량 기준',
  },
}

const prototypeOptions: Array<{ key: TicketPrototype; label: string }> = [
  { key: 'balanced', label: '1 균형형' },
  { key: 'allocation', label: '2 비중형' },
  { key: 'outcome', label: '3 결과형' },
]

function formatWon(value: number) {
  return `${Math.max(0, Math.round(value)).toLocaleString('ko-KR')}원`
}

function DirectionTabs({
  direction,
  onChange,
  shortAllowed,
}: {
  direction: TradeDirection
  onChange: (direction: TradeDirection) => void
  shortAllowed: boolean
}) {
  const directions = (Object.keys(directionMeta) as TradeDirection[])
    .filter((item) => shortAllowed || (item !== 'short' && item !== 'cover'))

  return (
    <div className="ticket-direction-tabs" role="tablist" aria-label="거래 방향">
      {directions.map((item) => (
        <button
          type="button"
          role="tab"
          aria-selected={item === direction}
          className={item === direction ? 'is-selected' : ''}
          data-direction={item}
          key={item}
          onClick={() => onChange(item)}
        >
          {directionMeta[item].tabLabel}
        </button>
      ))}
    </div>
  )
}

function InstrumentAccess({
  direction,
  selectedInstrument,
  searchQuery,
  searchFocused,
  onSearchQueryChange,
  onSearchFocusChange,
  onSelectInstrument,
  onOpenAllHoldings,
}: {
  direction: TradeDirection
  selectedInstrument: Instrument
  searchQuery: string
  searchFocused: boolean
  onSearchQueryChange: (query: string) => void
  onSearchFocusChange: (focused: boolean) => void
  onSelectInstrument: (instrument: Instrument) => void
  onOpenAllHoldings: () => void
}) {
  const isSearchDirection = direction === 'buy' || direction === 'short'
  const eligibleInstruments = direction === 'sell'
    ? instruments.filter((instrument) => instrument.longQuantity)
    : direction === 'cover'
      ? instruments.filter((instrument) => instrument.shortQuantity)
      : instruments

  const searchResults = eligibleInstruments.filter((instrument) => {
    const normalizedQuery = searchQuery.replace(/ /g, '').toLowerCase()
    return !normalizedQuery
      || instrument.name.toLowerCase().includes(normalizedQuery)
      || instrument.code.includes(normalizedQuery)
  })

  if (isSearchDirection) {
    return (
      <section className="ticket-instrument-section">
        <div className="ticket-section-label">{directionMeta[direction].searchLabel}</div>
        <div className="ticket-search-wrap">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={searchQuery}
            inputMode="search"
            enterKeyHint="search"
            aria-label={directionMeta[direction].searchLabel}
            placeholder={directionMeta[direction].searchLabel}
            onFocus={() => onSearchFocusChange(true)}
            onBlur={() => window.setTimeout(() => onSearchFocusChange(false), 100)}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
          {searchQuery && <button type="button" aria-label="검색어 지우기" onClick={() => onSearchQueryChange('')}>×</button>}
          {searchFocused && (
            <div className="ticket-search-results">
              {searchResults.slice(0, 4).map((instrument) => (
                <button
                  type="button"
                  key={`${direction}-${instrument.code}`}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onSelectInstrument(instrument)
                    onSearchQueryChange(instrument.name)
                    onSearchFocusChange(false)
                  }}
                >
                  <span><strong>{instrument.name}</strong><small>{instrument.code}</small></span>
                  <span><strong>{formatWon(instrument.price)}</strong><small className={instrument.change >= 0 ? 'is-positive' : 'is-negative'}>{instrument.change >= 0 ? '+' : ''}{instrument.change}%</small></span>
                </button>
              ))}
              {searchResults.length === 0 && (
                <p className="ticket-search-empty">일치하는 종목이 없어요. 종목명이나 코드를 다시 확인해 주세요.</p>
              )}
            </div>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="ticket-instrument-section">
      <div className="ticket-section-heading">
        <span className="ticket-section-label">{directionMeta[direction].searchLabel}</span>
        <button type="button" className="ticket-show-all" aria-label="전체 보유 종목 보기" onClick={onOpenAllHoldings}>＋</button>
      </div>
      <div className="ticket-holding-preview">
        {eligibleInstruments.slice(0, 3).map((instrument) => {
          const quantity = direction === 'sell' ? instrument.longQuantity : instrument.shortQuantity
          return (
            <button
              type="button"
              className={instrument.code === selectedInstrument.code ? 'is-selected' : ''}
              key={`${direction}-${instrument.code}`}
              onClick={() => onSelectInstrument(instrument)}
            >
              <span><strong>{instrument.name}</strong><small>{direction === 'sell' ? 'Long' : 'Short'} · {quantity}주</small></span>
              <span><strong>{formatWon(instrument.price)}</strong><small className={instrument.change >= 0 ? 'is-positive' : 'is-negative'}>{instrument.change >= 0 ? '+' : ''}{instrument.change}%</small></span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function QuoteAndCapacity({
  direction,
  instrument,
  maxQuantity,
}: {
  direction: TradeDirection
  instrument: Instrument
  maxQuantity: number
}) {
  const quantityLabel = direction === 'sell'
    ? '매도 가능'
    : direction === 'cover'
      ? '상환 가능'
      : direction === 'short'
        ? '공매도 가능'
        : '최대 주문'

  return (
    <>
      <div className="ticket-quote-row">
        <span><strong>{instrument.name}</strong><small>{instrument.code} · 현재가</small></span>
        <span><strong>{formatWon(instrument.price)}</strong><small className={instrument.change >= 0 ? 'is-positive' : 'is-negative'}>{instrument.change >= 0 ? '+' : ''}{instrument.change}%</small></span>
      </div>
      <div className="ticket-capacity-grid">
        <span><small>현재 현금</small><strong>{formatWon(CASH_BALANCE)}</strong></span>
        <span><small>{quantityLabel}</small><strong>{maxQuantity.toLocaleString('ko-KR')}주</strong></span>
      </div>
    </>
  )
}

function OrderTypeAndPrice({
  orderType,
  currentPrice,
  limitPrice,
  onOrderTypeChange,
  onLimitPriceChange,
}: {
  orderType: OrderType
  currentPrice: number
  limitPrice: number
  onOrderTypeChange: (orderType: OrderType) => void
  onLimitPriceChange: (price: number) => void
}) {
  const limitDifference = ((limitPrice - currentPrice) / currentPrice) * 100

  return (
    <section className="ticket-order-type-section">
      <div className="ticket-order-type-heading">
        <span className="ticket-section-label">가격 방식</span>
        <div className="ticket-order-type-tabs" aria-label="주문 가격 방식">
          <button type="button" className={orderType === 'market' ? 'is-selected' : ''} aria-pressed={orderType === 'market'} onClick={() => onOrderTypeChange('market')}>시장가</button>
          <button type="button" className={orderType === 'limit' ? 'is-selected' : ''} aria-pressed={orderType === 'limit'} onClick={() => onOrderTypeChange('limit')}>지정가</button>
        </div>
      </div>
      {orderType === 'market' ? (
        <div className="ticket-market-note"><span>현재가</span><strong>{formatWon(currentPrice)}</strong><small>빠른 체결을 우선하며 실제 체결가는 달라질 수 있어요.</small></div>
      ) : (
        <div className="ticket-limit-price">
          <button type="button" aria-label="지정가 한 호가 내리기" onClick={() => onLimitPriceChange(Math.max(100, limitPrice - 100))}>−</button>
          <label>
            <span>지정 가격</span>
            <input
              type="text"
              inputMode="numeric"
              aria-label="지정 가격"
              value={limitPrice.toLocaleString('ko-KR')}
              onChange={(event) => {
                const nextPrice = Number(event.target.value.replace(/[^0-9]/g, ''))
                if (Number.isFinite(nextPrice)) onLimitPriceChange(nextPrice)
              }}
            />
          </label>
          <button type="button" aria-label="지정가 한 호가 올리기" onClick={() => onLimitPriceChange(limitPrice + 100)}>＋</button>
          <small>현재가 대비 {limitDifference >= 0 ? '+' : ''}{limitDifference.toFixed(2)}%</small>
        </div>
      )}
    </section>
  )
}

function QuantityControl({
  quantity,
  maxQuantity,
  selectedPercent,
  quantityBasis,
  onQuantityChange,
  onPercentSelect,
}: {
  quantity: number
  maxQuantity: number
  selectedPercent: number | null
  quantityBasis: string
  onQuantityChange: (quantity: number) => void
  onPercentSelect: (percent: number) => void
}) {
  return (
    <section className="ticket-quantity-section">
      <div className="ticket-quantity-heading">
        <span className="ticket-section-label">수량</span>
        <small>{quantityBasis}</small>
      </div>
      <div className="ticket-quantity-input">
        <button type="button" aria-label="수량 줄이기" onClick={() => onQuantityChange(Math.max(1, quantity - 1))}>−</button>
        <label>
          <span className="sr-only">주문 수량</span>
          <input
            type="text"
            inputMode="numeric"
            aria-label="주문 수량"
            value={quantity.toLocaleString('ko-KR')}
            onChange={(event) => {
              const nextQuantity = Number(event.target.value.replace(/[^0-9]/g, ''))
              if (Number.isFinite(nextQuantity)) onQuantityChange(Math.max(1, Math.min(maxQuantity, nextQuantity)))
            }}
          />
          <small>주</small>
        </label>
        <button type="button" aria-label="수량 늘리기" onClick={() => onQuantityChange(Math.min(maxQuantity, quantity + 1))}>＋</button>
      </div>
      <div className="ticket-allocation-buttons" aria-label="주문 비중 선택">
        {[10, 25, 50, 100].map((percent) => (
          <button type="button" className={selectedPercent === percent ? 'is-selected' : ''} aria-pressed={selectedPercent === percent} key={percent} onClick={() => onPercentSelect(percent)}>{percent === 100 ? '최대' : `${percent}%`}</button>
        ))}
      </div>
    </section>
  )
}

function BalancedPrototype(props: SharedPrototypeProps) {
  return (
    <div className="ticket-prototype-stack">
      <QuoteAndCapacity direction={props.direction} instrument={props.instrument} maxQuantity={props.maxQuantity} />
      <OrderTypeAndPrice orderType={props.orderType} currentPrice={props.instrument.price} limitPrice={props.limitPrice} onOrderTypeChange={props.onOrderTypeChange} onLimitPriceChange={props.onLimitPriceChange} />
      <QuantityControl quantity={props.quantity} maxQuantity={props.maxQuantity} selectedPercent={props.selectedPercent} quantityBasis={directionMeta[props.direction].quantityBasis} onQuantityChange={props.onQuantityChange} onPercentSelect={props.onPercentSelect} />
    </div>
  )
}

function AllocationPrototype(props: SharedPrototypeProps) {
  const allocationPrompt = props.direction === 'sell'
    ? '보유 수량 중 얼마나 매도할까요?'
    : props.direction === 'cover'
      ? 'Short 수량 중 얼마나 상환할까요?'
      : '주문 가능 금액 중 얼마나 사용할까요?'

  return (
    <div className="ticket-prototype-stack ticket-allocation-prototype">
      <QuoteAndCapacity direction={props.direction} instrument={props.instrument} maxQuantity={props.maxQuantity} />
      <section className="ticket-allocation-focus">
        <span className="ticket-section-label">{allocationPrompt}</span>
        <div className="ticket-allocation-cards">
          {[10, 25, 50, 100].map((percent) => {
            const shares = Math.max(1, Math.floor(props.maxQuantity * percent / 100))
            return (
              <button type="button" className={props.selectedPercent === percent ? 'is-selected' : ''} aria-pressed={props.selectedPercent === percent} key={percent} onClick={() => props.onPercentSelect(percent)}>
                <strong>{percent === 100 ? '최대' : `${percent}%`}</strong>
                <span>{shares.toLocaleString('ko-KR')}주</span>
                <small>{formatWon(shares * props.effectivePrice)}</small>
              </button>
            )
          })}
        </div>
      </section>
      <div className="ticket-derived-quantity">
        <span><small>선택 수량</small><strong>{props.quantity.toLocaleString('ko-KR')}주</strong></span>
        <div aria-label="선택 수량 미세 조정">
          <button type="button" aria-label="선택 수량 줄이기" onClick={() => props.onQuantityChange(Math.max(1, props.quantity - 1))}>−</button>
          <button type="button" aria-label="선택 수량 늘리기" onClick={() => props.onQuantityChange(Math.min(props.maxQuantity, props.quantity + 1))}>＋</button>
        </div>
      </div>
      <OrderTypeAndPrice orderType={props.orderType} currentPrice={props.instrument.price} limitPrice={props.limitPrice} onOrderTypeChange={props.onOrderTypeChange} onLimitPriceChange={props.onLimitPriceChange} />
    </div>
  )
}

function OutcomePrototype(props: SharedPrototypeProps) {
  const cashDelta = props.direction === 'sell' || props.direction === 'short'
    ? props.estimatedAmount
    : -props.estimatedAmount
  const currentPosition = props.direction === 'short' || props.direction === 'cover'
    ? props.instrument.shortQuantity ?? 0
    : props.instrument.longQuantity ?? 0
  const positionAfter = props.direction === 'buy'
    ? currentPosition + props.quantity
    : props.direction === 'sell'
      ? Math.max(0, currentPosition - props.quantity)
      : props.direction === 'short'
        ? (props.instrument.shortQuantity ?? 0) + props.quantity
        : Math.max(0, currentPosition - props.quantity)

  return (
    <div className="ticket-prototype-stack ticket-outcome-prototype">
      <QuoteAndCapacity direction={props.direction} instrument={props.instrument} maxQuantity={props.maxQuantity} />
      <section className="ticket-outcome-preview">
        <div className="ticket-section-label">주문 후 예상</div>
        <div>
          <span><small>현금</small><strong>{formatWon(CASH_BALANCE)}</strong></span>
          <b aria-hidden="true">→</b>
          <span><small>예상 현금</small><strong>{formatWon(CASH_BALANCE + cashDelta)}</strong></span>
        </div>
        <div>
          <span><small>{props.direction === 'short' || props.direction === 'cover' ? 'Short' : '보유'}</small><strong>{currentPosition}주</strong></span>
          <b aria-hidden="true">→</b>
          <span><small>주문 후</small><strong>{positionAfter}주</strong></span>
        </div>
      </section>
      <OrderTypeAndPrice orderType={props.orderType} currentPrice={props.instrument.price} limitPrice={props.limitPrice} onOrderTypeChange={props.onOrderTypeChange} onLimitPriceChange={props.onLimitPriceChange} />
      <QuantityControl quantity={props.quantity} maxQuantity={props.maxQuantity} selectedPercent={props.selectedPercent} quantityBasis={directionMeta[props.direction].quantityBasis} onQuantityChange={props.onQuantityChange} onPercentSelect={props.onPercentSelect} />
    </div>
  )
}

type SharedPrototypeProps = {
  direction: TradeDirection
  instrument: Instrument
  maxQuantity: number
  orderType: OrderType
  limitPrice: number
  effectivePrice: number
  quantity: number
  selectedPercent: number | null
  estimatedAmount: number
  onOrderTypeChange: (orderType: OrderType) => void
  onLimitPriceChange: (price: number) => void
  onQuantityChange: (quantity: number) => void
  onPercentSelect: (percent: number) => void
}

function HoldingsPicker({
  direction,
  selectedInstrument,
  onSelect,
  onClose,
}: {
  direction: TradeDirection
  selectedInstrument: Instrument
  onSelect: (instrument: Instrument) => void
  onClose: () => void
}) {
  const holdings = direction === 'sell'
    ? instruments.filter((instrument) => instrument.longQuantity)
    : instruments.filter((instrument) => instrument.shortQuantity)

  return (
    <div className="ticket-picker-layer">
      <button type="button" className="ticket-picker-backdrop" aria-label="보유 종목 목록 닫기" onClick={onClose} />
      <section className="ticket-picker-sheet" role="dialog" aria-modal="true" aria-label={directionMeta[direction].searchLabel}>
        <div className="ticket-picker-grabber" />
        <header><strong>{directionMeta[direction].searchLabel}</strong><span>{holdings.length}개</span></header>
        <div className="ticket-picker-list">
          {holdings.map((instrument) => (
            <button type="button" className={instrument.code === selectedInstrument.code ? 'is-selected' : ''} key={instrument.code} onClick={() => { onSelect(instrument); onClose() }}>
              <span><strong>{instrument.name}</strong><small>{instrument.code}</small></span>
              <span><strong>{direction === 'sell' ? instrument.longQuantity : instrument.shortQuantity}주</strong><small>{formatWon(instrument.price)}</small></span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

export default function TradeDrafts({ shortAllowed = true }: { shortAllowed?: boolean }) {
  const [prototype, setPrototype] = useState<TicketPrototype>('balanced')
  const [direction, setDirection] = useState<TradeDirection>('buy')
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument>(instruments[0])
  const [searchQuery, setSearchQuery] = useState(instruments[0].name)
  const [searchFocused, setSearchFocused] = useState(false)
  const [orderType, setOrderType] = useState<OrderType>('market')
  const [limitPrice, setLimitPrice] = useState(instruments[0].price)
  const [quantity, setQuantity] = useState(10)
  const [selectedPercent, setSelectedPercent] = useState<number | null>(null)
  const [isHoldingsPickerOpen, setIsHoldingsPickerOpen] = useState(false)

  const effectivePrice = orderType === 'market' ? selectedInstrument.price : limitPrice

  const maxQuantity = useMemo(() => {
    if (direction === 'sell') return selectedInstrument.longQuantity ?? 0
    if (direction === 'cover') return selectedInstrument.shortQuantity ?? 0
    return Math.max(1, Math.floor(CASH_BALANCE / Math.max(1, effectivePrice)))
  }, [direction, effectivePrice, selectedInstrument])

  const estimatedAmount = effectivePrice * quantity

  useEffect(() => {
    setQuantity((currentQuantity) => Math.max(1, Math.min(maxQuantity, currentQuantity)))
  }, [maxQuantity])

  const selectInstrument = (instrument: Instrument) => {
    setSelectedInstrument(instrument)
    setSearchQuery(instrument.name)
    setLimitPrice(instrument.price)
    setQuantity(1)
    setSelectedPercent(null)
  }

  const selectDirection = (nextDirection: TradeDirection) => {
    const nextInstrument = nextDirection === 'sell'
      ? instruments.find((instrument) => instrument.longQuantity) ?? instruments[0]
      : nextDirection === 'cover'
        ? instruments.find((instrument) => instrument.shortQuantity) ?? instruments[0]
        : nextDirection === 'short'
          ? instruments.find((instrument) => instrument.name === '에코프로') ?? instruments[0]
          : instruments[0]

    setDirection(nextDirection)
    setOrderType('market')
    setSelectedInstrument(nextInstrument)
    setSearchQuery(nextInstrument.name)
    setLimitPrice(nextInstrument.price)
    setQuantity(1)
    setSelectedPercent(null)
  }

  const changeQuantity = (nextQuantity: number) => {
    setQuantity(Math.max(1, Math.min(maxQuantity, nextQuantity)))
    setSelectedPercent(null)
  }

  const selectPercent = (percent: number) => {
    setSelectedPercent(percent)
    setQuantity(Math.max(1, Math.floor(maxQuantity * percent / 100)))
  }

  const sharedPrototypeProps: SharedPrototypeProps = {
    direction,
    instrument: selectedInstrument,
    maxQuantity,
    orderType,
    limitPrice,
    effectivePrice,
    quantity,
    selectedPercent,
    estimatedAmount,
    onOrderTypeChange: setOrderType,
    onLimitPriceChange: setLimitPrice,
    onQuantityChange: changeQuantity,
    onPercentSelect: selectPercent,
  }

  return (
    <div className="ticket-prototypes">
      <div className="ticket-prototype-switcher" role="tablist" aria-label="A형 세부 초안">
        {prototypeOptions.map((option) => (
          <button type="button" role="tab" aria-selected={prototype === option.key} className={prototype === option.key ? 'is-selected' : ''} key={option.key} onClick={() => setPrototype(option.key)}>{option.label}</button>
        ))}
      </div>
      <div className="ticket-scroll-area">
        <DirectionTabs direction={direction} onChange={selectDirection} shortAllowed={shortAllowed} />
        <InstrumentAccess direction={direction} selectedInstrument={selectedInstrument} searchQuery={searchQuery} searchFocused={searchFocused} onSearchQueryChange={setSearchQuery} onSearchFocusChange={setSearchFocused} onSelectInstrument={selectInstrument} onOpenAllHoldings={() => setIsHoldingsPickerOpen(true)} />
        {prototype === 'balanced' && <BalancedPrototype {...sharedPrototypeProps} />}
        {prototype === 'allocation' && <AllocationPrototype {...sharedPrototypeProps} />}
        {prototype === 'outcome' && <OutcomePrototype {...sharedPrototypeProps} />}
      </div>
      <footer className="ticket-sticky-footer">
        <span><small>예상 주문금액</small><strong>{formatWon(estimatedAmount)}</strong></span>
        <button type="button">{directionMeta[direction].label} 검토하기</button>
      </footer>
      {isHoldingsPickerOpen && (
        <HoldingsPicker direction={direction} selectedInstrument={selectedInstrument} onSelect={selectInstrument} onClose={() => setIsHoldingsPickerOpen(false)} />
      )}
    </div>
  )
}
