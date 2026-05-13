import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function CopyButton({ text, label = 'Copy', className = 'btn-ghost' }) {
  const [done, setDone] = useState(false);
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(text || '');
      setDone(true);
      setTimeout(() => setDone(false), 1400);
    } catch {
      // ignore
    }
  };
  return (
    <button type="button" onClick={onClick} className={className}>
      {done ? <Check size={14} /> : <Copy size={14} />}
      <span className="text-xs sm:text-sm">{done ? 'Copied' : label}</span>
    </button>
  );
}
