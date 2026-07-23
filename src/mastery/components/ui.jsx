import { NavLink } from 'react-router-dom'
import {
  Accessibility, AlertTriangle, ArrowRight, Award, BadgeCheck, BarChart3, Bell,
  Bookmark, BookOpen, Bot, BrainCircuit, Briefcase, CalendarCheck, Check, CheckCircle2,
  ChevronLeft, Circle, HelpCircle, Clock, Coffee, Crosshair, Crown, Eye, Flame, Footprints,
  Gauge, GitCompareArrows, GraduationCap, Handshake, Heart, HeartHandshake, Home, Info,
  Lightbulb, Lock, MessagesSquare, Mic, PenLine, PersonStanding, Plus, Rocket, RotateCcw,
  Send, ShieldOff, Sparkles, Star, Sun, Swords, Target, ThumbsDown, ThumbsUp, Trash2,
  TrendingUp, Trophy, User, Users, X, Zap,
} from 'lucide-react'

// Only the icons the app actually uses — keeps the bundle lean (tree-shaken).
const ICONS = {
  Accessibility, AlertTriangle, ArrowRight, Award, BadgeCheck, BarChart3, Bell,
  Bookmark, BookOpen, Bot, BrainCircuit, Briefcase, CalendarCheck, Check, CheckCircle2,
  ChevronLeft, Circle, CircleHelp: HelpCircle, Clock, Coffee, Crosshair, Crown, Eye, Flame, Footprints,
  Gauge, GitCompareArrows, GraduationCap, Handshake, Heart, HeartHandshake, Home, Info,
  Lightbulb, Lock, MessagesSquare, Mic, PenLine, PersonStanding, Plus, Rocket, RotateCcw,
  Send, ShieldOff, Sparkles, Star, Sun, Swords, Target, ThumbsDown, ThumbsUp, Trash2,
  TrendingUp, Trophy, User, Users, X, Zap,
}

// ---- Icon resolver --------------------------------------------------------
export function Icon({ name, size = 20, className = '', strokeWidth = 2 }) {
  const Cmp = ICONS[name] || Circle
  return <Cmp size={size} className={className} strokeWidth={strokeWidth} />
}

// ---- Brand ----------------------------------------------------------------
export function BrandMark({ size = 34 }) {
  return (
    <div className="relative inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-gold-light to-gold shadow-gold"
      style={{ width: size, height: size }}>
      <Bookmark size={size * 0.56} className="text-ink-black" strokeWidth={2.5} fill="currentColor" />
    </div>
  )
}

export function Wordmark({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark size={compact ? 30 : 36} />
      <div className="leading-none">
        <div className="font-display font-bold text-paper tracking-tight text-[15px]">
          Winnersbookmark
        </div>
        <div className="eyebrow !text-[9px] mt-0.5">Social Mastery</div>
      </div>
    </div>
  )
}

// ---- Buttons / chips are provided by index.css component classes ----------

// ---- XP / level bar -------------------------------------------------------
export function XPBar({ pct, className = '' }) {
  return (
    <div className={`h-2.5 rounded-full bg-ink-card2 overflow-hidden border border-ink-line ${className}`}>
      <div className="h-full rounded-full bg-gradient-to-r from-gold to-amber transition-all duration-500"
        style={{ width: `${Math.max(3, pct)}%` }} />
    </div>
  )
}

// ---- Streak badge ---------------------------------------------------------
export function StreakBadge({ count, size = 'md' }) {
  const big = size === 'lg'
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full ${big ? 'px-3.5 py-2' : 'px-2.5 py-1'} bg-amber/10 border border-amber/40`}>
      <Flame size={big ? 20 : 15} className="text-amber-glow" fill="currentColor" />
      <span className={`font-bold text-amber-glow ${big ? 'text-base' : 'text-[13px]'}`}>{count}</span>
      {big && <span className="text-[11px] text-amber-glow/80 font-medium">day streak</span>}
    </div>
  )
}

// ---- Ring progress --------------------------------------------------------
export function Ring({ pct = 0, size = 64, stroke = 6, color = '#d4af37', track = '#1c2547', children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = c - (Math.min(100, Math.max(0, pct)) / 100) * c
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

// ---- Stat tile ------------------------------------------------------------
export function StatTile({ icon, label, value, sub, accent = 'gold' }) {
  const tone = accent === 'amber' ? 'text-amber-glow' : accent === 'electric' ? 'text-electric-glow' : 'text-gold-light'
  return (
    <div className="glass card-pad flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-mist">
        {icon && <Icon name={icon} size={15} className={tone} />}
        <span className="label !mb-0">{label}</span>
      </div>
      <div className="text-2xl font-bold text-paper leading-none">{value}</div>
      {sub && <div className="text-[11px] text-mist">{sub}</div>}
    </div>
  )
}

// ---- Skill radar chart (SVG, N axes) --------------------------------------
export function SkillRadar({ data, size = 260, max = 100, color = '#d4af37', compare = null }) {
  const cx = size / 2, cy = size / 2
  const R = size / 2 - 34
  const keys = data.map(d => d.label)
  const n = keys.length
  const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2
  const point = (val, i, radius = R) => {
    const rr = (Math.max(0, Math.min(max, val)) / max) * radius
    return [cx + rr * Math.cos(angle(i)), cy + rr * Math.sin(angle(i))]
  }
  const poly = (vals) => vals.map((v, i) => point(v, i).join(',')).join(' ')
  const rings = [0.25, 0.5, 0.75, 1]

  return (
    <svg width={size} height={size} className="mx-auto overflow-visible">
      {rings.map((r, ri) => (
        <polygon key={ri}
          points={keys.map((_, i) => [cx + R * r * Math.cos(angle(i)), cy + R * r * Math.sin(angle(i))].join(',')).join(' ')}
          fill="none" stroke="#1c2547" strokeWidth="1" />
      ))}
      {keys.map((_, i) => {
        const [x, y] = [cx + R * Math.cos(angle(i)), cy + R * Math.sin(angle(i))]
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#1c2547" strokeWidth="1" />
      })}
      {compare && (
        <polygon points={poly(compare.map(d => d.value))} fill="rgba(136,147,173,0.10)" stroke="#5a667f" strokeWidth="1.5" strokeDasharray="3 3" />
      )}
      <polygon points={poly(data.map(d => d.value))} fill={color + '33'} stroke={color} strokeWidth="2" />
      {data.map((d, i) => {
        const [x, y] = point(d.value, i)
        return <circle key={i} cx={x} cy={y} r="2.6" fill={color} />
      })}
      {keys.map((k, i) => {
        const [x, y] = [cx + (R + 20) * Math.cos(angle(i)), cy + (R + 20) * Math.sin(angle(i))]
        const anchor = Math.abs(Math.cos(angle(i))) < 0.35 ? 'middle' : x > cx ? 'start' : 'end'
        return (
          <text key={k} x={x} y={y} textAnchor={anchor} dominantBaseline="middle"
            fontSize="9.5" fill="#8893ad" className="font-medium">{k}</text>
        )
      })}
    </svg>
  )
}

// ---- Horizontal skill bar -------------------------------------------------
export function SkillBar({ label, value, color = 'gold' }) {
  const grad = color === 'amber' ? 'from-amber to-amber-glow' : color === 'electric' ? 'from-electric to-electric-glow' : 'from-gold to-gold-light'
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[13px] text-chalk font-medium">{label}</span>
        <span className="text-[12px] text-mist tabular-nums">{Math.round(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-ink-card2 overflow-hidden">
        <div className={`h-full rounded-full bg-gradient-to-r ${grad} transition-all duration-500`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

// ---- Section heading ------------------------------------------------------
export function SectionHead({ eyebrow, title, right }) {
  return (
    <div className="flex items-end justify-between mb-3">
      <div>
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h2 className="section-title">{title}</h2>
      </div>
      {right}
    </div>
  )
}

// ---- Bottom navigation (5 tabs, center Coach elevated) --------------------
const TABS = [
  { to: '/home',     icon: 'Home',        label: 'Home' },
  { to: '/learn',    icon: 'GraduationCap', label: 'Learn' },
  { to: '/coach',    icon: 'Bot',         label: 'Coach', center: true },
  { to: '/insights', icon: 'BarChart3',   label: 'Insights' },
  { to: '/profile',  icon: 'User',        label: 'Profile' },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 safe-bottom">
      <div className="max-w-3xl mx-auto px-3 pb-3">
        <div className="relative flex items-center justify-between rounded-2xl border border-ink-line bg-ink-deep/95 backdrop-blur-md shadow-panel-lg px-2 py-1.5">
          {TABS.map(t => t.center ? (
            <NavLink key={t.to} to={t.to} className="flex-1 flex justify-center" aria-label={t.label}>
              {({ isActive }) => (
                <div className="flex flex-col items-center -mt-7">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-gold tap
                    ${isActive ? 'bg-gradient-to-br from-gold-light to-gold border-gold text-ink-black'
                               : 'bg-gradient-to-br from-amber to-amber-deep border-amber/60 text-ink-black'}`}>
                    <Icon name={t.icon} size={26} strokeWidth={2.4} />
                  </div>
                  <span className={`text-[10px] mt-1 font-semibold ${isActive ? 'text-gold-light' : 'text-amber-glow'}`}>{t.label}</span>
                </div>
              )}
            </NavLink>
          ) : (
            <NavLink key={t.to} to={t.to} className="flex-1" aria-label={t.label}>
              {({ isActive }) => (
                <div className="flex flex-col items-center py-1.5 gap-1 tap">
                  <Icon name={t.icon} size={21} className={isActive ? 'text-gold-light' : 'text-mist'} strokeWidth={isActive ? 2.4 : 2} />
                  <span className={`text-[10px] font-medium ${isActive ? 'text-gold-light' : 'text-ghost'}`}>{t.label}</span>
                </div>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}

// ---- Toast for freshly unlocked achievement -------------------------------
export function AchievementToast({ achievement, onClose }) {
  if (!achievement) return null
  return (
    <div className="fixed top-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
      <div className="pop pointer-events-auto glass-strong card-pad flex items-center gap-3 max-w-sm w-full border-gold/50">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-gold-light to-gold flex items-center justify-center shrink-0">
          <Icon name={achievement.icon} size={22} className="text-ink-black" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="eyebrow !text-gold">Achievement unlocked</div>
          <div className="font-bold text-paper text-sm truncate">{achievement.title}</div>
        </div>
        {achievement.xp > 0 && <span className="chip-gold shrink-0">+{achievement.xp} XP</span>}
        <button onClick={onClose} className="text-mist hover:text-paper shrink-0" aria-label="Dismiss">
          <Icon name="X" size={16} />
        </button>
      </div>
    </div>
  )
}

// ---- Empty state ----------------------------------------------------------
export function Empty({ icon = 'Sparkles', title, children }) {
  return (
    <div className="empty">
      <Icon name={icon} size={26} className="text-ghost mx-auto mb-2" />
      <div className="text-chalk font-semibold text-sm">{title}</div>
      {children && <div className="text-mist text-[13px] mt-1">{children}</div>}
    </div>
  )
}
