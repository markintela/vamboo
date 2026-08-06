'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { countryNameToCode } from '@/lib/countries';
import { COUNTRY_COORDS } from '@/lib/countryCoords';
import { WORLD_LAND_PATH } from '@/lib/worldMapPath';
import { fmtDate } from '@/lib/dates';
import { useLanguage } from '@/lib/i18n/context';

interface TripMapRoute {
  id: string;
  city: string;
  country: string;
  start_date: string | null;
  tripName?: string;
}

interface ViewBox { minX: number; minY: number; width: number; height: number }

function project(lat: number, lng: number) {
  return { x: ((lng + 180) / 360) * 1000, y: ((90 - lat) / 180) * 500 };
}

const MAP_RATIO = 2; // largura/altura do viewBox — precisa bater com o aspect-ratio do CSS
const MIN_SPAN_X = 130; // não deixa dar zoom além disso, mesmo com rotas bem próximas
const PADDING_RATIO = 0.35; // margem ao redor dos pinos, proporcional ao tamanho do grupo
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 8;

// Ajusta o viewBox pra enquadrar só a região onde as rotas estão — sem
// isso, poucas cidades num só continente ficam minúsculas no meio de um
// viewBox que sempre mostra o mundo inteiro.
function fitViewBox(points: { x: number; y: number }[]): ViewBox {
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

function zoomViewBox(view: ViewBox, zoom: number): ViewBox {
  const cx = view.minX + view.width / 2;
  const cy = view.minY + view.height / 2;
  const width = view.width / zoom;
  const height = view.height / zoom;
  return { minX: cx - width / 2, minY: cy - height / 2, width, height };
}

// Deslocamento pequeno e determinístico (baseado no id da rota) pra cidades
// do mesmo país não caírem exatamente em cima uma da outra no mapa.
function hashOffset(seed: string, range: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 1000) / 1000 - 0.5) * 2 * range;
}

export function TripMap({ routes, large, zoomable, showOrder = true, showRoute = true }: {
  routes: TripMapRoute[];
  large?: boolean;
  zoomable?: boolean;
  showOrder?: boolean;
  showRoute?: boolean;
}) {
  const { lang } = useLanguage();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

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

  useEffect(() => { setZoom(1); }, [points.length]);

  if (points.length === 0) return null;

  const pathD = points.reduce((d, p, i) => {
    if (i === 0) return `M${p.x.toFixed(1)},${p.y.toFixed(1)} `;
    const prev = points[i - 1];
    const mx = (prev.x + p.x) / 2;
    const my = (prev.y + p.y) / 2 - 18;
    return `${d}Q${mx.toFixed(1)},${my.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)} `;
  }, '');

  const active = points.find((p) => p.id === activeId) ?? null;
  const baseView = fitViewBox(points);
  const view = zoomable ? zoomViewBox(baseView, zoom) : baseView;

  return (
    <div className={`trip-map${large ? ' trip-map-lg' : ''}`}>
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
          <path d={WORLD_LAND_PATH} vectorEffect="non-scaling-stroke" />
        </g>

        {showRoute && <path className="trip-map-route" d={pathD} vectorEffect="non-scaling-stroke" />}

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
            {showOrder && (
              <>
                <circle className="trip-map-pin-badge-bg" cx="9" cy="-9" r="6" />
                <text className="trip-map-pin-badge" x="9" y="-6.4" textAnchor="middle">{p.order}</text>
              </>
            )}
          </g>
        ))}
      </svg>

      {zoomable && (
        <div className="trip-map-zoom">
          <button type="button" className="icon-btn" onClick={() => setZoom((z) => Math.min(z * 1.5, MAX_ZOOM))} aria-label="Zoom +"><Plus size={14} /></button>
          <button type="button" className="icon-btn" onClick={() => setZoom((z) => Math.max(z / 1.5, MIN_ZOOM))} aria-label="Zoom -"><Minus size={14} /></button>
        </div>
      )}

      {active && (
        <div
          className="trip-map-tooltip"
          style={{
            left: `${((active.x - view.minX) / view.width) * 100}%`,
            top: `${((active.y - view.minY) / view.height) * 100}%`,
          }}
        >
          <b>{active.city}</b><br />
          {active.tripName ? active.tripName : `${active.country}${active.start_date ? ` · ${fmtDate(active.start_date, lang)}` : ''}`}
        </div>
      )}
    </div>
  );
}
