import { useMemo, useState, type ReactNode } from 'react'

export type CompetitionPhase = 'scheduled' | 'active' | 'ended' | 'invalidated'
export type CompetitionMembership = 'none' | 'eligible' | 'participant' | 'forfeited'

export type LoungeCompetition = {
  id: string
  title: string
  phase: CompetitionPhase
  initialCapital: number
  durationDays: number
  startDate: string
  endDate: string
  joinDeadline: string
  market: 'KOSPI · KOSDAQ'
  shortAllowed: boolean
  feeBps: 20
  taxBps: 0
  participantCount: number
  participantLimit: 10
}

export type CompetitionDraft = {
  title: string
  initialCapital: number
  durationDays: number
  startMode: 'immediate' | 'scheduled'
  scheduledDate: string
  shortAllowed: boolean
}

const MIN_INITIAL_CAPITAL = 1_000_000
const MAX_INITIAL_CAPITAL = 1_000_000_000_000
const MIN_DURATION_DAYS = 7
const MAX_DURATION_DAYS = 365 * 3
export const MAX_COMPETITION_PARTICIPANTS = 10
export const MAX_COMPETITION_TITLE_LENGTH = 10

function getKstParts(now: Date) {
  const values = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) => values.find((item) => item.type === type)?.value ?? ''
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    hour: Number(part('hour')),
    minute: Number(part('minute')),
  }
}

function parseDate(date: string) {
  return new Date(`${date}T00:00:00+09:00`)
}

export function addCalendarDays(date: string, days: number) {
  const nextDate = parseDate(date)
  nextDate.setUTCDate(nextDate.getUTCDate() + days)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(nextDate)
}

function getNextWeekday(date: string) {
  let nextDate = date
  do {
    nextDate = addCalendarDays(nextDate, 1)
  } while ([0, 6].includes(parseDate(nextDate).getDay()))
  return nextDate
}

function isWeekend(date: string) {
  return [0, 6].includes(parseDate(date).getDay())
}

export function formatCompetitionDate(date: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(parseDate(date))
}

export function formatCompetitionBoundary(date: string) {
  return `${formatCompetitionDate(date)} 00:00 KST`
}

export function limitCompetitionTitle(value: string) {
  return Array.from(value).slice(0, MAX_COMPETITION_TITLE_LENGTH).join('')
}

export function getCompetitionRemainingDays(endDate: string, now = new Date()) {
  const today = getKstParts(now).date
  return Math.max(0, Math.round((parseDate(endDate).getTime() - parseDate(today).getTime()) / 86_400_000))
}

export function createCompetitionFromDraft(draft: CompetitionDraft, now = new Date()): LoungeCompetition {
  const current = getKstParts(now)
  const currentMinutes = current.hour * 60 + current.minute
  const marketCloseMinutes = 15 * 60 + 30
  let startDate = draft.startMode === 'scheduled' ? draft.scheduledDate : current.date

  if (startDate <= current.date) {
    if (isWeekend(current.date) || currentMinutes >= marketCloseMinutes) startDate = getNextWeekday(current.date)
    else startDate = current.date
  }

  const startsToday = startDate === current.date && !isWeekend(startDate)
  const phase: CompetitionPhase = draft.startMode === 'immediate' && startsToday ? 'active' : 'scheduled'
  const endDate = addCalendarDays(startDate, draft.durationDays - 1)

  return {
    id: crypto.randomUUID(),
    title: draft.title.trim(),
    phase,
    initialCapital: draft.initialCapital,
    durationDays: draft.durationDays,
    startDate,
    endDate,
    joinDeadline: addCalendarDays(endDate, -7),
    market: 'KOSPI · KOSDAQ',
    shortAllowed: draft.shortAllowed,
    feeBps: 20,
    taxBps: 0,
    participantCount: 1,
    participantLimit: MAX_COMPETITION_PARTICIPANTS,
  }
}

export function isCompetitionJoinOpen(competition: LoungeCompetition, now = new Date()) {
  return competition.phase === 'active'
    && getKstParts(now).date < competition.joinDeadline
    && competition.participantCount < competition.participantLimit
}

export function hasCompetitionReachedRankedDuration(competition: LoungeCompetition, now = new Date()) {
  if (competition.phase !== 'active') return false
  return getKstParts(now).date >= addCalendarDays(competition.startDate, 7)
}

export function isCompetitionAtCapacity(competition: LoungeCompetition) {
  return competition.participantCount >= competition.participantLimit
}

export function CompetitionTrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 4h8v4.5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 6H5v1.5A3.5 3.5 0 0 0 8.5 11M16 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 12.5V16M8.5 20h7M10 16h4v4h-4z" />
    </svg>
  )
}

function CompetitionRuleSummary({ competition }: { competition: LoungeCompetition }) {
  return (
    <dl className="competition-rule-summary">
      <div><dt>초기자본</dt><dd>{competition.initialCapital.toLocaleString('ko-KR')}원</dd></div>
      <div><dt>기간</dt><dd>{formatCompetitionDate(competition.startDate)} – {formatCompetitionDate(competition.endDate)}</dd></div>
      <div><dt>참가 마감</dt><dd>{formatCompetitionBoundary(competition.joinDeadline)}</dd></div>
      <div><dt>참가 정원</dt><dd>{competition.participantCount}/{competition.participantLimit}명 · 방장 포함</dd></div>
      <div><dt>거래시장</dt><dd>{competition.market}</dd></div>
      <div><dt>공매도</dt><dd>{competition.shortAllowed ? '허용' : '미허용'}</dd></div>
      <div><dt>비용</dt><dd>매도·공매도 0.20% · 세금 없음</dd></div>
    </dl>
  )
}

function LifecycleSheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="competition-lifecycle-layer">
      <button type="button" className="competition-lifecycle-backdrop" aria-label={`${label} 닫기`} onClick={onClose} />
      <section className="competition-lifecycle-sheet" role="dialog" aria-modal="true" aria-label={label}>
        <div className="competition-lifecycle-grabber" aria-hidden="true" />
        {children}
      </section>
    </div>
  )
}

export function CompetitionHostSheet({ loungeTitle, competition, onClose, onCreate, onCancelSchedule, onStop }: {
  loungeTitle: string
  competition?: LoungeCompetition
  onClose: () => void
  onCreate: (draft: CompetitionDraft) => void
  onCancelSchedule: () => void
  onStop: () => void
}) {
  const today = getKstParts(new Date()).date
  const firstReservableDate = addCalendarDays(today, 1)
  const [isCreatingNext, setIsCreatingNext] = useState(false)
  const [title, setTitle] = useState(limitCompetitionTitle(`${loungeTitle} 대회`))
  const [initialCapital, setInitialCapital] = useState(10_000_000)
  const [durationDays, setDurationDays] = useState(30)
  const [startMode, setStartMode] = useState<'immediate' | 'scheduled'>('immediate')
  const [scheduledDate, setScheduledDate] = useState(firstReservableDate)
  const [shortAllowed, setShortAllowed] = useState(true)
  const [submitError, setSubmitError] = useState('')
  const shouldShowForm = !competition || ((competition.phase === 'ended' || competition.phase === 'invalidated') && isCreatingNext)
  const rankedStop = competition ? hasCompetitionReachedRankedDuration(competition) : false
  const titleLength = Array.from(title).length

  const submitCompetition = () => {
    if (!title.trim()) return setSubmitError('대회 이름을 입력해 주세요.')
    if (titleLength > MAX_COMPETITION_TITLE_LENGTH) return setSubmitError('대회 이름은 10자 이내로 입력해 주세요.')
    if (initialCapital < MIN_INITIAL_CAPITAL || initialCapital > MAX_INITIAL_CAPITAL) return setSubmitError('초기자본은 100만원부터 1조원까지 설정할 수 있어요.')
    if (durationDays < MIN_DURATION_DAYS || durationDays > MAX_DURATION_DAYS) return setSubmitError('기간은 7일부터 3년까지 설정할 수 있어요.')
    if (startMode === 'scheduled' && scheduledDate <= today) return setSubmitError('내일 이후의 예약일을 선택해 주세요.')
    onCreate({ title, initialCapital, durationDays, startMode, scheduledDate, shortAllowed })
  }

  if (!shouldShowForm && competition) {
    return (
      <LifecycleSheet label="대회 관리" onClose={onClose}>
        <header className="competition-lifecycle-header">
          <span className={`competition-phase-badge is-${competition.phase}`}>{competition.phase === 'scheduled' ? '예약' : competition.phase === 'active' ? '진행 중' : competition.phase === 'invalidated' ? '무효' : '종료'}</span>
          <button type="button" aria-label="대회 관리 닫기" onClick={onClose}>×</button>
        </header>
        <div className="competition-lifecycle-scroll">
          <section className="competition-manage-hero">
            <span>방장 전용</span>
            <h2>{competition.title}</h2>
            <p>{competition.phase === 'scheduled' ? '규칙이 잠겼고 시작을 기다리고 있어요.' : competition.phase === 'active' ? '대회가 진행 중이며 규칙은 변경할 수 없어요.' : competition.phase === 'invalidated' ? '7일 전에 종료되어 최종 순위가 없는 대회예요.' : '최종 NAV와 순위가 확정된 대회예요.'}</p>
          </section>
          <CompetitionRuleSummary competition={competition} />
          {competition.phase === 'scheduled' && (
            <section className="competition-lock-note"><strong>예약 후에는 수정할 수 없어요</strong><span>규칙을 바꾸려면 예약을 취소하고 다시 설정해야 합니다.</span></section>
          )}
          {competition.phase === 'active' && !rankedStop && (
            <section className="competition-lock-note is-invalid-warning"><strong>지금 종료하면 대회가 무효예요</strong><span>{formatCompetitionBoundary(addCalendarDays(competition.startDate, 7))} 전에는 즉시 종료할 수 있지만 순위를 만들지 않습니다.</span></section>
          )}
          {competition.phase === 'active' && rankedStop && (
            <section className="competition-lock-note"><strong>순위가 있는 즉시 종료</strong><span>지금 종료하면 현재 NAV를 기준으로 최종 순위를 확정합니다.</span></section>
          )}
        </div>
        <footer className="competition-lifecycle-footer">
          {competition.phase === 'scheduled' && <button type="button" className="is-danger" onClick={onCancelSchedule}>예약 취소</button>}
          {competition.phase === 'active' && <button type="button" className="is-danger" onClick={onStop}>{rankedStop ? '현재 NAV로 즉시 종료' : '순위 없이 무효 종료'}</button>}
          {(competition.phase === 'ended' || competition.phase === 'invalidated') && <button type="button" className="is-primary" onClick={() => setIsCreatingNext(true)}>다음 대회 설정</button>}
        </footer>
      </LifecycleSheet>
    )
  }

  return (
    <LifecycleSheet label="대회 주최하기" onClose={onClose}>
      <header className="competition-lifecycle-header">
        <span className="competition-phase-badge is-host">방장 주최</span>
        <button type="button" aria-label="대회 설정 닫기" onClick={onClose}>×</button>
      </header>
      <div className="competition-lifecycle-scroll">
        <section className="competition-manage-hero">
          <span>{loungeTitle}</span>
          <h2>라운지 안에서 새 대회를 열어요</h2>
          <p>한 번 확정한 규칙은 종료 전까지 바꿀 수 없습니다.</p>
        </section>

        <label className="competition-form-field">
          <span><strong>대회 이름</strong><small>{titleLength}/10</small></span>
          <input value={title} maxLength={20} onChange={(event) => { setTitle(limitCompetitionTitle(event.target.value)); setSubmitError('') }} />
        </label>

        <label className="competition-form-field">
          <span><strong>초기자본</strong><small>100만원 – 1조원</small></span>
          <div className="competition-money-input"><input type="number" min={MIN_INITIAL_CAPITAL} max={MAX_INITIAL_CAPITAL} step={1_000_000} value={initialCapital} onChange={(event) => { setInitialCapital(Number(event.target.value)); setSubmitError('') }} /><b>원</b></div>
        </label>
        <div className="competition-capital-presets">
          {[1_000_000, 10_000_000, 100_000_000, 1_000_000_000].map((amount) => <button type="button" className={initialCapital === amount ? 'is-selected' : ''} onClick={() => setInitialCapital(amount)} key={amount}>{amount >= 100_000_000 ? `${amount / 100_000_000}억` : `${amount / 10_000}만`}</button>)}
        </div>

        <label className="competition-form-field">
          <span><strong>대회 기간</strong><small>7일 – 3년</small></span>
          <div className="competition-money-input"><input type="number" min={MIN_DURATION_DAYS} max={MAX_DURATION_DAYS} value={durationDays} onChange={(event) => { setDurationDays(Number(event.target.value)); setSubmitError('') }} /><b>일</b></div>
        </label>

        <fieldset className="competition-form-field">
          <legend><strong>시작</strong><small>KST 00:00 기준</small></legend>
          <div className="competition-start-options">
            <button type="button" className={startMode === 'immediate' ? 'is-selected' : ''} onClick={() => setStartMode('immediate')}><strong>가능한 즉시</strong><small>장전·장중은 오늘, 장후는 다음 거래일</small></button>
            <button type="button" className={startMode === 'scheduled' ? 'is-selected' : ''} onClick={() => setStartMode('scheduled')}><strong>날짜 예약</strong><small>선택일 00:00 시작</small></button>
          </div>
          {startMode === 'scheduled' && <input className="competition-date-input" type="date" min={firstReservableDate} value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} />}
        </fieldset>

        <section className="competition-fixed-market">
          <span><strong>거래시장</strong><small>MVP 고정</small></span>
          <b>KOSPI · KOSDAQ 정규장</b>
          <p>거래소 상장 종목 전체 · ETF·리츠 포함. Pre·After·동시호가·NXT는 서버 검증 후 확정합니다.</p>
        </section>

        <section className="competition-fixed-market">
          <span><strong>참가 정원</strong><small>MVP 고정</small></span>
          <b>방장 포함 최대 10명</b>
          <p>방장은 시작과 함께 반드시 참가하며 예약 중 사전 참가는 받지 않습니다.</p>
        </section>

        <label className="competition-short-toggle">
          <span><strong>공매도 허용</strong><small>매도·공매도 수수료 0.20% · 세금 없음</small></span>
          <input type="checkbox" checked={shortAllowed} onChange={() => setShortAllowed((current) => !current)} />
          <i aria-hidden="true" />
        </label>

        <section className="competition-lock-note"><strong>규칙은 대회가 끝날 때까지 잠겨요</strong><span>예약 상태에서도 수정할 수 없고 취소 후 다시 설정해야 합니다.</span></section>
        {submitError && <p className="competition-form-error" role="alert">{submitError}</p>}
      </div>
      <footer className="competition-lifecycle-footer"><button type="button" className="is-primary" onClick={submitCompetition}>규칙 확정하고 {startMode === 'scheduled' ? '예약' : '주최'}</button></footer>
    </LifecycleSheet>
  )
}

export function CompetitionParticipationSheet({ competition, onClose, onParticipate }: {
  competition: LoungeCompetition
  onClose: () => void
  onParticipate: () => void
}) {
  const joinOpen = useMemo(() => isCompetitionJoinOpen(competition), [competition])
  const atCapacity = useMemo(() => isCompetitionAtCapacity(competition), [competition])
  const closedTitle = atCapacity ? '참가 정원 10명이 모두 찼어요' : '이 대회의 참가 신청이 마감됐어요'
  const closedButton = atCapacity ? '정원 마감' : '참가 마감'

  return (
    <LifecycleSheet label="대회 참여하기" onClose={onClose}>
      <header className="competition-lifecycle-header">
        <span className="competition-phase-badge is-active">참가 선택</span>
        <button type="button" aria-label="대회 참여 닫기" onClick={onClose}>×</button>
      </header>
      <div className="competition-lifecycle-scroll">
        <section className="competition-manage-hero">
          <span>라운지 가입 완료</span>
          <h2>{competition.title}</h2>
          <p>참여하기를 눌러야 계좌와 초기자본이 만들어집니다.</p>
        </section>
        <CompetitionRuleSummary competition={competition} />
        <section className={`competition-join-window ${joinOpen ? '' : 'is-closed'}`}>
          <strong>{joinOpen ? `${formatCompetitionBoundary(competition.joinDeadline)} 전까지 참여할 수 있어요` : closedTitle}</strong>
          <span>{joinOpen ? '참가 후에는 홈에 대회 카드와 계좌 HUD가 표시됩니다.' : '라운지 채팅과 대회 관망은 계속할 수 있습니다.'}</span>
        </section>
      </div>
      <footer className="competition-lifecycle-footer"><button type="button" className="is-primary" disabled={!joinOpen} onClick={onParticipate}>{joinOpen ? '초기자본 받고 참여하기' : closedButton}</button></footer>
    </LifecycleSheet>
  )
}
