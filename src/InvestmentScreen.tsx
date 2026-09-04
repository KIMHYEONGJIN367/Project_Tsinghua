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
}

type LeaderEntry = {
  rank: number
  name: string
  returnRate: number
}

type LeaderScope = 'all' | 'friends'

const STORAGE_KEY = 'tiantou-investment-watchlist-v1'
const STOCKS: WatchStock[] = [
  { id: 'samsung-electronics', name: '삼성전자', code: '005930', price: 72400, changeAmount: -300, changeRate: -0.41, high: 73100, low: 71800, volume: '1,240만' },
  { id: 'sk-hynix', name: 'SK하이닉스', code: '000660', price: 186700, changeAmount: 2900, changeRate: 1.58, high: 188200, low: 181500, volume: '398만' },
  { id: 'hyundai-motor', name: '현대차', code: '005380', price: 244500, changeAmount: 1000, changeRate: 0.41, high: 247000, low: 241000, volume: '82.6만' },
  { id: 'celltrion', name: '셀트리온', code: '068270', price: 194200, changeAmount: -2000, changeRate: -1.02, high: 197300, low: 193500, volume: '46.2만' },
  { id: 'naver', name: 'NAVER', code: '035420', price: 217000, changeAmount: 1500, changeRate: 0.7, high: 218500, low: 213000, volume: '61.8만' },
  { id: 'kakao', name: '카카오', code: '035720', price: 43850, changeAmount: -350, changeRate: -0.79, high: 44650, low: 43600, volume: '112만' },
  { id: 'samsung-biologics', name: '삼성바이오로직스', code: '207940', price: 1012000, changeAmount: 8000, changeRate: 0.8, high: 1019000, low: 997000, volume: '7.8만' },
]
const LEADER_GROUPS: Record<LeaderScope, { label: string; entries: LeaderEntry[] }> = {
  all: { label: '전체', entries: [
    { rank: 1, name: '이준호', returnRate: 48.72 },
    { rank: 2, name: '박서연', returnRate: 42.18 },
    { rank: 3, name: '최민재', returnRate: 37.64 },
  ] },
  friends: { label: '친구', entries: [
    { rank: 1, name: '정다은', returnRate: 31.45 },
    { rank: 2, name: '박지훈', returnRate: 24.83 },
    { rank: 3, name: '윤서진', returnRate: 19.67 },
  ] },
}
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

function RankingCrown() {
  return <svg className="investment-ranking-crown" viewBox="0 0 28 20" fill="none" aria-hidden="true"><path d="m3 15-1-10 7 5 5-8 5 8 7-5-1 10H3Z" /><path d="M4 18h20" /></svg>
}

function TopTierSummary() {
  const [scope, setScope] = useState<LeaderScope>('all')
  const group = LEADER_GROUPS[scope]
  const topThree = [...group.entries]
    .sort((left, right) => right.returnRate - left.returnRate || left.name.localeCompare(right.name, 'ko-KR'))
    .slice(0, 3)
    .map((entry, index) => ({ ...entry, rank: index + 1 }))
  const podium = [topThree[1], topThree[0], topThree[2]].filter((entry): entry is LeaderEntry => Boolean(entry))

  return (
    <section className="investment-top-tier" aria-labelledby="investment-top-tier-title">
      <header>
        <div><h2 id="investment-top-tier-title">랭킹</h2><small><i aria-hidden="true" />1분마다 갱신</small></div>
        <span>누적 수익률</span>
      </header>
      <div className="investment-ranking-tabs" role="tablist" aria-label="랭킹 범위">
        {(Object.keys(LEADER_GROUPS) as LeaderScope[]).map((key) => <button type="button" role="tab" className={scope === key ? 'is-selected' : ''} aria-selected={scope === key} onClick={() => setScope(key)} key={key}>{LEADER_GROUPS[key].label}</button>)}
      </div>
      <div className="investment-ranking-podium" aria-label={`${group.label} 누적 수익률 상위 3명`} aria-live="polite">
        {podium.map((entry) => <article className={`is-rank-${entry.rank}`} key={`${scope}-${entry.name}`}>
          <div className="investment-ranking-avatar">{entry.rank === 1 && <RankingCrown />}<span>{entry.name.slice(0, 1)}</span><i>{entry.rank}</i></div>
          <strong>{entry.name}</strong>
          <small>{entry.returnRate > 0 ? '+' : ''}{entry.returnRate.toFixed(2)}%</small>
        </article>)}
      </div>
    </section>
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
        aria-label={`${stock.name}, ${formatPrice(stock.price)}, ${formatChangeRate(stock.changeRate)}, 고가 ${stock.high.toLocaleString('ko-KR')}원, 저가 ${stock.low.toLocaleString('ko-KR')}원, 거래량 ${stock.volume}. 왼쪽으로 밀어 삭제`}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerEnd}
        onPointerCancel={pointerEnd}
        style={{ transform: `translate3d(${offset}px, 0, 0)` }}
      >
        <span className="investment-watch-identity"><strong>{stock.name}</strong><small>{stock.code}</small></span>
        <span className="investment-watch-numbers"><strong>{formatPrice(stock.price)}</strong><small className={tone(stock)}>{formatChangeRate(stock.changeRate)}</small></span>
        <span className="investment-watch-metrics" aria-hidden="true">
          <small><em>고</em>{stock.high.toLocaleString('ko-KR')}</small>
          <small><em>저</em>{stock.low.toLocaleString('ko-KR')}</small>
          <small><em>거래량</em>{stock.volume}</small>
        </span>
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
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === null) return DEFAULT_WATCHLIST
    const stored = JSON.parse(saved)
    if (!Array.isArray(stored)) return DEFAULT_WATCHLIST
    const valid = stored.filter((id): id is string => typeof id === 'string' && Boolean(STOCK_BY_ID[id]))
    return valid
  } catch { return DEFAULT_WATCHLIST }
}

export default function InvestmentScreen({ onNavigate }: { onNavigate: (screen: InvestmentRoute) => void }) {
  const [watchIds, setWatchIds] = useState<string[]>(initialWatchlist)
  const [selectedId, setSelectedId] = useState(STOCKS[0].id)
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [removed, setRemoved] = useState<{ id: string; index: number } | null>(null)
  const toastTimer = useRef<number | null>(null)
  const selected = STOCK_BY_ID[selectedId] ?? STOCK_BY_ID[watchIds[0]] ?? STOCKS[0]
  const normalized = query.trim().toLocaleLowerCase()
  const searchResults = useMemo(() => STOCKS.filter((stock) => !normalized || `${stock.name} ${stock.code}`.toLocaleLowerCase().includes(normalized)), [normalized])

  useEffect(() => { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(watchIds)) }, [watchIds])
  useEffect(() => () => { if (toastTimer.current) window.clearTimeout(toastTimer.current) }, [])

  const addStock = (id: string) => {
    if (watchIds.length === 0) setSelectedId(id)
    setWatchIds((current) => current.includes(id) ? current : [...current, id])
  }
  const toggleStockFromAddSheet = (id: string) => {
    const watched = watchIds.includes(id)
    if (!watched) {
      addStock(id)
      return
    }
    const next = watchIds.filter((watchId) => watchId !== id)
    setWatchIds(next)
    if (selectedId === id && next[0]) setSelectedId(next[0])
  }
  const removeStock = (id: string) => {
    const index = watchIds.indexOf(id)
    const next = watchIds.filter((watchId) => watchId !== id)
    setRemoved({ id, index })
    setWatchIds(next)
    setOpenSwipeId(null)
    const nextSelected = next[Math.min(index, next.length - 1)]
    if (selectedId === id && nextSelected) setSelectedId(nextSelected)
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
        <TopTierSummary />
        <section className="investment-focus" aria-live="polite">
          <div className="investment-focus-heading">
            <div className="investment-focus-identity"><strong>{selected.name}</strong><small>{selected.code} · KRX</small></div>
            <div className="investment-focus-actions"><span className="investment-live"><i aria-hidden="true" /> 실시간</span><button type="button" onClick={() => { setQuery(''); setIsSearchOpen(true); setIsAddOpen(false); setOpenSwipeId(null) }}><Icon kind="search" /> 종목 찾기</button></div>
          </div>
          <div className="investment-focus-price"><strong>{formatPrice(selected.price)}</strong><span className={tone(selected)}>{formatChangeAmount(selected.changeAmount)} · {formatChangeRate(selected.changeRate)}</span></div>
          <TradingViewChart stock={selected} />
        </section>
        <section className="investment-watchlist">
          <header><div><h2>관심 종목</h2><span>{watchIds.length}</span></div><button type="button" onClick={() => { setQuery(''); setIsAddOpen(true); setIsSearchOpen(false); setOpenSwipeId(null) }}><Icon kind="plus" /> 종목 추가</button></header>
          <div className="investment-watch-rows">{watchIds.length === 0 && <div className="investment-watch-empty"><strong>관심 종목이 없어요</strong><span>종목 추가에서 관심 종목을 선택해 보세요.</span></div>}{watchIds.map((id) => {
            const stock = STOCK_BY_ID[id]
            return <SwipeRow stock={stock} selected={id === selected.id} open={openSwipeId === id} onOpen={() => setOpenSwipeId(id)} onClose={() => setOpenSwipeId(null)} onSelect={() => { setSelectedId(id); setOpenSwipeId(null) }} onRemove={() => removeStock(id)} key={id} />
          })}</div>
        </section>
      </div>
      <div className="feed-bottom investment-footer"><BottomNav onNavigate={onNavigate} /><div className="home-indicator"><div /></div></div>

      {isSearchOpen && <div className="investment-add-layer">
        <button type="button" className="investment-add-backdrop" aria-label="종목 검색 닫기" onClick={() => setIsSearchOpen(false)} />
        <section className="investment-add-sheet investment-explore-sheet" role="dialog" aria-modal="true" aria-labelledby="investment-search-title">
          <div className="investment-add-grabber" aria-hidden="true" />
          <header><div><h2 id="investment-search-title">종목 검색</h2><span>관심 등록 없이 차트 보기</span></div><button type="button" aria-label="닫기" onClick={() => setIsSearchOpen(false)}><Icon kind="close" /></button></header>
          <label className="investment-search-field"><Icon kind="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="종목명 또는 종목코드" autoFocus /></label>
          <div className="investment-search-results investment-explore-results">{searchResults.map((stock) => {
            const watched = watchIds.includes(stock.id)
            return <button type="button" className={stock.id === selected.id ? 'is-current' : ''} aria-label={`${stock.name} 차트 보기`} onClick={() => { setSelectedId(stock.id); setIsSearchOpen(false); setQuery('') }} key={stock.id}><span><strong>{stock.name}</strong><small>{stock.code} · KRX</small></span><span className="investment-search-quote"><strong>{formatPrice(stock.price)}</strong><small className={tone(stock)}>{formatChangeRate(stock.changeRate)}</small></span><em>{watched ? '관심 종목' : '차트 보기'}</em></button>
          })}{searchResults.length === 0 && <p className="investment-search-empty">일치하는 종목이 없습니다.</p>}</div>
        </section>
      </div>}

      {isAddOpen && <div className="investment-add-layer">
        <button type="button" className="investment-add-backdrop" aria-label="종목 추가 닫기" onClick={() => setIsAddOpen(false)} />
        <section className="investment-add-sheet" role="dialog" aria-modal="true" aria-labelledby="investment-add-title">
          <div className="investment-add-grabber" aria-hidden="true" />
          <header><div><h2 id="investment-add-title">관심 종목 추가</h2><span>{watchIds.length}개 선택됨</span></div><button type="button" aria-label="닫기" onClick={() => setIsAddOpen(false)}><Icon kind="close" /></button></header>
          <label className="investment-search-field"><Icon kind="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="종목명 또는 종목코드" autoFocus /></label>
          <div className="investment-search-results">{searchResults.map((stock) => {
            const watched = watchIds.includes(stock.id)
            return <article key={stock.id}><span><strong>{stock.name}</strong><small>{stock.code} · KRX</small></span><span className="investment-search-quote"><strong>{formatPrice(stock.price)}</strong><small className={tone(stock)}>{formatChangeRate(stock.changeRate)}</small></span><button type="button" className={watched ? 'is-selected' : ''} aria-pressed={watched} aria-label={watched ? `${stock.name} 관심 종목에서 제거` : `${stock.name} 관심 종목에 추가`} onClick={() => toggleStockFromAddSheet(stock.id)}><span aria-hidden="true">{watched ? '×' : '+'}</span>{watched ? '제거' : '추가'}</button></article>
          })}{searchResults.length === 0 && <p className="investment-search-empty">일치하는 종목이 없습니다.</p>}</div>
          <footer className="investment-add-actions"><span>관심 종목 <strong>{watchIds.length}</strong>개</span><button type="button" onClick={() => setIsAddOpen(false)}>완료</button></footer>
        </section>
      </div>}
      {removed && <div className="investment-undo" role="status"><span>{STOCK_BY_ID[removed.id].name} 관심 종목을 삭제했어요</span><button type="button" onClick={undoRemove}>되돌리기</button></div>}
    </main>
  )
}
