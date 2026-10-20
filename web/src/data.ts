export interface Named { name: string; seconds: number; color?: string }
export interface Day { date: string; seconds: number; segments: Named[] }

export interface Wrapped {
  start: string
  end: string
  generatedAt: string
  name: string
  timeError?: string
  time?: {
    seconds: number
    categories: Named[]
    subcategories: Named[]
    days: Day[]
    hours: number[]
    busiestDay: string
    apps: Named[]
    switches: number
    longestFocus: { seconds: number; start: string }
  }
  anime?: {
    episodes: number
    seconds: number
    shows: Array<{ title: string; episodes: number; seconds: number; cover?: string; color?: string }>
  }
  reading?: Array<{ title: string; seconds: number }>
  code: {
    commits: number
    added: number
    removed: number
    repos: Array<{ name: string; commits: number }>
    hours: number[]
    latest: string
  }
  agents: {
    sessions?: number
    subagents?: number
    tokens?: number
    models?: Array<{ name: string; tokens: number }>
    projects?: Array<{ name: string; sessions: number }>
  }
}

declare global {
  interface Window { WRAPPED?: Wrapped }
}

export const data: Wrapped | undefined = window.WRAPPED

export function hours(seconds: number, digits = 1): string {
  const h = seconds / 3600
  return h >= 10 ? Math.round(h).toString() : h.toFixed(digits)
}

export function duration(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export function compact(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e8 ? 0 : 1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + 'K'
  return String(n)
}

export function weekday(date: string, long = false): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: long ? 'long' : 'short' })
}

export function clock(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()
}

export function range(start: string, end: string): string {
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase()
  const last = new Date(new Date(end).getTime() - 1)
  return `${fmt(new Date(start))} – ${fmt(last)}`
}

export function modelName(id: string): string {
  return id
    .replace(/^claude-/, '')
    .replace(/^(opus|sonnet|haiku|fable)-(\d+)-(\d+)$/, (_, n, a, b) => `${n} ${a}.${b}`)
    .replace(/^(opus|sonnet|haiku|fable)-(\d+)$/, (_, n, a) => `${n} ${a}`)
    .replace(/-/g, ' ')
}
