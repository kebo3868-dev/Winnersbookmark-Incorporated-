import {
  Dumbbell, Brain, Banknote, BookOpen, Crosshair, Flag,
  Compass, Apple, PenLine, Sunrise,
} from 'lucide-react';

const tiles = [
  { icon: Crosshair, label: 'Focus', accent: 'electric', span: 'row-span-2' },
  { icon: Dumbbell, label: 'The Gym', accent: 'crimson', span: '' },
  { icon: Apple, label: 'Clean Eating', accent: 'success', span: '' },
  { icon: Banknote, label: 'Money', accent: 'gold', span: 'row-span-2' },
  { icon: PenLine, label: 'Journaling', accent: 'electric', span: '' },
  { icon: BookOpen, label: 'Learning', accent: 'crimson', span: '' },
  { icon: Compass, label: 'Purpose', accent: 'gold', span: '' },
  { icon: Flag, label: 'Leadership', accent: 'electric', span: '' },
  { icon: Brain, label: 'Self-Mastery', accent: 'gold', span: '' },
  { icon: Sunrise, label: '5 AM Discipline', accent: 'crimson', span: '' },
];

const glow = {
  electric: 'from-electric/30',
  gold: 'from-gold/25',
  crimson: 'from-[#b91c1c]/30',
  success: 'from-success/25',
};
const txt = {
  electric: 'text-electric-glow',
  gold: 'text-gold-light',
  crimson: 'text-[#f08a8a]',
  success: 'text-success',
};

export default function VisionBoard() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 auto-rows-[120px] sm:auto-rows-[140px] gap-3">
      {tiles.map((t, i) => {
        const Icon = t.icon;
        return (
          <div
            key={i}
            className={`group relative overflow-hidden rounded-2xl border border-ink-line bg-ink-card/60 flex flex-col items-center justify-center text-center ${t.span}`}
          >
            <div className={`absolute -bottom-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br ${glow[t.accent]} to-transparent blur-2xl opacity-60 group-hover:opacity-100 transition-opacity`} />
            <Icon size={26} className={`relative ${txt[t.accent]} mb-2 group-hover:scale-110 transition-transform`} />
            <span className="relative eyebrow text-chalk">{t.label}</span>
          </div>
        );
      })}
    </div>
  );
}
