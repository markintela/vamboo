'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { countryNameToCode } from '@/lib/countries';
import { COUNTRY_COORDS } from '@/lib/countryCoords';
import { WORLD_LAND_PATH } from '@/lib/worldMapPath';
import { fmtDate, routeStatus } from '@/lib/dates';
import { useLanguage } from '@/lib/i18n/context';
import { Flag } from '@/components/Flag';

interface TripMapRoute {
  id: string;
  city: string;
  country: string;
  start_date: string | null;
  end_date?: string | null;
  tripName?: string;
}

// Status de cada perna do trajeto: "done" já foi percorrida (cidade no
// passado), "active" é sempre a próxima parada — a que está rolando agora
// (routeStatus === 'current'), ou, se nenhuma estiver rolando agora, a
// primeira ainda não percorrida — e "disabled" é qualquer trecho futuro
// depois dessa.
type LegStatus = 'done' | 'active' | 'disabled' | 'neutral';

function legStatuses(points: { start_date: string | null; end_date?: string | null }[]): LegStatus[] {
  let activeAssigned = false;
  return points.map((p) => {
    const status = routeStatus({ start_date: p.start_date, end_date: p.end_date ?? null });
    if (status === 'past') return 'done';
    if (status === 'current' && !activeAssigned) { activeAssigned = true; return 'active'; }
    if (!activeAssigned) { activeAssigned = true; return 'active'; }
    return 'disabled';
  });
}

interface ViewBox { minX: number; minY: number; width: number; height: number }

function project(lat: number, lng: number) {
  return { x: ((lng + 180) / 360) * 1000, y: ((90 - lat) / 180) * 500 };
}

const DEFAULT_MAP_RATIO = 2; // fallback antes de medir o container de verdade (1º render)
const MIN_SPAN_X = 130; // não deixa dar zoom além disso, mesmo com rotas bem próximas
const PADDING_RATIO = 0.35; // margem ao redor dos pinos, proporcional ao tamanho do grupo
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 8;

// Ajusta o viewBox pra enquadrar só a região onde as rotas estão — sem
// isso, poucas cidades num só continente ficam minúsculas no meio de um
// viewBox que sempre mostra o mundo inteiro. `ratio` é largura/altura do
// container de verdade (medido via ResizeObserver) — o CSS usa
// max-height pra limitar a altura do mapa, o que quebra o aspect-ratio
// declarado em telas largas; sem isso, o enquadramento calculado aqui
// não bate com o que realmente aparece na tela e os pinos ficam com
// margens invisíveis de um lado (mesma cor do oceano) em vez de
// centralizados de verdade.
function fitViewBox(points: { x: number; y: number }[], ratio: number): ViewBox {
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
  if (height < MIN_SPAN_X / ratio) {
    const cy = (minY + maxY) / 2;
    minY = cy - MIN_SPAN_X / ratio / 2;
    height = MIN_SPAN_X / ratio;
  }

  // estica o eixo mais curto até bater com a proporção real do container
  if (width / height > ratio) {
    const targetHeight = width / ratio;
    const cy = minY + height / 2;
    minY = cy - targetHeight / 2;
    height = targetHeight;
  } else {
    const targetWidth = height * ratio;
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

export function TripMap({ routes, large, zoomable, showOrder = true, showRoute = true, groupByCountry = false }: {
  routes: TripMapRoute[];
  large?: boolean;
  zoomable?: boolean;
  showOrder?: boolean;
  showRoute?: boolean;
  groupByCountry?: boolean;
}) {
  const { lang, t } = useLanguage();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(zoomable ? MIN_ZOOM : 1);
  const containerRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(DEFAULT_MAP_RATIO);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const { clientWidth: w, clientHeight: h } = el;
      if (w > 0 && h > 0) setRatio(w / h);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = useMemo(() => {
    const withCoords = routes
      .map((r) => {
        const code = countryNameToCode(r.country);
        const coords = code ? COUNTRY_COORDS[code as keyof typeof COUNTRY_COORDS] : undefined;
        return coords ? { ...r, code: code as string, lat: coords[0], lng: coords[1] } : null;
      })
      .filter((r): r is TripMapRoute & { code: string; lat: number; lng: number } => r !== null)
      .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));

    if (groupByCountry) {
      const byCode = new Map<string, typeof withCoords>();
      for (const r of withCoords) {
        const list = byCode.get(r.code);
        if (list) list.push(r); else byCode.set(r.code, [r]);
      }
      return Array.from(byCode.values()).map((group) => {
        const first = group[0];
        const { x, y } = project(first.lat, first.lng);
        return { ...first, x, y, order: 1, visitCount: group.length, status: 'neutral' as LegStatus };
      });
    }

    const statuses = legStatuses(withCoords);
    return withCoords.map((r, i) => {
      const jLat = r.lat + hashOffset(r.id + 'lat', 4);
      const jLng = r.lng + hashOffset(r.id + 'lng', 4);
      const { x, y } = project(jLat, jLng);
      return { ...r, x, y, order: i + 1, visitCount: 1, status: statuses[i] };
    });
  }, [routes, groupByCountry]);

  useEffect(() => { setZoom(zoomable ? MIN_ZOOM : 1); }, [points.length, zoomable]);

  if (points.length === 0) return null;

  // Um <path> por trecho (não mais uma curva única) — cada um herda o
  // status do ponto de chegada, pra poder colorir/tracejar cada perna do
  // trajeto de um jeito diferente (já percorrida / próxima / ainda distante).
  const segments = points.slice(1).map((p, i) => {
    const prev = points[i];
    const mx = (prev.x + p.x) / 2;
    const my = (prev.y + p.y) / 2 - 18;
    return {
      id: p.id,
      status: p.status,
      d: `M${prev.x.toFixed(1)},${prev.y.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)}`,
    };
  });

  const active = points.find((p) => p.id === activeId) ?? null;
  const baseView = fitViewBox(points, ratio);
  const view = zoomable ? zoomViewBox(baseView, zoom) : baseView;

  function togglePin(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setActiveId((cur) => (cur === id ? null : id));
  }

  return (
    <div className={`trip-map${large ? ' trip-map-lg' : ''}`} ref={containerRef} onClick={() => setActiveId(null)}>
      <svg
        viewBox={`${view.minX.toFixed(1)} ${view.minY.toFixed(1)} ${view.width.toFixed(1)} ${view.height.toFixed(1)}`}
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="tripMapWave" width="40" height="14" patternUnits="userSpaceOnUse">
            <path d="M0,7 Q10,0 20,7 T40,7" className="trip-map-wave" />
          </pattern>
        </defs>

        <g className="trip-map-graticule">
          {[83, 166, 250, 333, 416].map((y) => <line key={y} x1="0" y1={y} x2="1000" y2={y} />)}
          {[125, 250, 375, 500, 625, 750, 875].map((x) => <line key={x} x1={x} y1="0" x2={x} y2="500" />)}
        </g>
        <rect x="0" y="0" width="1000" height="500" fill="url(#tripMapWave)" opacity="0.5" />

        <g className="trip-map-land">
          <path d={WORLD_LAND_PATH} vectorEffect="non-scaling-stroke" />
        </g>

        {showRoute && segments.map((seg) => (
          <path key={seg.id} className={`trip-map-route status-${seg.status}`} d={seg.d} vectorEffect="non-scaling-stroke" />
        ))}

        {points.map((p) => (
          <g
            key={p.id}
            className={`trip-map-pin status-${p.status}${activeId === p.id ? ' open' : ''}`}
            transform={`translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`}
            onClick={(e) => togglePin(e, p.id)}
          >
            <circle className="trip-map-pin-pulse" r="11" />
            <circle className="trip-map-pin-ring" r="14" />
            <circle className="trip-map-pin-dot" r="11" />
            <circle r="11" fill="none" stroke="#fff" strokeWidth="2" opacity="0.9" />
            {showOrder && <text className="trip-map-pin-number" x="0" y="3.2" textAnchor="middle">{p.order}</text>}
          </g>
        ))}
      </svg>

      {zoomable && (
        <div className="trip-map-zoom">
          <button type="button" className="icon-btn" onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.min(z * 1.5, MAX_ZOOM)); }} aria-label="Zoom +"><Plus size={14} /></button>
          <button type="button" className="icon-btn" onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.max(z / 1.5, MIN_ZOOM)); }} aria-label="Zoom -"><Minus size={14} /></button>
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
          <div className="trip-map-tooltip-head">
            <Flag code={active.code} size={16} />
            <b>{groupByCountry ? active.country : active.city}</b>
          </div>
          <div className="trip-map-tooltip-sub">
            {groupByCountry
              ? t('map.visitedTimes', { count: String(active.visitCount) })
              : (active.tripName ? active.tripName : `${active.country}${active.start_date ? ` · ${fmtDate(active.start_date, lang)}` : ''}`)}
          </div>
        </div>
      )}
    </div>
  );
}
