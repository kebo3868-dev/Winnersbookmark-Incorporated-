import { formatCurrency } from '../lib/finance';

export default function AmountDisplay({
  amount,
  currency = 'USD',
  size = 'md',
  positive,
  negative,
  muted = false,
  compact = false,
  className = '',
}) {
  const num = Number(amount) || 0;
  const isPos = positive ?? num >= 0;
  const isNeg = negative ?? num < 0;

  const colorClass = muted
    ? 'text-wb-muted'
    : isNeg
    ? 'text-wb-red-light'
    : isPos
    ? 'text-wb-green-light'
    : 'text-wb-white';

  const sizes = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg font-semibold',
    xl: 'text-xl font-bold',
    '2xl': 'text-2xl font-bold',
    '3xl': 'text-3xl font-bold',
  };

  return (
    <span className={`${sizes[size]} ${colorClass} tabular-nums ${className}`}>
      {isNeg && num > 0 ? '−' : ''}{formatCurrency(Math.abs(num), currency, compact)}
    </span>
  );
}
