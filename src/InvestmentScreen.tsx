import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AreaSeries, ColorType, CrosshairMode, createChart, type AreaData, type UTCTimestamp } from 'lightweight-charts'
import investBattery from './assets/invest-ios-battery.svg'
import investHome from './assets/invest-home.svg'
import investMessage from './assets/invest-message.svg'
import investSignal from './assets/invest-ios-signal.svg'
import investTrending from './assets/invest-trending.svg'
import investWifi from './assets/invest-ios-wifi.svg'
import friendsUser from './assets/friends-user.svg'

type InvestmentRoute = 'home' | 'chat-list' | 'invest' | 'my'
type ChartPeriod = '1D' | '1W' | '1M' | '1Y'

type WatchStock = {
  id: string
  name: string
  code: string
  price: number
  changeAmount: number
  changeRate: number
  high: number
  low: number
  volume: string
  sparkline: string
}

const STORAGE_KEY = 'tiantou-investment-watchlist-v1'
const STOCKS: WatchStock[] = [
  { id: 'samsung-electronics', name: '삼성전자', code: '005930', price: 72400, changeAmount: -300, changeRate: -0.41, high: 73100, low: 71800, volume: '1,240만', sparkline: 'M2 25 C14 17 21 26 31 16 S48 10 57 17 S72 7 82 8' },
  { id: 'sk-hynix', name: 'SK하이닉스', code: '000660', price: 186700, changeAmount: 2900, changeRate: 1.58, high: 188200, low: 181500, volume: '398만', sparkline: 'M2 28 C13 26 22 16 31 20 S47 12 58 13 S72 5 82 7' },
  { id: 'hyundai-motor', name: '현대차', code: '005380', price: 244500, changeAmount: 1000, changeRate: 0.41, high: 247000, low: 241000, volume: '82.6만', sparkline: 'M2 23 C15 21 23 24 33 18 S50 21 60 13 S74 16 82 10' },
  { id: 'celltrion', name: '셀트리온', code: '068270', price: 194200, changeAmount: -2000, changeRate: -1.02, high: 197300, low: 193500, volume: '46.2만', sparkline: 'M2 8 C15 12 23 7 33 15 S48 17 58 21 S73 24 82 27' },
  { id: 'naver', name: 'NAVER', code: '035420', price: 217000, changeAmount: 1500, changeRate: 0.7, high: 218500, low: 213000, volume: '61.8만', sparkline: 'M2 27 C13 19 22 22 32 15 S48 18 58 10 S73 12 82 6' },
  { id: 'kakao', name: '카카오', code: '035720', price: 43850, changeAmount: -350, changeRate: -0.79, high: 44650, low: 43600, volume: '112만', sparkline: 'M2 7 C14 10 23 14 32 12 S48 20 59 18 S72 27 82 24' },
  { id: 'samsung-biologics', name: '삼성바이오로직스', code: '207940', price: 1012000, changeAmount: 8000, changeRate: 0.8, high: 1019000, low: 997000, volume: '7.8만', sparkline: 'M2 25 C15 19 24 23 34 15 S49 11 59 13 S72 5 82 8' },
]
const STOCK_BY_ID = Object.fromEntries(STOCKS.map((stock) => [stock.id, stock])) as Record<string, WatchStock>
const DEFAULT_WATCHLIST = ['samsung-electronics', 'sk-hynix', 'hyundai-motor', 'celltrion']

const formatPrice = (value: number) => `${value.toLocaleString('ko-KR')}원`
const formatChangeAmount = (value: number) => `${value > 0 ? '+' : ''}${value.toLocaleString('ko-KR')}`
const formatChangeRate = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
const tone = (stock: WatchStock) => stock.changeRate > 0 ? 'is-up' : stock.changeRate < 0 ? 'is-down' : 'is-flat'

function createChartData(stock: WatchStock, period: ChartPeriod): AreaData[] {
  const config = {
    '1D': { count: 42, step: 600, amplitude: .012 },
    '1W': { count: 42, step: 3600, amplitude: .02 },
    '1M': { count: 45, step: 86400, amplitude: .045 },
    '1Y': { count: 52, step: 604800, amplitude: .16 },
  }[period]
  const seed = stock.code.split('').reduce((sum, digit) => sum + Number(digit), 0)
  const direction = stock.changeRate >= 0 ? 1 : -1
  const last = Math.floor(Date.now() / 1000)
  const start = last - (config.count - 1) * config.step
  const raw = Array.from({ length: config.count }, (_, index) => {
    const progress = index / (config.count - 1)
    return stock.price * (1 + direction * config.amplitude * (progress - 1) + Math.sin(index * .72 + seed) * config.amplitude * .18 + Math.cos(index * .31 + seed * .4) * config.amplitude * .1)
  })
  const scale = stock.price / raw[raw.length - 1]
  return raw.map((value, index) => ({ time: (start + index * config.step) as UTCTimestamp, value: Math.round(value * scale) }))
}

function Icon({ kind }: { kind: 'search' | 'plus' | 'trash' | 'close' }) {
  return (
    <svg className="investment-line-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {kind === 'search' && <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.2 4.2" /></>}
      {kind === 'plus' && <><path d="M12 5v14M5 12h14" /></>}
      {kind === 'trash' && <><path d="M5.5 7.5h13M9 7.5V5h6v2.5M7.5 7.5l.7 11h7.6l.7-11M10 10.5v5M14 10.5v5" /></>}
      {kind === 'close' && <path d="m6.5 6.5 11 11m0-11-11 11" />}
    </svg>
  )
}

function TradingViewChart({ stock }: { stock: WatchStock }) {
  const chartRef = useRef<HTMLDivElement | null>(null)
  const [period, setPeriod] = useState<ChartPeriod>('1D')

  useEffect(() => {
    const container = chartRef.current
    if (!container) return
    const isUp = stock.changeRate >= 0
    const lineColor = isUp ? '#b8323c' : '#256bbc'
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: { background: { type: ColorType.Solid, color: '#ffffff' }, textColor: '#9f9596', fontFamily: 'Kakao Small Sans, sans-serif', fontSize: 10 },
      localization: { priceFormatter: (price: number) => Math.round(price).toLocaleString('ko-KR') },
      grid: { vertLines: { color: '#f4f0ef' }, horzLines: { color: '#f1eceb' } },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: '#bdb3b4', width: 1 }, horzLine: { color: '#bdb3b4', width: 1 } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: .13, bottom: .12 } },
      timeScale: { borderVisible: false, timeVisible: period === '1D' || period === '1W', secondsVisible: false, rightOffset: 1, barSpacing: 7, minBarSpacing: 2 },
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: false, mouseWheel: false, pinch: true },
    })
    const series = chart.addSeries(AreaSeries, {
      lineColor,
      lineWidth: 2,
      topColor: isUp ? 'rgba(184, 50, 60, .18)' : 'rgba(37, 107, 188, .18)',
      bottomColor: isUp ? 'rgba(184, 50, 60, 0)' : 'rgba(37, 107, 188, 0)',
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
    })
    series.setData(createChartData(stock, period))
    chart.timeScale().fitContent()
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      chart.resize(Math.floor(entry.contentRect.width), Math.floor(entry.contentRect.height))
      chart.timeScale().fitContent()
    })
    observer.observe(container)
    return () => { observer.disconnect(); chart.remove() }
  }, [period, stock])

  return (
    <div className="investment-chart-stage" aria-label={`${stock.name} TradingView Lightweight Charts 가격 차트`}>
      <div className="investment-chart-periods" aria-label="차트 기간">
        {(['1D', '1W', '1M', '1Y'] as const).map((item) => <button type="button" className={period === item ? 'is-selected' : ''} aria-pressed={period === item} onClick={() => setPeriod(item)} key={item}>{item}</button>)}
      </div>
      <div ref={chartRef} className="investment-tradingview-chart" />
      <a className="investment-tradingview-credit" href="https://www.tradingview.com/" target="_blank" rel="noreferrer">Chart by TradingView</a>
    </div>
  )
}

function SwipeRow({ stock, selected, open, onOpen, onClose, onSelect, onRemove }: { stock: WatchStock; selected: boolean; open: boolean; onOpen: () => void; onClose: () => void; onSelect: () => void; onRemove: () => void }) {
  const gestureRef = useRef({ x: 0, y: 0, offset: 0, dragging: false, horizontal: false })
  const [dragOffset, setDragOffset] = useState<number | null>(null)
  const restingOffset = open ? -76 : 0
  const offset = dragOffset ?? restingOffset

  const pointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    gestureRef.current = { x: event.clientX, y: event.clientY, offset: restingOffset, dragging: true, horizontal: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const pointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = gestureRef.current
    if (!gesture.dragging) return
    const dx = event.clientX - gesture.x
    const dy = event.clientY - gesture.y
    if (!gesture.horizontal) {
      if (Math.abs(dx) < 5 || Math.abs(dx) <= Math.abs(dy)) return
      gesture.horizontal = true
    }
    setDragOffset(Math.max(-76, Math.min(0, gesture.offset + dx)))
  }
  const pointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = gestureRef.current
    if (!gesture.dragging) return
    gesture.dragging = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    const finalOffset = dragOffset ?? restingOffset
    setDragOffset(null)
    if (gesture.horizontal) finalOffset <= -34 ? onOpen() : onClose()
    else if (open) onClose()
    else onSelect()
  }

  return (
    <div className={`investment-watch-row ${selected ? 'is-selected' : ''}`}>
      <button type="button" className="investment-watch-delete" onClick={onRemove} aria-label={`${stock.name} 관심 종목에서 삭제`}><Icon kind="trash" /><span>삭제</span></button>
      <button
        type="button"
        className="investment-watch-surface"
        aria-current={selected ? 'true' : undefined}
        aria-label={`${stock.name}, ${formatPrice(stock.price)}, ${formatChangeRate(stock.changeRate)}. 왼쪽으로 밀어 삭제`}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerEnd}
        onPointerCancel={pointerEnd}
        style={{ transform: `translate3d(${offset}px, 0, 0)` }}
      >
        <span className="investment-watch-identity"><strong>{stock.name}</strong><small>{stock.code}</small></span>
        <svg className={`investment-watch-spark ${tone(stock)}`} viewBox="0 0 84 34" aria-hidden="true"><path d={stock.sparkline} /></svg>
        <span className="investment-watch-numbers"><strong>{formatPrice(stock.price)}</strong><small className={tone(stock)}>{formatChangeRate(stock.changeRate)}</small></span>
      </button>
    </div>
  )
}

function StatusBar() {
  return <div className="status-bar investment-status-bar"><span className="status-time">9:41</span><div className="status-icons"><img src={investSignal} alt="" width="18" height="18" /><img src={investWifi} alt="" width="18" height="18" /><img src={investBattery} alt="" width="24" height="24" /></div></div>
}

function BottomNav({ onNavigate }: { onNavigate: (screen: InvestmentRoute) => void }) {
  const items = [
    { key: 'home' as const, label: '홈', icon: investHome },
    { key: 'chat-list' as const, label: '라운지', icon: investMessage },
    { key: 'invest' as const, label: '투자', icon: investTrending },
    { key: 'my' as const, label: '마이', icon: friendsUser },
  ]
  return <nav className="bottom-nav investment-bottom-nav" aria-label="주요 메뉴">{items.map((item) => <button type="button" className={`nav-item ${item.key === 'invest' ? 'is-active' : ''}`} aria-current={item.key === 'invest' ? 'page' : undefined} onClick={() => onNavigate(item.key)} key={item.key}><img className="feed-icon" src={item.icon} alt="" width="22" height="22" /><span>{item.label}</span></button>)}</nav>
}

function initialWatchlist() {
  if (typeof window === 'undefined') return DEFAULT_WATCHLIST
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(stored)) return DEFAULT_WATCHLIST
    const valid = stored.filter((id): id is string => typeof id === 'string' && Boolean(STOCK_BY_ID[id]))
    return valid.length ? valid : DEFAULT_WATCHLIST
  } catch { return DEFAULT_WATCHLIST }
}

export default function InvestmentScreen({ onNavigate }: { onNavigate: (screen: InvestmentRoute) => void }) {
  const [watchIds, setWatchIds] = useState<string[]>(initialWatchlist)
  const [selectedId, setSelectedId] = useState(() => initialWatchlist()[0])
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [removed, setRemoved] = useState<{ id: string; index: number } | null>(null)
  const toastTimer = useRef<number | null>(null)
  const selected = STOCK_BY_ID[selectedId] ?? STOCK_BY_ID[watchIds[0]] ?? STOCKS[0]
  const normalized = query.trim().toLocaleLowerCase()
  const searchResults = useMemo(() => STOCKS.filter((stock) => !normalized || `${stock.name} ${stock.code}`.toLocaleLowerCase().includes(normalized)), [normalized])

  useEffect(() => { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(watchIds)) }, [watchIds])
  useEffect(() => () => { if (toastTimer.current) window.clearTimeout(toastTimer.current) }, [])

  const addStock = (id: string) => {
    setWatchIds((current) => current.includes(id) ? current : [...current, id])
    setSelectedId(id)
    setQuery('')
    setIsAddOpen(false)
  }
  const removeStock = (id: string) => {
    if (watchIds.length <= 1) return
    const index = watchIds.indexOf(id)
    const next = watchIds.filter((watchId) => watchId !== id)
    setRemoved({ id, index })
    setWatchIds(next)
    setOpenSwipeId(null)
    if (selectedId === id) setSelectedId(next[Math.min(index, next.length - 1)])
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setRemoved(null), 4200)
  }
  const undoRemove = () => {
    if (!removed) return
    setWatchIds((current) => {
      if (current.includes(removed.id)) return current
      const next = [...current]
      next.splice(Math.min(removed.index, next.length), 0, removed.id)
      return next
    })
    setRemoved(null)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
  }

  return (
    <main className="app-shell investment-screen">
      <div className="investment-scroll">
        <StatusBar />
        <header className="investment-header"><h1>투자</h1></header>
        <section className="investment-focus" aria-live="polite">
          <div className="investment-focus-heading"><div><strong>{selected.name}</strong><small>{selected.code} · KRX</small></div><span className="investment-live"><i aria-hidden="true" /> 실시간</span></div>
          <div className="investment-focus-price"><strong>{formatPrice(selected.price)}</strong><span className={tone(selected)}>{formatChangeAmount(selected.changeAmount)} · {formatChangeRate(selected.changeRate)}</span></div>
          <small className="investment-updated-at">15:18:24 기준</small>
          <TradingViewChart stock={selected} />
          <div className="investment-quote-summary"><span>고가 <b>{selected.high.toLocaleString('ko-KR')}</b></span><span>저가 <b>{selected.low.toLocaleString('ko-KR')}</b></span><span>거래량 <b>{selected.volume}</b></span></div>
        </section>
        <section className="investment-watchlist">
          <header><div><h2>관심 종목</h2><span>{watchIds.length}</span></div><button type="button" onClick={() => { setQuery(''); setIsAddOpen(true); setOpenSwipeId(null) }}><Icon kind="plus" /> 종목 추가</button></header>
          <p className="investment-swipe-hint">종목을 눌러 차트를 바꾸고, 왼쪽으로 밀어 삭제하세요.</p>
          <div className="investment-watch-rows">{watchIds.map((id) => {
            const stock = STOCK_BY_ID[id]
            return <SwipeRow stock={stock} selected={id === selected.id} open={openSwipeId === id} onOpen={() => setOpenSwipeId(id)} onClose={() => setOpenSwipeId(null)} onSelect={() => { setSelectedId(id); setOpenSwipeId(null) }} onRemove={() => removeStock(id)} key={id} />
          })}</div>
        </section>
      </div>
      <div className="feed-bottom investment-footer"><BottomNav onNavigate={onNavigate} /><div className="home-indicator"><div /></div></div>

      {isAddOpen && <div className="investment-add-layer">
        <button type="button" className="investment-add-backdrop" aria-label="종목 추가 닫기" onClick={() => setIsAddOpen(false)} />
        <section className="investment-add-sheet" role="dialog" aria-modal="true" aria-labelledby="investment-add-title">
          <div className="investment-add-grabber" aria-hidden="true" />
          <header><h2 id="investment-add-title">관심 종목 추가</h2><button type="button" aria-label="닫기" onClick={() => setIsAddOpen(false)}><Icon kind="close" /></button></header>
          <label className="investment-search-field"><Icon kind="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="종목명 또는 종목코드" autoFocus /></label>
          <div className="investment-search-results">{searchResults.map((stock) => {
            const watched = watchIds.includes(stock.id)
            return <article key={stock.id}><span><strong>{stock.name}</strong><small>{stock.code} · KRX</small></span><span className="investment-search-quote"><strong>{formatPrice(stock.price)}</strong><small className={tone(stock)}>{formatChangeRate(stock.changeRate)}</small></span><button type="button" disabled={watched} onClick={() => addStock(stock.id)}>{watched ? '추가됨' : '추가'}</button></article>
          })}{searchResults.length === 0 && <p className="investment-search-empty">일치하는 종목이 없습니다.</p>}</div>
        </section>
      </div>}
      {removed && <div className="investment-undo" role="status"><span>{STOCK_BY_ID[removed.id].name} 관심 종목을 삭제했어요</span><button type="button" onClick={undoRemove}>되돌리기</button></div>}
    </main>
  )
}
