import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { PortfolioSheet, RankingSheet, TradeHistorySheet } from './AccountSheets'
import {
  CompetitionHostSheet,
  CompetitionMulliganIcon,
  CompetitionParticipationSheet,
  CompetitionTrophyIcon,
  MAX_COMPETITION_PARTICIPANTS,
  addCalendarDays,
  createCompetitionFromDraft,
  formatCompetitionBoundary,
  formatCompetitionDate,
  getCompetitionRemainingDays,
  hasCompetitionReachedRankedDuration,
  isCompetitionAtCapacity,
  isCompetitionJoinOpen,
  type CompetitionDraft,
  type CompetitionMembership,
  type LoungeCompetition,
} from './CompetitionLifecycle'
import TradeDrafts from './TradeDrafts'
import InvestmentScreen from './InvestmentScreen'
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
type ScreenKey = 'home' | 'chat-list' | 'chat-room' | 'competition-join' | 'lounge-create' | 'friend-add' | 'invest' | 'my' | 'splash'
type NavKey = 'home' | 'chat' | 'invest' | 'my'
type ChatFilter = 'all' | 'group' | 'personal'
type ChatRoomKind = 'group' | 'personal'
type ChatSwipeSide = 'leading' | 'trailing'
type ChatCompetitionState = 'scheduled' | 'active' | 'ended' | 'invalidated' | 'chat-only'
type MyPanelKey = 'profile' | 'records' | 'notifications' | 'friends' | 'devices' | 'visibility' | 'support'

type SocialViewKind = 'balance' | 'ranking'

type ChatHistoryItem = {
  id: string
  sender: string
  text: string
  sentAt: string
  sentOn: string
  mine?: boolean
}

type RoomTimelineItem =
  | { id: string; kind: 'message'; text: string; sentAt: string }
  | { id: string; kind: 'view-event'; viewKind: SocialViewKind; count: number; sentAt: string }
  | { id: string; kind: 'portfolio-share'; sentAt: string }
  | { id: string; kind: 'join-event'; roomKind: '대회' | '라운지'; sentAt: string }
  | { id: string; kind: 'lounge-create-event'; sentAt: string }
  | { id: string; kind: 'competition-event'; eventType: 'scheduled' | 'started' | 'cancelled' | 'ended' | 'invalidated' | 'forfeited' | 'host-transferred'; title: string; detail: string; sentAt: string }

type FriendProfile = {
  id: string
  tiantouId: string
  name: string
  grade: string
  returnValue: string
}

type CompetitionInvite = {
  code: string
  title: string
  participantCount: number
  competitionState: ChatCompetitionState
  startDate?: string
  endDate?: string
  market: string
  shortAllowed: boolean
  initialCapital: number
  mulliganLimit?: 0 | 1 | 2 | 3
  competitionParticipantCount?: number
  image: string
  recentHistory: ChatHistoryItem[]
}

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

const navItems: Array<{ key: NavKey; label: string; icon: keyof Pick<FeedIcons, 'home' | 'message' | 'trending' | 'user'> }> = [
  { key: 'home', label: '홈', icon: 'home' },
  { key: 'chat', label: '대회', icon: 'message' },
  { key: 'invest', label: '투자', icon: 'trending' },
  { key: 'my', label: '마이', icon: 'user' },
]

const investRooms = [
  {
    title: '쌍띠 투자대회',
    rank: '#2 / 4',
    returnValue: '+28.4%',
    returnTone: 'positive',
    scheduleLabel: '종료 D-26 · 2026.09.27',
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
    rank: '#8 / 10',
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
    rank: '#6 / 10',
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

const friends: FriendProfile[] = [
  { id: 'kim-young-gyu', tiantouId: '@younggyu', name: '김영규', grade: '등급 불개미', returnValue: '+314.2%' },
  { id: 'jang-woo-jin', tiantouId: '@woojin', name: '장우진', grade: '등급 애널리스트', returnValue: '+28.4%' },
  { id: 'kim-hyeong-jin', tiantouId: '@hyeongjin367', name: '김형진', grade: '등급 개미', returnValue: '—' },
  { id: 'jo-jin-man', tiantouId: '@jinman', name: '조진만', grade: '등급 기관', returnValue: '—' },
]

const friendDirectory: FriendProfile[] = [
  { id: 'lee-min-su', tiantouId: '@minsu77', name: '이민수', grade: '등급 가치투자자', returnValue: '+18.7%' },
  { id: 'park-seo-jun', tiantouId: '@seojunpark', name: '박서준', grade: '등급 개미', returnValue: '+4.2%' },
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
  isHost?: boolean
  competitionState?: ChatCompetitionState
  competition?: LoungeCompetition
  competitionMembership?: CompetitionMembership
  mulligansUsed?: number
  accountReset?: boolean
  recentHistory?: ChatHistoryItem[]
  image: string
}

const chatRooms: ChatRoom[] = [
  {
    id: 'ssangddi',
    title: '쌍띠 투자대회',
    detail: '진짜 오늘 단타 매수 타이밍이죠?',
    meta: '오후 9:41',
    count: '4',
    unread: 3,
    muted: false,
    pinned: false,
    kind: 'group',
    isHost: true,
    competitionState: 'active',
    competitionMembership: 'participant',
    competition: {
      id: 'competition-ssangddi',
      title: '쌍띠 투자대회',
      phase: 'active',
      initialCapital: 15_000_000,
      durationDays: 30,
      startDate: '2026-08-29',
      endDate: '2026-09-27',
      joinDeadline: '2026-09-20',
      market: 'KOSPI · KOSDAQ',
      shortAllowed: true,
      feeBps: 20,
      taxBps: 0,
      participantCount: 4,
      participantLimit: 10,
      mulliganLimit: 2,
    },
    mulligansUsed: 0,
    image: investRoom,
  },
  { id: 'kakao', title: '카카오 투자 라운지', detail: '진짜 발표 전까지 떡상하려나요?', meta: '오후 8:12', count: '15', unread: 15, muted: true, pinned: false, kind: 'group', isHost: true, competitionState: 'chat-only', competitionMembership: 'none', image: friendsRoom },
  { id: 'jang-woo-jin', title: '장우진', detail: '모의투자도 끝까지 잘 챙겼네요 공유좀', meta: '오후 5:30', count: '1', unread: 1, muted: false, pinned: false, kind: 'personal', image: investProfile },
  { id: 'kim-young-gyu', title: '김영규', detail: '삼성전자 오늘 매수 타이밍 맞나요?', meta: '어제', count: '', unread: 0, muted: true, pinned: false, kind: 'personal', image: friendsProfile },
]

const competitionInvites: CompetitionInvite[] = [
  {
    code: 'T26START2026',
    title: '여름 단타 챌린지',
    participantCount: 11,
    competitionState: 'active',
    startDate: '2026-08-28',
    endDate: '2026-09-30',
    market: 'KOSPI · KOSDAQ',
    shortAllowed: true,
    initialCapital: 10_000_000,
    mulliganLimit: 1,
    competitionParticipantCount: 8,
    image: investRoom,
    recentHistory: [
      { id: 'summer-history-1', sender: '박민수', text: '오늘 장 시작부터 변동성 엄청 크네요.', sentOn: '8월 28일', sentAt: '오전 9:18' },
      { id: 'summer-history-2', sender: '이서연', text: '반도체 비중 줄이고 현금 들고 있어요.', sentOn: '8월 29일', sentAt: '오후 3:42' },
      { id: 'summer-history-3', sender: '장우진', text: '새로 오신 분들 반갑습니다!', sentOn: '오늘', sentAt: '오전 11:06' },
    ],
  },
  {
    code: 'LOUNGE882026',
    title: '퇴근 후 투자 라운지',
    participantCount: 27,
    competitionState: 'chat-only',
    market: 'KOSPI · KOSDAQ',
    shortAllowed: false,
    initialCapital: 10_000_000,
    mulliganLimit: 0,
    image: friendsRoom,
    recentHistory: [
      { id: 'lounge-history-1', sender: '김영규', text: '이번 주 관심 종목 하나씩 공유해볼까요?', sentOn: '8월 28일', sentAt: '오후 8:11' },
      { id: 'lounge-history-2', sender: '조진만', text: '저는 자동차 부품주 보고 있습니다.', sentOn: '8월 29일', sentAt: '오후 7:34' },
      { id: 'lounge-history-3', sender: '이민수', text: '오늘도 다들 고생 많으셨어요.', sentOn: '오늘', sentAt: '오후 6:02' },
    ],
  },
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

type HomeQuickActionIconKind = 'host' | 'join' | 'friend' | 'lounge'

function HomeQuickActionIcon({ kind }: { kind: HomeQuickActionIconKind }) {
  return (
    <svg className="home-quick-action-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {kind === 'host' && (
        <>
          <path d="M7 5h10v3.5a5 5 0 0 1-10 0V5Z" />
          <path d="M9 15h6M12 13.5V19M8.5 19h7" />
          <path d="M7 7H4.5v1A3.5 3.5 0 0 0 8 11.5M17 7h2.5v1a3.5 3.5 0 0 1-3.5 3.5" />
        </>
      )}
      {kind === 'join' && (
        <>
          <path d="M13 5h5a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5" />
          <path d="m10 8 4 4-4 4M14 12H4" />
        </>
      )}
      {kind === 'friend' && (
        <>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0M18 8v6M15 11h6" />
        </>
      )}
      {kind === 'lounge' && (
        <>
          <path d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-5 3v-3H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" />
          <path d="M12 8.5v6M9 11.5h6" />
        </>
      )}
    </svg>
  )
}

function FeedHeader({ icons, nodePrefix, onQuickAction }: { icons: FeedIcons; nodePrefix: '2' | '7'; onQuickAction: (action: HomeQuickActionIconKind) => void }) {
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false)
  const quickMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isQuickMenuOpen) return

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!quickMenuRef.current?.contains(event.target as Node)) setIsQuickMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsQuickMenuOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePress)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isQuickMenuOpen])

  return (
    <header className="feed-header" data-node-id={`${nodePrefix}:42`} data-name="feed-header">
      <h1>천투</h1>
      <div className="header-actions" ref={quickMenuRef}>
        <button
          type="button"
          className={`header-add-trigger ${isQuickMenuOpen ? 'is-open' : ''}`}
          aria-label="빠른 메뉴 열기"
          aria-haspopup="menu"
          aria-expanded={isQuickMenuOpen}
          onClick={() => setIsQuickMenuOpen((isOpen) => !isOpen)}
        >
          <Icon src={icons.plus} nodeId={`${nodePrefix}:721`} />
        </button>
        {isQuickMenuOpen && (
          <div className="home-quick-menu" role="menu" aria-label="빠른 메뉴">
            <button
              type="button"
              className="home-quick-action"
              role="menuitem"
              onClick={() => {
                setIsQuickMenuOpen(false)
                onQuickAction('lounge')
              }}
            >
              <span className="home-quick-action-icon"><HomeQuickActionIcon kind="lounge" /></span>
              <span className="home-quick-action-copy"><strong>라운지 만들기</strong></span>
            </button>
            <button
              type="button"
              className="home-quick-action"
              role="menuitem"
              onClick={() => {
                setIsQuickMenuOpen(false)
                onQuickAction('join')
              }}
            >
              <span className="home-quick-action-icon"><HomeQuickActionIcon kind="join" /></span>
              <span className="home-quick-action-copy"><strong>라운지 참가하기</strong></span>
            </button>
            <button
              type="button"
              className="home-quick-action"
              role="menuitem"
              onClick={() => {
                setIsQuickMenuOpen(false)
                onQuickAction('friend')
              }}
            >
              <span className="home-quick-action-icon"><HomeQuickActionIcon kind="friend" /></span>
              <span className="home-quick-action-copy"><strong>친구 추가</strong></span>
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

function ChatListQuickMenu({ onNavigate }: { onNavigate: (screen: ScreenKey) => void }) {
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false)
  const quickMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isQuickMenuOpen) return

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!quickMenuRef.current?.contains(event.target as Node)) setIsQuickMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsQuickMenuOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePress)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isQuickMenuOpen])

  const openScreen = (screen: ScreenKey) => {
    setIsQuickMenuOpen(false)
    onNavigate(screen)
  }

  return (
    <div className="header-actions chat-header-actions" ref={quickMenuRef}>
      <button
        type="button"
        className={`header-add-trigger ${isQuickMenuOpen ? 'is-open' : ''}`}
        aria-label="대회 빠른 메뉴 열기"
        aria-haspopup="menu"
        aria-expanded={isQuickMenuOpen}
        onClick={() => setIsQuickMenuOpen((isOpen) => !isOpen)}
      >
        <Icon src={friendsPlus} size={22} />
      </button>
      {isQuickMenuOpen && (
        <div className="home-quick-menu chat-list-quick-menu" role="menu" aria-label="대회 빠른 메뉴">
          <button type="button" className="home-quick-action" role="menuitem" onClick={() => openScreen('lounge-create')}>
            <span className="home-quick-action-icon"><HomeQuickActionIcon kind="lounge" /></span>
            <span className="home-quick-action-copy"><strong>라운지 만들기</strong></span>
          </button>
          <button type="button" className="home-quick-action" role="menuitem" onClick={() => openScreen('competition-join')}>
            <span className="home-quick-action-icon"><HomeQuickActionIcon kind="join" /></span>
            <span className="home-quick-action-copy"><strong>라운지 참가하기</strong></span>
          </button>
        </div>
      )}
    </div>
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

function InvestRoomCardCompact({ room, onOpen }: { room: (typeof investRooms)[number]; onOpen: () => void }) {
  const rows = getLeaderboardRows(room)

  return (
    <article
      className="room-card invest-room-card invest-card-variant-a"
      role="button"
      tabIndex={0}
      aria-label={`${room.title} 대화방 열기`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
    >
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

function InvestRoomCardScoreboard({ room, onOpen }: { room: (typeof investRooms)[number]; onOpen: () => void }) {
  const rows = getLeaderboardRows(room)

  return (
    <article
      className="room-card invest-room-card invest-card-variant-b"
      role="button"
      tabIndex={0}
      aria-label={`${room.title} 대화방 열기`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
    >
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

function InvestRoomCard({ room, index, variant, onOpen }: { room: (typeof investRooms)[number]; index: number; variant: InvestCardVariant; onOpen: () => void }) {
  if (variant === 'compact') return <InvestRoomCardCompact room={room} onOpen={onOpen} />
  if (variant === 'scoreboard') return <InvestRoomCardScoreboard room={room} onOpen={onOpen} />

  return (
    <article
      className="room-card invest-room-card"
      data-node-id={index === 0 ? '2:70' : undefined}
      role="button"
      tabIndex={0}
      aria-label={`${room.title} 대화방 열기`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
    >
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

function FriendCard({ friend, index, onOpen }: { friend: (typeof friends)[number]; index: number; onOpen: () => void }) {
  return (
    <article
      className="room-card friend-room-card"
      data-node-id={index === 0 ? '7:233' : undefined}
      role="button"
      tabIndex={0}
      aria-label={`${friend.name}님과 대화하기`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
    >
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
            if (item.key === 'invest') onNavigate?.('invest')
            if (item.key === 'my') onNavigate?.('my')
          }}
        >
          <Icon src={icons[item.icon]} size={22} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}

type ChatSwipeIconKind = 'bookmark' | 'bell' | 'bell-off' | 'flag' | 'log-out'

function ChatSwipeIcon({ kind }: { kind: ChatSwipeIconKind }) {
  return (
    <svg className="chat-swipe-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {kind === 'bookmark' && (
        <path d="M6.5 4.75A1.75 1.75 0 0 1 8.25 3h7.5a1.75 1.75 0 0 1 1.75 1.75V21L12 17.65 6.5 21V4.75Z" />
      )}
      {kind === 'bell' && (
        <>
          <path d="M18 9.75a6 6 0 0 0-12 0c0 6-2.5 6.5-2.5 6.5h17S18 15.75 18 9.75Z" />
          <path d="M9.75 19a2.5 2.5 0 0 0 4.5 0" />
        </>
      )}
      {kind === 'bell-off' && (
        <>
          <path d="m4 4 16 16" />
          <path d="M9.15 3.7A6 6 0 0 1 18 9.75c0 2.55.45 4.08 1 5" />
          <path d="M6.3 6.3A6 6 0 0 0 6 9.75c0 6-2.5 6.5-2.5 6.5h12.25" />
          <path d="M9.75 19a2.5 2.5 0 0 0 4.5 0" />
        </>
      )}
      {kind === 'flag' && (
        <>
          <path d="M5 21V4" />
          <path d="M5 5h11l-1.75 3L16 11H5" />
        </>
      )}
      {kind === 'log-out' && (
        <>
          <path d="M10 17l5-5-5-5" />
          <path d="M15 12H3" />
          <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
        </>
      )}
    </svg>
  )
}

const CHAT_LEADING_ACTION_WIDTH = 126
const CHAT_TRAILING_ACTION_WIDTH = 63

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
  const canForfeitCompetition = room.kind === 'group' && room.competitionState === 'active' && room.competitionMembership === 'participant'
  const trailingActionLabel = canForfeitCompetition ? '포기하기' : '나가기'
  const [dragOffsetX, setDragOffsetX] = useState(openSwipe === 'leading' ? CHAT_LEADING_ACTION_WIDTH : openSwipe === 'trailing' ? -CHAT_TRAILING_ACTION_WIDTH : 0)
  const pointerStartRef = useRef<{ x: number; y: number; startOffset: number } | null>(null)
  const didSwipeRef = useRef(false)

  useEffect(() => {
    setDragOffsetX(openSwipe === 'leading' ? CHAT_LEADING_ACTION_WIDTH : openSwipe === 'trailing' ? -CHAT_TRAILING_ACTION_WIDTH : 0)
  }, [openSwipe])

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    pointerStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      startOffset: openSwipe === 'leading' ? CHAT_LEADING_ACTION_WIDTH : openSwipe === 'trailing' ? -CHAT_TRAILING_ACTION_WIDTH : 0,
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
    setDragOffsetX(Math.max(-CHAT_TRAILING_ACTION_WIDTH, Math.min(CHAT_LEADING_ACTION_WIDTH, pointerStart.startOffset + deltaX)))
  }

  const finishPointer = () => {
    const pointerStart = pointerStartRef.current
    if (!pointerStart) return

    pointerStartRef.current = null
    if (!didSwipeRef.current) return

    const nextSide = dragOffsetX >= CHAT_LEADING_ACTION_WIDTH * 0.45
      ? 'leading'
      : dragOffsetX <= -CHAT_TRAILING_ACTION_WIDTH * 0.45
        ? 'trailing'
        : null
    setDragOffsetX(nextSide === 'leading' ? CHAT_LEADING_ACTION_WIDTH : nextSide === 'trailing' ? -CHAT_TRAILING_ACTION_WIDTH : 0)
    if (nextSide) onOpenActions(nextSide)
    else onCloseActions()
  }

  const cancelPointer = () => {
    pointerStartRef.current = null
    didSwipeRef.current = false
    setDragOffsetX(openSwipe === 'leading' ? CHAT_LEADING_ACTION_WIDTH : openSwipe === 'trailing' ? -CHAT_TRAILING_ACTION_WIDTH : 0)
  }

  return (
    <div className="chat-room-swipe-item">
      <div className="chat-room-swipe-actions chat-room-swipe-actions-leading" aria-hidden={openSwipe !== 'leading'}>
        <button
          type="button"
          className={`chat-room-swipe-action chat-room-swipe-action-pin ${room.pinned ? 'is-state-active' : ''}`}
          tabIndex={openSwipe === 'leading' ? 0 : -1}
          aria-label={room.pinned ? `${room.title} 고정 해제` : `${room.title} 고정`}
          onClick={() => {
            onTogglePinned()
            onCloseActions()
          }}
        >
          <span className="chat-swipe-action-seal"><ChatSwipeIcon kind="bookmark" /></span>
          <small>{room.pinned ? '해제' : '고정'}</small>
        </button>
        <button
          type="button"
          className={`chat-room-swipe-action chat-room-swipe-action-alert ${room.muted ? 'is-state-active' : ''}`}
          tabIndex={openSwipe === 'leading' ? 0 : -1}
          aria-label={room.muted ? `${room.title} 알람 설정` : `${room.title} 알람 해제`}
          onClick={() => {
            onToggleMuted()
            onCloseActions()
          }}
        >
          <span className="chat-swipe-action-seal"><ChatSwipeIcon kind={room.muted ? 'bell' : 'bell-off'} /></span>
          <small>알람</small>
        </button>
      </div>
      <div className="chat-room-swipe-actions chat-room-swipe-actions-trailing" aria-hidden={openSwipe !== 'trailing'}>
        <button
          type="button"
          className="chat-room-swipe-action chat-room-swipe-action-leave"
          tabIndex={openSwipe === 'trailing' ? 0 : -1}
          aria-label={`${room.title} ${trailingActionLabel}`}
          onClick={() => {
            onRequestLeave()
            onCloseActions()
          }}
        >
          <span className="chat-swipe-action-seal"><ChatSwipeIcon kind={canForfeitCompetition ? 'flag' : 'log-out'} /></span>
          <small>{trailingActionLabel}</small>
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
            {room.competitionState && (
              <span className={`chat-room-status is-${room.competitionState}`}>
                {room.competitionState === 'active' ? '대회 중' : room.competitionState === 'scheduled' ? '예약' : room.competitionState === 'invalidated' ? '무효' : room.competitionState === 'ended' ? '종료' : '라운지'}
              </span>
            )}
            {room.competitionMembership === 'eligible' && <span className="chat-membership-status is-eligible">참여 대기</span>}
            {room.competitionMembership === 'forfeited' && <span className="chat-membership-status is-forfeited">관망 중</span>}
            {room.pinned && <span className="chat-pinned-indicator" aria-label="고정됨"><ChatSwipeIcon kind="bookmark" /></span>}
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

function ChatListScreen({ onNavigate, rooms, onRoomsChange, onOpenRoom, onForfeitRoom }: {
  onNavigate: (screen: ScreenKey) => void
  rooms: ChatRoom[]
  onRoomsChange: (updater: (rooms: ChatRoom[]) => ChatRoom[]) => void
  onOpenRoom: (room: ChatRoom) => void
  onForfeitRoom: (room: ChatRoom, successorName?: string) => void
}) {
  const [chatFilter, setChatFilter] = useState<ChatFilter>('all')
  const [chatQuery, setChatQuery] = useState('')
  const [swipedRoom, setSwipedRoom] = useState<{ id: string; side: ChatSwipeSide } | null>(null)
  const [pendingLeaveRoom, setPendingLeaveRoom] = useState<ChatRoom | null>(null)
  const [pendingHostSuccessor, setPendingHostSuccessor] = useState('')
  const normalizedChatQuery = chatQuery.trim().toLocaleLowerCase()

  useEffect(() => {
    setSwipedRoom(null)
  }, [chatFilter, chatQuery])

  const visibleChatRooms = rooms
    .filter((room) => chatFilter === 'all' || room.kind === chatFilter)
    .filter((room) => !normalizedChatQuery || `${room.title} ${room.detail}`.toLocaleLowerCase().includes(normalizedChatQuery))
    .sort((firstRoom, secondRoom) => Number(secondRoom.pinned) - Number(firstRoom.pinned))

  const updateChatRoom = (roomId: string, update: Partial<Pick<ChatRoom, 'pinned' | 'muted'>>) => {
    onRoomsChange((currentRooms) => currentRooms.map((room) => room.id === roomId ? { ...room, ...update } : room))
  }

  const confirmLeaveRoom = () => {
    if (!pendingLeaveRoom) return
    const requiresHostTransfer = pendingLeaveRoom.kind === 'group' && pendingLeaveRoom.isHost
    if (requiresHostTransfer && !pendingHostSuccessor) return
    const shouldForfeit = pendingLeaveRoom.kind === 'group'
      && pendingLeaveRoom.competitionState === 'active'
      && pendingLeaveRoom.competitionMembership === 'participant'
    if (shouldForfeit) {
      onForfeitRoom(pendingLeaveRoom, pendingHostSuccessor || undefined)
      setPendingLeaveRoom(null)
      setPendingHostSuccessor('')
      setSwipedRoom(null)
      return
    }
    onRoomsChange((currentRooms) => currentRooms.filter((room) => room.id !== pendingLeaveRoom.id))
    setPendingLeaveRoom(null)
    setPendingHostSuccessor('')
    setSwipedRoom(null)
  }

  const pendingLeaveIsForfeit = pendingLeaveRoom?.kind === 'group'
    && pendingLeaveRoom.competitionState === 'active'
    && pendingLeaveRoom.competitionMembership === 'participant'
  const pendingLeaveAction = pendingLeaveIsForfeit ? '포기하기' : '나가기'
  const pendingLeaveRequiresHostTransfer = Boolean(pendingLeaveRoom?.kind === 'group' && pendingLeaveRoom.isHost)
  const successorCandidates = Number(pendingLeaveRoom?.count ?? 0) > 1
    ? friends.filter((profile) => profile.id !== 'kim-hyeong-jin').slice(0, 3)
    : []

  return (
    <main className="app-shell chat-shell chat-list-screen" data-name="chat-list" data-node-id="2:126">
      <div className="chat-top-container">
        <StatusBar icons={friendsIcons} nodePrefix="2" />
        <header className="chat-header">
          <h1>대회</h1>
          <ChatListQuickMenu onNavigate={onNavigate} />
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
              onNavigate={() => onOpenRoom(room)}
              onTogglePinned={() => updateChatRoom(room.id, { pinned: !room.pinned })}
              onToggleMuted={() => updateChatRoom(room.id, { muted: !room.muted })}
              onRequestLeave={() => { setPendingHostSuccessor(''); setPendingLeaveRoom(room) }}
            />
          ))}
          {visibleChatRooms.length === 0 && <p className="chat-empty-state">{rooms.length === 0 ? '참여 중인 채팅방이 없습니다.' : '검색 결과가 없습니다.'}</p>}
        </section>
      </div>
      <div className="feed-bottom">
        <BottomNav icons={friendsIcons} activeMode="friends" activeKey="chat" onNavigate={onNavigate} />
        <HomeIndicator />
      </div>
      {pendingLeaveRoom && (
        <div className="chat-confirm-layer">
          <button type="button" className="chat-confirm-backdrop" aria-label="확인 창 닫기" onClick={() => { setPendingLeaveRoom(null); setPendingHostSuccessor('') }} />
          <section className="chat-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="chat-confirm-title" aria-describedby="chat-confirm-description">
            <span className="chat-confirm-badge">{pendingLeaveRequiresHostTransfer ? '방장 위임 필수' : pendingLeaveIsForfeit ? '대회' : '라운지'}</span>
            <h2 id="chat-confirm-title">{pendingLeaveRequiresHostTransfer ? '다음 방장을 정해 주세요' : `${pendingLeaveAction} 하시겠어요?`}</h2>
            <p id="chat-confirm-description"><strong>{pendingLeaveRoom.title}</strong>{pendingLeaveRequiresHostTransfer ? `의 방장을 넘긴 뒤 ${pendingLeaveIsForfeit ? '포기할' : '나갈'} 수 있어요.` : pendingLeaveIsForfeit ? '에서 포기하면 모든 포기자와 공동 꼴등으로 기록되고 라운지에는 관망자로 남습니다.' : '에서 나가면 대화 목록에서 사라집니다.'}</p>
            {pendingLeaveRequiresHostTransfer && (
              <fieldset className="host-successor-fieldset">
                <legend>{pendingLeaveIsForfeit ? '현재 대회 참가자 중 선택' : '현재 라운지 멤버 중 선택'}</legend>
                {successorCandidates.map((candidate) => (
                  <label className={pendingHostSuccessor === candidate.name ? 'is-selected' : ''} key={candidate.id}>
                    <input type="radio" name="host-successor" value={candidate.name} checked={pendingHostSuccessor === candidate.name} onChange={() => setPendingHostSuccessor(candidate.name)} />
                    <span>{candidate.name.slice(0, 1)}</span>
                    <strong>{candidate.name}</strong>
                    <small>{candidate.grade.replace('등급 ', '')}</small>
                  </label>
                ))}
                {successorCandidates.length === 0 && <p>위임할 다른 멤버가 없어 지금은 {pendingLeaveAction}할 수 없어요.</p>}
              </fieldset>
            )}
            <div className="chat-confirm-actions">
              <button type="button" className="chat-confirm-cancel" onClick={() => { setPendingLeaveRoom(null); setPendingHostSuccessor('') }}>취소</button>
              <button type="button" className="chat-confirm-destructive" disabled={pendingLeaveRequiresHostTransfer && !pendingHostSuccessor} onClick={confirmLeaveRoom}>{pendingLeaveRequiresHostTransfer ? `위임 후 ${pendingLeaveAction}` : pendingLeaveAction}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

function ChatRoomScreen({
  onNavigate,
  room,
  roomTimeline,
  viewCounts,
  onSendMessage,
  onRecordSocialView,
  onSharePortfolio,
  openOrders,
  onUpdateOpenOrder,
  onCancelOpenOrder,
  onCreateCompetition,
  onCancelCompetitionSchedule,
  onStopCompetition,
  onParticipateCompetition,
  onUseMulligan,
  competitionNotice,
}: {
  onNavigate: (screen: ScreenKey) => void
  room: ChatRoom
  roomTimeline: RoomTimelineItem[]
  viewCounts: Record<SocialViewKind, number>
  onSendMessage: (message: string) => void
  onRecordSocialView: (viewKind: SocialViewKind) => void
  onSharePortfolio: () => void
  openOrders: OpenOrder[]
  onUpdateOpenOrder: (orderId: string, update: OpenOrderUpdate) => void
  onCancelOpenOrder: (orderId: string) => void
  onCreateCompetition: (draft: CompetitionDraft) => void
  onCancelCompetitionSchedule: () => void
  onStopCompetition: () => void
  onParticipateCompetition: () => void
  onUseMulligan: () => void
  competitionNotice: string
}) {
  const [messageDraft, setMessageDraft] = useState('')
  const [isTradeSheetOpen, setIsTradeSheetOpen] = useState(false)
  const [tradeEntryIntent, setTradeEntryIntent] = useState<TradeEntryIntent | null>(null)
  const [isPortfolioSheetOpen, setIsPortfolioSheetOpen] = useState(false)
  const [isTradeHistorySheetOpen, setIsTradeHistorySheetOpen] = useState(false)
  const [isRankingSheetOpen, setIsRankingSheetOpen] = useState(false)
  const [isCompetitionHostSheetOpen, setIsCompetitionHostSheetOpen] = useState(false)
  const [isCompetitionParticipationSheetOpen, setIsCompetitionParticipationSheetOpen] = useState(false)
  const [isMulliganConfirmOpen, setIsMulliganConfirmOpen] = useState(false)
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
  const isActiveCompetition = room.competitionState === 'active'
  const isCompetitionParticipant = isActiveCompetition && room.competitionMembership === 'participant'
  const competitionAtCapacity = Boolean(room.competition && isCompetitionAtCapacity(room.competition))
  const canJoinCompetition = Boolean(room.competition && room.competitionMembership === 'eligible' && isCompetitionJoinOpen(room.competition))
  const joinClosedLabel = competitionAtCapacity ? '대회 참가 정원 마감' : '대회 참가 마감'
  const mulligansUsed = room.mulligansUsed ?? 0
  const mulligansRemaining = Math.max(0, (room.competition?.mulliganLimit ?? 0) - mulligansUsed)
  const hasMulliganRule = (room.competition?.mulliganLimit ?? 0) > 0
  const usesExistingPortfolioMock = room.competition?.id === 'competition-ssangddi' && !room.accountReset
  const competitionAsset = usesExistingPortfolioMock ? TOTAL_ASSET : room.competition?.initialCapital ?? TOTAL_ASSET
  const competitionReturn = usesExistingPortfolioMock ? TOTAL_RETURN : 0
  const competitionRemainingDays = room.competition ? getCompetitionRemainingDays(room.competition.endDate) : 0
  const competitionEndLabel = room.competition ? formatCompetitionDate(room.competition.endDate).replace(/^\d+년\s*/, '') : ''

  useEffect(() => {
    if (isCompetitionParticipant) return
    setIsTradeSheetOpen(false)
    setTradeEntryIntent(null)
    setIsPortfolioSheetOpen(false)
    setIsTradeHistorySheetOpen(false)
    setIsRankingSheetOpen(false)
    setIsMulliganConfirmOpen(false)
  }, [isCompetitionParticipant, room.id])

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
    setIsTradeHistorySheetOpen(false)
    onRecordSocialView('balance')
    setIsPortfolioSheetOpen(true)
  }

  const openTradeHistorySheet = () => {
    if (!isCompetitionParticipant || !room.competition) return
    closeTradeSheet()
    setIsPortfolioSheetOpen(false)
    setIsRankingSheetOpen(false)
    setIsTradeHistorySheetOpen(true)
  }

  const openRankingSheet = () => {
    closeTradeSheet()
    setIsPortfolioSheetOpen(false)
    setIsTradeHistorySheetOpen(false)
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
              {room.title}
              {room.count && <span className="chat-header-participants">{room.count}명</span>}
            </strong>
            <span>{isActiveCompetition ? '대회 진행 중' : room.competitionState === 'scheduled' ? '대회 예약됨' : room.competitionState === 'invalidated' ? '대회 무효 · 라운지' : room.competitionState === 'ended' ? '대회 종료 · 라운지' : room.competitionState === 'chat-only' ? '투자 라운지' : '개인 대화'}</span>
          </div>
          <div className="chat-room-actions">
            {room.kind === 'group' && room.isHost && (
              <button type="button" className="competition-header-action is-host" aria-label={room.competitionState === 'chat-only' || room.competitionState === 'ended' || room.competitionState === 'invalidated' ? '대회 주최하기' : '대회 관리'} onClick={() => setIsCompetitionHostSheetOpen(true)}>
                <CompetitionTrophyIcon />
                <small>{room.competitionState === 'chat-only' || room.competitionState === 'ended' || room.competitionState === 'invalidated' ? '주최' : '관리'}</small>
              </button>
            )}
            {room.kind === 'group' && !room.isHost && room.competitionState === 'active' && room.competitionMembership === 'eligible' && (
              <button type="button" className="competition-header-action is-join" aria-label={canJoinCompetition ? '대회 참여하기' : joinClosedLabel} disabled={!canJoinCompetition} onClick={() => setIsCompetitionParticipationSheetOpen(true)}>
                <CompetitionTrophyIcon />
                <small>{canJoinCompetition ? '참여' : competitionAtCapacity ? '정원' : '마감'}</small>
              </button>
            )}
            <button type="button" aria-label="더 보기">⋮</button>
          </div>
        </header>
        {competitionNotice && <div className="competition-popup-notice" role="status"><CompetitionTrophyIcon /><span>{competitionNotice}</span></div>}
        {isCompetitionParticipant && <section className="chat-account-hud" aria-label="내 대회 현황">
          <div className="chat-account-hud-card">
            <div className="chat-account-hud-main">
              <span>내 총자산</span>
              <strong>{formatWon(competitionAsset)}</strong>
              <em>{formatReturn(competitionReturn)}</em>
            </div>
            <div className="chat-account-hud-rank" aria-label={usesExistingPortfolioMock ? `현재 ${CURRENT_RANK}위, 4명 중` : '참여 직후 순위 집계 전'}>
              <span>현재 순위</span>
              <strong>{usesExistingPortfolioMock ? <><b>{CURRENT_RANK}</b>위</> : '집계 전'}</strong>
              <small>{usesExistingPortfolioMock ? '4명 중' : `${room.competition?.participantCount ?? '-'}명 중`}</small>
            </div>
            <div className="chat-account-hud-footer">
              <span className="chat-account-deadline"><b>{competitionRemainingDays === 0 ? 'D-DAY' : `D-${competitionRemainingDays}`}</b><span>{competitionEndLabel} 종료</span></span>
              <div className={hasMulliganRule ? 'has-mulligan' : ''}>
                {hasMulliganRule && (
                  <button type="button" className="chat-mulligan-button" disabled={mulligansRemaining === 0} aria-label={`멀리건 ${mulligansRemaining}회 남음`} onClick={() => setIsMulliganConfirmOpen(true)}>
                    <CompetitionMulliganIcon /><span>멀리건</span><b>{mulligansRemaining}</b>
                  </button>
                )}
                <button type="button" onClick={openRankingSheet}>순위</button>
                <button type="button" onClick={openPortfolioSheet}>잔고</button>
              </div>
            </div>
          </div>
        </section>}
        {room.competitionState === 'scheduled' && room.competition && (
          <section className="competition-context-card is-scheduled">
            <span className="competition-context-icon"><CompetitionTrophyIcon /></span>
            <div><small>대회 예약</small><strong>{room.competition.title}</strong><p>{formatCompetitionBoundary(room.competition.startDate)} 기준으로 시작해요.</p></div>
            {room.isHost && <button type="button" onClick={() => setIsCompetitionHostSheetOpen(true)}>관리</button>}
          </section>
        )}
        {isActiveCompetition && room.competitionMembership === 'eligible' && room.competition && (
          <section className={`competition-context-card ${canJoinCompetition ? 'is-open' : 'is-closed'}`}>
            <span className="competition-context-icon"><CompetitionTrophyIcon /></span>
            <div><small>{canJoinCompetition ? '대회 참여 가능' : competitionAtCapacity ? '정원 마감 · 관망 가능' : '참가 마감 · 관망 가능'}</small><strong>{room.competition.title}</strong><p>{canJoinCompetition ? `${formatCompetitionBoundary(room.competition.joinDeadline)} 전까지 직접 참여해 주세요. ${room.competition.participantCount}/${room.competition.participantLimit}명` : '채팅과 대회 흐름은 계속 볼 수 있어요.'}</p></div>
            {canJoinCompetition && <button type="button" onClick={() => setIsCompetitionParticipationSheetOpen(true)}>참여하기</button>}
          </section>
        )}
        {isActiveCompetition && room.competitionMembership === 'forfeited' && (
          <section className="competition-context-card is-forfeited">
            <span className="competition-context-icon"><CompetitionTrophyIcon /></span>
            <div><small>포기 · 관망 중</small><strong>라운지에는 그대로 남아 있어요</strong><p>모든 포기자와 공동 꼴등이며 매매는 할 수 없습니다.</p></div>
          </section>
        )}
        {room.competitionState === 'chat-only' && room.kind === 'group' && room.isHost && (
          <section className="competition-context-card is-empty">
            <span className="competition-context-icon"><CompetitionTrophyIcon /></span>
            <div><small>방장 전용</small><strong>이 라운지에서 대회를 열 수 있어요</strong><p>초기자본과 기간, 공매도 규칙을 먼저 설정합니다.</p></div>
            <button type="button" onClick={() => setIsCompetitionHostSheetOpen(true)}>주최하기</button>
          </section>
        )}
        {room.competitionState === 'ended' && room.competition && (
          <section className="competition-context-card is-ended">
            <span className="competition-context-icon"><CompetitionTrophyIcon /></span>
            <div><small>대회 종료</small><strong>{room.competition.title}</strong><p>종료 시점 NAV로 최종 순위가 확정됐어요.</p></div>
            {room.isHost && <button type="button" onClick={() => setIsCompetitionHostSheetOpen(true)}>다음 대회</button>}
          </section>
        )}
        {room.competitionState === 'invalidated' && room.competition && (
          <section className="competition-context-card is-invalidated">
            <span className="competition-context-icon"><CompetitionTrophyIcon /></span>
            <div><small>대회 무효</small><strong>{room.competition.title}</strong><p>시작 후 7일 전에 종료되어 최종 순위가 없습니다.</p></div>
            {room.isHost && <button type="button" onClick={() => setIsCompetitionHostSheetOpen(true)}>다음 대회</button>}
          </section>
        )}
        <div className="chat-date-divider">{room.recentHistory?.length ? '참가 시점 기준 최근 3일 채팅' : '오늘, 2026년 2월 24일'}</div>
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
          {room.id === 'ssangddi' && (
            <>
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
            </>
          )}
          {room.id !== 'ssangddi' && room.recentHistory?.map((historyItem, index) => (
            <div className="chat-history-entry" key={historyItem.id}>
              {(index === 0 || room.recentHistory?.[index - 1]?.sentOn !== historyItem.sentOn) && (
                <div className="chat-history-day">{historyItem.sentOn}</div>
              )}
              <article className={`chat-message ${historyItem.mine ? 'outgoing' : 'incoming'}`}>
                {!historyItem.mine && <img src={friendsProfile} alt="" width="32" height="32" />}
                <div>
                  {!historyItem.mine && <span className="chat-message-name">{historyItem.sender}</span>}
                  <p>{historyItem.text}</p>
                  <time>{historyItem.sentAt}</time>
                </div>
              </article>
            </div>
          ))}
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

            if (item.kind === 'portfolio-share') return (
              <article className="chat-portfolio-share" key={item.id}>
                <span className="chat-portfolio-share-badge">잔고 공유</span>
                <strong>김형진님의 포트폴리오</strong>
                <p>총자산 {formatWon(TOTAL_ASSET)} · {formatReturn(TOTAL_RETURN)}</p>
                <small>삼성전자 · SK하이닉스 외 3종목</small>
                <time>{item.sentAt}</time>
              </article>
            )

            if (item.kind === 'lounge-create-event') return (
              <div className="chat-join-alert" role="status" key={item.id}>
                <span className="chat-join-alert-badge">개설</span>
                <span>김형진님이 라운지를 만들었어요</span>
                <time>{item.sentAt}</time>
              </div>
            )

            if (item.kind === 'competition-event') {
              const eventLabel = item.eventType === 'scheduled' ? '예약' : item.eventType === 'started' ? '시작' : item.eventType === 'cancelled' ? '취소' : item.eventType === 'invalidated' ? '무효' : item.eventType === 'forfeited' ? '포기' : item.eventType === 'host-transferred' ? '방장 위임' : '종료'
              return (
                <div className={`chat-competition-event is-${item.eventType}`} role="status" key={item.id}>
                  <span className="chat-competition-event-icon"><CompetitionTrophyIcon /></span>
                  <span><small>대회 {eventLabel}</small><strong>{item.title}</strong><p>{item.detail}</p></span>
                  <time>{item.sentAt}</time>
                </div>
              )
            }

            return (
              <div className="chat-join-alert" role="status" key={item.id}>
                <span className="chat-join-alert-badge">참가</span>
                <span>김형진님이 {item.roomKind}에 참가했어요</span>
                <time>{item.sentAt}</time>
              </div>
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
          className={`chat-send-button ${canSendMessage ? 'is-message-send' : isCompetitionParticipant ? 'is-trade' : 'is-lounge-send'}`}
          aria-label={canSendMessage ? '메시지 전송' : isCompetitionParticipant ? '매매 주문 열기' : '메시지를 입력하면 전송할 수 있습니다'}
          disabled={!canSendMessage && !isCompetitionParticipant}
          onPointerDown={(event) => {
            if (canSendMessage) event.preventDefault()
          }}
          onClick={() => {
            if (canSendMessage) sendMessage()
            else if (isCompetitionParticipant) {
              messageInputRef.current?.blur()
              openTradeSheet()
            }
          }}
        >
          {canSendMessage ? '전송' : isCompetitionParticipant ? '매매' : '전송'}
        </button>
      </div>
      <div className="feed-bottom">
        <HomeIndicator />
      </div>
      {isCompetitionParticipant && isTradeSheetOpen && (
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
                <TradeDrafts positionsReset={Boolean(room.accountReset)} shortAllowed={room.competition?.shortAllowed ?? false} tradeEntryIntent={tradeEntryIntent} onOpenPortfolio={openPortfolioSheet} openOrders={openOrders} onUpdateOpenOrder={onUpdateOpenOrder} onCancelOpenOrder={onCancelOpenOrder} />
              </div>
            </div>
          </section>
        </div>
      )}
      {isCompetitionParticipant && isPortfolioSheetOpen && (
        <PortfolioSheet isReset={Boolean(room.accountReset)} initialCapital={room.competition?.initialCapital} viewCount={viewCounts.balance} openOrders={openOrders} onClose={() => setIsPortfolioSheetOpen(false)} onShare={sharePortfolio} onOpenHistory={openTradeHistorySheet} onOpenPosition={openPositionTradeFromPortfolio} onOpenOrder={openOrderManagerFromPortfolio} />
      )}
      {isCompetitionParticipant && isTradeHistorySheetOpen && room.competition && (
        <TradeHistorySheet competitionTitle={room.competition.title} periodLabel={`${formatCompetitionDate(room.competition.startDate)} – ${formatCompetitionDate(room.competition.endDate)}`} mulligansUsed={mulligansUsed} onClose={() => setIsTradeHistorySheetOpen(false)} />
      )}
      {isCompetitionParticipant && isRankingSheetOpen && (
        <RankingSheet viewCount={viewCounts.ranking} onClose={() => setIsRankingSheetOpen(false)} />
      )}
      {isCompetitionHostSheetOpen && room.kind === 'group' && room.isHost && (
        <CompetitionHostSheet
          loungeTitle={room.title}
          competition={room.competition}
          onClose={() => setIsCompetitionHostSheetOpen(false)}
          onCreate={(draft) => {
            onCreateCompetition(draft)
            setIsCompetitionHostSheetOpen(false)
          }}
          onCancelSchedule={() => {
            onCancelCompetitionSchedule()
            setIsCompetitionHostSheetOpen(false)
          }}
          onStop={() => {
            onStopCompetition()
            setIsCompetitionHostSheetOpen(false)
          }}
        />
      )}
      {isCompetitionParticipationSheetOpen && room.competition && room.competitionMembership === 'eligible' && (
        <CompetitionParticipationSheet
          competition={room.competition}
          onClose={() => setIsCompetitionParticipationSheetOpen(false)}
          onParticipate={() => {
            onParticipateCompetition()
            setIsCompetitionParticipationSheetOpen(false)
          }}
        />
      )}
      {isMulliganConfirmOpen && room.competition && (
        <div className="competition-mulligan-layer">
          <button type="button" className="competition-mulligan-backdrop" aria-label="멀리건 사용 취소" onClick={() => setIsMulliganConfirmOpen(false)} />
          <section className="competition-mulligan-dialog" role="alertdialog" aria-modal="true" aria-labelledby="mulligan-dialog-title">
            <div className="competition-mulligan-grabber" aria-hidden="true" />
            <header>
              <span className="competition-mulligan-mark"><CompetitionMulliganIcon /></span>
              <div><small>MULLIGAN</small><strong>다시 시작 기회</strong></div>
              <em>{mulligansRemaining}회 남음</em>
            </header>
            <h2 id="mulligan-dialog-title">내 계좌를 초기자본으로<br />되돌릴까요?</h2>
            <p className="competition-mulligan-intro">지금까지의 포지션을 정리하고 같은 대회에서 새로 시작합니다.</p>
            <div className="competition-mulligan-balance-preview">
              <div><small>현재 총자산</small><strong>{formatWon(competitionAsset)}</strong><em className={competitionReturn >= 0 ? 'is-positive' : 'is-negative'}>{formatReturn(competitionReturn)}</em></div>
              <span aria-hidden="true">→</span>
              <div><small>초기화 후</small><strong>{formatWon(room.competition.initialCapital)}</strong><em>0.0%</em></div>
            </div>
            <ul>
              <li><span>01</span><div><strong>미체결 주문 취소</strong><small>대기 중인 주문을 모두 취소해요</small></div></li>
              <li><span>02</span><div><strong>보유 포지션 정리</strong><small>Long·Short 잔고를 모두 비워요</small></div></li>
              <li><span>03</span><div><strong>현금 100%로 재시작</strong><small>손익 0원 · 수익률 0.0%로 돌아가요</small></div></li>
            </ul>
            <p className="competition-mulligan-warning"><strong>되돌릴 수 없어요.</strong> 이전 거래 기록은 보존되고 사용 횟수는 다시 채워지지 않습니다.</p>
            <div className="competition-mulligan-actions"><button type="button" onClick={() => setIsMulliganConfirmOpen(false)}>돌아가기</button><button type="button" onClick={() => { onUseMulligan(); setIsMulliganConfirmOpen(false); setIsPortfolioSheetOpen(false); closeTradeSheet() }}>1회 사용하고 초기화</button></div>
          </section>
        </div>
      )}
    </main>
  )
}

function normalizeJoinCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
}

function extractJoinCode(value: string) {
  try {
    const inviteUrl = new URL(value)
    const queryCode = inviteUrl.searchParams.get('invite')
    if (queryCode) return normalizeJoinCode(queryCode)
    const pathParts = inviteUrl.pathname.split('/').filter(Boolean)
    return normalizeJoinCode(pathParts[pathParts.length - 1] ?? '')
  } catch {
    return normalizeJoinCode(value)
  }
}

function MvpQrPattern({ seed, label }: { seed: string; label: string }) {
  const size = 21
  const seedValue = Array.from(seed).reduce((total, character, index) => total + character.charCodeAt(0) * (index + 3), 17)
  const isFinderCell = (row: number, column: number, offsetRow: number, offsetColumn: number) => {
    const localRow = row - offsetRow
    const localColumn = column - offsetColumn
    if (localRow < 0 || localRow > 6 || localColumn < 0 || localColumn > 6) return false
    return localRow === 0 || localRow === 6 || localColumn === 0 || localColumn === 6 || (localRow >= 2 && localRow <= 4 && localColumn >= 2 && localColumn <= 4)
  }

  return (
    <div className="mvp-qr" role="img" aria-label={label}>
      {Array.from({ length: size * size }, (_, index) => {
        const row = Math.floor(index / size)
        const column = index % size
        const finder = isFinderCell(row, column, 0, 0) || isFinderCell(row, column, 0, 14) || isFinderCell(row, column, 14, 0)
        const payload = ((row * 17 + column * 31 + seedValue + (row * column * 7)) % 11) < 5
        return <span className={finder || payload ? 'is-filled' : ''} key={index} />
      })}
    </div>
  )
}

function UtilityScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="utility-screen-header">
      <button type="button" className="utility-back-button" aria-label="뒤로 가기" onClick={onBack}>‹</button>
      <strong>{title}</strong>
      <span aria-hidden="true" />
    </header>
  )
}

function LoungeCreateScreen({ onBack, onCreate }: {
  onBack: () => void
  onCreate: (draft: { title: string; description: string }) => void
}) {
  const [loungeTitle, setLoungeTitle] = useState('')
  const [loungeDescription, setLoungeDescription] = useState('')
  const normalizedTitle = loungeTitle.trim()
  const canCreate = normalizedTitle.length >= 2

  const createLounge = () => {
    if (!canCreate) return
    onCreate({ title: normalizedTitle, description: loungeDescription.trim() })
  }

  return (
    <main className="app-shell utility-shell lounge-create-screen">
      <div className="utility-top-container">
        <StatusBar icons={friendsIcons} nodePrefix="2" />
        <UtilityScreenHeader title="라운지 만들기" onBack={onBack} />
        <section className="utility-scroll-content">
          <div className="join-intro lounge-create-intro">
            <span className="utility-eyebrow">가벼운 투자 대화방</span>
            <h1>바로 이야기할 라운지를 만들어요</h1>
            <p>대회 기간, 거래 시장, 공매도 같은 설정 없이 채팅방만 즉시 개설됩니다.</p>
          </div>

          <form className="lounge-create-form" onSubmit={(event) => { event.preventDefault(); createLounge() }}>
            <label className="lounge-create-field" htmlFor="lounge-title">
              <span><strong>라운지 이름</strong><small>{loungeTitle.length}/24</small></span>
              <input
                id="lounge-title"
                value={loungeTitle}
                maxLength={24}
                autoComplete="off"
                placeholder="예: 퇴근 후 종목 토크"
                onChange={(event) => setLoungeTitle(event.target.value)}
              />
              <small>두 글자 이상 입력해주세요.</small>
            </label>

            <label className="lounge-create-field" htmlFor="lounge-description">
              <span><strong>라운지 소개</strong><small>{loungeDescription.length}/60</small></span>
              <textarea
                id="lounge-description"
                value={loungeDescription}
                rows={3}
                maxLength={60}
                placeholder="어떤 이야기를 나누는 곳인지 간단히 적어주세요. (선택)"
                onChange={(event) => setLoungeDescription(event.target.value)}
              />
            </label>

            <aside className="lounge-create-note">
              <span className="home-quick-action-icon"><HomeQuickActionIcon kind="lounge" /></span>
              <span><strong>생성 즉시 시작</strong><small>개설 후 바로 라운지 채팅방으로 이동하며 대회 목록에도 추가됩니다.</small></span>
            </aside>

            <section className="lounge-create-preview" aria-label="라운지 미리보기">
              <span className="lounge-preview-avatar">라</span>
              <span>
                <small>투자 라운지 · 1명</small>
                <strong>{normalizedTitle || '라운지 이름 미리보기'}</strong>
                <p>{loungeDescription.trim() || '편하게 투자 이야기를 나눠보세요.'}</p>
              </span>
            </section>

            <button type="submit" className="lounge-create-submit" disabled={!canCreate}>라운지 만들고 대화 시작</button>
          </form>
        </section>
      </div>
      <HomeIndicator />
    </main>
  )
}

function CompetitionJoinScreen({ initialCode, onBack, onJoin }: {
  initialCode: string
  onBack: () => void
  onJoin: (invite: CompetitionInvite) => void
}) {
  const [joinMethod, setJoinMethod] = useState<'code' | 'qr'>('code')
  const [joinCode, setJoinCode] = useState(() => normalizeJoinCode(initialCode))
  const [preview, setPreview] = useState<CompetitionInvite | null>(null)
  const [joinError, setJoinError] = useState('')
  const [qrStatus, setQrStatus] = useState('')

  const resolveInvite = (rawCode: string) => {
    const normalizedCode = extractJoinCode(rawCode)
    setJoinCode(normalizedCode)
    if (normalizedCode.length !== 12) {
      setPreview(null)
      setJoinError('라운지 초대 코드는 영문과 숫자 12자리입니다.')
      return
    }

    const matchedInvite = competitionInvites.find((invite) => invite.code === normalizedCode)
    if (!matchedInvite) {
      setPreview(null)
      setJoinError('유효하지 않거나 만료된 라운지 초대 코드입니다.')
      return
    }

    setPreview(matchedInvite)
    setJoinError('')
  }

  useEffect(() => {
    if (initialCode) resolveInvite(initialCode)
  }, [initialCode])

  const readQrImage = async (file: File | undefined) => {
    if (!file) return
    setQrStatus('QR코드를 확인하고 있어요...')

    type QrResult = { rawValue: string }
    type QrDetector = { detect: (source: ImageBitmap) => Promise<QrResult[]> }
    type QrDetectorConstructor = new (options: { formats: string[] }) => QrDetector
    const Detector = (window as Window & { BarcodeDetector?: QrDetectorConstructor }).BarcodeDetector

    if (!Detector) {
      setQrStatus('이 브라우저는 QR 이미지 인식을 지원하지 않습니다. 참가 코드를 입력해주세요.')
      return
    }

    try {
      const bitmap = await createImageBitmap(file)
      const detector = new Detector({ formats: ['qr_code'] })
      const [result] = await detector.detect(bitmap)
      bitmap.close()
      if (!result) {
        setQrStatus('QR코드를 찾지 못했습니다. 선명한 이미지를 다시 선택해주세요.')
        return
      }
      resolveInvite(result.rawValue)
      setQrStatus('QR코드를 인식했습니다.')
    } catch {
      setQrStatus('QR코드를 읽지 못했습니다. 참가 코드를 직접 입력해주세요.')
    }
  }

  return (
    <main className="app-shell utility-shell competition-join-screen">
      <div className="utility-top-container">
        <StatusBar icons={friendsIcons} nodePrefix="2" />
        <UtilityScreenHeader title="라운지 참가하기" onBack={onBack} />
        <section className="utility-scroll-content">
          <div className="join-intro">
            <span className="utility-eyebrow">12자리 라운지 초대 코드</span>
            <h1>초대받은 라운지에 들어가요</h1>
            <p>코드와 QR, 초대 링크는 같은 라운지 가입 권한으로 연결됩니다.</p>
          </div>

          <div className="join-method-tabs" role="tablist" aria-label="참가 방법">
            <button type="button" className={joinMethod === 'code' ? 'is-active' : ''} role="tab" aria-selected={joinMethod === 'code'} onClick={() => setJoinMethod('code')}>코드 입력</button>
            <button type="button" className={joinMethod === 'qr' ? 'is-active' : ''} role="tab" aria-selected={joinMethod === 'qr'} onClick={() => setJoinMethod('qr')}>QR 스캔</button>
          </div>

          {joinMethod === 'code' ? (
            <form className="join-code-panel" onSubmit={(event) => { event.preventDefault(); resolveInvite(joinCode) }}>
              <label htmlFor="competition-join-code">참가 코드</label>
              <div className="join-code-input-row">
                <input
                  id="competition-join-code"
                  value={joinCode}
                  maxLength={12}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  inputMode="text"
                  placeholder="예: T26START2026"
                  onChange={(event) => {
                    setJoinCode(normalizeJoinCode(event.target.value))
                    setJoinError('')
                    setPreview(null)
                  }}
                />
                <button type="submit" disabled={joinCode.length !== 12}>확인</button>
              </div>
              <small>테스트 코드: T26START2026 · LOUNGE882026</small>
            </form>
          ) : (
            <section className="join-qr-panel">
              <div className="join-qr-frame">
                <MvpQrPattern seed="https://tiantou.app/j/T26START2026" label="라운지 참가 QR 샘플" />
                <span>QR을 사각형 안에 맞춰주세요</span>
              </div>
              <label className="join-qr-upload">
                카메라 또는 앨범에서 QR 읽기
                <input type="file" accept="image/*" capture="environment" onChange={(event) => void readQrImage(event.target.files?.[0])} />
              </label>
              <button type="button" className="join-qr-demo" onClick={() => { resolveInvite('T26START2026'); setQrStatus('샘플 QR을 인식했습니다.') }}>샘플 QR로 테스트</button>
              {qrStatus && <p className="join-qr-status" role="status">{qrStatus}</p>}
            </section>
          )}

          <div className="join-link-note">
            <HomeQuickActionIcon kind="join" />
            <span><strong>초대 링크로 들어왔나요?</strong><small>링크의 12자리 코드를 자동으로 인식해 이 화면을 바로 엽니다.</small></span>
          </div>

          {joinError && <p className="join-error" role="alert">{joinError}</p>}

          {preview && (
            <section className="competition-preview-card" aria-label="대회 미리보기">
              <header>
                <img src={preview.image} alt="" width="48" height="48" />
                <span>
                  <small>{preview.competitionState === 'active' ? '대회 진행 중인 라운지' : '투자 라운지'}</small>
                  <strong>{preview.title}</strong>
                </span>
                <b>멤버 {preview.participantCount}명</b>
              </header>
              <dl>
                <div><dt>현재 현황</dt><dd>{preview.competitionState === 'active' ? '대회 진행 중' : '채팅 라운지'}</dd></div>
                {preview.competitionState === 'active' && preview.startDate && preview.endDate && <div><dt>대회 기간</dt><dd>{formatCompetitionDate(preview.startDate)} – {formatCompetitionDate(preview.endDate)}</dd></div>}
                {preview.competitionState === 'active' && <div><dt>대회 참가</dt><dd>{preview.competitionParticipantCount ?? 1}/{MAX_COMPETITION_PARTICIPANTS}명</dd></div>}
                {preview.competitionState === 'active' && <div><dt>멀리건</dt><dd>{preview.mulliganLimit ? `참가자당 ${preview.mulliganLimit}회` : '사용 안 함'}</dd></div>}
                <div><dt>거래 가능 시장</dt><dd>{preview.market}</dd></div>
                <div><dt>공매도</dt><dd>{preview.shortAllowed ? '허용' : '미허용'}</dd></div>
              </dl>
              {preview.competitionState === 'active' && preview.endDate && <div className="competition-history-notice">라운지 가입 후 {formatCompetitionBoundary(addCalendarDays(preview.endDate, -7))} 전까지 대회 참여를 선택할 수 있어요.</div>}
              <div className="competition-history-notice">가입하면 가입 시점 기준 최근 3일 채팅을 볼 수 있어요.</div>
              <button type="button" className="competition-join-submit" onClick={() => onJoin(preview)}>라운지 참가하기</button>
            </section>
          )}
        </section>
      </div>
      <HomeIndicator />
    </main>
  )
}

function FriendCandidate({ profile, requested, onRequest }: { profile: FriendProfile; requested: boolean; onRequest: () => void }) {
  return (
    <article className="friend-candidate">
      <span className="friend-candidate-avatar">{profile.name.slice(0, 1)}</span>
      <span>
        <strong>{profile.name}</strong>
        <small>{profile.tiantouId} · {profile.grade}</small>
      </span>
      <button type="button" disabled={requested} onClick={onRequest}>{requested ? '요청됨' : '친구 요청'}</button>
    </article>
  )
}

function FriendAddScreen({ onBack, requestedFriendIds, onRequestFriend }: {
  onBack: () => void
  requestedFriendIds: string[]
  onRequestFriend: (profile: FriendProfile) => void
}) {
  const [friendMethod, setFriendMethod] = useState<'qr' | 'contacts' | 'id'>('qr')
  const [qrCandidate, setQrCandidate] = useState<FriendProfile | null>(null)
  const [contactsLoaded, setContactsLoaded] = useState(false)
  const [friendIdQuery, setFriendIdQuery] = useState('')
  const [idCandidate, setIdCandidate] = useState<FriendProfile | null>(null)
  const [idError, setIdError] = useState('')

  const requestFriend = (profile: FriendProfile) => {
    onRequestFriend(profile)
  }

  const searchFriendId = () => {
    const normalizedId = friendIdQuery.trim().toLocaleLowerCase().replace(/^@?/, '@')
    const matchedProfile = friendDirectory.find((profile) => profile.tiantouId.toLocaleLowerCase() === normalizedId)
    setIdCandidate(matchedProfile ?? null)
    setIdError(matchedProfile ? '' : '일치하는 천투 ID를 찾지 못했습니다.')
  }

  return (
    <main className="app-shell utility-shell friend-add-screen">
      <div className="utility-top-container">
        <StatusBar icons={friendsIcons} nodePrefix="2" />
        <UtilityScreenHeader title="친구 추가" onBack={onBack} />
        <section className="utility-scroll-content">
          <section className="my-qr-card">
            <div className="my-qr-heading">
              <img src={investProfile} alt="김형진" width="48" height="48" />
              <span><small>내 천투 ID</small><strong>@hyeongjin367</strong></span>
            </div>
            <MvpQrPattern seed="https://tiantou.app/f/hyeongjin367" label="김형진님의 친구 추가 QR" />
            <p>상대방이 이 QR을 스캔하면 내 프로필을 확인하고 친구 요청을 보낼 수 있어요.</p>
            <div className="my-qr-actions">
              <button type="button" onClick={() => void navigator.clipboard?.writeText('@hyeongjin367')}>ID 복사</button>
              <button type="button" onClick={() => void navigator.clipboard?.writeText('https://tiantou.app/f/hyeongjin367')}>링크 복사</button>
            </div>
          </section>

          <div className="friend-method-tabs" role="tablist" aria-label="친구 추가 방법">
            {([['qr', 'QR코드'], ['contacts', '연락처'], ['id', 'ID 검색']] as const).map(([method, label]) => (
              <button type="button" className={friendMethod === method ? 'is-active' : ''} role="tab" aria-selected={friendMethod === method} key={method} onClick={() => setFriendMethod(method)}>{label}</button>
            ))}
          </div>

          {friendMethod === 'qr' && (
            <section className="friend-method-panel">
              <h2>친구 QR 스캔</h2>
              <p>QR을 인식한 뒤 상대 프로필을 확인하고 요청을 보냅니다.</p>
              <button type="button" className="friend-primary-action" onClick={() => setQrCandidate(friendDirectory[0])}>샘플 QR 스캔</button>
              {qrCandidate && <FriendCandidate profile={qrCandidate} requested={requestedFriendIds.includes(qrCandidate.id)} onRequest={() => requestFriend(qrCandidate)} />}
            </section>
          )}

          {friendMethod === 'contacts' && (
            <section className="friend-method-panel">
              <h2>연락처에서 찾기</h2>
              <p>사용자가 직접 허용한 경우에만 연락처를 확인하며 전화번호는 다른 사람에게 표시하지 않습니다.</p>
              {!contactsLoaded && <button type="button" className="friend-primary-action" onClick={() => setContactsLoaded(true)}>연락처 선택하기</button>}
              {contactsLoaded && (
                <div className="friend-candidate-list">
                  {friendDirectory.map((profile) => <FriendCandidate profile={profile} requested={requestedFriendIds.includes(profile.id)} onRequest={() => requestFriend(profile)} key={profile.id} />)}
                </div>
              )}
            </section>
          )}

          {friendMethod === 'id' && (
            <section className="friend-method-panel">
              <h2>천투 ID로 찾기</h2>
              <p>정확한 ID를 입력해야 검색됩니다. 테스트 ID는 @minsu77입니다.</p>
              <form className="friend-id-search" onSubmit={(event) => { event.preventDefault(); searchFriendId() }}>
                <input value={friendIdQuery} placeholder="@tiantou_id" autoCapitalize="none" autoComplete="off" onChange={(event) => { setFriendIdQuery(event.target.value); setIdError(''); setIdCandidate(null) }} />
                <button type="submit" disabled={!friendIdQuery.trim()}>검색</button>
              </form>
              {idError && <p className="friend-id-error" role="alert">{idError}</p>}
              {idCandidate && <FriendCandidate profile={idCandidate} requested={requestedFriendIds.includes(idCandidate.id)} onRequest={() => requestFriend(idCandidate)} />}
            </section>
          )}
        </section>
      </div>
      <HomeIndicator />
    </main>
  )
}

type MyIconKind = 'edit' | 'trophy' | 'bell' | 'users' | 'devices' | 'eye' | 'help' | 'chevron' | 'close' | 'shield' | 'check'

function MyIcon({ kind }: { kind: MyIconKind }) {
  return (
    <svg className="my-line-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {kind === 'edit' && (
        <>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" />
        </>
      )}
      {kind === 'trophy' && (
        <>
          <path d="M8 21h8" />
          <path d="M12 17v4" />
          <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
          <path d="M7 6H4v1a4 4 0 0 0 4 4" />
          <path d="M17 6h3v1a4 4 0 0 1-4 4" />
        </>
      )}
      {kind === 'bell' && (
        <>
          <path d="M18 9.75a6 6 0 0 0-12 0c0 6-2.5 6.5-2.5 6.5h17S18 15.75 18 9.75Z" />
          <path d="M9.75 19a2.5 2.5 0 0 0 4.5 0" />
        </>
      )}
      {kind === 'users' && (
        <>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </>
      )}
      {kind === 'devices' && (
        <>
          <rect x="2.5" y="4" width="14" height="10" rx="2" />
          <path d="M7 19h5" />
          <path d="M9.5 14v5" />
          <rect x="17.5" y="9" width="4" height="10" rx="1.25" />
        </>
      )}
      {kind === 'eye' && (
        <>
          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
          <circle cx="12" cy="12" r="2.5" />
        </>
      )}
      {kind === 'help' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.8 9a2.4 2.4 0 1 1 3.35 2.2c-.8.38-1.15.85-1.15 1.8" />
          <path d="M12 17h.01" />
        </>
      )}
      {kind === 'chevron' && <path d="m9 18 6-6-6-6" />}
      {kind === 'close' && <path d="m6 6 12 12M18 6 6 18" />}
      {kind === 'shield' && (
        <>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
          <path d="m9 12 2 2 4-4" />
        </>
      )}
      {kind === 'check' && <path d="m5 12 4 4L19 6" />}
    </svg>
  )
}

function MySettingSwitch({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <button type="button" className={`my-setting-switch ${checked ? 'is-on' : ''}`} role="switch" aria-checked={checked} aria-label={label} onClick={onChange}>
      <span />
    </button>
  )
}

function MyScreen({ onNavigate, onOpenCompetition }: { onNavigate: (screen: ScreenKey) => void; onOpenCompetition: (title: string) => void }) {
  const [profileName, setProfileName] = useState('김형진')
  const [profileIntro, setProfileIntro] = useState('확신보다 규칙으로 매매합니다.')
  const [draftName, setDraftName] = useState(profileName)
  const [draftIntro, setDraftIntro] = useState(profileIntro)
  const [activePanel, setActivePanel] = useState<MyPanelKey | null>(null)
  const [notifications, setNotifications] = useState({ all: true, chat: true, trade: true })
  const [profileVisible, setProfileVisible] = useState(true)
  const [friendRequests, setFriendRequests] = useState(true)

  useEffect(() => {
    if (!activePanel) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActivePanel(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [activePanel])

  const openProfileEditor = () => {
    setDraftName(profileName)
    setDraftIntro(profileIntro)
    setActivePanel('profile')
  }

  const panelTitle: Record<MyPanelKey, string> = {
    profile: '프로필 편집',
    records: '내 대회 기록',
    notifications: '알림',
    friends: '친구 및 차단',
    devices: '계정과 기기',
    visibility: '게임 공개 범위',
    support: '고객센터 · 약관',
  }

  const competitions = [
    { title: '쌍띠 투자대회', state: '진행 중', rank: '현재 2위', returnValue: '+28.4%', tone: 'is-gain', image: investRoom },
    { title: '카카오 투자대회', state: '종료', rank: '최종 15위', returnValue: '-15.8%', tone: 'is-loss', image: friendsRoom },
  ]

  const renderPanelContent = () => {
    if (activePanel === 'profile') {
      return (
        <form className="my-profile-form" onSubmit={(event) => {
          event.preventDefault()
          setProfileName(draftName.trim() || '김형진')
          setProfileIntro(draftIntro.trim() || '한 줄 소개를 입력해보세요.')
          setActivePanel(null)
        }}>
          <div className="my-profile-avatar-edit">
            <img src={investProfile} alt="김형진 프로필" width="68" height="68" />
            <button type="button" aria-label="프로필 사진 변경"><MyIcon kind="edit" /></button>
          </div>
          <label>닉네임<input value={draftName} maxLength={12} onChange={(event) => setDraftName(event.target.value)} /></label>
          <label>한 줄 소개<textarea value={draftIntro} maxLength={36} rows={2} onChange={(event) => setDraftIntro(event.target.value)} /></label>
          <button type="submit" className="my-primary-button">저장</button>
        </form>
      )
    }

    if (activePanel === 'records') {
      return (
        <div className="my-record-list">
          {competitions.map((competition) => (
            <button type="button" key={competition.title} onClick={() => { setActivePanel(null); onOpenCompetition(competition.title) }}>
              <img src={competition.image} alt="" width="42" height="42" />
              <span><strong>{competition.title}</strong><small>{competition.state} · {competition.rank}</small></span>
              <b className={competition.tone}>{competition.returnValue}</b>
            </button>
          ))}
          <div className="my-record-summary"><MyIcon kind="trophy" /><span><strong>완주율 67%</strong><small>참가 6회 중 4회 완주</small></span></div>
        </div>
      )
    }

    if (activePanel === 'notifications') {
      return (
        <div className="my-sheet-menu">
          <div><span><strong>전체 알림</strong><small>천투의 모든 푸시 알림</small></span><MySettingSwitch checked={notifications.all} label="전체 알림" onChange={() => setNotifications((current) => ({ ...current, all: !current.all }))} /></div>
          <div><span><strong>채팅 알림</strong><small>메시지와 멘션</small></span><MySettingSwitch checked={notifications.chat && notifications.all} label="채팅 알림" onChange={() => setNotifications((current) => ({ ...current, chat: !current.chat }))} /></div>
          <div><span><strong>매매·대회 알림</strong><small>체결, 순위, 대회 일정</small></span><MySettingSwitch checked={notifications.trade && notifications.all} label="매매와 대회 알림" onChange={() => setNotifications((current) => ({ ...current, trade: !current.trade }))} /></div>
          <p className="my-sheet-note">방별 채팅 알림은 채팅 목록에서 스와이프해 조절할 수 있어요.</p>
        </div>
      )
    }

    if (activePanel === 'friends') {
      return (
        <div className="my-sheet-menu">
          <button type="button" onClick={() => { setActivePanel(null); onNavigate('friend-add') }}><span><strong>친구 목록</strong><small>12명 · 새로운 친구 찾기</small></span><MyIcon kind="chevron" /></button>
          <button type="button"><span><strong>받은 친구 요청</strong><small>새 요청 없음</small></span><MyIcon kind="chevron" /></button>
          <button type="button"><span><strong>차단한 사용자</strong><small>1명</small></span><MyIcon kind="chevron" /></button>
        </div>
      )
    }

    if (activePanel === 'devices') {
      return (
        <div className="my-device-panel">
          <div className="my-account-id"><small>천투 ID</small><strong>@kimhj</strong><span>친구가 나를 찾을 때 사용하는 ID예요.</span></div>
          <div className="my-current-device"><span className="my-menu-icon"><MyIcon kind="devices" /></span><span><strong>Windows · 이 기기</strong><small>서울 · 지금 사용 중</small></span><b>현재</b></div>
          <p className="my-sheet-note">새 기기에서 로그인하면 여기에서 접속 상태를 확인하고 연결을 해제할 수 있어요.</p>
        </div>
      )
    }

    if (activePanel === 'visibility') {
      return (
        <div className="my-sheet-menu">
          <div><span><strong>프로필 공개</strong><small>대회 참가자와 친구에게 표시</small></span><MySettingSwitch checked={profileVisible} label="프로필 공개" onChange={() => setProfileVisible((current) => !current)} /></div>
          <div><span><strong>친구 요청 허용</strong><small>천투 ID를 통한 요청</small></span><MySettingSwitch checked={friendRequests} label="친구 요청 허용" onChange={() => setFriendRequests((current) => !current)} /></div>
          <div className="my-rule-card"><MyIcon kind="shield" /><span><strong>대회 활동은 게임 규칙이에요</strong><small>매매, 잔고·순위 확인 마일스톤은 같은 대회 참가자에게 표시되며 끌 수 없어요.</small></span></div>
        </div>
      )
    }

    return (
      <div className="my-sheet-menu">
        <button type="button"><span><strong>도움말 · 문의</strong><small>자주 묻는 질문과 문의하기</small></span><MyIcon kind="chevron" /></button>
        <button type="button"><span><strong>이용약관</strong><small>서비스 이용 정책</small></span><MyIcon kind="chevron" /></button>
        <button type="button"><span><strong>개인정보처리방침</strong><small>개인정보 보호 및 처리 안내</small></span><MyIcon kind="chevron" /></button>
        <p className="my-version">천투 MVP · 버전 0.1.0</p>
      </div>
    )
  }

  const menuItems: Array<{ key: MyPanelKey; icon: MyIconKind; label: string; detail: string }> = [
    { key: 'notifications', icon: 'bell', label: '알림', detail: '채팅·매매·대회' },
    { key: 'friends', icon: 'users', label: '친구 및 차단', detail: '친구 12명' },
    { key: 'devices', icon: 'devices', label: '계정과 기기', detail: '이 기기에서 접속 중' },
    { key: 'visibility', icon: 'eye', label: '게임 공개 범위', detail: '활동 공개 규칙' },
    { key: 'support', icon: 'help', label: '고객센터 · 약관', detail: '버전 0.1.0' },
  ]

  return (
    <main className="app-shell my-screen" data-name="my-screen">
      <div className="my-top-container">
        <StatusBar icons={friendsIcons} nodePrefix="2" />
        <header className="my-header"><h1>마이</h1></header>

        <section className="my-profile">
          <img src={investProfile} alt="김형진 프로필" width="66" height="66" />
          <span className="my-profile-copy"><strong>{profileName}</strong><small>개미 · 천투 ID @kimhj</small><p>{profileIntro}</p></span>
          <button type="button" className="my-profile-edit" aria-label="프로필 편집" onClick={openProfileEditor}><MyIcon kind="edit" /></button>
        </section>

        <section className="my-stats" aria-label="나의 대회 기록 요약">
          <div><strong>6</strong><span>참가</span></div>
          <div><strong>4</strong><span>완주</span></div>
          <div><strong>1</strong><span>우승</span></div>
        </section>

        <section className="my-section">
          <header><h2>최근 대회</h2><button type="button" onClick={() => setActivePanel('records')}>전체 기록</button></header>
          <div className="my-competition-list">
            {competitions.map((competition) => (
              <button type="button" key={competition.title} onClick={() => onOpenCompetition(competition.title)}>
                <img src={competition.image} alt="" width="42" height="42" />
                <span><strong>{competition.title}</strong><small>{competition.state} · {competition.rank}</small></span>
                <b className={competition.tone}>{competition.returnValue}</b>
              </button>
            ))}
          </div>
        </section>

        <section className="my-section my-settings-section">
          <header><h2>설정</h2></header>
          <div className="my-settings-list">
            {menuItems.map((item) => (
              <button type="button" key={item.key} onClick={() => setActivePanel(item.key)}>
                <span className="my-menu-icon"><MyIcon kind={item.icon} /></span>
                <span><strong>{item.label}</strong><small>{item.detail}</small></span>
                <MyIcon kind="chevron" />
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="feed-bottom">
        <BottomNav icons={friendsIcons} activeMode="friends" activeKey="my" onNavigate={onNavigate} />
        <HomeIndicator />
      </div>

      {activePanel && (
        <div className="my-sheet-layer">
          <button type="button" className="my-sheet-backdrop" aria-label={`${panelTitle[activePanel]} 닫기`} onClick={() => setActivePanel(null)} />
          <section className="my-sheet" role="dialog" aria-modal="true" aria-label={panelTitle[activePanel]}>
            <div className="my-sheet-grabber" aria-hidden="true" />
            <header><h2>{panelTitle[activePanel]}</h2><button type="button" aria-label="닫기" onClick={() => setActivePanel(null)}><MyIcon kind="close" /></button></header>
            <div className="my-sheet-content">{renderPanelContent()}</div>
          </section>
        </div>
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

function HomeFeed({ mode, onModeChange, cardVariant, onNavigate, onOpenInvestRoom, onOpenFriend, investRoomItems, friendItems }: {
  mode: FeedMode
  onModeChange: (mode: FeedMode) => void
  cardVariant: InvestCardVariant
  onNavigate: (screen: ScreenKey) => void
  onOpenInvestRoom: (room: (typeof investRooms)[number]) => void
  onOpenFriend: (friend: FriendProfile) => void
  investRoomItems: typeof investRooms
  friendItems: FriendProfile[]
}) {
  const icons = mode === 'invest' ? investIcons : friendsIcons
  const isFriends = mode === 'friends'
  const [searchQuery, setSearchQuery] = useState('')
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase()
  const visibleInvestRooms = investRoomItems.filter((room) => (
    !normalizedSearchQuery
    || `${room.title} ${room.scheduleLabel} ${room.leaderboard.join(' ')} ${room.holdings.map((holding) => holding.name).join(' ')}`.toLocaleLowerCase().includes(normalizedSearchQuery)
  ))
  const visibleFriends = friendItems.filter((friend) => (
    !normalizedSearchQuery
    || `${friend.name} ${friend.grade}`.toLocaleLowerCase().includes(normalizedSearchQuery)
  ))
  const visibleItemCount = isFriends ? visibleFriends.length : visibleInvestRooms.length

  return (
    <main className={`app-shell feed-shell ${isFriends ? 'friends-feed' : 'invest-feed'}`} data-name={isFriends ? 'home-feed-freinds' : 'home-feed-invest'}>
      <div className="feed-top-container">
        <StatusBar icons={icons} nodePrefix={isFriends ? '7' : '2'} />
        <FeedHeader
          icons={icons}
          nodePrefix={isFriends ? '7' : '2'}
          onQuickAction={(action) => {
            if (action === 'join') onNavigate('competition-join')
            if (action === 'friend') onNavigate('friend-add')
            if (action === 'lounge') onNavigate('lounge-create')
          }}
        />
        <TickerBelt nodePrefix={isFriends ? '7' : '2'} />
        <HeroBanner profile={isFriends ? friendsProfile : investProfile} nodePrefix={isFriends ? '7' : '2'} />

        <section className={`feed-section ${isFriends ? 'friends-section' : 'invest-section'}`}>
          <FeedTabs mode={mode} onChange={onModeChange} searchValue={searchQuery} onSearchChange={setSearchQuery} searchIcon={icons.search} />
          <div className="rooms-list">
            {isFriends
              ? visibleFriends.map((friend, index) => <FriendCard friend={friend} index={index} onOpen={() => onOpenFriend(friend)} key={friend.name} />)
              : visibleInvestRooms.map((room, index) => <InvestRoomCard room={room} index={index} variant={cardVariant} onOpen={() => onOpenInvestRoom(room)} key={`${room.title}-${index}`} />)}
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
  const [chatRoomItems, setChatRoomItems] = useState<ChatRoom[]>(chatRooms)
  const [investRoomItems, setInvestRoomItems] = useState(investRooms)
  const [friendItems] = useState<FriendProfile[]>(friends)
  const [requestedFriendIds, setRequestedFriendIds] = useState<string[]>([])
  const [activeRoomId, setActiveRoomId] = useState('ssangddi')
  const [roomTimelines, setRoomTimelines] = useState<Record<string, RoomTimelineItem[]>>({})
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>(initialOpenOrders)
  const [viewCounts, setViewCounts] = useState<Record<SocialViewKind, number>>({ balance: 0, ranking: 0 })
  const [competitionNotice, setCompetitionNotice] = useState('')
  const [utilityReturnScreen, setUtilityReturnScreen] = useState<ScreenKey>('home')
  const socialViewTrackerRef = useRef<Record<SocialViewKind, SocialViewTracker>>({
    balance: { count: 0, lastCountedAt: 0, dateKey: '' },
    ranking: { count: 0, lastCountedAt: 0, dateKey: '' },
  })
  const [screen, setScreen] = useState<ScreenKey>(() => {
    if (typeof window === 'undefined') return 'home'
    const params = new URLSearchParams(window.location.search)
    if (params.get('invite')) return 'competition-join'
    const requestedScreen = params.get('screen')
    if (requestedScreen === 'chat-list' || requestedScreen === 'chat-room' || requestedScreen === 'competition-join' || requestedScreen === 'lounge-create' || requestedScreen === 'friend-add' || requestedScreen === 'invest' || requestedScreen === 'my' || requestedScreen === 'splash') return requestedScreen
    return 'home'
  })

  useEffect(() => {
    if (!competitionNotice) return
    const timer = window.setTimeout(() => setCompetitionNotice(''), 4200)
    return () => window.clearTimeout(timer)
  }, [competitionNotice])

  const navigate = (nextScreen: ScreenKey) => {
    if (nextScreen === 'competition-join' || nextScreen === 'lounge-create' || nextScreen === 'friend-add') {
      setUtilityReturnScreen(screen === 'chat-list' ? 'chat-list' : 'home')
    }
    setScreen(nextScreen)
    const params = new URLSearchParams(window.location.search)
    if (nextScreen === 'home') params.delete('screen')
    else params.set('screen', nextScreen)
    if (nextScreen !== 'competition-join') params.delete('invite')
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

  const appendRoomTimeline = (roomId: string, item: RoomTimelineItem) => {
    setRoomTimelines((currentTimelines) => ({
      ...currentTimelines,
      [roomId]: [...(currentTimelines[roomId] ?? []), item],
    }))
  }

  const sendChatMessage = (message: string) => {
    appendRoomTimeline(activeRoomId, { id: crypto.randomUUID(), kind: 'message', text: message, sentAt: getCurrentChatTime() })
  }

  const addViewMilestone = (viewKind: SocialViewKind, count: number) => {
    appendRoomTimeline(activeRoomId, { id: crypto.randomUUID(), kind: 'view-event', viewKind, count, sentAt: getCurrentChatTime() })
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
    appendRoomTimeline(activeRoomId, { id: crypto.randomUUID(), kind: 'portfolio-share', sentAt: getCurrentChatTime() })
  }

  const updateOpenOrder = (orderId: string, update: OpenOrderUpdate) => {
    setOpenOrders((currentOrders) => currentOrders.map((order) => (
      order.id === orderId ? { ...order, ...update } : order
    )))
  }

  const cancelOpenOrder = (orderId: string) => {
    setOpenOrders((currentOrders) => currentOrders.filter((order) => order.id !== orderId))
  }

  const openChatRoom = (room: ChatRoom) => {
    setActiveRoomId(room.id)
    navigate('chat-room')
  }

  const openInvestFeedRoom = (feedRoom: (typeof investRooms)[number]) => {
    const existingRoom = chatRoomItems.find((room) => room.kind === 'group' && room.title === feedRoom.title)
    if (existingRoom) {
      openChatRoom(existingRoom)
      return
    }

    const createdRoom: ChatRoom = {
      id: `home-competition-${feedRoom.title}`,
      title: feedRoom.title,
      detail: feedRoom.rankStatus === '종료' ? '종료된 대회의 대화를 확인해보세요.' : '대회 채팅방에 입장했어요.',
      meta: '방금',
      count: getParticipantCount(feedRoom),
      unread: 0,
      muted: false,
      pinned: false,
      kind: 'group',
      isHost: false,
      competitionState: feedRoom.rankStatus === '종료' ? 'ended' : 'active',
      competitionMembership: feedRoom.rankStatus === '종료' ? 'none' : 'participant',
      competition: {
        id: `competition-${feedRoom.title}`,
        title: feedRoom.title,
        phase: feedRoom.rankStatus === '종료' ? 'ended' : 'active',
        initialCapital: 15_000_000,
        durationDays: 30,
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        joinDeadline: '2026-08-24',
        market: 'KOSPI · KOSDAQ',
        shortAllowed: true,
        feeBps: 20,
        taxBps: 0,
        participantCount: Math.min(Number(getParticipantCount(feedRoom)), MAX_COMPETITION_PARTICIPANTS),
        participantLimit: 10,
        mulliganLimit: 0,
      },
      image: feedRoom.image,
    }

    setChatRoomItems((currentRooms) => [createdRoom, ...currentRooms])
    openChatRoom(createdRoom)
  }

  const openFriendFeedRoom = (friend: FriendProfile) => {
    const existingRoom = chatRoomItems.find((room) => room.kind === 'personal' && (room.id === friend.id || room.title === friend.name))
    if (existingRoom) {
      openChatRoom(existingRoom)
      return
    }

    const createdRoom: ChatRoom = {
      id: friend.id,
      title: friend.name,
      detail: '새 대화를 시작해보세요.',
      meta: '방금',
      count: '',
      unread: 0,
      muted: false,
      pinned: false,
      kind: 'personal',
      image: friendsRoom,
    }

    setChatRoomItems((currentRooms) => [createdRoom, ...currentRooms])
    openChatRoom(createdRoom)
  }

  const createLounge = ({ title, description }: { title: string; description: string }) => {
    const roomId = `lounge-${crypto.randomUUID()}`
    const createdRoom: ChatRoom = {
      id: roomId,
      title,
      detail: description || '김형진님이 라운지를 만들었어요',
      meta: '방금',
      count: '1',
      unread: 0,
      muted: false,
      pinned: false,
      kind: 'group',
      isHost: true,
      competitionState: 'chat-only',
      competitionMembership: 'none',
      image: friendsRoom,
    }

    setChatRoomItems((currentRooms) => [createdRoom, ...currentRooms])
    setRoomTimelines((currentTimelines) => ({
      ...currentTimelines,
      [roomId]: [{ id: crypto.randomUUID(), kind: 'lounge-create-event', sentAt: getCurrentChatTime() }],
    }))
    setActiveRoomId(roomId)
    navigate('chat-room')
  }

  const joinCompetition = (invite: CompetitionInvite) => {
    const roomId = `invite-${invite.code.toLocaleLowerCase()}`
    const existingRoom = chatRoomItems.find((room) => room.id === roomId)
    if (existingRoom) {
      openChatRoom(existingRoom)
      return
    }

    const joinedMemberCount = invite.participantCount + 1
    const inviteCompetition: LoungeCompetition | undefined = invite.competitionState === 'active' && invite.startDate && invite.endDate
      ? {
          id: `competition-${invite.code.toLocaleLowerCase()}`,
          title: invite.title,
          phase: 'active',
          initialCapital: invite.initialCapital,
          durationDays: Math.max(7, Math.round((new Date(`${invite.endDate}T00:00:00+09:00`).getTime() - new Date(`${invite.startDate}T00:00:00+09:00`).getTime()) / 86_400_000) + 1),
          startDate: invite.startDate,
          endDate: invite.endDate,
          joinDeadline: addCalendarDays(invite.endDate, -7),
          market: 'KOSPI · KOSDAQ',
          shortAllowed: invite.shortAllowed,
          feeBps: 20,
          taxBps: 0,
          participantCount: invite.competitionParticipantCount ?? 1,
          participantLimit: 10,
          mulliganLimit: invite.mulliganLimit ?? 0,
        }
      : undefined
    const joinedRoom: ChatRoom = {
      id: roomId,
      title: invite.title,
      detail: '김형진님이 라운지에 참가했어요',
      meta: '방금',
      count: String(joinedMemberCount),
      unread: 0,
      muted: false,
      pinned: false,
      kind: 'group',
      isHost: false,
      competitionState: invite.competitionState,
      competition: inviteCompetition,
      competitionMembership: invite.competitionState === 'active' ? 'eligible' : 'none',
      recentHistory: invite.recentHistory,
      image: invite.image,
    }

    setChatRoomItems((currentRooms) => [joinedRoom, ...currentRooms])
    setRoomTimelines((currentTimelines) => ({
      ...currentTimelines,
      [roomId]: [{
        id: crypto.randomUUID(),
        kind: 'join-event',
        roomKind: '라운지',
        sentAt: getCurrentChatTime(),
      }],
    }))

    setActiveRoomId(roomId)
    setCompetitionNotice(invite.competitionState === 'active' ? '라운지에 가입했어요. 대회 규칙을 확인하고 참여를 선택해 주세요.' : '라운지에 가입했어요.')
    navigate('chat-room')
  }

  const addCompetitionHomeCard = (room: ChatRoom, competition: LoungeCompetition, rankStatus: string) => {
    const participantCount = competition.participantCount
    setInvestRoomItems((currentRooms) => currentRooms.some((item) => item.title === competition.title) ? currentRooms : [
      {
        title: competition.title,
        rank: `#${participantCount} / ${participantCount}`,
        returnValue: '0.0%',
        returnTone: 'positive',
        scheduleLabel: `진행 중 · ${formatCompetitionDate(competition.endDate)} 종료`,
        rankStatus,
        image: room.image,
        leaderboard: ['1위 박민수 +12.8%', '2위 이서연 +8.1%', `${participantCount}위 김형진 0.0%`],
        holdings: [{ name: '현금', weight: '100%' }],
      },
      ...currentRooms,
    ])
  }

  const createRoomCompetition = (draft: CompetitionDraft) => {
    const room = chatRoomItems.find((item) => item.id === activeRoomId)
    if (!room || !room.isHost || room.kind !== 'group') return
    const competition = createCompetitionFromDraft(room.title, draft)
    const eventType = competition.phase === 'active' ? 'started' : 'scheduled'
    const detail = competition.phase === 'active'
      ? `${formatCompetitionDate(competition.endDate)}까지 진행하며 모든 날짜 경계는 00:00 KST예요.`
      : `${formatCompetitionBoundary(competition.startDate)} 시작으로 예약됐어요.`

    setChatRoomItems((currentRooms) => currentRooms.map((item) => item.id === activeRoomId ? {
      ...item,
      competition,
      competitionState: competition.phase,
      competitionMembership: 'participant',
      mulligansUsed: 0,
      accountReset: false,
      detail: competition.phase === 'active' ? `${competition.title} 대회가 시작됐어요` : `${competition.title} 대회가 예약됐어요`,
      meta: '방금',
    } : item))
    appendRoomTimeline(activeRoomId, { id: crypto.randomUUID(), kind: 'competition-event', eventType, title: competition.title, detail, sentAt: getCurrentChatTime() })
    setCompetitionNotice(competition.phase === 'active' ? '대회가 시작됐어요. 음소거와 관계없이 모든 멤버에게 시작 알림을 보냅니다.' : '대회가 예약됐어요. 라운지 알림 설정에 따라 예약 알림을 보냅니다.')
    if (competition.phase === 'active') addCompetitionHomeCard(room, competition, '방장 · 참가 중')
  }

  const cancelRoomCompetitionSchedule = () => {
    const room = chatRoomItems.find((item) => item.id === activeRoomId)
    if (!room?.competition || room.competition.phase !== 'scheduled' || !room.isHost) return
    const competitionTitle = room.competition.title
    setChatRoomItems((currentRooms) => currentRooms.map((item) => item.id === activeRoomId ? {
      ...item,
      competition: undefined,
      competitionState: 'chat-only',
      competitionMembership: 'none',
      detail: `${competitionTitle} 예약이 취소됐어요`,
      meta: '방금',
    } : item))
    appendRoomTimeline(activeRoomId, { id: crypto.randomUUID(), kind: 'competition-event', eventType: 'cancelled', title: competitionTitle, detail: '방장이 대회 예약을 취소했어요. 새 규칙으로 다시 설정할 수 있습니다.', sentAt: getCurrentChatTime() })
    setCompetitionNotice('대회 예약이 취소됐어요. 라운지 알림 설정에 따라 취소 알림을 보냅니다.')
  }

  const stopRoomCompetition = () => {
    const room = chatRoomItems.find((item) => item.id === activeRoomId)
    if (!room?.competition || room.competition.phase !== 'active' || !room.isHost) return
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const rankedStop = hasCompetitionReachedRankedDuration(room.competition)
    const endPhase = rankedStop ? 'ended' : 'invalidated'
    const endedCompetition: LoungeCompetition = { ...room.competition, phase: endPhase, endDate: today }
    setChatRoomItems((currentRooms) => currentRooms.map((item) => item.id === activeRoomId ? {
      ...item,
      competition: endedCompetition,
      competitionState: endPhase,
      competitionMembership: 'none',
      detail: rankedStop ? `${endedCompetition.title} 대회가 중도 종료됐어요` : `${endedCompetition.title} 대회가 무효 종료됐어요`,
      meta: '방금',
    } : item))
    setInvestRoomItems((currentRooms) => currentRooms.filter((item) => item.title !== endedCompetition.title))
    appendRoomTimeline(activeRoomId, { id: crypto.randomUUID(), kind: 'competition-event', eventType: rankedStop ? 'ended' : 'invalidated', title: endedCompetition.title, detail: rankedStop ? '주최자가 대회를 중간 종료했습니다. 종료 시점의 NAV로 최종 순위를 확정해요.' : '주최자가 대회를 중간 종료했습니다. 시작 후 7일 전이라 무효이며 최종 순위가 없습니다.', sentAt: getCurrentChatTime() })
    setCompetitionNotice(rankedStop ? '대회가 즉시 종료됐어요. NAV 순위를 확정하고 음소거와 관계없이 알립니다.' : '대회가 즉시 무효 종료됐어요. 순위는 만들지 않고 모든 멤버에게 알립니다.')
  }

  const participateRoomCompetition = () => {
    const room = chatRoomItems.find((item) => item.id === activeRoomId)
    if (!room?.competition || room.competition.phase !== 'active' || room.competitionMembership !== 'eligible' || !isCompetitionJoinOpen(room.competition)) return
    const joinedCompetition: LoungeCompetition = { ...room.competition, participantCount: room.competition.participantCount + 1 }
    setChatRoomItems((currentRooms) => currentRooms.map((item) => item.id === activeRoomId ? {
      ...item,
      competition: joinedCompetition,
      competitionMembership: 'participant',
      mulligansUsed: 0,
      accountReset: false,
      detail: '김형진님이 대회에 참여했어요',
      meta: '방금',
    } : item))
    appendRoomTimeline(activeRoomId, { id: crypto.randomUUID(), kind: 'join-event', roomKind: '대회', sentAt: getCurrentChatTime() })
    addCompetitionHomeCard(room, joinedCompetition, '방금 참가')
    setCompetitionNotice(`${room.competition.initialCapital.toLocaleString('ko-KR')}원의 초기자본으로 대회에 참여했어요.`)
  }

  const useRoomCompetitionMulligan = () => {
    const room = chatRoomItems.find((item) => item.id === activeRoomId)
    if (!room?.competition || room.competition.phase !== 'active' || room.competitionMembership !== 'participant') return
    const usedCount = room.mulligansUsed ?? 0
    if (usedCount >= room.competition.mulliganLimit) return

    setChatRoomItems((currentRooms) => currentRooms.map((item) => item.id === activeRoomId ? {
      ...item,
      mulligansUsed: usedCount + 1,
      accountReset: true,
      detail: '멀리건으로 내 계좌를 초기화했어요',
      meta: '방금',
    } : item))
    setOpenOrders([])
    setCompetitionNotice(`멀리건을 사용했어요. 총자산 ${room.competition.initialCapital.toLocaleString('ko-KR')}원 · 손익 0원 · 수익률 0.0%로 초기화했습니다.`)
  }

  const forfeitRoomCompetition = (room: ChatRoom, successorName?: string) => {
    if (!room.competition || room.competitionMembership !== 'participant') return
    if (room.isHost && !successorName) return
    setChatRoomItems((currentRooms) => currentRooms.map((item) => item.id === room.id ? {
      ...item,
      isHost: room.isHost ? false : item.isHost,
      competitionMembership: 'forfeited',
      detail: '대회를 포기하고 관망 중이에요',
      meta: '방금',
    } : item))
    setInvestRoomItems((currentRooms) => currentRooms.filter((item) => item.title !== room.competition?.title))
    if (successorName) appendRoomTimeline(room.id, { id: crypto.randomUUID(), kind: 'competition-event', eventType: 'host-transferred', title: room.title, detail: `김형진님이 ${successorName}님에게 방장을 위임했어요.`, sentAt: getCurrentChatTime() })
    appendRoomTimeline(room.id, { id: crypto.randomUUID(), kind: 'competition-event', eventType: 'forfeited', title: room.competition.title, detail: '김형진님이 대회를 포기하고 관망으로 전환했어요. 모든 포기자는 공동 꼴등입니다.', sentAt: getCurrentChatTime() })
    setCompetitionNotice(successorName ? `${successorName}님에게 방장을 넘기고 대회를 포기했어요.` : '대회를 포기했어요. 모든 포기자와 공동 꼴등으로 라운지에 남습니다.')
  }

  const activeRoom = chatRoomItems.find((room) => room.id === activeRoomId) ?? chatRoomItems[0]

  const openMyCompetition = (title: string) => {
    const room = chatRoomItems.find((item) => item.kind === 'group' && item.title === title)
    if (room) openChatRoom(room)
    else navigate('chat-list')
  }

  if (screen === 'competition-join') {
    const initialCode = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('invite') ?? ''
    return <CompetitionJoinScreen initialCode={initialCode} onBack={() => navigate(utilityReturnScreen)} onJoin={joinCompetition} />
  }
  if (screen === 'lounge-create') {
    return <LoungeCreateScreen onBack={() => navigate(utilityReturnScreen)} onCreate={createLounge} />
  }
  if (screen === 'friend-add') {
    return (
      <FriendAddScreen
        onBack={() => navigate('home')}
        requestedFriendIds={requestedFriendIds}
        onRequestFriend={(profile) => setRequestedFriendIds((currentIds) => currentIds.includes(profile.id) ? currentIds : [...currentIds, profile.id])}
      />
    )
  }
  if (screen === 'chat-list') {
    return (
      <ChatListScreen
        onNavigate={navigate}
        rooms={chatRoomItems}
        onRoomsChange={(updater) => setChatRoomItems(updater)}
        onOpenRoom={openChatRoom}
        onForfeitRoom={forfeitRoomCompetition}
      />
    )
  }
  if (screen === 'chat-room') {
    return (
      <ChatRoomScreen
        onNavigate={navigate}
        room={activeRoom}
        roomTimeline={roomTimelines[activeRoom.id] ?? []}
        viewCounts={viewCounts}
        onSendMessage={sendChatMessage}
        onRecordSocialView={recordSocialView}
        onSharePortfolio={sharePortfolio}
        openOrders={openOrders}
        onUpdateOpenOrder={updateOpenOrder}
        onCancelOpenOrder={cancelOpenOrder}
        onCreateCompetition={createRoomCompetition}
        onCancelCompetitionSchedule={cancelRoomCompetitionSchedule}
        onStopCompetition={stopRoomCompetition}
        onParticipateCompetition={participateRoomCompetition}
        onUseMulligan={useRoomCompetitionMulligan}
        competitionNotice={competitionNotice}
      />
    )
  }
  if (screen === 'my') return <MyScreen onNavigate={navigate} onOpenCompetition={openMyCompetition} />
  if (screen === 'invest') return <InvestmentScreen onNavigate={navigate} />
  if (screen === 'splash') return <SplashScreen />
  return (
    <HomeFeed
      mode={mode}
      onModeChange={setMode}
      cardVariant={getInvestCardVariant()}
      onNavigate={navigate}
      onOpenInvestRoom={openInvestFeedRoom}
      onOpenFriend={openFriendFeedRoom}
      investRoomItems={investRoomItems}
      friendItems={friendItems}
    />
  )
}
