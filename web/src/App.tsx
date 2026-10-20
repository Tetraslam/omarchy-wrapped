import { Dithering, GrainGradient, ImageDithering } from '@paper-design/shaders-react'
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { DotNumber } from './components/DotNumber'
import { DotmSquare3 } from './components/ui/dotm-square-3'
import { compact, clock, data, duration, hours, modelName, range, weekday, type Wrapped } from './data'

const PALETTE = ['#d46a7a', '#c9a27e', '#8fa89a', '#7e8ba3', '#8a5a7c', '#e8a6ae']

// Stagger index for .rise children.
const i = (n: number) => ({ '--i': n }) as CSSProperties

function Grain({ active }: { active: boolean }) {
  // Shaders only run on the slide on screen; the rest of the deck costs nothing.
  if (!active) return null
  return (
    <div className="absolute inset-0 -z-10">
      <GrainGradient
        colorBack="#171416"
        colors={['#3a2530', '#2b2629', '#4a2c3a', '#221f22']}
        softness={0.7}
        intensity={0.35}
        noise={0.4}
        speed={0.25}
        shape="corners"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}

function Slide({ children, active, dither }: { children: ReactNode; active: boolean; dither?: boolean }) {
  return (
    <section className="absolute inset-0 isolate flex items-center justify-center overflow-hidden px-[8vw]">
      <Grain active={active && !dither} />
      {dither && active && (
        <div className="absolute inset-0 -z-10 opacity-70">
          <Dithering
            colorBack="#171416"
            colorFront="#4a2c3a"
            shape="warp"
            type="8x8"
            size={2.5}
            speed={0.35}
            scale={1}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      )}
      {active && <div className="rise w-full max-w-5xl">{children}</div>}
    </section>
  )
}

function Bar({ value, max, color, n }: { value: number; max: number; color: string; n: number }) {
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
      <div className="bar-grow h-full rounded-full" style={{ ...i(n), width: `${(100 * value) / Math.max(1, max)}%`, background: color }} />
    </div>
  )
}

function Row({ label, value, amount, max, color, n }: { label: string; value: string; amount: number; max: number; color: string; n: number }) {
  return (
    <div className="flex items-center gap-5 py-1.5" style={i(n)}>
      <div className="w-56 truncate text-sm">{label}</div>
      <Bar value={amount} max={max} color={color} n={n} />
      <div className="w-20 text-right text-sm text-[var(--muted)]">{value}</div>
    </div>
  )
}

// ------------------------------------------------------------------ slides

function Intro({ d, active }: { d: Wrapped; active: boolean }) {
  return (
    <Slide active={active} dither>
      <div className="label" style={i(0)}>your week · {range(d.start, d.end)}</div>
      <h1 className="serif mt-6 text-6xl leading-tight" style={i(1)}>
        Here’s what this machine
        <br />
        saw you do.
      </h1>
      <div className="mt-14 flex items-end gap-6" style={i(2)}>
        <DotNumber value={hours(d.time?.seconds ?? 0)} dot={14} gap={5} delay={500} />
        <div className="pb-2 text-[var(--muted)]">hours at the keyboard</div>
      </div>
      <div className="mt-16 flex items-center gap-3 text-xs text-[var(--muted)]" style={i(3)}>
        <span>→ / space</span>
        <DotmSquare3 size={14} dotSize={2} color="var(--rose)" />
      </div>
    </Slide>
  )
}

function Time({ d, active }: { d: Wrapped; active: boolean }) {
  const t = d.time!
  const peak = Math.max(1, ...t.days.map((x) => x.seconds))
  return (
    <Slide active={active}>
      <div className="label" style={i(0)}>where it went</div>
      <h2 className="serif mt-4 text-5xl" style={i(1)}>
        Mostly <span style={{ color: t.categories[0]?.color }}>{t.categories[0]?.name.toLowerCase()}</span>.
      </h2>
      <div className="mt-12 flex h-64 items-end gap-5" style={i(2)}>
        {t.days.map((day, n) => (
          <div key={day.date} className="flex h-full flex-1 flex-col items-center justify-end gap-3">
            <div className="text-xs text-[var(--muted)]">{day.seconds >= 60 ? duration(day.seconds) : ''}</div>
            <div className="col-grow flex w-full flex-col-reverse overflow-hidden rounded-md" style={{ ...i(n * 3), height: `${(100 * day.seconds) / peak}%` }}>
              {day.segments.map((s) => (
                <div key={s.name} style={{ height: `${(100 * s.seconds) / Math.max(1, day.seconds)}%`, background: s.color }} />
              ))}
            </div>
            <div className={`text-xs ${day.date === t.busiestDay ? 'text-[var(--cream)]' : 'text-[var(--muted)]'}`}>{weekday(day.date)}</div>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs" style={i(3)}>
        {t.categories.map((c) => (
          <span key={c.name} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
            {c.name} <span className="text-[var(--muted)]">{duration(c.seconds)}</span>
          </span>
        ))}
      </div>
    </Slide>
  )
}

function Rhythm({ d, active }: { d: Wrapped; active: boolean }) {
  const t = d.time!
  const max = Math.max(1, ...t.hours)
  const peakHour = t.hours.indexOf(max)
  const label = (h: number) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`
  return (
    <Slide active={active}>
      <div className="label" style={i(0)}>your rhythm</div>
      <h2 className="serif mt-4 text-5xl" style={i(1)}>
        Most awake at <span className="text-[var(--rose)]">{label(peakHour)}</span>.
      </h2>
      <div className="mt-12 flex h-40 items-end gap-1.5" style={i(2)}>
        {t.hours.map((s, h) => (
          <div key={h} className="flex h-full flex-1 flex-col justify-end">
            <div
              className="col-grow rounded-sm"
              style={{ ...i(h), height: `${Math.max(2, (100 * s) / max)}%`, background: h === peakHour ? 'var(--rose)' : 'rgba(247,244,241,0.16)' }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-[var(--muted)]" style={i(2)}>
        {[0, 6, 12, 18, 23].map((h) => <span key={h}>{label(h)}</span>)}
      </div>
      <div className="mt-14 grid grid-cols-2 gap-10" style={i(3)}>
        <div>
          <div className="label">longest focus</div>
          <div className="mt-3 flex items-end gap-4">
            <DotNumber value={String(Math.round(t.longestFocus.seconds / 60))} dot={9} gap={3} delay={400} />
            <span className="pb-1 text-sm text-[var(--muted)]">minutes of work, from {clock(t.longestFocus.start)}</span>
          </div>
        </div>
        <div>
          <div className="label">app switches</div>
          <div className="mt-3 flex items-end gap-4">
            <DotNumber value={compact(t.switches)} dot={9} gap={3} color="var(--sand)" delay={600} />
            <span className="pb-1 text-sm text-[var(--muted)]">about {Math.round(t.switches / 7)} a day</span>
          </div>
        </div>
      </div>
    </Slide>
  )
}

function Code({ d, active }: { d: Wrapped; active: boolean }) {
  const c = d.code
  const top = c.repos[0]?.commits ?? 1
  return (
    <Slide active={active}>
      <div className="label" style={i(0)}>you shipped</div>
      <div className="mt-8 flex items-end gap-6" style={i(1)}>
        <DotNumber value={String(c.commits)} dot={14} gap={5} delay={300} />
        <div className="pb-2">
          <div className="text-[var(--muted)]">commits</div>
          <div className="text-sm">
            <span className="text-[var(--sage)]">+{compact(c.added)}</span> <span className="text-[var(--rose)]">−{compact(c.removed)}</span>
          </div>
        </div>
      </div>
      <div className="mt-12" style={i(2)}>
        {c.repos.map((r, n) => (
          <Row key={r.name} n={n} label={r.name} value={String(r.commits)} amount={r.commits} max={top} color={PALETTE[n % PALETTE.length]} />
        ))}
      </div>
      {c.latest && (
        <div className="serif mt-10 text-2xl text-[var(--muted)]" style={i(3)}>
          Latest commit of the week: <span className="text-[var(--cream)]">{clock(c.latest)}</span>, {weekday(c.latest.slice(0, 10), true)}.
        </div>
      )}
    </Slide>
  )
}

function Agents({ d, active }: { d: Wrapped; active: boolean }) {
  const a = d.agents
  const models = a.models ?? []
  const top = models[0]?.tokens ?? 1
  return (
    <Slide active={active} dither>
      <div className="label flex items-center gap-3" style={i(0)}>
        <DotmSquare3 size={14} dotSize={2} color="var(--rose)" /> your agents read
      </div>
      <div className="mt-8 flex items-end gap-6" style={i(1)}>
        <DotNumber value={compact(a.tokens ?? 0)} dot={14} gap={5} delay={300} />
        <div className="pb-2 text-[var(--muted)]">tokens</div>
      </div>
      <div className="serif mt-6 text-2xl" style={i(2)}>
        across {a.sessions} sessions and {a.subagents} subagents.
      </div>
      <div className="mt-10" style={i(3)}>
        {models.map((m, n) => (
          <Row key={m.name} n={n} label={modelName(m.name)} value={compact(m.tokens)} amount={m.tokens} max={top} color={PALETTE[n % PALETTE.length]} />
        ))}
      </div>
    </Slide>
  )
}

function Anime({ d, active }: { d: Wrapped; active: boolean }) {
  const a = d.anime!
  const show = a.shows[0]
  return (
    <Slide active={active}>
      <div className="grid grid-cols-[1fr_auto] items-center gap-16">
        <div>
          <div className="label" style={i(0)}>on crunchyroll</div>
          <div className="mt-8 flex items-end gap-6" style={i(1)}>
            <DotNumber value={String(a.episodes)} dot={14} gap={5} delay={300} />
            <div className="pb-2 text-[var(--muted)]">episodes · {duration(a.seconds)}</div>
          </div>
          <div className="serif mt-10 text-4xl leading-snug" style={i(2)}>
            Mostly <span style={{ color: show?.color ? `color-mix(in oklab, ${show.color} 55%, var(--cream))` : 'var(--rose)' }}>{show?.title}</span>
          </div>
          <div className="mt-4 text-sm text-[var(--muted)]" style={i(3)}>
            {a.shows.slice(1).map((s) => s.title).join(' · ')}
          </div>
        </div>
        {show?.cover && (
          <div className="h-[56vh] max-h-[520px] w-[38vh] max-w-[360px] overflow-hidden rounded-xl" style={i(2)}>
            {active && (
              <ImageDithering
                image={show.cover}
                originalColors
                type="4x4"
                size={2}
                colorSteps={4}
                fit="cover"
                style={{ width: '100%', height: '100%' }}
              />
            )}
          </div>
        )}
      </div>
    </Slide>
  )
}

function Reading({ d, active }: { d: Wrapped; active: boolean }) {
  const r = d.reading ?? []
  return (
    <Slide active={active}>
      <div className="label" style={i(0)}>you read</div>
      <div className="mt-8 space-y-6">
        {r.map((p, n) => (
          <div key={p.title} className="flex items-baseline gap-6" style={i(n + 1)}>
            <span className="w-16 shrink-0 text-right text-sm text-[var(--muted)]">{duration(p.seconds)}</span>
            <span className="serif truncate text-3xl">{p.title.replace(/ — LessWrong$/, '')}</span>
          </div>
        ))}
      </div>
    </Slide>
  )
}

// One shareable card: `wrapped --png` screenshots this at #card.
function Card({ d, active }: { d: Wrapped; active: boolean }) {
  const t = d.time
  const cell = 'rounded-2xl border border-[var(--line)]/60 bg-black/20 p-6 backdrop-blur-sm'
  return (
    <Slide active={active} dither>
      <div className="grid grid-cols-3 gap-4">
        <div className={`${cell} col-span-3 flex items-end justify-between`} style={i(0)}>
          <div>
            <div className="label">{d.name || 'wrapped'} · {range(d.start, d.end)}</div>
            <div className="serif mt-2 text-4xl">the week, wrapped</div>
          </div>
          <DotNumber value={`${hours(t?.seconds ?? 0)}h`} dot={9} gap={3} delay={200} />
        </div>
        <div className={cell} style={i(1)}>
          <div className="label">commits</div>
          <div className="mt-4"><DotNumber value={String(d.code.commits)} dot={7} gap={3} color="var(--sage)" delay={400} /></div>
          <div className="mt-4 truncate text-xs text-[var(--muted)]">{d.code.repos.slice(0, 3).map((r) => r.name).join(' · ')}</div>
        </div>
        <div className={cell} style={i(2)}>
          <div className="label">agent tokens</div>
          <div className="mt-4"><DotNumber value={compact(d.agents.tokens ?? 0)} dot={7} gap={3} delay={500} /></div>
          <div className="mt-4 truncate text-xs text-[var(--muted)]">{(d.agents.models ?? []).slice(0, 2).map((m) => modelName(m.name)).join(' · ')}</div>
        </div>
        <div className={cell} style={i(3)}>
          <div className="label">episodes</div>
          <div className="mt-4"><DotNumber value={String(d.anime?.episodes ?? 0)} dot={7} gap={3} color="var(--sand)" delay={600} /></div>
          <div className="mt-4 truncate text-xs text-[var(--muted)]">{d.anime?.shows[0]?.title}</div>
        </div>
        {t && (
          <div className={`${cell} col-span-3`} style={i(4)}>
            <div className="flex h-3 overflow-hidden rounded-full">
              {t.categories.map((c) => (
                <div key={c.name} style={{ width: `${(100 * c.seconds) / Math.max(1, t.seconds)}%`, background: c.color }} />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--muted)]">
              {t.categories.slice(0, 5).map((c) => <span key={c.name}>{c.name.toLowerCase()} {duration(c.seconds)}</span>)}
            </div>
          </div>
        )}
      </div>
    </Slide>
  )
}

// ------------------------------------------------------------------ deck

export default function App() {
  const d = data
  const slides = d ? buildSlides(d) : []
  // #<slide id> opens on that slide (#card for the shareable summary).
  const [index, setIndex] = useState(() => Math.max(0, slides.findIndex((s) => '#' + s.id === location.hash)))

  const go = useCallback((delta: number) => setIndex((n) => Math.max(0, Math.min(slides.length - 1, n + delta))), [slides.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', ' ', 'l', 'Enter'].includes(e.key)) go(1)
      else if (['ArrowLeft', 'h', 'Backspace'].includes(e.key)) go(-1)
      else if (e.key === 'Escape' || e.key === 'q') window.close()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  if (!d) {
    return <div className="flex h-full items-center justify-center text-[var(--muted)]">No data. Run bin/wrapped.</div>
  }

  return (
    <main
      className="relative h-full select-none"
      onClick={(e) => go(e.clientX < window.innerWidth / 3 ? -1 : 1)}
    >
      {slides.map((s, n) => (
        <div key={s.id} className="absolute inset-0 transition-opacity duration-500" style={{ opacity: n === index ? 1 : 0, pointerEvents: n === index ? 'auto' : 'none' }}>
          {s.render(n === index)}
        </div>
      ))}
      {location.hash !== '#card' && (
        <div className="absolute inset-x-[8vw] top-6 flex gap-1.5">
          {slides.map((s, n) => (
            <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-[var(--cream)] transition-all duration-500" style={{ width: n <= index ? '100%' : '0%', opacity: n === index ? 1 : 0.5 }} />
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

function buildSlides(d: Wrapped) {
  const slides: Array<{ id: string; render: (active: boolean) => ReactNode }> = []
  slides.push({ id: 'intro', render: (a) => <Intro d={d} active={a} /> })
  if (d.time) {
    slides.push({ id: 'time', render: (a) => <Time d={d} active={a} /> })
    slides.push({ id: 'rhythm', render: (a) => <Rhythm d={d} active={a} /> })
  }
  if (d.code.commits > 0) slides.push({ id: 'code', render: (a) => <Code d={d} active={a} /> })
  if ((d.agents.tokens ?? 0) > 0) slides.push({ id: 'agents', render: (a) => <Agents d={d} active={a} /> })
  if (d.anime && d.anime.episodes > 0) slides.push({ id: 'anime', render: (a) => <Anime d={d} active={a} /> })
  if (d.reading && d.reading.length > 0) slides.push({ id: 'reading', render: (a) => <Reading d={d} active={a} /> })
  slides.push({ id: 'card', render: (a) => <Card d={d} active={a} /> })
  return slides
}
