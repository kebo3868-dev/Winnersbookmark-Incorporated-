export default function SelectGrid({ items, value, onChange, cols = 'grid-cols-2 sm:grid-cols-3', renderItem }) {
  return (
    <div className={`grid ${cols} gap-2.5`}>
      {items.map(item => {
        const selected = item.id === value;
        return (
          <button
            type="button"
            key={item.id}
            onClick={() => onChange(item.id)}
            className={`text-left p-3 rounded-xl border transition-all active:scale-[.98] ${
              selected
                ? 'border-gold bg-gold/10 shadow-gold'
                : 'border-ink-line bg-ink-card/60 hover:border-electric/60'
            }`}
          >
            {renderItem ? renderItem(item, selected) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  {item.emoji && <span className="chip-gold !py-0.5 !px-1.5 font-comic">{item.emoji}</span>}
                  <div className={`font-semibold text-sm ${selected ? 'text-gold-light' : 'text-paper'}`}>{item.name}</div>
                </div>
                {item.tag && <div className="text-[10.5px] uppercase tracking-wider text-mist">{item.tag}</div>}
                {item.blurb && <div className="text-xs text-mist mt-1 leading-relaxed">{item.blurb}</div>}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
