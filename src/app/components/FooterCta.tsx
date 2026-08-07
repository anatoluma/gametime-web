"use client";

import { useT } from "./LanguageProvider";

export default function FooterCta() {
  const { t } = useT();

  return (
    <footer className="max-w-5xl mx-auto py-6 text-center bg-[var(--surface)] border-x border-[var(--border)] space-y-2">
      <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">© 2026 LBM Stats</p>
      <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest">
        {t("footer_cta")}{" "}
        <a
          href="https://gametime.md"
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-orange-500 hover:text-orange-600 transition-colors"
        >
          gametime.md
        </a>
      </p>
    </footer>
  );
}
