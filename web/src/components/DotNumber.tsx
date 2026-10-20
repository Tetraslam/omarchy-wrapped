import { useEffect, useState } from 'react'

// ?still (used for the PNG export) draws everything lit, without motion.
export const STILL = new URLSearchParams(location.search).has('still')

// A 5×7 dot-matrix face. Each glyph is seven rows of five bits.
const GLYPHS: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '.': ['000', '000', '000', '000', '000', '011', '011'],
  ',': ['000', '000', '000', '000', '011', '001', '010'],
  'K': ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  'B': ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  'h': ['10000', '10000', '10110', '11001', '10001', '10001', '10001'],
  'm': ['00000', '00000', '11010', '10101', '10101', '10101', '10101'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '−': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  ' ': ['000', '000', '000', '000', '000', '000', '000'],
}

interface Props {
  value: string
  dot?: number
  gap?: number
  color?: string
  off?: string
  // Delay before the dots light, in ms; they sweep in column by column.
  delay?: number
}

export function DotNumber({ value, dot = 10, gap = 4, color = 'var(--rose)', off = 'rgba(247,244,241,0.06)', delay = 0 }: Props) {
  const [lit, setLit] = useState(STILL)
  useEffect(() => {
    if (STILL) return
    setLit(false)
    const id = window.setTimeout(() => setLit(true), delay + 40)
    return () => window.clearTimeout(id)
  }, [value, delay])

  let column = 0
  return (
    <div className="flex items-start" style={{ gap: dot + gap * 2 }} aria-label={value} role="img">
      {[...value].map((ch, gi) => {
        const rows = GLYPHS[ch] ?? GLYPHS[' ']
        const width = rows[0].length
        const start = column
        column += width + 1
        return (
          <div key={gi} className="grid" style={{ gridTemplateColumns: `repeat(${width}, ${dot}px)`, gap }}>
            {rows.flatMap((row, r) =>
              [...row].map((bit, c) => (
                <span
                  key={`${r}-${c}`}
                  className="rounded-full"
                  style={{
                    width: dot,
                    height: dot,
                    background: bit === '1' && lit ? color : off,
                    boxShadow: bit === '1' && lit ? `0 0 ${dot * 0.9}px color-mix(in oklab, ${color} 45%, transparent)` : 'none',
                    transition: STILL ? 'none' : 'background 260ms ease, box-shadow 400ms ease',
                    transitionDelay: `${(start + c) * 22 + r * 6}ms`,
                  }}
                />
              )),
            )}
          </div>
        )
      })}
    </div>
  )
}
