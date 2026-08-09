type EyebrowProps = {
  children: string;
};

export default function Eyebrow({ children }: EyebrowProps) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
      style={{ borderColor: "var(--line)", color: "var(--muted)", background: "rgba(10, 18, 32, 0.45)" }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--orange)" }} />
      {children}
    </span>
  );
}
