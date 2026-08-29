import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { PortfolioSheet, RankingSheet } from './AccountSheets'
import TradeDrafts from './TradeDrafts'
import {
  CURRENT_RANK,
  TOTAL_ASSET,
  TOTAL_RETURN,
  formatReturn,
  formatWon,
  initialOpenOrders,
  type OpenOrder,
  type OpenOrderUpdate,
  type TradeEntryIntent,
} from './tradingData'
import investBattery from './assets/invest-ios-battery.svg'
import investHome from './assets/invest-home.svg'
import investMessage from './assets/invest-message.svg'
import investPie from './assets/invest-pie.svg'
import investPlus from './assets/invest-plus.svg'
import investProfile from './assets/invest-profile.png'
import investRoom from './assets/invest-room.png'
import investSearch from './assets/invest-search.svg'
import investSignal from './assets/invest-ios-signal.svg'
import investTrending from './assets/invest-trending.svg'
import investWifi from './assets/invest-ios-wifi.svg'
import friendsBattery from './assets/friends-ios-battery.svg'
import friendsHome from './assets/friends-home.svg'
import friendsMessage from './assets/friends-message.svg'
import friendsPie from './assets/friends-pie.svg'
import friendsPlus from './assets/friends-plus.svg'
import friendsProfile from './assets/friends-profile.png'
import friendsRoom from './assets/friends-room.png'
import friendsSearch from './assets/friends-search.svg'
import friendsSignal from './assets/friends-ios-signal.svg'
import friendsTrending from './assets/friends-trending.svg'
import friendsUser from './assets/friends-user.svg'
import friendsWifi from './assets/friends-ios-wifi.svg'
import splashTrending from './assets/trending-up.svg'

type FeedMode = 'invest' | 'friends'
type InvestCardVariant = 'default' | 'compact' | 'scoreboard'
type ScreenKey = 'home' | 'chat-list' | 'chat-room' | 'splash'
type NavKey = 'home' | 'chat' | 'invest' | 'portfolio' | 'my'
type ChatFilter = 'all' | 'group' | 'personal'
type ChatRoomKind = 'group' | 'personal'
type ChatSwipeSide = 'leading' | 'trailing'

type SocialViewKind = 'balance' | 'ranking'

type RoomTimelineItem =
  | { id: string; kind: 'message'; text: string; sentAt: string }
  | { id: string; kind: 'view-event'; viewKind: SocialViewKind; count: number; sentAt: string }
  | { id: string; kind: 'portfolio-share'; sentAt: string }

type SocialViewTracker = { count: number; lastCountedAt: number; dateKey: string }

const SOCIAL_VIEW_COOLDOWN_MS = 30_000

function isSocialViewMilestone(count: number) {
  return count === 3 || (count >= 5 && count % 5 === 0)
}

function getLocalDateKey() {
  const now = new Date()
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
}

type FeedIcons = {
  signal: string
  wifi: string
  battery: string
  search: string
  plus: string
  home: string
  message: string
  trending: string
  pie: string
  user: string
}

const investIcons: FeedIcons = {
  signal: investSignal,
  wifi: investWifi,
  battery: investBattery,
  search: investSearch,
  plus: investPlus,
  home: investHome,
  message: investMessage,
  trending: investTrending,
  pie: investPie,
  user: friendsUser,
}

const friendsIcons: FeedIcons = {
  signal: friendsSignal,
  wifi: friendsWifi,
  battery: friendsBattery,
  search: friendsSearch,
  plus: friendsPlus,
  home: friendsHome,
  message: friendsMessage,
  trending: friendsTrending,
  pie: friendsPie,
  user: friendsUser,
}

const navItems: Array<{ key: NavKey; label: string; icon: keyof Pick<FeedIcons, 'home' | 'message' | 'trending' | 'pie' | 'user'> }> = [
  { key: 'home', label: '홈', icon: 'home' },
  { key: 'chat', label: '대회', icon: 'message' },
  { key: 'invest', label: '투자', icon: 'trending' },
  { key: 'portfolio', label: '포트폴리오', icon: 'pie' },
  { key: 'my', label: '마이', icon: 'user' },
]

const investRooms = [
  {
    title: '쌍띠 투자대회',
    rank: '#2 / 4',
    returnValue: '+28.4%',
    returnTone: 'positive',
    scheduleLabel: '종료 D-7 · 2026.08.31',
    rankStatus: '진행 중',
    image: investRoom,
    leaderboard: ['1위 김영규 + 122.1%', '2위 장우진 +28.4%', '3위 김형진 +12.4%'],
    holdings: [
      { name: '삼성전자', weight: '42%' },
      { name: 'SK하이닉스', weight: '33%' },
      { name: '현대차', weight: '25%' },
    ],
  },
  {
    title: '카카오 투자대회',
    rank: '#15 / 32',
    returnValue: '-15.8%',
    returnTone: 'negative',
    scheduleLabel: '종료 · 2026.07.31',
    rankStatus: '종료',
    image: friendsRoom,
    leaderboard: ['1위 김영규 + 46.7%', '2위 김형진 +12.2%', '3위 조진만 +4.6%'],
    holdings: [
      { name: '카카오', weight: '38%' },
      { name: 'NAVER', weight: '34%' },
      { name: '삼성전자', weight: '28%' },
    ],
  },
  {
    title: '테슬라 투자대회',
    rank: '#6 / 18',
    returnValue: '+9.6%',
    returnTone: 'positive',
    scheduleLabel: '종료 D-7 · 2026.08.31',
    rankStatus: '진행 중',
    image: investProfile,
    leaderboard: ['1위 장우진 + 31.8%', '2위 김영규 +22.4%', '3위 김형진 +9.6%'],
    holdings: [
      { name: '테슬라', weight: '45%' },
      { name: '현대차', weight: '30%' },
      { name: '삼성SDI', weight: '25%' },
    ],
  },
]

const friends = [
  { name: '김영규', grade: '등급 불개미', returnValue: '+314.2%' },
  { name: '장우진', grade: '등급 애널리스트', returnValue: '+28.4%' },
  { name: '김형진', grade: '등급 개미', returnValue: '—' },
  { name: '조진만', grade: '등급 기관', returnValue: '—' },
]

type ChatRoom = {
  id: string
  title: string
  detail: string
  meta: string
  count: string
  unread: number
  muted: boolean
  pinned: boolean
  kind: ChatRoomKind
  image: string
}

const chatRooms: ChatRoom[] = [
  { id: 'ssangddi', title: '쌍띠 투자대회', detail: '진짜 오늘 단타 매수 타이밍이죠?', meta: '오후 9:41', count: '4', unread: 3, muted: false, pinned: false, kind: 'group', image: investRoom },
  { id: 'kakao', title: '카카오 투자대회', detail: '진짜 발표 전까지 떡상하려나요?', meta: '오후 8:12', count: '15', unread: 15, muted: true, pinned: false, kind: 'group', image: friendsRoom },
  { id: 'jang-woo-jin', title: '장우진', detail: '모의투자도 끝까지 잘 챙겼네요 공유좀', meta: '오후 5:30', count: '1', unread: 1, muted: false, pinned: false, kind: 'personal', image: investProfile },
  { id: 'kim-young-gyu', title: '김영규', detail: '삼성전자 오늘 매수 타이밍 맞나요?', meta: '어제', count: '', unread: 0, muted: true, pinned: false, kind: 'personal', image: friendsProfile },
]

function getLeaderboardRows(room: (typeof investRooms)[number]) {
  return room.leaderboard.slice(0, 3).map((entry) => {
    const parts = entry.split(' ')
    return {
      rank: parts[0],
      name: parts[1],
      returnValue: parts.slice(2).join(' ').replace('+ ', '+'),
    }
  })
}

function getInvestCardVariant(): InvestCardVariant {
  if (typeof window === 'undefined') return 'scoreboard'
  const preview = new URLSearchParams(window.location.search).get('preview')
  if (preview === 'card-a') return 'compact'
  return 'scoreboard'
}

function getParticipantCount(room: (typeof investRooms)[number]) {
  return room.rank.split('/')[1]?.trim() ?? '-'
}

function getCurrentRank(room: (typeof investRooms)[number]) {
  return room.rank.split('/')[0]?.replace('#', '').trim() ?? '-'
}

function Icon({ src, size = 24, nodeId }: { src: string; size?: number; nodeId?: string }) {
  return <img className="feed-icon" src={src} alt="" width={size} height={size} data-node-id={nodeId} />
}

function StatusBar({ icons, nodePrefix }: { icons: FeedIcons; nodePrefix: '2' | '7' }) {
  return (
    <div className="status-bar" data-node-id={`${nodePrefix}:36`} data-name="status-bar">
      <span className="status-time">9:41</span>
      <div className="status-icons" data-name="icons">
        <Icon src={icons.signal} size={18} nodeId={`${nodePrefix}:706`} />
        <Icon src={icons.wifi} size={18} nodeId={`${nodePrefix}:712`} />
        <Icon src={icons.battery} size={24} nodeId={`${nodePrefix}:715`} />
      </div>
    </div>
  )
}

function FeedHeader({ icons, nodePrefix }: { icons: FeedIcons; nodePrefix: '2' | '7' }) {
  return (
    <header className="feed-header" data-node-id={`${nodePrefix}:42`} data-name="feed-header">
      <h1>천투</h1>
      <div className="header-actions">
        <button type="button" aria-label="새 콘텐츠 추가">
          <Icon src={icons.plus} nodeId={`${nodePrefix}:721`} />
        </button>
      </div>
    </header>
  )
}

function TickerBelt({ nodePrefix }: { nodePrefix: '2' | '7' }) {
  const tickerItems = [
    { name: 'KOSPI', value: '+2.1%', tone: 'positive' },
    { name: 'KOSDAQ', value: '-4.3%', tone: 'negative' },
    { name: 'S&P500', value: '+8.9%', tone: 'positive' },
    { name: 'NASDAQ', value: '-0.5%', tone: 'negative' },
  ]

  return (
    <div className="ticker-belt" data-node-id={`${nodePrefix}:47`} data-name="ticker-belt">
      {tickerItems.map((item) => (
        <div className="ticker-item" key={item.name}>
          <span>{item.name}</span>
          <span className={item.tone}>{item.value}</span>
        </div>
      ))}
    </div>
  )
}

function HeroBanner({ profile, nodePrefix }: { profile: string; nodePrefix: '2' | '7' }) {
  return (
    <section className="hero-banner" data-node-id={`${nodePrefix}:60`} data-name="hero-banner">
      <img className="hero-avatar" src={profile} alt="장우진 프로필" width="48" height="48" />
      <div className="hero-copy">
        <span>장우진</span>
        <strong>등급 애널리스트</strong>
      </div>
      <div className="hero-stats">
        <span>누적 수익률 + 314.2%</span>
        <span>월간 수익률 + 21.4%</span>
        <span>일간 수익률 - 3.2%</span>
      </div>
    </section>
  )
}

function InlineSearch({ icon, value, placeholder, ariaLabel, onChange }: { icon: string; value: string; placeholder: string; ariaLabel: string; onChange: (value: string) => void }) {
  return (
    <div className={`inline-search ${value ? 'has-value' : ''}`}>
      <Icon src={icon} size={16} />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <button type="button" className="inline-search-clear" aria-label={`${ariaLabel} 초기화`} onClick={() => onChange('')}>
          ×
        </button>
      )}
    </div>
  )
}

function FeedTabs({ mode, onChange, searchValue, onSearchChange, searchIcon }: { mode: FeedMode; onChange: (mode: FeedMode) => void; searchValue: string; onSearchChange: (value: string) => void; searchIcon: string }) {
  return (
    <div className="feed-tabs" data-name="tab-switcher">
      <div className="feed-tab-options">
        <button
          type="button"
          className={`feed-tab ${mode === 'invest' ? 'is-active' : ''}`}
          aria-pressed={mode === 'invest'}
          onClick={() => onChange('invest')}
        >
          투자 대회
        </button>
        <button
          type="button"
          className={`feed-tab ${mode === 'friends' ? 'is-active' : ''}`}
          aria-pressed={mode === 'friends'}
          onClick={() => onChange('friends')}
        >
          친구
        </button>
      </div>
      <InlineSearch
        icon={searchIcon}
        value={searchValue}
        placeholder="검색"
        ariaLabel={mode === 'invest' ? '투자 대회 검색' : '친구 검색'}
        onChange={onSearchChange}
      />
    </div>
  )
}

function InvestRoomCardCompact({ room }: { room: (typeof investRooms)[number] }) {
  const rows = getLeaderboardRows(room)

  return (
    <article className="room-card invest-room-card invest-card-variant-a">
      <img className="room-avatar" src={room.image} alt="투자 대회 프로필" width="48" height="48" />
      <div className="invest-card-body-a">
        <div className="invest-card-header-a">
          <strong>{room.title}</strong>
          <span className={`return-badge ${room.returnTone}`}>{room.returnValue}</span>
        </div>
        <div className="invest-card-meta-a">
          <span>D-7 (2026-08-31)</span>
          <strong>{room.rank}</strong>
        </div>
        <div className="invest-leaderboard-a">
          {rows.map((row) => (
            <div className="invest-leaderboard-row-a" key={`${room.title}-${row.rank}`}>
              <span className="invest-rank-a">{row.rank}</span>
              <span className="invest-name-a">{row.name}</span>
              <span className="invest-performance-a">{row.returnValue}</span>
            </div>
          ))}
        </div>
      </div>
    </article>
  )
}

function InvestRoomCardScoreboard({ room }: { room: (typeof investRooms)[number] }) {
  const rows = getLeaderboardRows(room)

  return (
    <article className="room-card invest-room-card invest-card-variant-b">
      <div className="invest-card-header-b">
        <img className="room-avatar" src={room.image} alt="투자 대회 프로필" width="48" height="48" />
        <div className="invest-card-heading-b">
          <div className="invest-card-title-line-b">
            <strong>{room.title}</strong>
            <span>{getParticipantCount(room)}명</span>
          </div>
          <span>{room.scheduleLabel}</span>
        </div>
        <div className="invest-card-score-b">
          <span className={`return-badge ${room.returnTone}`}>{room.returnValue}</span>
          <strong>{getCurrentRank(room)}위 · {room.rankStatus}</strong>
        </div>
      </div>
      <div className="invest-card-divider-b" />
      <div className="invest-card-panels-b">
        <section className="invest-card-panel-b">
          <div className="invest-card-label-b">실시간 순위</div>
          <div className="invest-leaderboard-b">
            {rows.map((row) => (
              <div className="invest-leaderboard-row-b" key={`${room.title}-${row.rank}`}>
                <span className="invest-rank-b">{row.rank}</span>
                <span className="invest-name-b">{row.name}</span>
                <span className="invest-performance-b">{row.returnValue}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="invest-card-panel-b">
          <div className="invest-card-label-b">보유 종목</div>
          <div className="invest-holdings-b">
            {room.holdings.map((holding) => (
              <div className="invest-holding-row-b" key={holding.name}>
                <span>{holding.name}</span>
                <strong>{holding.weight}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </article>
  )
}

function InvestRoomCard({ room, index, variant }: { room: (typeof investRooms)[number]; index: number; variant: InvestCardVariant }) {
  if (variant === 'compact') return <InvestRoomCardCompact room={room} />
  if (variant === 'scoreboard') return <InvestRoomCardScoreboard room={room} />

  return (
    <article className="room-card invest-room-card" data-node-id={index === 0 ? '2:70' : undefined}>
      <img className="room-avatar" src={room.image} alt="투자 대회 프로필" width="48" height="48" />
      <div className="room-card-body">
        <div className="room-topline">
          <strong>{room.title}</strong>
          <strong>{room.rank}</strong>
          <span className={`return-badge ${room.returnTone}`}>{room.returnValue}</span>
        </div>
        <span className="room-deadline">D-7 (2026-08-31)</span>
        <div className="leaderboard">
          {room.leaderboard.map((entry) => <span key={entry}>{entry}</span>)}
        </div>
      </div>
    </article>
  )
}

function FriendCard({ friend, index }: { friend: (typeof friends)[number]; index: number }) {
  return (
    <article className="room-card friend-room-card" data-node-id={index === 0 ? '7:233' : undefined}>
      <img className="room-avatar" src={friendsRoom} alt={`${friend.name} 프로필`} width="48" height="48" />
      <div className="friend-card-body">
        <div className="friend-identity">
          <strong>{friend.name}</strong>
          <span>{friend.grade}</span>
          <div className="performance-row">
            <span>누적 수익률</span>
            <strong className={friend.returnValue === '—' ? '' : 'positive'}>{friend.returnValue}</strong>
          </div>
        </div>
        <div className="friend-stats">
          <strong className="holdings-label">베스트 픽</strong>
          {['삼성전자', 'SK하이닉스', '현대차'].map((holding, holdingIndex) => (
            <div className="holding-row" key={holding}>
              <span className="rank-badge">{holdingIndex + 1}위</span>
              <span>{holding}</span>
            </div>
          ))}
        </div>
      </div>
    </article>
  )
}

function BottomNav({ icons, activeMode, activeKey = 'home', onNavigate }: { icons: FeedIcons; activeMode: FeedMode; activeKey?: NavKey; onNavigate?: (screen: ScreenKey) => void }) {
  return (
    <nav className="bottom-nav" data-name="bottom-nav" aria-label="주요 메뉴">
      {navItems.map((item) => (
        <button
          type="button"
          className={`nav-item ${item.key === activeKey ? 'is-active' : ''}`}
          key={item.key}
          aria-current={item.key === activeKey ? 'page' : undefined}
          aria-label={item.label}
          data-active-feed={activeMode}
          onClick={() => {
            if (item.key === 'home') onNavigate?.('home')
            if (item.key === 'chat') onNavigate?.('chat-list')
          }}
        >
          <Icon src={icons[item.icon]} size={22} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}

const CHAT_ACTION_WIDTH = 126

function ChatRoomRow({ room, openSwipe, onOpenActions, onCloseActions, onNavigate, onTogglePinned, onToggleMuted, onRequestLeave }: {
  room: ChatRoom
  openSwipe: ChatSwipeSide | null
  onOpenActions: (side: ChatSwipeSide) => void
  onCloseActions: () => void
  onNavigate: () => void
  onTogglePinned: () => void
  onToggleMuted: () => void
  onRequestLeave: () => void
}) {
  const [dragOffsetX, setDragOffsetX] = useState(openSwipe === 'leading' ? CHAT_ACTION_WIDTH : openSwipe === 'trailing' ? -CHAT_ACTION_WIDTH : 0)
  const pointerStartRef = useRef<{ x: number; y: number; startOffset: number } | null>(null)
  const didSwipeRef = useRef(false)

  useEffect(() => {
    setDragOffsetX(openSwipe === 'leading' ? CHAT_ACTION_WIDTH : openSwipe === 'trailing' ? -CHAT_ACTION_WIDTH : 0)
  }, [openSwipe])

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    pointerStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      startOffset: openSwipe === 'leading' ? CHAT_ACTION_WIDTH : openSwipe === 'trailing' ? -CHAT_ACTION_WIDTH : 0,
    }
    didSwipeRef.current = false
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const pointerStart = pointerStartRef.current
    if (!pointerStart) return

    const deltaX = event.clientX - pointerStart.x
    const deltaY = event.clientY - pointerStart.y
    if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) return

    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      pointerStartRef.current = null
      return
    }

    event.preventDefault()
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Synthetic pointer events used by previews do not have an active pointer to capture.
    }
    didSwipeRef.current = true
    setDragOffsetX(Math.max(-CHAT_ACTION_WIDTH, Math.min(CHAT_ACTION_WIDTH, pointerStart.startOffset + deltaX)))
  }

  const finishPointer = () => {
    const pointerStart = pointerStartRef.current
    if (!pointerStart) return

    pointerStartRef.current = null
    if (!didSwipeRef.current) return

    const threshold = CHAT_ACTION_WIDTH * 0.45
    const nextSide = dragOffsetX >= threshold ? 'leading' : dragOffsetX <= -threshold ? 'trailing' : null
    setDragOffsetX(nextSide === 'leading' ? CHAT_ACTION_WIDTH : nextSide === 'trailing' ? -CHAT_ACTION_WIDTH : 0)
    if (nextSide) onOpenActions(nextSide)
    else onCloseActions()
  }

  const cancelPointer = () => {
    pointerStartRef.current = null
    didSwipeRef.current = false
    setDragOffsetX(openSwipe === 'leading' ? CHAT_ACTION_WIDTH : openSwipe === 'trailing' ? -CHAT_ACTION_WIDTH : 0)
  }

  return (
    <div className="chat-room-swipe-item">
      <div className="chat-room-swipe-actions chat-room-swipe-actions-leading" aria-hidden={openSwipe !== 'leading'}>
        <button
          type="button"
          className="chat-room-swipe-action chat-room-swipe-action-pin"
          tabIndex={openSwipe === 'leading' ? 0 : -1}
          aria-label={room.pinned ? `${room.title} 고정 해제` : `${room.title} 고정`}
          onClick={() => {
            onTogglePinned()
            onCloseActions()
          }}
        >
          <span aria-hidden="true">📌</span>
          <small>{room.pinned ? '해제' : '고정'}</small>
        </button>
        <button
          type="button"
          className="chat-room-swipe-action chat-room-swipe-action-alert"
          tabIndex={openSwipe === 'leading' ? 0 : -1}
          aria-label={room.muted ? `${room.title} 알람 설정` : `${room.title} 알람 해제`}
          onClick={() => {
            onToggleMuted()
            onCloseActions()
          }}
        >
          <span aria-hidden="true">◔</span>
          <small>{room.muted ? '알람 켜기' : '알람 끄기'}</small>
        </button>
      </div>
      <div className="chat-room-swipe-actions chat-room-swipe-actions-trailing" aria-hidden={openSwipe !== 'trailing'}>
        <button
          type="button"
          className="chat-room-swipe-action chat-room-swipe-action-leave"
          tabIndex={openSwipe === 'trailing' ? 0 : -1}
          aria-label={`${room.title} ${room.kind === 'group' ? '포기하기' : '나가기'}`}
          onClick={() => {
            onRequestLeave()
            onCloseActions()
          }}
        >
          <span aria-hidden="true">↗</span>
          <small>{room.kind === 'group' ? '포기하기' : '나가기'}</small>
        </button>
      </div>
      <button
        className={`chat-room-row ${room.pinned ? 'is-pinned' : ''}`}
        type="button"
        aria-expanded={openSwipe !== null}
        style={{ transform: `translateX(${dragOffsetX}px)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={cancelPointer}
        onClick={() => {
          if (didSwipeRef.current) {
            didSwipeRef.current = false
            return
          }
          if (openSwipe !== null) {
            onCloseActions()
            return
          }
          onNavigate()
        }}
      >
        <img src={room.image} alt="" width="48" height="48" />
        <span className="chat-room-copy">
          <span className="chat-room-title-line">
            <strong>{room.title}</strong>
            {room.pinned && <span className="chat-pinned-indicator" aria-label="고정됨">📌</span>}
            {room.muted && <span className="chat-muted-icon" aria-label="알람 해제됨" />}
            {room.count && (
              <span className="chat-participant-count">
                <Icon src={friendsUser} size={10} />
                {room.count}
              </span>
            )}
          </span>
          <span>{room.detail}</span>
        </span>
        <span className="chat-row-side-meta">
          <span className="chat-room-time">{room.meta}</span>
          {room.unread > 0 && <span className="chat-unread-badge">{room.unread > 99 ? '99+' : room.unread}</span>}
        </span>
      </button>
    </div>
  )
}

function ChatListScreen({ onNavigate }: { onNavigate: (screen: ScreenKey) => void }) {
  const [chatFilter, setChatFilter] = useState<ChatFilter>('all')
  const [chatQuery, setChatQuery] = useState('')
  const [chatRoomsState, setChatRoomsState] = useState(chatRooms)
  const [swipedRoom, setSwipedRoom] = useState<{ id: string; side: ChatSwipeSide } | null>(null)
  const [pendingLeaveRoom, setPendingLeaveRoom] = useState<ChatRoom | null>(null)
  const normalizedChatQuery = chatQuery.trim().toLocaleLowerCase()

  useEffect(() => {
    setSwipedRoom(null)
  }, [chatFilter, chatQuery])

  const visibleChatRooms = chatRoomsState
    .filter((room) => chatFilter === 'all' || room.kind === chatFilter)
    .filter((room) => !normalizedChatQuery || `${room.title} ${room.detail}`.toLocaleLowerCase().includes(normalizedChatQuery))
    .sort((firstRoom, secondRoom) => Number(secondRoom.pinned) - Number(firstRoom.pinned))

  const updateChatRoom = (roomId: string, update: Partial<Pick<ChatRoom, 'pinned' | 'muted'>>) => {
    setChatRoomsState((rooms) => rooms.map((room) => room.id === roomId ? { ...room, ...update } : room))
  }

  const confirmLeaveRoom = () => {
    if (!pendingLeaveRoom) return
    setChatRoomsState((rooms) => rooms.filter((room) => room.id !== pendingLeaveRoom.id))
    setPendingLeaveRoom(null)
    setSwipedRoom(null)
  }

  const pendingLeaveAction = pendingLeaveRoom?.kind === 'group' ? '포기하기' : '나가기'

  return (
    <main className="app-shell chat-shell chat-list-screen" data-name="chat-list" data-node-id="2:126">
      <div className="chat-top-container">
        <StatusBar icons={friendsIcons} nodePrefix="2" />
        <header className="chat-header">
          <h1>대회</h1>
          <div className="chat-header-actions">
            <button type="button" aria-label="새 대화"><Icon src={friendsPlus} size={22} /></button>
          </div>
        </header>
        <div className="chat-filter-tabs" role="tablist" aria-label="대화 필터">
          <div className="chat-filter-options">
            {([
              ['all', '전체'],
              ['group', '그룹별'],
              ['personal', '개인별'],
            ] as const).map(([filter, label]) => (
              <button
                type="button"
                className={chatFilter === filter ? 'is-active' : ''}
                role="tab"
                aria-selected={chatFilter === filter}
                key={filter}
                onClick={() => setChatFilter(filter)}
              >
                {label}
              </button>
            ))}
          </div>
          <InlineSearch icon={friendsSearch} value={chatQuery} placeholder="검색" ariaLabel="대회 검색" onChange={setChatQuery} />
        </div>
        <section className="chat-room-list" aria-label="대화 목록">
          {visibleChatRooms.map((room) => (
            <ChatRoomRow
              key={room.id}
              room={room}
              openSwipe={swipedRoom?.id === room.id ? swipedRoom.side : null}
              onOpenActions={(side) => setSwipedRoom({ id: room.id, side })}
              onCloseActions={() => setSwipedRoom(null)}
              onNavigate={() => onNavigate('chat-room')}
              onTogglePinned={() => updateChatRoom(room.id, { pinned: !room.pinned })}
              onToggleMuted={() => updateChatRoom(room.id, { muted: !room.muted })}
              onRequestLeave={() => setPendingLeaveRoom(room)}
            />
          ))}
          {visibleChatRooms.length === 0 && <p className="chat-empty-state">{chatRoomsState.length === 0 ? '참여 중인 채팅방이 없습니다.' : '검색 결과가 없습니다.'}</p>}
        </section>
      </div>
      <div className="feed-bottom">
        <BottomNav icons={friendsIcons} activeMode="friends" activeKey="chat" onNavigate={onNavigate} />
        <HomeIndicator />
      </div>
      {pendingLeaveRoom && (
        <div className="chat-confirm-layer">
          <button type="button" className="chat-confirm-backdrop" aria-label="확인 창 닫기" onClick={() => setPendingLeaveRoom(null)} />
          <section className="chat-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="chat-confirm-title" aria-describedby="chat-confirm-description">
            <span className="chat-confirm-badge">{pendingLeaveRoom.kind === 'group' ? '대회' : '채팅'}</span>
            <h2 id="chat-confirm-title">{pendingLeaveAction} 하시겠어요?</h2>
            <p id="chat-confirm-description"><strong>{pendingLeaveRoom.title}</strong>{pendingLeaveRoom.kind === 'group' ? '에서 포기하면 대화 목록에서 사라집니다.' : '에서 나가면 대화 목록에서 사라집니다.'}</p>
            <div className="chat-confirm-actions">
              <button type="button" className="chat-confirm-cancel" onClick={() => setPendingLeaveRoom(null)}>취소</button>
              <button type="button" className="chat-confirm-destructive" onClick={confirmLeaveRoom}>{pendingLeaveAction}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

function ChatRoomScreen({
  onNavigate,
  roomTimeline,
  viewCounts,
  onSendMessage,
  onRecordSocialView,
  onSharePortfolio,
  openOrders,
  onUpdateOpenOrder,
  onCancelOpenOrder,
}: {
  onNavigate: (screen: ScreenKey) => void
  roomTimeline: RoomTimelineItem[]
  viewCounts: Record<SocialViewKind, number>
  onSendMessage: (message: string) => void
  onRecordSocialView: (viewKind: SocialViewKind) => void
  onSharePortfolio: () => void
  openOrders: OpenOrder[]
  onUpdateOpenOrder: (orderId: string, update: OpenOrderUpdate) => void
  onCancelOpenOrder: (orderId: string) => void
}) {
  const [messageDraft, setMessageDraft] = useState('')
  const [isTradeSheetOpen, setIsTradeSheetOpen] = useState(false)
  const [tradeEntryIntent, setTradeEntryIntent] = useState<TradeEntryIntent | null>(null)
  const [isPortfolioSheetOpen, setIsPortfolioSheetOpen] = useState(false)
  const [isRankingSheetOpen, setIsRankingSheetOpen] = useState(false)
  const [isTradeSheetDragging, setIsTradeSheetDragging] = useState(false)
  const [isTradeSheetDismissing, setIsTradeSheetDismissing] = useState(false)
  const [tradeSheetDragY, setTradeSheetDragY] = useState(0)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const tradeSheetRef = useRef<HTMLElement>(null)
  const tradeSheetDragStartYRef = useRef<number | null>(null)
  const tradeSheetDragYRef = useRef(0)
  const tradeSheetDismissTimerRef = useRef<number | null>(null)
  const chatSwipeStartYRef = useRef<number | null>(null)
  const canSendMessage = messageDraft.trim().length > 0

  useEffect(() => {
    if (roomTimeline.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [roomTimeline])

  useEffect(() => {
    if (!isTradeSheetOpen) return

    const focusFrame = window.requestAnimationFrame(() => tradeSheetRef.current?.focus())
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsTradeSheetOpen(false)
        setIsTradeSheetDragging(false)
        setTradeSheetDragY(0)
        tradeSheetDragYRef.current = 0
      }
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [isTradeSheetOpen])

  useEffect(() => () => {
    if (tradeSheetDismissTimerRef.current !== null) {
      window.clearTimeout(tradeSheetDismissTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const moveTradeSheet = (event: PointerEvent) => {
      if (tradeSheetDragStartYRef.current === null) return

      const nextDragY = Math.max(0, event.clientY - tradeSheetDragStartYRef.current)
      tradeSheetDragYRef.current = nextDragY
      setTradeSheetDragY(nextDragY)
    }

    const finishTradeSheetDrag = () => {
      if (tradeSheetDragStartYRef.current === null) return

      tradeSheetDragStartYRef.current = null
      setIsTradeSheetDragging(false)

      const sheetHeight = tradeSheetRef.current?.getBoundingClientRect().height ?? 0
      const dismissThreshold = Math.min(96, sheetHeight * 0.18)

      if (tradeSheetDragYRef.current >= dismissThreshold) {
        setIsTradeSheetDismissing(true)
        setTradeSheetDragY(sheetHeight)
        tradeSheetDragYRef.current = sheetHeight
        tradeSheetDismissTimerRef.current = window.setTimeout(() => {
          setIsTradeSheetOpen(false)
          setIsTradeSheetDismissing(false)
          setTradeSheetDragY(0)
          tradeSheetDragYRef.current = 0
          tradeSheetDismissTimerRef.current = null
        }, 200)
        return
      }

      setTradeSheetDragY(0)
      tradeSheetDragYRef.current = 0
    }

    const cancelTradeSheetDrag = () => {
      if (tradeSheetDragStartYRef.current === null) return
      tradeSheetDragStartYRef.current = null
      tradeSheetDragYRef.current = 0
      setIsTradeSheetDragging(false)
      setTradeSheetDragY(0)
    }

    window.addEventListener('pointermove', moveTradeSheet)
    window.addEventListener('pointerup', finishTradeSheetDrag)
    window.addEventListener('pointercancel', cancelTradeSheetDrag)
    return () => {
      window.removeEventListener('pointermove', moveTradeSheet)
      window.removeEventListener('pointerup', finishTradeSheetDrag)
      window.removeEventListener('pointercancel', cancelTradeSheetDrag)
    }
  }, [])

  const sendMessage = () => {
    const message = messageDraft.trim()
    if (!message) return

    onSendMessage(message)
    setMessageDraft('')
    messageInputRef.current?.focus()
  }

  const openTradeSheet = (intent: TradeEntryIntent | null = null) => {
    setTradeEntryIntent(intent)
    setIsTradeSheetDragging(false)
    setIsTradeSheetDismissing(false)
    setTradeSheetDragY(0)
    tradeSheetDragYRef.current = 0
    setIsTradeSheetOpen(true)
  }

  const openPositionTradeFromPortfolio = (instrumentCode: string, direction: 'sell' | 'cover') => {
    setIsPortfolioSheetOpen(false)
    openTradeSheet({ requestId: crypto.randomUUID(), kind: 'position', direction, instrumentCode })
  }

  const openOrderManagerFromPortfolio = (orderId: string) => {
    setIsPortfolioSheetOpen(false)
    openTradeSheet({ requestId: crypto.randomUUID(), kind: 'open-order', orderId })
  }

  const closeTradeSheet = () => {
    if (tradeSheetDismissTimerRef.current !== null) {
      window.clearTimeout(tradeSheetDismissTimerRef.current)
      tradeSheetDismissTimerRef.current = null
    }
    setIsTradeSheetOpen(false)
    setIsTradeSheetDragging(false)
    setIsTradeSheetDismissing(false)
    setTradeSheetDragY(0)
    tradeSheetDragYRef.current = 0
  }

  const dismissTradeSheet = () => {
    if (tradeSheetDismissTimerRef.current !== null) return

    const sheetHeight = tradeSheetRef.current?.getBoundingClientRect().height ?? 600
    setIsTradeSheetDragging(false)
    setIsTradeSheetDismissing(true)
    setTradeSheetDragY(sheetHeight)
    tradeSheetDragYRef.current = sheetHeight
    tradeSheetDismissTimerRef.current = window.setTimeout(() => {
      tradeSheetDismissTimerRef.current = null
      setIsTradeSheetOpen(false)
      setIsTradeSheetDismissing(false)
      setTradeSheetDragY(0)
      tradeSheetDragYRef.current = 0
    }, 200)
  }

  const openPortfolioSheet = () => {
    setIsRankingSheetOpen(false)
    onRecordSocialView('balance')
    setIsPortfolioSheetOpen(true)
  }

  const openRankingSheet = () => {
    closeTradeSheet()
    setIsPortfolioSheetOpen(false)
    onRecordSocialView('ranking')
    setIsRankingSheetOpen(true)
  }

  const sharePortfolio = () => {
    onSharePortfolio()
    setIsPortfolioSheetOpen(false)
  }

  const startTradeSheetDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    tradeSheetDragStartYRef.current = event.clientY
    setIsTradeSheetDragging(true)
  }

  return (
    <main className="app-shell chat-shell chat-room-shell" data-name="chat-room" data-node-id="2:242">
      <div className="chat-top-container chat-room-screen">
        <StatusBar icons={friendsIcons} nodePrefix="2" />
        <header className="chat-room-header">
          <button type="button" className="chat-back-button" aria-label="대화 목록으로 이동" onClick={() => onNavigate('chat-list')}>‹</button>
          <div>
            <strong>
              쌍디 투자대회방
              <span className="chat-header-participants">4명</span>
            </strong>
            <span>현재 2명 활동 중</span>
          </div>
          <div className="chat-room-actions">
            <button type="button" aria-label="통화">◡</button>
            <button type="button" aria-label="더 보기">⋮</button>
          </div>
        </header>
        <section className="chat-account-hud" aria-label="내 대회 현황">
          <div className="chat-account-hud-card">
            <div className="chat-account-hud-main">
              <span>내 총자산</span>
              <strong>{formatWon(TOTAL_ASSET)}</strong>
              <em>{formatReturn(TOTAL_RETURN)}</em>
            </div>
            <div className="chat-account-hud-rank" aria-label={`현재 ${CURRENT_RANK}위, 4명 중`}>
              <span>현재 순위</span>
              <strong><b>{CURRENT_RANK}</b>위</strong>
              <small>4명 중</small>
            </div>
            <div className="chat-account-hud-footer">
              <span className="chat-account-deadline"><b>D-5</b><span>8월 31일 종료</span></span>
              <div>
                <button type="button" onClick={openRankingSheet}>순위</button>
                <button type="button" onClick={openPortfolioSheet}>잔고</button>
              </div>
            </div>
          </div>
        </section>
        <div className="chat-date-divider">오늘, 2026년 2월 24일</div>
        <section
          id="chat-message-list"
          className="chat-messages"
          aria-label="대화 내용"
          aria-live="polite"
          onPointerDown={(event) => {
            chatSwipeStartYRef.current = event.clientY
          }}
          onPointerUp={(event) => {
            const startY = chatSwipeStartYRef.current
            chatSwipeStartYRef.current = null
            if (
              startY !== null
              && event.clientY - startY >= 48
              && document.activeElement === messageInputRef.current
            ) {
              messageInputRef.current?.blur()
            }
          }}
          onPointerCancel={() => {
            chatSwipeStartYRef.current = null
          }}
        >
          <article className="chat-message incoming">
            <img src={friendsProfile} alt="장우진" width="32" height="32" />
            <div>
              <span className="chat-message-name">장우진</span>
              <p>하 반도체 좋아보이는데 사야되나?</p>
              <time>오후 9:39</time>
            </div>
          </article>
          <article className="chat-message outgoing">
            <p>레알 사게? ㅋㅋ</p>
            <time>오후 9:41</time>
          </article>
          <div className="chat-trade-alert" role="status">
            <span className="chat-trade-alert-badge">매매</span>
            <span>장우진님이 <strong>SK하이닉스 46주</strong>를 매수하셨습니다.</span>
          </div>
          <article className="chat-message outgoing">
            <p>ㅄ ㅋㅋㅋㅋ 하닉을 사?</p>
            <time>오후 9:42</time>
          </article>
          <div className="chat-trade-alert" role="status">
            <span className="chat-trade-alert-badge">매도</span>
            <span>김형진님이 <strong>SK하이닉스 100주</strong>를 매도하셨습니다.</span>
          </div>
          <article className="chat-message outgoing">
            <p>잘 먹고 갑니다 ㅋㅋㅋㅋㅋ</p>
            <time>오후 9:43</time>
          </article>
          {roomTimeline.map((item) => {
            if (item.kind === 'message') {
              return (
                <article className="chat-message outgoing" key={item.id}>
                  <p>{item.text}</p>
                  <time>{item.sentAt}</time>
                </article>
              )
            }

            if (item.kind === 'view-event') {
              const viewLabel = item.viewKind === 'balance' ? '잔고' : '순위'
              return (
                <div className={`chat-view-alert is-${item.viewKind}`} role="status" key={item.id}>
                  <span className="chat-view-alert-badge">{viewLabel}</span>
                  <span>김형진님이 오늘 {viewLabel}를 <strong>{item.count}번째</strong> 확인했어요 👀</span>
                </div>
              )
            }

            return (
              <article className="chat-portfolio-share" key={item.id}>
                <span className="chat-portfolio-share-badge">잔고 공유</span>
                <strong>김형진님의 포트폴리오</strong>
                <p>총자산 {formatWon(TOTAL_ASSET)} · {formatReturn(TOTAL_RETURN)}</p>
                <small>삼성전자 · SK하이닉스 외 3종목</small>
                <time>{item.sentAt}</time>
              </article>
            )
          })}
          <div ref={messagesEndRef} aria-hidden="true" />
        </section>
        {(isPortfolioSheetOpen || isRankingSheetOpen) && (
          <div className="chat-view-presence" role="status">
            <span aria-hidden="true">👀</span>
            김형진님이 {isPortfolioSheetOpen ? '잔고' : '순위'}를 확인 중이에요
          </div>
        )}
      </div>
      <div className="chat-composer">
        <button type="button" aria-label="첨부">＋</button>
        <textarea
          ref={messageInputRef}
          value={messageDraft}
          rows={1}
          maxLength={500}
          inputMode="text"
          enterKeyHint="send"
          aria-label="메시지 입력"
          aria-controls="chat-message-list"
          placeholder="메시지를 입력하세요..."
          onChange={(event) => setMessageDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              sendMessage()
            }
          }}
        />
        <button
          type="button"
          className={`chat-send-button ${canSendMessage ? 'is-message-send' : 'is-trade'}`}
          aria-label={canSendMessage ? '메시지 전송' : '매매 주문 열기'}
          onPointerDown={(event) => {
            if (canSendMessage) event.preventDefault()
          }}
          onClick={() => {
            if (canSendMessage) sendMessage()
            else {
              messageInputRef.current?.blur()
              openTradeSheet()
            }
          }}
        >
          {canSendMessage ? '전송' : '매매'}
        </button>
      </div>
      <div className="feed-bottom">
        <HomeIndicator />
      </div>
      {isTradeSheetOpen && (
        <div className={`trade-sheet-layer ${isTradeSheetDismissing ? 'is-dismissing' : ''}`}>
          <button
            type="button"
            className="trade-sheet-backdrop"
            aria-label="매매 화면 닫기"
            onClick={dismissTradeSheet}
          />
          <section ref={tradeSheetRef} className="trade-sheet" role="dialog" aria-modal="true" aria-label="매매 화면" tabIndex={-1}>
            <div
              className={`trade-sheet-surface ${isTradeSheetDragging ? 'is-dragging' : ''}`}
              style={{ transform: `translateY(${tradeSheetDragY}px)` }}
            >
              <div
                className="trade-sheet-drag-zone"
                role="button"
                tabIndex={0}
                aria-label="아래로 드래그하여 매매 화면 닫기"
                onPointerDown={startTradeSheetDrag}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
                    event.preventDefault()
                    dismissTradeSheet()
                  }
                }}
              >
                <div className="trade-sheet-grabber" aria-hidden="true" />
              </div>
              <div className="trade-sheet-canvas">
                <TradeDrafts shortAllowed tradeEntryIntent={tradeEntryIntent} onOpenPortfolio={openPortfolioSheet} openOrders={openOrders} onUpdateOpenOrder={onUpdateOpenOrder} onCancelOpenOrder={onCancelOpenOrder} />
              </div>
            </div>
          </section>
        </div>
      )}
      {isPortfolioSheetOpen && (
        <PortfolioSheet viewCount={viewCounts.balance} openOrders={openOrders} onClose={() => setIsPortfolioSheetOpen(false)} onShare={sharePortfolio} onOpenPosition={openPositionTradeFromPortfolio} onOpenOrder={openOrderManagerFromPortfolio} />
      )}
      {isRankingSheetOpen && (
        <RankingSheet viewCount={viewCounts.ranking} onClose={() => setIsRankingSheetOpen(false)} />
      )}
    </main>
  )
}

function SplashScreen() {
  return (
    <main className="app-shell splash-shell" data-name="splash-screen" data-node-id="2:12">
      <StatusBar icons={friendsIcons} nodePrefix="2" />
      <section className="splash-content">
        <div className="splash-logo-mark"><Icon src={splashTrending} size={36} /></div>
        <h1>천투</h1>
        <strong>TIAN TOU</strong>
        <p>함께 투자하고,<br />함께 성장하자</p>
        <div className="splash-divider" />
        <small>모의투자 기반 소셜 플랫폼<br />By Two-Tsing</small>
      </section>
      <HomeIndicator />
    </main>
  )
}

function HomeIndicator() {
  return <div className="home-indicator"><div /></div>
}

function HomeFeed({ mode, onModeChange, cardVariant, onNavigate }: { mode: FeedMode; onModeChange: (mode: FeedMode) => void; cardVariant: InvestCardVariant; onNavigate: (screen: ScreenKey) => void }) {
  const icons = mode === 'invest' ? investIcons : friendsIcons
  const isFriends = mode === 'friends'
  const [searchQuery, setSearchQuery] = useState('')
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase()
  const visibleInvestRooms = investRooms.filter((room) => (
    !normalizedSearchQuery
    || `${room.title} ${room.scheduleLabel} ${room.leaderboard.join(' ')} ${room.holdings.map((holding) => holding.name).join(' ')}`.toLocaleLowerCase().includes(normalizedSearchQuery)
  ))
  const visibleFriends = friends.filter((friend) => (
    !normalizedSearchQuery
    || `${friend.name} ${friend.grade}`.toLocaleLowerCase().includes(normalizedSearchQuery)
  ))
  const visibleItemCount = isFriends ? visibleFriends.length : visibleInvestRooms.length

  return (
    <main className={`app-shell feed-shell ${isFriends ? 'friends-feed' : 'invest-feed'}`} data-name={isFriends ? 'home-feed-freinds' : 'home-feed-invest'}>
      <div className="feed-top-container">
        <StatusBar icons={icons} nodePrefix={isFriends ? '7' : '2'} />
        <FeedHeader icons={icons} nodePrefix={isFriends ? '7' : '2'} />
        <TickerBelt nodePrefix={isFriends ? '7' : '2'} />
        <HeroBanner profile={isFriends ? friendsProfile : investProfile} nodePrefix={isFriends ? '7' : '2'} />

        <section className={`feed-section ${isFriends ? 'friends-section' : 'invest-section'}`}>
          <FeedTabs mode={mode} onChange={onModeChange} searchValue={searchQuery} onSearchChange={setSearchQuery} searchIcon={icons.search} />
          <div className="rooms-list">
            {isFriends
              ? visibleFriends.map((friend, index) => <FriendCard friend={friend} index={index} key={friend.name} />)
              : visibleInvestRooms.map((room, index) => <InvestRoomCard room={room} index={index} variant={cardVariant} key={`${room.title}-${index}`} />)}
            {visibleItemCount === 0 && <p className="feed-empty-state">검색 결과가 없습니다.</p>}
          </div>
        </section>
      </div>

      <div className="feed-bottom">
        <BottomNav icons={icons} activeMode={mode} onNavigate={onNavigate} />
        <HomeIndicator />
      </div>
    </main>
  )
}

export default function App() {
  const [mode, setMode] = useState<FeedMode>('invest')
  const [roomTimeline, setRoomTimeline] = useState<RoomTimelineItem[]>([])
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>(initialOpenOrders)
  const [viewCounts, setViewCounts] = useState<Record<SocialViewKind, number>>({ balance: 0, ranking: 0 })
  const socialViewTrackerRef = useRef<Record<SocialViewKind, SocialViewTracker>>({
    balance: { count: 0, lastCountedAt: 0, dateKey: '' },
    ranking: { count: 0, lastCountedAt: 0, dateKey: '' },
  })
  const [screen, setScreen] = useState<ScreenKey>(() => {
    if (typeof window === 'undefined') return 'home'
    const requestedScreen = new URLSearchParams(window.location.search).get('screen')
    if (requestedScreen === 'chat-list' || requestedScreen === 'chat-room' || requestedScreen === 'splash') return requestedScreen
    return 'home'
  })

  const navigate = (nextScreen: ScreenKey) => {
    setScreen(nextScreen)
    const params = new URLSearchParams(window.location.search)
    if (nextScreen === 'home') params.delete('screen')
    else params.set('screen', nextScreen)
    const query = params.toString()
    window.history.pushState({}, '', query ? `/?${query}` : '/')
  }

  const getCurrentChatTime = () => {
    const now = new Date()
    const hour = now.getHours()
    const period = hour < 12 ? '오전' : '오후'
    const displayHour = hour % 12 || 12
    return `${period} ${displayHour}:${String(now.getMinutes()).padStart(2, '0')}`
  }

  const sendChatMessage = (message: string) => {
    setRoomTimeline((currentTimeline) => [
      ...currentTimeline,
      { id: crypto.randomUUID(), kind: 'message', text: message, sentAt: getCurrentChatTime() },
    ])
  }

  const addViewMilestone = (viewKind: SocialViewKind, count: number) => {
    setRoomTimeline((currentTimeline) => [
      ...currentTimeline,
      { id: crypto.randomUUID(), kind: 'view-event', viewKind, count, sentAt: getCurrentChatTime() },
    ])
  }

  const recordSocialView = (viewKind: SocialViewKind) => {
    const now = Date.now()
    const dateKey = getLocalDateKey()
    const storedTracker = socialViewTrackerRef.current[viewKind]
    const tracker = storedTracker.dateKey === dateKey
      ? storedTracker
      : { count: 0, lastCountedAt: 0, dateKey }

    if (now - tracker.lastCountedAt < SOCIAL_VIEW_COOLDOWN_MS) return

    const nextCount = tracker.count + 1
    socialViewTrackerRef.current[viewKind] = { count: nextCount, lastCountedAt: now, dateKey }
    setViewCounts((currentCounts) => ({ ...currentCounts, [viewKind]: nextCount }))

    if (isSocialViewMilestone(nextCount)) addViewMilestone(viewKind, nextCount)
  }

  const sharePortfolio = () => {
    setRoomTimeline((currentTimeline) => [
      ...currentTimeline,
      { id: crypto.randomUUID(), kind: 'portfolio-share', sentAt: getCurrentChatTime() },
    ])
  }

  const updateOpenOrder = (orderId: string, update: OpenOrderUpdate) => {
    setOpenOrders((currentOrders) => currentOrders.map((order) => (
      order.id === orderId ? { ...order, ...update } : order
    )))
  }

  const cancelOpenOrder = (orderId: string) => {
    setOpenOrders((currentOrders) => currentOrders.filter((order) => order.id !== orderId))
  }

  if (screen === 'chat-list') return <ChatListScreen onNavigate={navigate} />
  if (screen === 'chat-room') {
    return (
      <ChatRoomScreen
        onNavigate={navigate}
        roomTimeline={roomTimeline}
        viewCounts={viewCounts}
        onSendMessage={sendChatMessage}
        onRecordSocialView={recordSocialView}
        onSharePortfolio={sharePortfolio}
        openOrders={openOrders}
        onUpdateOpenOrder={updateOpenOrder}
        onCancelOpenOrder={cancelOpenOrder}
      />
    )
  }
  if (screen === 'splash') return <SplashScreen />
  return <HomeFeed mode={mode} onModeChange={setMode} cardVariant={getInvestCardVariant()} onNavigate={navigate} />
}
