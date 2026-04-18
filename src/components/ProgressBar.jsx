export default function ProgressBar({ pct = 0, color = 'blue', size = 'md', showLabel = false }) {
  const colors = {
    blue:   'bg-wb-blue',
    green:  'bg-wb-green',
    red:    'bg-wb-red',
    amber:  'bg-wb-amber',
    gold:   'bg-wb-gold',
    purple: 'bg-wb-purple',
  };
  const heights = { sm: 'h-1', md: 'h-1.5', lg: 'h-2', xl: 'h-3' };
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="w-full">
      <div className={`w-full ${heights[size]} bg-wb-border rounded-full overflow-hidden`}>
        <div
          className={`h-full ${colors[color] || colors.blue} rounded-full transition-all duration-500`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-wb-muted mt-1 text-right">{Math.round(clamped)}%</p>
      )}
    </div>
  );
}
