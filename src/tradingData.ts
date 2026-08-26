export type Instrument = {
  name: string
  code: string
  price: number
  change: number
  longQuantity?: number
  shortQuantity?: number
}

export const ORDERABLE_CASH = 8_420_000
export const INITIAL_ASSET = 15_000_000

export const instruments: Instrument[] = [
  { name: '삼성전자', code: '005930', price: 71_300, change: 2.1, longQuantity: 42 },
  { name: 'SK하이닉스', code: '000660', price: 188_200, change: 1.4, longQuantity: 18 },
  { name: '에코프로', code: '086520', price: 92_500, change: -1.1, shortQuantity: 12 },
  { name: '현대차', code: '005380', price: 242_000, change: -0.3, longQuantity: 8 },
  { name: '카카오', code: '035720', price: 43_600, change: 0.8, shortQuantity: 20 },
  { name: 'NAVER', code: '035420', price: 214_500, change: 0.4, longQuantity: 11 },
  { name: 'LG에너지솔루션', code: '373220', price: 381_000, change: -0.7, longQuantity: 5 },
  { name: 'POSCO홀딩스', code: '005490', price: 348_500, change: -0.5, shortQuantity: 6 },
]

export const LONG_MARKET_VALUE = instruments.reduce(
  (total, instrument) => total + instrument.price * (instrument.longQuantity ?? 0),
  0,
)

export const SHORT_MARKET_VALUE = instruments.reduce(
  (total, instrument) => total + instrument.price * (instrument.shortQuantity ?? 0),
  0,
)

export const TOTAL_ASSET = ORDERABLE_CASH + LONG_MARKET_VALUE - SHORT_MARKET_VALUE
export const TOTAL_RETURN = ((TOTAL_ASSET - INITIAL_ASSET) / INITIAL_ASSET) * 100
export const CURRENT_RANK = 3

export function formatWon(value: number) {
  return `${Math.max(0, Math.round(value)).toLocaleString('ko-KR')}원`
}

export function formatReturn(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}
