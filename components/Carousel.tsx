'use client';

import { useRef, type ReactNode } from 'react';

export function Carousel({ items }: { items: ReactNode[] }) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  function scroll(dir: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('.carousel-item');
    const amount = (card?.offsetWidth || 280) + 20;
    el.scrollBy({ left: amount * dir, behavior: 'smooth' });
  }

  return (
    <div className="carousel">
      <button type="button" className="carousel-btn carousel-prev" onClick={() => scroll(-1)} aria-label="Previous">‹</button>
      <div className="carousel-track" ref={trackRef}>
        {items.map((item, i) => (
          <div className="carousel-item" key={i}>{item}</div>
        ))}
      </div>
      <button type="button" className="carousel-btn carousel-next" onClick={() => scroll(1)} aria-label="Next">›</button>
    </div>
  );
}
