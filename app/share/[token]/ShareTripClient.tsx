'use client';

import { Download, ExternalLink } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Flag } from '@/components/Flag';
import { countryNameToCode } from '@/lib/countries';
import { useLanguage } from '@/lib/i18n/context';
import { daysBetween, fmtDate, fmtTime } from '@/lib/dates';
import { TRANSPORT_META, ACCOMMODATION_META } from '@/lib/expenseMeta';
import type { TransportType, AccommodationType } from '@/lib/types';

export type PublicRoute = { id: string; country: string; city: string; start_date: string | null; end_date: string | null; order_index: number; notes: string | null };
export type PublicTransportDoc = { id: string; label: string | null };
export type PublicTransport = {
  id: string; route_id: string | null; transport_type: TransportType; description: string | null;
  transport_date: string | null; flight_time: string | null; arrival_time: string | null;
  documents: PublicTransportDoc[];
};
export type PublicHotel = {
  id: string; route_id: string | null; name: string; address: string | null;
  checkin: string | null; checkout: string | null; accommodation_type: AccommodationType;
  link: string | null; reservation_file_path: string | null;
};
export type PublicDocument = { id: string; route_id: string | null; label: string };
export type PublicTrip = {
  id: string; name: string; start_date: string | null; end_date: string | null;
  departure_country: string | null; departure_city: string | null; arrival_country: string | null; arrival_city: string | null;
  color_index: number;
  trip_routes: PublicRoute[];
  trip_transports: PublicTransport[];
  hotels: PublicHotel[];
  trip_documents: PublicDocument[];
};

export function ShareTripClient({ trip, token }: { trip: PublicTrip; token: string }) {
  const { lang, t } = useLanguage();

  function downloadUrl(type: 'document' | 'transport' | 'hotel', id: string) {
    return `/api/share/${token}/download?type=${type}&id=${id}`;
  }

  const routes = trip.trip_routes.slice().sort((a, b) => a.order_index - b.order_index);

  const transportsByRoute = new Map<string, PublicTransport[]>();
  for (const tr of trip.trip_transports) {
    if (!tr.route_id) continue;
    const list = transportsByRoute.get(tr.route_id);
    if (list) list.push(tr); else transportsByRoute.set(tr.route_id, [tr]);
  }
  const hotelsByRoute = new Map<string, PublicHotel[]>();
  for (const h of trip.hotels) {
    if (!h.route_id) continue;
    const list = hotelsByRoute.get(h.route_id);
    if (list) list.push(h); else hotelsByRoute.set(h.route_id, [h]);
  }
  const docsByRoute = new Map<string, PublicDocument[]>();
  const unassignedDocs: PublicDocument[] = [];
  for (const d of trip.trip_documents) {
    if (d.route_id) {
      const list = docsByRoute.get(d.route_id);
      if (list) list.push(d); else docsByRoute.set(d.route_id, [d]);
    } else {
      unassignedDocs.push(d);
    }
  }

  return (
    <div>
      <div className="topbar topbar-centered">
        <Logo markSize={34} />
        <div className="topbar-actions">
          <LanguageSwitcher />
        </div>
      </div>

      <div className="page">
        <span className="status-badge badge-neutral">{t('share.viewOnlyBadge')}</span>
        <h1 className="page-title" style={{ marginTop: 10 }}>{trip.name}</h1>
        <p className="page-sub">
          {fmtDate(trip.start_date, lang)} – {fmtDate(trip.end_date, lang)} · {daysBetween(trip.start_date, trip.end_date)} {t('summary.nights')}
        </p>

        {routes.map((route) => {
          const code = countryNameToCode(route.country);
          const transports = transportsByRoute.get(route.id) ?? [];
          const hotels = hotelsByRoute.get(route.id) ?? [];
          const docs = docsByRoute.get(route.id) ?? [];
          return (
            <div className="gallery-section" key={route.id}>
              <div className="gallery-section-title">
                {code && <Flag code={code} size={16} />}
                <h3>{route.city}</h3>
                <span className="gallery-section-country">{route.country}</span>
              </div>

              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink-soft)', margin: '0 0 12px' }}>
                {fmtDate(route.start_date, lang)} – {fmtDate(route.end_date, lang)}
              </div>
              {route.notes && <p style={{ fontSize: 13, margin: '0 0 12px' }}>{route.notes}</p>}

              {transports.length > 0 && (
                <div className="route-expenses" style={{ marginBottom: 14 }}>
                  <div className="route-expenses-label">{t('transport.sectionTitle')}</div>
                  {transports.map((tr) => {
                    const meta = TRANSPORT_META[tr.transport_type];
                    const TransportIcon = meta.icon;
                    return (
                      <div key={tr.id} style={{ padding: '9px 0' }}>
                        <div className="expense-row" style={{ padding: 0 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="transport-type-icon" style={{ background: meta.color }} title={t(meta.labelKey)}>
                              <TransportIcon size={14} />
                            </span>
                            {tr.description}
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink-soft)', textAlign: 'right' }}>
                            {fmtDate(tr.transport_date, lang)}
                            {tr.flight_time && <><br />{fmtTime(tr.flight_time)}{tr.arrival_time ? ` → ${fmtTime(tr.arrival_time)}` : ''}</>}
                          </span>
                        </div>
                        {tr.documents.length > 0 && (
                          <div className="transport-doc-list" style={{ marginTop: 8 }}>
                            {tr.documents.map((doc) => (
                              <a key={doc.id} className="pill-btn" href={downloadUrl('transport', doc.id)}>
                                <Download size={13} /> {doc.label || t('transport.documentFallbackName')}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {hotels.map((h) => (
                <div className="hotel-card" key={h.id} style={{ marginBottom: 14 }}>
                  <div className="card-head">
                    <div className="hotel-top">
                      <h4>
                        <span className="expense-tag" style={{ background: ACCOMMODATION_META[h.accommodation_type].color }}>
                          {t(ACCOMMODATION_META[h.accommodation_type].labelKey)}
                        </span>
                        {h.name}
                      </h4>
                    </div>
                  </div>
                  <div className="card-body">
                    {h.address && <div className="hotel-addr">📍 {h.address}</div>}
                    <div className="hotel-meta">
                      <span>{t('hotel.checkin')} <b>{fmtDate(h.checkin, lang)}</b></span>
                      <span>{t('hotel.checkout')} <b>{fmtDate(h.checkout, lang)}</b></span>
                      <span><b>{daysBetween(h.checkin, h.checkout)}</b> {t('common.nights')}</span>
                    </div>
                    <div className="hotel-actions">
                      {h.link && <a className="pill-btn" href={h.link} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> {t('hotel.viewReservation')}</a>}
                      {h.reservation_file_path && (
                        <a className="pill-btn" href={downloadUrl('hotel', h.id)}><Download size={13} /> {t('hotel.viewAttachment')}</a>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {docs.length > 0 && (
                <div className="route-expenses">
                  {docs.map((d) => (
                    <div className="expense-row" key={d.id}>
                      <span>📎 {d.label}</span>
                      <a className="pill-btn" href={downloadUrl('document', d.id)}><Download size={13} /> {t('documents.download')}</a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {unassignedDocs.length > 0 && (
          <div className="gallery-section">
            <div className="gallery-section-title"><h3>{t('documents.noLocationSection')}</h3></div>
            <div className="route-expenses">
              {unassignedDocs.map((d) => (
                <div className="expense-row" key={d.id}>
                  <span>📎 {d.label}</span>
                  <a className="pill-btn" href={downloadUrl('document', d.id)}><Download size={13} /> {t('documents.download')}</a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
