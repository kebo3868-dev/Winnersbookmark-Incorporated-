export function Field({ label, hint, children }) {
  return (
    <label className="field">
      {label && <span className="label">{label}</span>}
      {children}
      {hint && <span className="text-[11px] text-ghost mt-1">{hint}</span>}
    </label>
  );
}

export function Input(props) {
  return <input {...props} />;
}

export function Textarea(props) {
  return <textarea {...props} />;
}

export function Select({ children, ...props }) {
  return <select {...props}>{children}</select>;
}
