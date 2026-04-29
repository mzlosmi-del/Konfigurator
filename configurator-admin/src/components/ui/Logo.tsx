import type { CSSProperties } from 'react'

export type LogoVariant = 'primary' | 'reverse' | 'onTurq' | 'mono-ink' | 'mono-paper'
export type LogoLockup  = 'mark' | 'horizontal' | 'vertical'

export interface LogoProps {
  variant?:   LogoVariant
  size?:      number
  lockup?:    LogoLockup
  tagline?:   boolean
  pulse?:     boolean
  className?: string
}

type Colors = {
  bar: string; topRight: string; btmRight: string; dot: string
  wordmark: string; dotPunct: string; tagline: string
}

const COLORS: Record<LogoVariant, Colors> = {
  'primary':    { bar:'#0c1414', topRight:'#0fa392', btmRight:'#0c1414', dot:'#0fa392', wordmark:'#0c1414', dotPunct:'#0fa392', tagline:'#0a665b' },
  'reverse':    { bar:'#f7f5f1', topRight:'#0fa392', btmRight:'#f7f5f1', dot:'#0fa392', wordmark:'#f7f5f1', dotPunct:'#0fa392', tagline:'#38d3bb' },
  'onTurq':     { bar:'#0c1414', topRight:'#f7f5f1', btmRight:'#0c1414', dot:'#f7f5f1', wordmark:'#0c1414', dotPunct:'#f7f5f1', tagline:'#0c1414' },
  'mono-ink':   { bar:'#0c1414', topRight:'#0c1414', btmRight:'#0c1414', dot:'#0c1414', wordmark:'#0c1414', dotPunct:'#0c1414', tagline:'#0c1414' },
  'mono-paper': { bar:'#f7f5f1', topRight:'#f7f5f1', btmRight:'#f7f5f1', dot:'#f7f5f1', wordmark:'#f7f5f1', dotPunct:'#f7f5f1', tagline:'#f7f5f1' },
}

// ── Mark (200×200 viewBox) ────────────────────────────────────────────────────
function CMark({ c, size, pulse }: { c: Colors; size: number; pulse?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ flexShrink: 0, display: 'block' }}
    >
      <rect x="1.5"   y="1.5"   width="97" height="197" rx="9" fill={c.bar}      />
      <rect x="101.5" y="1.5"   width="97" height="47"  rx="9" fill={c.topRight} />
      <rect x="101.5" y="151.5" width="97" height="47"  rx="9" fill={c.btmRight} />
      <circle
        cx="150" cy="100" r="16"
        fill={c.dot}
        style={pulse ? { animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' } : undefined}
      />
    </svg>
  )
}

// ── Vertical lockup (480×270 / 480×305 viewBox) ───────────────────────────────
function VerticalLockup({ c, size, showTagline, pulse }: { c: Colors; size: number; showTagline: boolean; pulse?: boolean }) {
  const vbH = showTagline ? 305 : 270
  const w   = Math.round(size * 480 / vbH)
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 480 ${vbH}`}
      width={w}
      height={size}
      aria-label="Configureout"
      style={{ display: 'block' }}
    >
      <g transform="translate(160 30)">
        <rect x="1.2"  y="1.2"   width="77.6" height="157.6" rx="7.2" fill={c.bar}      />
        <rect x="81.2" y="1.2"   width="77.6" height="37.6"  rx="7.2" fill={c.topRight} />
        <rect x="81.2" y="121.2" width="77.6" height="37.6"  rx="7.2" fill={c.btmRight} />
        <circle
          cx="120" cy="80" r="12.8"
          fill={c.dot}
          style={pulse ? { animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' } : undefined}
        />
      </g>
      <text
        x="240" y="246"
        fontFamily="Sora, sans-serif" fontWeight="700" fontSize="38" letterSpacing="-1.2"
        fill={c.wordmark} textAnchor="middle"
      >
        configureout<tspan fill={c.dotPunct}>.</tspan>
      </text>
      {showTagline && (
        <text
          x="240" y="280"
          fontFamily="JetBrains Mono, monospace" fontWeight="500" fontSize="13" letterSpacing="4.5"
          fill={c.tagline} textAnchor="middle"
        >
          COMMERCE · CONFIGURATORS
        </text>
      )}
    </svg>
  )
}

// ── Horizontal lockup (composed — no source SVG) ──────────────────────────────
function HorizontalLockup({ c, size, pulse }: { c: Colors; size: number; pulse?: boolean }) {
  const textStyle: CSSProperties = {
    fontFamily:    'Sora, sans-serif',
    fontWeight:    700,
    fontSize:      Math.round(size * 0.64),
    letterSpacing: '-0.02em',
    color:         c.wordmark,
    lineHeight:    1,
    userSelect:    'none',
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(size * 0.32) }}>
      <CMark c={c} size={size} pulse={pulse} />
      <span style={textStyle}>
        configureout<span style={{ color: c.dotPunct }}>.</span>
      </span>
    </div>
  )
}

// ── Public component ──────────────────────────────────────────────────────────
export function Logo({
  variant  = 'primary',
  size     = 96,
  lockup   = 'mark',
  tagline  = false,
  pulse    = false,
  className,
}: LogoProps) {
  const c = COLORS[variant]

  if (lockup === 'vertical') {
    return (
      <span className={className} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
        <VerticalLockup c={c} size={size} showTagline={tagline} pulse={pulse} />
      </span>
    )
  }

  if (lockup === 'horizontal') {
    return (
      <span className={className} style={{ display: 'inline-flex' }}>
        <HorizontalLockup c={c} size={size} pulse={pulse} />
      </span>
    )
  }

  return (
    <span className={className} style={{ display: 'inline-flex' }}>
      <CMark c={c} size={size} pulse={pulse} />
    </span>
  )
}
