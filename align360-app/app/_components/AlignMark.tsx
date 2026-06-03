// The real ALIGN pure mark (symbol only). Fig on light backgrounds, white on
// dark — swapped via CSS off [data-theme]. `white` forces the white mark
// regardless of theme (for the always-dark profile document).
export default function AlignMark({ className = '', white = false }: { className?: string; white?: boolean }) {
  if (white) {
    return <span className={`align-mark ${className}`} aria-hidden><img src="/brand/align-mark-white.png" alt="" className="align-mark-img" /></span>;
  }
  return (
    <span className={`align-mark ${className}`} aria-hidden>
      <img src="/brand/align-mark-fig.png" alt="" className="align-mark-img fig" />
      <img src="/brand/align-mark-white.png" alt="" className="align-mark-img wht" />
    </span>
  );
}
