'use client';

import { useMemo, useState } from 'react';
import { countryNameToCode } from '@/lib/countries';
import { COUNTRY_COORDS } from '@/lib/countryCoords';
import { fmtDate } from '@/lib/dates';
import { useLanguage } from '@/lib/i18n/context';

interface TripMapRoute {
  id: string;
  city: string;
  country: string;
  start_date: string | null;
}

function project(lat: number, lng: number) {
  return { x: ((lng + 180) / 360) * 1000, y: ((90 - lat) / 180) * 500 };
}

const MAP_RATIO = 2; // largura/altura do viewBox — precisa bater com o aspect-ratio do CSS
const MIN_SPAN_X = 130; // não deixa dar zoom além disso, mesmo com rotas bem próximas
const PADDING_RATIO = 0.35; // margem ao redor dos pinos, proporcional ao tamanho do grupo

// Ajusta o viewBox pra enquadrar só a região onde as rotas da trip estão —
// sem isso, uma trip toda dentro de um continente fica minúscula no meio
// de um viewBox que sempre mostra o mundo inteiro.
function fitViewBox(points: { x: number; y: number }[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);

  const padX = Math.max((maxX - minX) * PADDING_RATIO, 40);
  const padY = Math.max((maxY - minY) * PADDING_RATIO, 40);
  minX -= padX; maxX += padX;
  minY -= padY; maxY += padY;

  let width = maxX - minX;
  let height = maxY - minY;

  if (width < MIN_SPAN_X) {
    const cx = (minX + maxX) / 2;
    minX = cx - MIN_SPAN_X / 2;
    width = MIN_SPAN_X;
  }
  if (height < MIN_SPAN_X / MAP_RATIO) {
    const cy = (minY + maxY) / 2;
    minY = cy - MIN_SPAN_X / MAP_RATIO / 2;
    height = MIN_SPAN_X / MAP_RATIO;
  }

  // mantém a proporção 2:1 do container, esticando o eixo mais curto
  if (width / height > MAP_RATIO) {
    const targetHeight = width / MAP_RATIO;
    const cy = minY + height / 2;
    minY = cy - targetHeight / 2;
    height = targetHeight;
  } else {
    const targetWidth = height * MAP_RATIO;
    const cx = minX + width / 2;
    minX = cx - targetWidth / 2;
    width = targetWidth;
  }

  return { minX, minY, width, height };
}

// Deslocamento pequeno e determinístico (baseado no id da rota) pra cidades
// do mesmo país não caírem exatamente em cima uma da outra no mapa.
function hashOffset(seed: string, range: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 1000) / 1000 - 0.5) * 2 * range;
}

const LAND_PATHS = [
  'M120,70 C170,45 240,55 275,80 C305,100 300,140 270,160 C300,180 290,210 260,215 C220,225 180,205 160,180 C130,190 105,165 110,135 C90,110 95,80 120,70 Z',
  'M230,235 C265,225 300,245 305,285 C310,320 290,360 265,385 C245,400 220,385 215,355 C195,330 200,290 215,265 C215,250 220,240 230,235 Z',
  'M470,95 C505,75 545,85 565,105 C585,95 610,105 605,125 C625,135 620,160 600,165 C605,185 585,195 565,185 C540,200 505,190 495,165 C470,160 460,130 470,95 Z',
  'M480,175 C520,165 560,185 570,225 C580,265 565,310 540,340 C515,365 485,350 480,315 C455,290 460,245 470,215 C465,200 470,185 480,175 Z',
  'M600,90 C660,60 740,65 800,90 C860,105 900,140 895,175 C910,195 890,220 860,215 C840,240 800,235 780,215 C740,225 700,210 680,185 C650,190 610,170 600,140 C585,120 590,105 600,90 Z',
  'M840,290 C875,280 910,295 915,320 C920,345 895,365 865,360 C840,358 825,340 830,318 C828,305 832,295 840,290 Z',
];

export function TripMap({ routes }: { routes: TripMapRoute[] }) {
  const { lang } = useLanguage();
  const [activeId, setActiveId] = useState<string | null>(null);

  const points = useMemo(() => {
    const withCoords = routes
      .map((r) => {
        const code = countryNameToCode(r.country);
        const coords = code ? COUNTRY_COORDS[code as keyof typeof COUNTRY_COORDS] : undefined;
        return coords ? { ...r, code: code as string, lat: coords[0], lng: coords[1] } : null;
      })
      .filter((r): r is TripMapRoute & { code: string; lat: number; lng: number } => r !== null)
      .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));

    return withCoords.map((r, i) => {
      const jLat = r.lat + hashOffset(r.id + 'lat', 4);
      const jLng = r.lng + hashOffset(r.id + 'lng', 4);
      const { x, y } = project(jLat, jLng);
      return { ...r, x, y, order: i + 1 };
    });
  }, [routes]);

  if (points.length === 0) return null;

  const pathD = points.reduce((d, p, i) => {
    if (i === 0) return `M${p.x.toFixed(1)},${p.y.toFixed(1)} `;
    const prev = points[i - 1];
    const mx = (prev.x + p.x) / 2;
    const my = (prev.y + p.y) / 2 - 18;
    return `${d}Q${mx.toFixed(1)},${my.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)} `;
  }, '');

  const active = points.find((p) => p.id === activeId) ?? null;
  const view = fitViewBox(points);

  return (
    <div className="trip-map">
      <svg viewBox={`${view.minX.toFixed(1)} ${view.minY.toFixed(1)} ${view.width.toFixed(1)} ${view.height.toFixed(1)}`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="tripMapWave" width="40" height="14" patternUnits="userSpaceOnUse">
            <path d="M0,7 Q10,0 20,7 T40,7" className="trip-map-wave" />
          </pattern>
          {points.map((p) => (
            <clipPath id={`tripMapClip-${p.id}`} key={p.id}><circle cx="0" cy="0" r="11" /></clipPath>
          ))}
        </defs>

        <g className="trip-map-graticule">
          {[83, 166, 250, 333, 416].map((y) => <line key={y} x1="0" y1={y} x2="1000" y2={y} />)}
          {[125, 250, 375, 500, 625, 750, 875].map((x) => <line key={x} x1={x} y1="0" x2={x} y2="500" />)}
        </g>
        <rect x="0" y="0" width="1000" height="500" fill="url(#tripMapWave)" opacity="0.5" />

        <g className="trip-map-land">
          {LAND_PATHS.map((d) => <path key={d} d={d} />)}
        </g>

        <path className="trip-map-route" d={pathD} />

        {points.map((p) => (
          <g
            key={p.id}
            className={`trip-map-pin${activeId === p.id ? ' active' : ''}`}
            transform={`translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`}
            onMouseEnter={() => setActiveId(p.id)}
            onMouseLeave={() => setActiveId(null)}
          >
            <circle className="trip-map-pin-pulse" r="11" />
            <circle className="trip-map-pin-ring" r="14" />
            <circle r="11" fill="#fff" />
            <image
              href={`https://flagcdn.com/w40/${p.code.toLowerCase()}.png`}
              x="-11" y="-8.25" width="22" height="16.5"
              clipPath={`url(#tripMapClip-${p.id})`}
              preserveAspectRatio="xMidYMid slice"
            />
            <circle r="11" fill="none" stroke="#fff" strokeWidth="2" opacity="0.9" />
            <circle className="trip-map-pin-badge-bg" cx="9" cy="-9" r="6" />
            <text className="trip-map-pin-badge" x="9" y="-6.4" textAnchor="middle">{p.order}</text>
          </g>
        ))}
      </svg>

      {active && (
        <div
          className="trip-map-tooltip"
          style={{
            left: `${((active.x - view.minX) / view.width) * 100}%`,
            top: `${((active.y - view.minY) / view.height) * 100}%`,
          }}
        >
          <b>{active.city}</b><br />
          {active.country}{active.start_date ? ` · ${fmtDate(active.start_date, lang)}` : ''}
        </div>
      )}
    </div>
  );
}
