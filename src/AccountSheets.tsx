import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import {
  CURRENT_RANK,
  LONG_MARKET_VALUE,
  ORDERABLE_CASH,
  SHORT_MARKET_VALUE,
  TOTAL_ASSET,
  TOTAL_RETURN,
  formatReturn,
  formatWon,
  instruments,
  type OpenOrder,
} from './tradingData'

type SheetEdge = 'top' | 'bottom'
type PortfolioTab = 'long' | 'short' | 'open'

function SwipeSheet({
  edge,
  label,
  sheetClassName = '',
  onClose,
  children,
}: {
  edge: SheetEdge
  label: string
  sheetClassName?: string
  onClose: () => void
  children: ReactNode
}) {
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)
  const sheetRef = useRef<HTMLElement>(null)
  const dragStartYRef = useRef<number | null>(null)
  const dragOffsetRef = useRef(0)
  const dismissTimerRef = useRef<number | null>(null)

  const dismissSheet = useCallback(() => {
    if (dismissTimerRef.current !== null) return

    const sheetHeight = sheetRef.current?.getBoundingClientRect().height ?? 600
    const dismissOffset = edge === 'bottom' ? sheetHeight : -sheetHeight
    dragStartYRef.current = null
    dragOffsetRef.current = dismissOffset
    setIsDragging(false)
    setIsDismissing(true)
    setDragOffset(dismissOffset)
    dismissTimerRef.current = window.setTimeout(() => {
      dismissTimerRef.current = null
      onClose()
    }, 200)
  }, [edge, onClose])

  useEffect(() => {
    const focusFrame = window.requestAnimationFrame(() => sheetRef.current?.focus())
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissSheet()
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [dismissSheet])

  useEffect(() => {
    const moveSheet = (event: PointerEvent) => {
      if (dragStartYRef.current === null) return
      const rawDelta = event.clientY - dragStartYRef.current
      const nextOffset = edge === 'bottom' ? Math.max(0, rawDelta) : Math.min(0, rawDelta)
      dragOffsetRef.current = nextOffset
      setDragOffset(nextOffset)
    }

    const finishSheetDrag = () => {
      if (dragStartYRef.current === null) return
      dragStartYRef.current = null
      setIsDragging(false)

      if (Math.abs(dragOffsetRef.current) >= 82) {
        dismissSheet()
        return
      }

      dragOffsetRef.current = 0
      setDragOffset(0)
    }

    const cancelSheetDrag = () => {
      if (dragStartYRef.current === null) return
      dragStartYRef.current = null
      dragOffsetRef.current = 0
      setIsDragging(false)
      setDragOffset(0)
    }

    window.addEventListener('pointermove', moveSheet)
    window.addEventListener('pointerup', finishSheetDrag)
    window.addEventListener('pointercancel', cancelSheetDrag)
    return () => {
      window.removeEventListener('pointermove', moveSheet)
      window.removeEventListener('pointerup', finishSheetDrag)
      window.removeEventListener('pointercancel', cancelSheetDrag)
      if (dismissTimerRef.current !== null) window.clearTimeout(dismissTimerRef.current)
    }
  }, [dismissSheet, edge])

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    dragStartYRef.current = event.clientY
    setIsDragging(true)
  }

  const handle = (
    <button
      type="button"
      className="social-sheet-drag-zone"
      aria-label={edge === 'bottom' ? '아래로 드래그하여 닫기' : '위로 드래그하여 닫기'}
      onPointerDown={startDrag}
      onKeyDown={(event) => {
        const dismissKey = edge === 'bottom' ? 'ArrowDown' : 'ArrowUp'
        if (event.key === 'Enter' || event.key === ' ' || event.key === dismissKey) {
          event.preventDefault()
          dismissSheet()
        }
      }}
    >
      <span aria-hidden="true" />
    </button>
  )

  return (
    <div className={`social-sheet-layer is-${edge} ${isDismissing ? 'is-dismissing' : ''}`}>
      <button type="button" className="social-sheet-backdrop" aria-label={`${label} 닫기`} onClick={dismissSheet} />
      <section
        ref={sheetRef}
        className={`social-sheet social-sheet-${edge} ${sheetClassName} ${isDragging ? 'is-dragging' : ''}`}
        style={{ transform: `translateY(${dragOffset}px)` }}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
      >
        {edge === 'bottom' && handle}
        <div className="social-sheet-content">{children}</div>
        {edge === 'top' && handle}
      </section>
    </div>
  )
}

export function PortfolioSheet({
  viewCount,
  openOrders,
  onClose,
  onShare,
  onOpenPosition,
  onOpenOrder,
}: {
  viewCount: number
  openOrders: OpenOrder[]
  onClose: () => void
  onShare: () => void
  onOpenPosition: (instrumentCode: string, direction: 'sell' | 'cover') => void
  onOpenOrder: (orderId: string) => void
}) {
  const [tab, setTab] = useState<PortfolioTab>('long')
  const longHoldings = instruments.filter((instrument) => instrument.longQuantity)
  const shortHoldings = instruments.filter((instrument) => instrument.shortQuantity)
  const visibleHoldings = tab === 'long' ? longHoldings : shortHoldings

  return (
    <SwipeSheet edge="top" label="내 잔고" sheetClassName="social-sheet-portfolio" onClose={onClose}>
      <header className="portfolio-sheet-header">
        <span><strong>내 잔고</strong><small>오늘 {viewCount}번째 확인</small></span>
        <span className="portfolio-live-mark">방에 표시 중 · 👀</span>
      </header>

      <section className="portfolio-nav-card" aria-label="내 자산 요약">
        <span><small>총자산</small><strong>{formatWon(TOTAL_ASSET)}</strong></span>
        <span><strong>{formatReturn(TOTAL_RETURN)}</strong><small>대회 시작 이후</small></span>
      </section>

      <section className="portfolio-balance-grid" aria-label="잔고 구성">
        <span><small>주문 가능 현금</small><strong>{formatWon(ORDERABLE_CASH)}</strong></span>
        <span><small>Long 평가액</small><strong>{formatWon(LONG_MARKET_VALUE)}</strong></span>
        <span><small>Short 평가액</small><strong>{formatWon(SHORT_MARKET_VALUE)}</strong></span>
      </section>

      <div className="portfolio-tabs" role="tablist" aria-label="잔고 종류">
        <button type="button" role="tab" aria-selected={tab === 'long'} className={tab === 'long' ? 'is-selected' : ''} onClick={() => setTab('long')}>보유종목 <small>{longHoldings.length}</small></button>
        <button type="button" role="tab" aria-selected={tab === 'short'} className={tab === 'short' ? 'is-selected' : ''} onClick={() => setTab('short')}>공매도 <small>{shortHoldings.length}</small></button>
        <button type="button" role="tab" aria-selected={tab === 'open'} className={tab === 'open' ? 'is-selected' : ''} onClick={() => setTab('open')}>미체결 <small>{openOrders.length}</small></button>
      </div>

      <div className="portfolio-holdings" aria-live="polite">
        {tab === 'open' ? (
          openOrders.length === 0 ? (
            <div className="portfolio-empty-state"><strong>미체결 주문이 없어요</strong><span>지정가 주문을 접수하면 이곳에서 확인할 수 있어요.</span></div>
          ) : openOrders.map((order) => {
            const instrument = instruments.find((item) => item.code === order.instrumentCode) ?? instruments[0]
            const directionLabel = order.direction === 'buy' ? '매수' : order.direction === 'sell' ? '매도' : order.direction === 'short' ? '공매도' : '상환'
            return (
              <button type="button" className="portfolio-holding-row is-open-order" aria-label={`${instrument.name} ${directionLabel} 미체결 주문 관리`} onClick={() => onOpenOrder(order.id)} key={order.id}>
                <span className="portfolio-holding-main"><strong>{instrument.name}</strong><small>{directionLabel} 지정가 · 잔여 {order.remainingQuantity}주</small></span>
                <span className="portfolio-holding-value"><strong>{formatWon(order.price)}</strong><small>{order.submittedAt}</small></span>
                <b className="portfolio-row-action">관리 <span aria-hidden="true">〉</span></b>
              </button>
            )
          })
        ) : visibleHoldings.map((instrument) => {
          const quantity = tab === 'long' ? instrument.longQuantity ?? 0 : instrument.shortQuantity ?? 0
          const actionLabel = tab === 'long' ? '매도' : '상환'
          return (
            <button type="button" className="portfolio-holding-row" aria-label={`${instrument.name} ${actionLabel} 화면 열기`} onClick={() => onOpenPosition(instrument.code, tab === 'long' ? 'sell' : 'cover')} key={`${tab}-${instrument.code}`}>
              <span className="portfolio-holding-main"><strong>{instrument.name}</strong><small>{instrument.code} · {quantity}주</small></span>
              <span className="portfolio-holding-value"><strong>{formatWon(instrument.price * quantity)}</strong><small className={instrument.change >= 0 ? 'is-positive' : 'is-negative'}>{instrument.change >= 0 ? '+' : ''}{instrument.change}%</small></span>
              <b className="portfolio-row-action">{actionLabel} <span aria-hidden="true">〉</span></b>
            </button>
          )
        })}
      </div>

      <footer className="portfolio-share-footer">
        <p>정확한 잔고는 공유 버튼을 누를 때만 대화방에 공개돼요.</p>
        <button type="button" onClick={onShare}>채팅방에 잔고 공유</button>
      </footer>
    </SwipeSheet>
  )
}

const leaderboard = [
  { rank: 1, name: '김영규', returnValue: 31.8, change: '—' },
  { rank: 2, name: '장우진', returnValue: 28.4, change: '▲ 1' },
  { rank: CURRENT_RANK, name: '김형진', returnValue: TOTAL_RETURN, change: '▼ 1', isMe: true },
  { rank: 4, name: '조진만', returnValue: -2.6, change: '—' },
]

export function RankingSheet({ viewCount, onClose }: { viewCount: number; onClose: () => void }) {
  return (
    <SwipeSheet edge="top" label="대회 순위" onClose={onClose}>
      <header className="ranking-sheet-header">
        <span><strong>대회 순위</strong><small>NAV 기준 · 실시간 반영</small></span>
        <span><strong>나의 순위 {CURRENT_RANK}위</strong><small>오늘 {viewCount}번째 확인</small></span>
      </header>

      <div className="ranking-social-note">👀 순위를 확인 중이라는 사실이 대회방에 표시돼요.</div>

      <ol className="ranking-list">
        {leaderboard.map((entry) => (
          <li className={entry.isMe ? 'is-me' : ''} key={entry.name}>
            <strong className="ranking-position">{entry.rank}</strong>
            <span className="ranking-avatar" aria-hidden="true">{entry.name.slice(0, 1)}</span>
            <span className="ranking-player"><strong>{entry.name}{entry.isMe ? ' (나)' : ''}</strong><small>{entry.change}</small></span>
            <strong className={entry.returnValue >= 0 ? 'is-positive' : 'is-negative'}>{formatReturn(entry.returnValue)}</strong>
          </li>
        ))}
      </ol>
    </SwipeSheet>
  )
}
