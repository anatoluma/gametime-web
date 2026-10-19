"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

export type CarouselBanner = {
  id: string;
  href: string;
  imageUrl: string;
  alt: string;
};

const AUTOPLAY_MS = 6000;

export default function BannerCarousel({ banners }: { banners: CarouselBanner[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = banners.length;

  const goTo = useCallback((next: number) => {
    const track = trackRef.current;
    if (!track) return;
    const target = (next + count) % count;
    track.scrollTo({ left: target * track.clientWidth, behavior: "smooth" });
  }, [count]);

  const handleScroll = () => {
    const track = trackRef.current;
    if (track?.clientWidth) setIndex(Math.round(track.scrollLeft / track.clientWidth));
  };

  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => goTo(index + 1), AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [count, paused, index, goTo]);

  if (count === 0) return null;

  const arrow =
    "absolute top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center bg-black/60 text-xl text-white hover:bg-[var(--orange)] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--orange)] sm:flex";

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Latest results"
      className="border-b px-3 py-4 sm:px-6 sm:py-6"
      style={{ borderColor: "var(--line)" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative mx-auto max-w-5xl overflow-hidden" style={{ borderRadius: "var(--radius)" }}>
        <div
          ref={trackRef}
          onScroll={handleScroll}
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {banners.map((banner, i) => (
            <Link
              key={banner.id}
              href={banner.href}
              aria-label={banner.alt}
              aria-roledescription="slide"
              className="block w-full min-w-full shrink-0 snap-center"
            >
              {/* Below sm the 1600x600 art is centre-cropped to 4:3 so logos, names and score stay legible;
                  the template keeps all of them inside the central 800px. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={banner.imageUrl}
                alt={banner.alt}
                width={1600}
                height={600}
                loading={i === 0 ? "eager" : "lazy"}
                className="aspect-[4/3] w-full object-cover object-center sm:aspect-[8/3]"
              />
            </Link>
          ))}
        </div>

        {count > 1 && (
          <>
            <button type="button" aria-label="Previous banner" onClick={() => goTo(index - 1)} className={`${arrow} left-2`}>
              ‹
            </button>
            <button type="button" aria-label="Next banner" onClick={() => goTo(index + 1)} className={`${arrow} right-2`}>
              ›
            </button>
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
              {banners.map((banner, i) => (
                <button
                  key={banner.id}
                  type="button"
                  aria-label={`Show banner ${i + 1}`}
                  aria-current={i === index}
                  onClick={() => goTo(i)}
                  className="h-2.5 w-2.5 rounded-full border border-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--orange)]"
                  style={{ background: i === index ? "var(--orange)" : "rgba(0,0,0,0.5)" }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
