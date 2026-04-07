export default function SliderInput({ label, value, onChange, min = 1, max = 10 }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-wb-muted uppercase tracking-wider">{label}</span>
        <span className="text-sm font-bold text-wb-blue-light">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-wb-border accent-wb-blue cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-wb-blue-light [&::-webkit-slider-thumb]:cursor-pointer"
        style={{ border: 'none', padding: 0 }}
      />
    </div>
  );
}
