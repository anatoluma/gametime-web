type SeasonCountdownProps = {
  label: string;
  daysLabel: string;
  dateLabel: string;
};

// Season tips off Saturday, September 12, 2026 (Europe/Chisinau).
const SEASON_START = new Date("2026-09-12T00:00:00+03:00");

function getDaysRemaining(): number {
  const now = new Date();
  const diffMs = SEASON_START.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export default function SeasonCountdown({ label, daysLabel, dateLabel }: SeasonCountdownProps) {
  const days = getDaysRemaining();

  return (
    <section
      className="border-b px-3 py-10 text-center sm:px-6 sm:py-14"
      style={{
        borderColor: "var(--line)",
        background: "linear-gradient(135deg, rgba(255,122,26,0.14) 0%, var(--navy-950) 60%)",
      }}
    >
      <div className="mx-auto max-w-5xl">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] sm:text-sm" style={{ color: "var(--muted)" }}>
          {label}
        </span>

        <div
          className="mt-3 leading-none"
          style={{
            color: "var(--orange)",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "clamp(4.5rem, 18vw, 9rem)",
          }}
        >
          {days}
        </div>

        <div className="mt-2 text-base font-semibold uppercase tracking-[0.1em] sm:text-lg" style={{ color: "var(--text)" }}>
          {daysLabel}
        </div>

        <div className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] sm:text-sm" style={{ color: "var(--muted)" }}>
          {dateLabel}
        </div>
      </div>
    </section>
  );
}
