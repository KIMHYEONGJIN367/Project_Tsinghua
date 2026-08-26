import { useEffect, useMemo, useState } from 'react'
import {
  ORDERABLE_CASH,
  TOTAL_ASSET,
  TOTAL_RETURN,
  formatReturn,
  formatWon,
  instruments,
  type Instrument,
} from './tradingData'

type TradeDirection = 'buy' | 'sell' | 'short' | 'cover'
type OrderType = 'market' | 'limit'

const directionMeta: Record<TradeDirection, {
  tabLabel: string
  label: string
  searchLabel: string
  quantityBasis: string
}> = {
  buy: { tabLabel: '매수', label: '매수', searchLabel: '종목명·코드 검색', quantityBasis: '현금 기준' },
  sell: { tabLabel: '매도', label: '매도', searchLabel: '내 Long 보유종목', quantityBasis: '보유 수량 기준' },
  short: { tabLabel: '공매도', label: '공매도', searchLabel: '공매도 가능 종목 검색', quantityBasis: '주문 가능 금액 기준' },
  cover: { tabLabel: '상환', label: '공매도 상환', searchLabel: '내 Short 보유종목', quantityBasis: 'Short 보유 수량 기준' },
}

function DirectionTabs({ direction, onChange, shortAllowed }: {
  direction: TradeDirection
  onChange: (direction: TradeDirection) => void
  shortAllowed: boolean
}) {
  const directions = (Object.keys(directionMeta) as TradeDirection[])
    .filter((item) => shortAllowed || (item !== 'short' && item !== 'cover'))

  return (
    <div className="ticket-direction-tabs" role="tablist" aria-label="거래 방향">
      {directions.map((item) => (
        <button type="button" role="tab" aria-selected={item === direction} className={item === direction ? 'is-selected' : ''} data-direction={item} key={item} onClick={() => onChange(item)}>
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
              {searchResults.length === 0 && <p className="ticket-search-empty">일치하는 종목이 없어요. 종목명이나 코드를 다시 확인해 주세요.</p>}
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
            <button type="button" className={instrument.code === selectedInstrument.code ? 'is-selected' : ''} key={`${direction}-${instrument.code}`} onClick={() => onSelectInstrument(instrument)}>
              <span><strong>{instrument.name}</strong><small>{direction === 'sell' ? 'Long' : 'Short'} · {quantity}주</small></span>
              <span><strong>{formatWon(instrument.price)}</strong><small className={instrument.change >= 0 ? 'is-positive' : 'is-negative'}>{instrument.change >= 0 ? '+' : ''}{instrument.change}%</small></span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function AccountAndCapacity({ direction, instrument, maxQuantity, onOpenPortfolio }: {
  direction: TradeDirection
  instrument: Instrument
  maxQuantity: number
  onOpenPortfolio: () => void
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
      <button type="button" className="ticket-nav-summary" onClick={onOpenPortfolio}>
        <span><small>내 총자산</small><strong>{formatWon(TOTAL_ASSET)}</strong></span>
        <span><strong>{formatReturn(TOTAL_RETURN)}</strong><small>잔고 보기 〉</small></span>
      </button>
      <div className="ticket-quote-row">
        <span><strong>{instrument.name}</strong><small>{instrument.code} · 현재가</small></span>
        <span><strong>{formatWon(instrument.price)}</strong><small className={instrument.change >= 0 ? 'is-positive' : 'is-negative'}>{instrument.change >= 0 ? '+' : ''}{instrument.change}%</small></span>
      </div>
      <div className="ticket-capacity-grid">
        <span><small>주문 가능 현금</small><strong>{formatWon(ORDERABLE_CASH)}</strong></span>
        <span><small>{quantityLabel}</small><strong>{maxQuantity.toLocaleString('ko-KR')}주</strong></span>
      </div>
    </>
  )
}

function OrderTypeAndPrice({ orderType, currentPrice, limitPrice, onOrderTypeChange, onLimitPriceChange }: {
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

function QuantityControl({ quantity, maxQuantity, selectedPercent, quantityBasis, onQuantityChange, onPercentSelect }: {
  quantity: number
  maxQuantity: number
  selectedPercent: number | null
  quantityBasis: string
  onQuantityChange: (quantity: number) => void
  onPercentSelect: (percent: number) => void
}) {
  return (
    <section className="ticket-quantity-section">
      <div className="ticket-quantity-heading"><span className="ticket-section-label">수량</span><small>{quantityBasis}</small></div>
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

function HoldingsPicker({ direction, selectedInstrument, onSelect, onClose }: {
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

export default function TradeDrafts({ shortAllowed = true, onOpenPortfolio }: {
  shortAllowed?: boolean
  onOpenPortfolio: () => void
}) {
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
    return Math.max(1, Math.floor(ORDERABLE_CASH / Math.max(1, effectivePrice)))
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

  return (
    <div className="ticket-prototypes">
      <div className="ticket-scroll-area">
        <DirectionTabs direction={direction} onChange={selectDirection} shortAllowed={shortAllowed} />
        <InstrumentAccess direction={direction} selectedInstrument={selectedInstrument} searchQuery={searchQuery} searchFocused={searchFocused} onSearchQueryChange={setSearchQuery} onSearchFocusChange={setSearchFocused} onSelectInstrument={selectInstrument} onOpenAllHoldings={() => setIsHoldingsPickerOpen(true)} />
        <div className="ticket-prototype-stack">
          <AccountAndCapacity direction={direction} instrument={selectedInstrument} maxQuantity={maxQuantity} onOpenPortfolio={onOpenPortfolio} />
          <OrderTypeAndPrice orderType={orderType} currentPrice={selectedInstrument.price} limitPrice={limitPrice} onOrderTypeChange={setOrderType} onLimitPriceChange={setLimitPrice} />
          <QuantityControl quantity={quantity} maxQuantity={maxQuantity} selectedPercent={selectedPercent} quantityBasis={directionMeta[direction].quantityBasis} onQuantityChange={changeQuantity} onPercentSelect={selectPercent} />
        </div>
      </div>
      <footer className="ticket-sticky-footer">
        <span><small>예상 주문금액</small><strong>{formatWon(estimatedAmount)}</strong></span>
        <button type="button">{directionMeta[direction].label} 검토하기</button>
      </footer>
      {isHoldingsPickerOpen && <HoldingsPicker direction={direction} selectedInstrument={selectedInstrument} onSelect={selectInstrument} onClose={() => setIsHoldingsPickerOpen(false)} />}
    </div>
  )
}
