import {
  ShieldCheck, Crosshair, Dumbbell, Apple, Banknote, Target,
  BookOpen, Users, Brain, Flag, Compass, Repeat, Circle,
} from 'lucide-react';

// Curated icon map for data-driven cards. Importing icons explicitly (rather
// than `import * as Lucide`) keeps tree-shaking working and the bundle lean.
const icons = {
  ShieldCheck, Crosshair, Dumbbell, Apple, Banknote, Target,
  BookOpen, Users, Brain, Flag, Compass, Repeat,
};

export default function Icon({ name, size = 20, className = '' }) {
  const Cmp = icons[name] || Circle;
  return <Cmp size={size} className={className} />;
}
