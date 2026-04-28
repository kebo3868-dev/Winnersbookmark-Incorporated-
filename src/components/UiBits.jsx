export function Card({ children, className = '' }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function Progress({ value }) {
  return (
    <div className="w-full h-2 bg-wb-border rounded-full overflow-hidden">
      <div className="h-full bg-wb-blue" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Field({ label, ...props }) {
  return <label className="block mb-3"><span className="label">{label}</span><input {...props} /></label>;
}

export function TextArea({ label, ...props }) {
  return <label className="block mb-3"><span className="label">{label}</span><textarea rows={3} {...props} /></label>;
}
