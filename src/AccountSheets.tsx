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
type TradeHistoryFilter = 'all' | 'long' | 'short'
type TradeHistoryDirection = 'buy' | 'sell' | 'short' | 'cover'

type TradeHistoryItem = {
  id: string
  type: 'trade'
  dateLabel: string
  direction: TradeHistoryDirection
  instrumentName: string
  instrumentCode: string
  orderType: '시장가' | '지정가'
  quantity: number
  price: number
  fee: number
  executedAt: string
} | {
  id: string
  type: 'mulligan'
  executedAt: string
}

const tradeHistoryItems: TradeHistoryItem[] = [
  { id: 'fill-1', type: 'trade', dateLabel: '오늘', direction: 'sell', instrumentName: 'SK하이닉스', instrumentCode: '000660', orderType: '시장가', quantity: 100, price: 176_500, fee: 35_300, executedAt: '오후 2:42:18' },
  { id: 'fill-2', type: 'trade', dateLabel: '오늘', direction: 'buy', instrumentName: '삼성전자', instrumentCode: '005930', orderType: '지정가', quantity: 12, price: 74_100, fee: 0, executedAt: '오전 10:18:04' },
  { id: 'fill-3', type: 'trade', dateLabel: '9월 1일', direction: 'cover', instrumentName: 'NAVER', instrumentCode: '035420', orderType: '시장가', quantity: 8, price: 211_000, fee: 0, executedAt: '오후 3:11:27' },
  { id: 'mulligan-1', type: 'mulligan', executedAt: '8월 31일 오후 4:02' },
  { id: 'fill-4', type: 'trade', dateLabel: '8월 31일', direction: 'short', instrumentName: '카카오', instrumentCode: '035720', orderType: '지정가', quantity: 40, price: 48_250, fee: 3_860, executedAt: '오후 1:36:52' },
  { id: 'fill-5', type: 'trade', dateLabel: '8월 30일', direction: 'buy', instrumentName: 'KODEX 200', instrumentCode: '069500', orderType: '시장가', quantity: 25, price: 36_180, fee: 0, executedAt: '오전 9:21:13' },
  { id: 'fill-6', type: 'trade', dateLabel: '8월 29일', direction: 'sell', instrumentName: '삼성전자', instrumentCode: '005930', orderType: '시장가', quantity: 20, price: 73_800, fee: 2_952, executedAt: '오후 2:57:40' },
]

const tradeDirectionMeta: Record<TradeHistoryDirection, { label: string; group: Exclude<TradeHistoryFilter, 'all'> }> = {
  buy: { label: '매수', group: 'long' },
  sell: { label: '매도', group: 'long' },
  short: { label: '공매도', group: 'short' },
  cover: { label: '상환', group: 'short' },
}

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
  isReset = false,
  initialCapital,
  viewCount,
  openOrders,
  onClose,
  onShare,
  onOpenHistory,
  onOpenPosition,
  onOpenOrder,
}: {
  isReset?: boolean
  initialCapital?: number
  viewCount: number
  openOrders: OpenOrder[]
  onClose: () => void
  onShare: () => void
  onOpenHistory: () => void
  onOpenPosition: (instrumentCode: string, direction: 'sell' | 'cover') => void
  onOpenOrder: (orderId: string) => void
}) {
  const [tab, setTab] = useState<PortfolioTab>('long')
  const longHoldings = isReset ? [] : instruments.filter((instrument) => instrument.longQuantity)
  const shortHoldings = isReset ? [] : instruments.filter((instrument) => instrument.shortQuantity)
  const visibleHoldings = tab === 'long' ? longHoldings : shortHoldings
  const visibleTotalAsset = isReset ? initialCapital ?? TOTAL_ASSET : TOTAL_ASSET
  const visibleReturn = isReset ? 0 : TOTAL_RETURN
  const visibleCash = isReset ? initialCapital ?? ORDERABLE_CASH : ORDERABLE_CASH

  return (
    <SwipeSheet edge="top" label="내 잔고" sheetClassName="social-sheet-portfolio" onClose={onClose}>
      <header className="portfolio-sheet-header">
        <span><strong>내 잔고</strong><small>오늘 {viewCount}번째 확인</small></span>
        <span className="portfolio-live-mark">방에 표시 중 · 👀</span>
      </header>

      <section className="portfolio-nav-card" aria-label="내 자산 요약">
        <span><small>총자산</small><strong>{formatWon(visibleTotalAsset)}</strong></span>
        <span><strong>{formatReturn(visibleReturn)}</strong><small>{isReset ? '멀리건 사용 후' : '대회 시작 이후'}</small></span>
      </section>

      <section className="portfolio-balance-grid" aria-label="잔고 구성">
        <span><small>주문 가능 현금</small><strong>{formatWon(visibleCash)}</strong></span>
        <span><small>Long 평가액</small><strong>{formatWon(isReset ? 0 : LONG_MARKET_VALUE)}</strong></span>
        <span><small>Short 평가액</small><strong>{formatWon(isReset ? 0 : SHORT_MARKET_VALUE)}</strong></span>
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
        ) : visibleHoldings.length === 0 ? (
          <div className="portfolio-empty-state"><strong>{isReset ? '멀리건으로 보유종목을 정리했어요' : '보유종목이 없어요'}</strong><span>{isReset ? '현금 100%에서 다시 매매를 시작할 수 있어요.' : '매매를 시작하면 이곳에서 확인할 수 있어요.'}</span></div>
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
        <div className="portfolio-footer-actions">
          <button type="button" className="is-history" onClick={onOpenHistory}>거래내역</button>
          <button type="button" onClick={onShare}>채팅방에 잔고 공유</button>
        </div>
      </footer>
    </SwipeSheet>
  )
}

export function TradeHistorySheet({
  competitionTitle,
  periodLabel,
  mulligansUsed = 0,
  onClose,
}: {
  competitionTitle: string
  periodLabel: string
  mulligansUsed?: number
  onClose: () => void
}) {
  const [filter, setFilter] = useState<TradeHistoryFilter>('all')
  const visibleItems = tradeHistoryItems.filter((item) => item.type === 'mulligan' || filter === 'all' || tradeDirectionMeta[item.direction].group === filter)
  const totalTrades = tradeHistoryItems.filter((item) => item.type === 'trade').length
  const visibleFees = visibleItems.reduce((sum, item) => sum + (item.type === 'trade' ? item.fee : 0), 0)
  let lastDateLabel = ''

  return (
    <SwipeSheet edge="bottom" label="내 거래내역" sheetClassName="social-sheet-trade-history" onClose={onClose}>
      <header className="trade-history-header">
        <span><small>{competitionTitle}</small><strong>내 거래내역</strong></span>
        <em>체결 기준</em>
      </header>

      <section className="trade-history-period" aria-label="거래내역 조회 범위">
        <span><small>이번 대회 조회 기간</small><strong>{periodLabel}</strong></span>
        <span><em>진행 중</em><strong>총 {totalTrades}건</strong></span>
        <p>대회 시작부터 지금까지 체결된 내 거래만 보여드려요.</p>
      </section>

      <div className="trade-history-filter" role="tablist" aria-label="거래 유형 필터">
        {([
          { id: 'all', label: '전체' },
          { id: 'long', label: '매수 · 매도' },
          { id: 'short', label: '공매도 · 상환' },
        ] as const).map((item) => (
          <button type="button" role="tab" aria-selected={filter === item.id} className={filter === item.id ? 'is-selected' : ''} onClick={() => setFilter(item.id)} key={item.id}>{item.label}</button>
        ))}
      </div>

      <div className="trade-history-list" aria-live="polite">
        {visibleItems.map((item) => {
          if (item.type === 'mulligan') {
            lastDateLabel = ''
            if (mulligansUsed === 0) return null
            return <div className="trade-history-mulligan" key={item.id}><span>멀리건 사용</span><strong>계좌를 초기자본으로 리셋했어요</strong><small>{item.executedAt} · 이전 거래도 보존</small></div>
          }

          const showDate = item.dateLabel !== lastDateLabel
          lastDateLabel = item.dateLabel
          const direction = tradeDirectionMeta[item.direction]
          return (
            <section className="trade-history-date-group" key={item.id}>
              {showDate && <h3>{item.dateLabel}</h3>}
              <article className="trade-history-row">
                <span className={`trade-history-direction is-${item.direction}`}>{direction.label}</span>
                <span className="trade-history-instrument"><strong>{item.instrumentName}</strong><small>{item.instrumentCode} · {item.orderType} · {item.executedAt}</small></span>
                <span className="trade-history-value"><strong>{formatWon(item.price * item.quantity)}</strong><small>{item.quantity.toLocaleString('ko-KR')}주 × {formatWon(item.price)}</small><em>{item.fee ? `수수료 ${formatWon(item.fee)}` : '수수료 없음'}</em></span>
              </article>
            </section>
          )
        })}
      </div>

      <footer className="trade-history-footer">
        <span><strong>표시된 수수료</strong><b>{formatWon(visibleFees)}</b></span>
        <p>대회가 끝나면 라운지에서는 볼 수 없지만 기록은 삭제되지 않아요. 향후 전체 거래내역에서 다시 확인할 수 있습니다.</p>
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
