import { useEffect, useMemo, useRef, useState, type FocusEvent as ReactFocusEvent, type PointerEvent as ReactPointerEvent } from 'react'
import {
  ORDERABLE_CASH,
  formatWon,
  instruments,
  type Instrument,
  type OpenOrder,
  type OpenOrderUpdate,
  type TradeDirection,
  type TradeEntryIntent,
} from './tradingData'

type OrderType = 'market' | 'limit'

const directionMeta: Record<TradeDirection, {
  tabLabel: string
  searchLabel: string
  quantityBasis: string
}> = {
  buy: { tabLabel: '매수', searchLabel: '종목명·코드 검색', quantityBasis: '현금 기준' },
  sell: { tabLabel: '매도', searchLabel: '내 Long 보유종목', quantityBasis: '보유 수량 기준' },
  short: { tabLabel: '공매도', searchLabel: '공매도 가능 종목 검색', quantityBasis: '주문 가능 금액 기준' },
  cover: { tabLabel: '상환', searchLabel: '내 Short 보유종목', quantityBasis: 'Short 보유 수량 기준' },
}

function getKrxTickSize(price: number) {
  if (price < 2_000) return 1
  if (price < 5_000) return 5
  if (price < 20_000) return 10
  if (price < 50_000) return 50
  if (price < 200_000) return 100
  if (price < 500_000) return 500
  return 1_000
}

function normalizeKrxPrice(price: number) {
  const safePrice = Math.max(1, price)
  const tickSize = getKrxTickSize(safePrice)
  return Math.max(1, Math.round(safePrice / tickSize) * tickSize)
}

function moveKrxPriceByTick(price: number, direction: -1 | 1) {
  const normalizedPrice = normalizeKrxPrice(price)
  const referencePrice = direction === -1 ? Math.max(1, normalizedPrice - 1) : normalizedPrice
  return Math.max(1, normalizedPrice + getKrxTickSize(referencePrice) * direction)
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
  positionsReset,
}: {
  direction: TradeDirection
  selectedInstrument: Instrument
  searchQuery: string
  searchFocused: boolean
  onSearchQueryChange: (query: string) => void
  onSearchFocusChange: (focused: boolean) => void
  onSelectInstrument: (instrument: Instrument) => void
  onOpenAllHoldings: () => void
  positionsReset: boolean
}) {
  const isSearchDirection = direction === 'buy' || direction === 'short'
  const eligibleInstruments = direction === 'sell'
    ? positionsReset ? [] : instruments.filter((instrument) => instrument.longQuantity)
    : direction === 'cover'
      ? positionsReset ? [] : instruments.filter((instrument) => instrument.shortQuantity)
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
                  <span><strong>{instrument.name}</strong><small>{instrument.code} · {instrument.category ?? '주식'}</small></span>
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
        <button type="button" className="ticket-show-all" disabled={eligibleInstruments.length === 0} aria-label="전체 보유 종목 보기" onClick={onOpenAllHoldings}>＋</button>
      </div>
      <div className="ticket-holding-preview">
        {eligibleInstruments.length === 0 && <p className="ticket-search-empty">멀리건 사용 후 새로 보유한 종목이 없어요.</p>}
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

function QuoteAndCapacity({ direction, instrument, maxQuantity }: {
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
        <span><strong>{instrument.name}</strong><small>{instrument.code} · {instrument.category ?? '주식'} · 현재가</small></span>
        <span><strong>{formatWon(instrument.price)}</strong><small className={instrument.change >= 0 ? 'is-positive' : 'is-negative'}>{instrument.change >= 0 ? '+' : ''}{instrument.change}%</small></span>
      </div>
      <div className="ticket-capacity-grid">
        <span><small>주문 가능 현금</small><strong>{formatWon(ORDERABLE_CASH)}</strong></span>
        <span><small>{quantityLabel}</small><strong>{maxQuantity.toLocaleString('ko-KR')}주</strong></span>
      </div>
    </>
  )
}

function OpenOrdersManager({ initialOrderId, openOrders, onUpdate, onCancel, onClose }: {
  initialOrderId?: string | null
  openOrders: OpenOrder[]
  onUpdate: (orderId: string, update: OpenOrderUpdate) => void
  onCancel: (orderId: string) => void
  onClose: () => void
}) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(initialOrderId ?? openOrders[0]?.id ?? null)
  const [mode, setMode] = useState<'summary' | 'edit' | 'cancel'>('summary')
  const [isBatchCancelConfirmOpen, setIsBatchCancelConfirmOpen] = useState(false)
  const selectedOrder = openOrders.find((order) => order.id === selectedOrderId) ?? null
  const [draftPrice, setDraftPrice] = useState(selectedOrder?.price ?? 0)
  const [draftQuantity, setDraftQuantity] = useState(selectedOrder?.remainingQuantity ?? 1)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const sheetRef = useRef<HTMLElement>(null)
  const dragStartYRef = useRef<number | null>(null)
  const dragOffsetRef = useRef(0)

  useEffect(() => {
    if (initialOrderId && openOrders.some((order) => order.id === initialOrderId)) {
      setSelectedOrderId(initialOrderId)
    }
  }, [initialOrderId])

  useEffect(() => {
    if (openOrders.length > 0) return
    setSelectedOrderId(null)
    setIsBatchCancelConfirmOpen(false)
  }, [openOrders.length])

  useEffect(() => {
    if (!selectedOrder) {
      setMode('summary')
      return
    }

    setDraftPrice(selectedOrder.price)
    setDraftQuantity(selectedOrder.remainingQuantity)
    setMode('summary')
  }, [selectedOrderId, selectedOrder?.price, selectedOrder?.remainingQuantity])

  useEffect(() => {
    const moveSheet = (event: PointerEvent) => {
      if (dragStartYRef.current === null) return
      const nextOffset = Math.max(0, event.clientY - dragStartYRef.current)
      dragOffsetRef.current = nextOffset
      setDragOffset(nextOffset)
    }

    const finishDrag = () => {
      if (dragStartYRef.current === null) return
      dragStartYRef.current = null
      setIsDragging(false)

      if (dragOffsetRef.current >= 72) {
        const sheetHeight = sheetRef.current?.getBoundingClientRect().height ?? 500
        dragOffsetRef.current = sheetHeight
        setDragOffset(sheetHeight)
        window.setTimeout(onClose, 180)
        return
      }

      dragOffsetRef.current = 0
      setDragOffset(0)
    }

    const cancelDrag = () => {
      dragStartYRef.current = null
      dragOffsetRef.current = 0
      setIsDragging(false)
      setDragOffset(0)
    }

    window.addEventListener('pointermove', moveSheet)
    window.addEventListener('pointerup', finishDrag)
    window.addEventListener('pointercancel', cancelDrag)
    return () => {
      window.removeEventListener('pointermove', moveSheet)
      window.removeEventListener('pointerup', finishDrag)
      window.removeEventListener('pointercancel', cancelDrag)
    }
  }, [onClose])

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const syncKeyboardInset = () => {
      const keyboardInset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      sheetRef.current?.style.setProperty('--keyboard-inset', `${keyboardInset}px`)
    }

    syncKeyboardInset()
    viewport.addEventListener('resize', syncKeyboardInset)
    viewport.addEventListener('scroll', syncKeyboardInset)
    return () => {
      viewport.removeEventListener('resize', syncKeyboardInset)
      viewport.removeEventListener('scroll', syncKeyboardInset)
      sheetRef.current?.style.removeProperty('--keyboard-inset')
    }
  }, [])

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    dragStartYRef.current = event.clientY
    setIsDragging(true)
  }

  const selectOrder = (order: OpenOrder) => {
    setIsBatchCancelConfirmOpen(false)
    setSelectedOrderId((currentId) => currentId === order.id ? null : order.id)
  }

  const applyCorrection = () => {
    if (!selectedOrder) return
    onUpdate(selectedOrder.id, {
      price: normalizeKrxPrice(draftPrice),
      remainingQuantity: Math.max(1, draftQuantity),
    })
    setMode('summary')
  }

  const revealEditInput = (event: ReactFocusEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    window.setTimeout(() => input.scrollIntoView({ behavior: 'smooth', block: 'center' }), 180)
  }

  const cancelOrder = () => {
    if (!selectedOrder) return
    onCancel(selectedOrder.id)
    setSelectedOrderId(null)
    setMode('summary')
  }

  const cancelAllOrders = () => {
    openOrders.forEach((order) => onCancel(order.id))
    setSelectedOrderId(null)
    setMode('summary')
    setIsBatchCancelConfirmOpen(false)
  }

  return (
    <div className="ticket-orders-layer">
      <button type="button" className="ticket-orders-backdrop" aria-label="미체결 주문 닫기" onClick={onClose} />
      <section ref={sheetRef} className={`ticket-orders-sheet ${isDragging ? 'is-dragging' : ''}`} style={{ transform: `translateY(${dragOffset}px)` }} role="dialog" aria-modal="true" aria-label="미체결 주문 관리">
        <button
          type="button"
          className="ticket-orders-close-grabber"
          aria-label="아래로 드래그하여 미체결 주문 닫기"
          onPointerDown={startDrag}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
              event.preventDefault()
              onClose()
            }
          }}
        ><span aria-hidden="true" /></button>
        <header className="ticket-orders-header">
          <span><strong>미체결 주문</strong><small>가격·수량을 바로 정정하거나 취소할 수 있어요.</small></span>
          <div className="ticket-orders-header-actions">
            <b>{openOrders.length}건</b>
            <button type="button" disabled={openOrders.length === 0} aria-label={`미체결 주문 ${openOrders.length}건 일괄취소`} onClick={() => {
              setMode('summary')
              setIsBatchCancelConfirmOpen(true)
            }}>일괄취소</button>
          </div>
        </header>

        {isBatchCancelConfirmOpen && (
          <div className="ticket-orders-batch-confirm" role="alert">
            <span><strong>미체결 {openOrders.length}건을 모두 취소할까요?</strong><small>이미 체결된 수량은 취소되지 않아요.</small></span>
            <div><button type="button" onClick={() => setIsBatchCancelConfirmOpen(false)}>돌아가기</button><button type="button" onClick={cancelAllOrders}>전체 취소</button></div>
          </div>
        )}

        {openOrders.length === 0 ? (
          <div className="ticket-orders-empty"><strong>미체결 주문이 없어요</strong><span>새 주문을 접수하면 이곳에서 관리할 수 있어요.</span></div>
        ) : (
          <div className="ticket-orders-list">
            {openOrders.map((order) => {
              const instrument = instruments.find((item) => item.code === order.instrumentCode) ?? instruments[0]
              const isSelected = selectedOrderId === order.id
              const totalQuantity = order.filledQuantity + order.remainingQuantity
              return (
                <article className={`ticket-order-card ${isSelected ? 'is-selected' : ''}`} key={order.id}>
                  <button type="button" className="ticket-order-summary" aria-expanded={isSelected} onClick={() => selectOrder(order)}>
                    <span className={`ticket-order-direction is-${order.direction}`}>{directionMeta[order.direction].tabLabel}</span>
                    <span className="ticket-order-name"><strong>{instrument.name}</strong><small>{order.submittedAt} · 지정가</small></span>
                    <span className="ticket-order-value"><strong>{formatWon(order.price)}</strong><small>잔여 {order.remainingQuantity}주</small></span>
                    <b aria-hidden="true">⌄</b>
                  </button>

                  {isSelected && (
                    <div className="ticket-order-detail">
                      <div className="ticket-order-facts">
                        <span><small>현재가</small><strong>{formatWon(instrument.price)}</strong></span>
                        <span><small>주문 수량</small><strong>{totalQuantity}주</strong></span>
                        <span><small>체결 / 잔여</small><strong>{order.filledQuantity} / {order.remainingQuantity}주</strong></span>
                      </div>

                      {mode === 'summary' && (
                        <div className="ticket-order-actions">
                          <button type="button" onClick={() => setMode('edit')}>정정</button>
                          <button type="button" className="is-cancel" onClick={() => setMode('cancel')}>취소</button>
                        </div>
                      )}

                      {mode === 'edit' && (
                        <div className="ticket-order-edit">
                          <div className="ticket-order-edit-field">
                            <span><strong>정정 가격</strong><small>1틱 {getKrxTickSize(normalizeKrxPrice(draftPrice)).toLocaleString('ko-KR')}원</small></span>
                            <div className="ticket-order-stepper">
                              <button type="button" aria-label="정정 가격 1틱 내리기" onClick={() => setDraftPrice((price) => moveKrxPriceByTick(price, -1))}>−</button>
                              <label><input aria-label="정정 가격" inputMode="numeric" enterKeyHint="done" value={draftPrice.toLocaleString('ko-KR')} onFocus={revealEditInput} onBlur={() => setDraftPrice((price) => normalizeKrxPrice(price))} onChange={(event) => setDraftPrice(Number(event.target.value.replace(/[^0-9]/g, '')) || 0)} /><small>원</small></label>
                              <button type="button" aria-label="정정 가격 1틱 올리기" onClick={() => setDraftPrice((price) => moveKrxPriceByTick(price, 1))}>＋</button>
                            </div>
                          </div>
                          <div className="ticket-order-edit-field">
                            <span><strong>정정 잔여 수량</strong><small>1주 단위</small></span>
                            <div className="ticket-order-stepper">
                              <button type="button" aria-label="정정 잔여 수량 1주 줄이기" disabled={draftQuantity <= 1} onClick={() => setDraftQuantity((quantity) => Math.max(1, quantity - 1))}>−</button>
                              <label><input aria-label="정정 잔여 수량" inputMode="numeric" enterKeyHint="done" value={draftQuantity.toLocaleString('ko-KR')} onFocus={revealEditInput} onBlur={() => setDraftQuantity((quantity) => Math.max(1, quantity))} onChange={(event) => setDraftQuantity(Number(event.target.value.replace(/[^0-9]/g, '')) || 0)} /><small>주</small></label>
                              <button type="button" aria-label="정정 잔여 수량 1주 늘리기" onClick={() => setDraftQuantity((quantity) => Math.max(1, quantity + 1))}>＋</button>
                            </div>
                          </div>
                          <p>부분 체결분은 바뀌지 않고 남은 수량만 정정돼요.</p>
                          <div className="ticket-order-edit-actions"><button type="button" onClick={() => setMode('summary')}>돌아가기</button><button type="button" onClick={applyCorrection}>정정 적용</button></div>
                        </div>
                      )}

                      {mode === 'cancel' && (
                        <div className="ticket-order-cancel-confirm" role="alert">
                          <span><strong>남은 {order.remainingQuantity}주를 취소할까요?</strong><small>이미 체결된 {order.filledQuantity}주는 취소되지 않아요.</small></span>
                          <div><button type="button" onClick={() => setMode('summary')}>돌아가기</button><button type="button" onClick={cancelOrder}>주문 취소</button></div>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
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
        <button type="button" aria-label="수량 줄이기" disabled={maxQuantity === 0} onClick={() => onQuantityChange(Math.max(1, quantity - 1))}>−</button>
        <label>
          <span className="sr-only">주문 수량</span>
          <input
            type="text"
            inputMode="numeric"
            aria-label="주문 수량"
            value={quantity.toLocaleString('ko-KR')}
            onChange={(event) => {
              const nextQuantity = Number(event.target.value.replace(/[^0-9]/g, ''))
              if (Number.isFinite(nextQuantity)) onQuantityChange(maxQuantity === 0 ? 0 : Math.max(1, Math.min(maxQuantity, nextQuantity)))
            }}
          />
          <small>주</small>
        </label>
        <button type="button" aria-label="수량 늘리기" disabled={maxQuantity === 0} onClick={() => onQuantityChange(Math.min(maxQuantity, quantity + 1))}>＋</button>
      </div>
      <div className="ticket-allocation-buttons" aria-label="주문 비중 선택">
        {[10, 25, 50, 100].map((percent) => (
          <button type="button" disabled={maxQuantity === 0} className={selectedPercent === percent ? 'is-selected' : ''} aria-pressed={selectedPercent === percent} key={percent} onClick={() => onPercentSelect(percent)}>{percent === 100 ? '최대' : `${percent}%`}</button>
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

export default function TradeDrafts({ positionsReset = false, shortAllowed = true, tradeEntryIntent, onOpenPortfolio, openOrders, onUpdateOpenOrder, onCancelOpenOrder }: {
  positionsReset?: boolean
  shortAllowed?: boolean
  tradeEntryIntent: TradeEntryIntent | null
  onOpenPortfolio: () => void
  openOrders: OpenOrder[]
  onUpdateOpenOrder: (orderId: string, update: OpenOrderUpdate) => void
  onCancelOpenOrder: (orderId: string) => void
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
  const [isOpenOrdersManagerOpen, setIsOpenOrdersManagerOpen] = useState(false)
  const [openOrdersManagerTargetId, setOpenOrdersManagerTargetId] = useState<string | null>(null)

  const effectivePrice = orderType === 'market' ? selectedInstrument.price : limitPrice
  const maxQuantity = useMemo(() => {
    if (direction === 'sell') return positionsReset ? 0 : selectedInstrument.longQuantity ?? 0
    if (direction === 'cover') return positionsReset ? 0 : selectedInstrument.shortQuantity ?? 0
    return Math.max(1, Math.floor(ORDERABLE_CASH / Math.max(1, effectivePrice)))
  }, [direction, effectivePrice, positionsReset, selectedInstrument])
  const estimatedAmount = effectivePrice * quantity

  useEffect(() => {
    setQuantity((currentQuantity) => maxQuantity === 0 ? 0 : Math.max(1, Math.min(maxQuantity, currentQuantity)))
  }, [maxQuantity])

  useEffect(() => {
    if (!tradeEntryIntent) return

    if (tradeEntryIntent.kind === 'open-order') {
      const order = openOrders.find((item) => item.id === tradeEntryIntent.orderId)
      if (!order) return
      const instrument = instruments.find((item) => item.code === order.instrumentCode) ?? instruments[0]

      setDirection(order.direction)
      setSelectedInstrument(instrument)
      setSearchQuery(instrument.name)
      setSearchFocused(false)
      setOrderType('limit')
      setLimitPrice(order.price)
      setQuantity(order.remainingQuantity)
      setSelectedPercent(null)
      setIsHoldingsPickerOpen(false)
      setOpenOrdersManagerTargetId(order.id)
      setIsOpenOrdersManagerOpen(true)
      return
    }

    const instrument = instruments.find((item) => item.code === tradeEntryIntent.instrumentCode)
    if (!instrument) return

    setDirection(tradeEntryIntent.direction)
    setSelectedInstrument(instrument)
    setSearchQuery(instrument.name)
    setSearchFocused(false)
    setOrderType('market')
    setLimitPrice(instrument.price)
    setQuantity(1)
    setSelectedPercent(null)
    setIsHoldingsPickerOpen(false)
    setOpenOrdersManagerTargetId(null)
    setIsOpenOrdersManagerOpen(false)
  }, [tradeEntryIntent?.requestId])

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
    setQuantity(maxQuantity === 0 ? 0 : Math.max(1, Math.min(maxQuantity, nextQuantity)))
    setSelectedPercent(null)
  }

  const selectPercent = (percent: number) => {
    setSelectedPercent(percent)
    setQuantity(maxQuantity === 0 ? 0 : Math.max(1, Math.floor(maxQuantity * percent / 100)))
  }

  return (
    <div className="ticket-prototypes">
      <div className="ticket-scroll-area">
        <DirectionTabs direction={direction} onChange={selectDirection} shortAllowed={shortAllowed} />
        <InstrumentAccess positionsReset={positionsReset} direction={direction} selectedInstrument={selectedInstrument} searchQuery={searchQuery} searchFocused={searchFocused} onSearchQueryChange={setSearchQuery} onSearchFocusChange={setSearchFocused} onSelectInstrument={selectInstrument} onOpenAllHoldings={() => setIsHoldingsPickerOpen(true)} />
        <div className="ticket-prototype-stack">
          <QuoteAndCapacity direction={direction} instrument={selectedInstrument} maxQuantity={maxQuantity} />
          <OrderTypeAndPrice orderType={orderType} currentPrice={selectedInstrument.price} limitPrice={limitPrice} onOrderTypeChange={setOrderType} onLimitPriceChange={setLimitPrice} />
          <QuantityControl quantity={quantity} maxQuantity={maxQuantity} selectedPercent={selectedPercent} quantityBasis={directionMeta[direction].quantityBasis} onQuantityChange={changeQuantity} onPercentSelect={selectPercent} />
        </div>
      </div>
      <footer className="ticket-sticky-footer">
        <span className="ticket-footer-estimate"><small>예상 주문금액</small><strong>{formatWon(estimatedAmount)}</strong></span>
        <div className="ticket-footer-actions">
          <button type="button" className="ticket-balance-action" onClick={onOpenPortfolio}>잔고</button>
          <button
            type="button"
            className="ticket-open-orders-action"
            disabled={openOrders.length === 0}
            aria-label={openOrders.length > 0 ? `미체결 주문 ${openOrders.length}건 관리` : '미체결 주문 없음'}
            onClick={() => {
              setOpenOrdersManagerTargetId(null)
              setIsOpenOrdersManagerOpen(true)
            }}
          >
            미체결 <span>{openOrders.length}</span>
          </button>
          <button type="button" className="ticket-primary-action" disabled={maxQuantity === 0}>{directionMeta[direction].tabLabel}</button>
        </div>
      </footer>
      {isHoldingsPickerOpen && <HoldingsPicker direction={direction} selectedInstrument={selectedInstrument} onSelect={selectInstrument} onClose={() => setIsHoldingsPickerOpen(false)} />}
      {isOpenOrdersManagerOpen && <OpenOrdersManager initialOrderId={openOrdersManagerTargetId} openOrders={openOrders} onUpdate={onUpdateOpenOrder} onCancel={onCancelOpenOrder} onClose={() => {
        setOpenOrdersManagerTargetId(null)
        setIsOpenOrdersManagerOpen(false)
      }} />}
    </div>
  )
}
