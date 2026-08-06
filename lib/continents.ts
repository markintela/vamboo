export type ContinentKey = 'AF' | 'AS' | 'EU' | 'NA' | 'OC' | 'SA';

// Mapeia cada código ISO de lib/countries.ts pro continente — usado só
// pra contar quantos continentes distintos aparecem no roteiro das
// trips do usuário (card "Continentes" do dashboard). Alguns países
// transcontinentais (Rússia, Turquia, Chipre, Geórgia, Armênia) usam a
// classificação mais comum em contexto de viagem, não a divisão
// geográfica estrita por área.
export const CONTINENT_BY_CODE: Record<string, ContinentKey> = {
  AD: 'EU', AE: 'AS', AF: 'AS', AG: 'NA', AI: 'NA', AL: 'EU', AM: 'AS', AO: 'AF', AR: 'SA', AT: 'EU', AU: 'OC', AW: 'NA', AZ: 'AS',
  BA: 'EU', BB: 'NA', BD: 'AS', BE: 'EU', BF: 'AF', BG: 'EU', BH: 'AS', BI: 'AF', BJ: 'AF', BN: 'AS', BO: 'SA', BR: 'SA', BS: 'NA', BT: 'AS', BW: 'AF', BY: 'EU', BZ: 'NA',
  CA: 'NA', CD: 'AF', CF: 'AF', CG: 'AF', CH: 'EU', CI: 'AF', CK: 'OC', CL: 'SA', CM: 'AF', CN: 'AS', CO: 'SA', CR: 'NA', CU: 'NA', CV: 'AF', CY: 'EU', CZ: 'EU',
  DE: 'EU', DJ: 'AF', DK: 'EU', DM: 'NA', DO: 'NA', DZ: 'AF',
  EC: 'SA', EE: 'EU', EG: 'AF', EH: 'AF', ER: 'AF', ES: 'EU', ET: 'AF',
  FI: 'EU', FJ: 'OC', FM: 'OC', FR: 'EU',
  GA: 'AF', GB: 'EU', GD: 'NA', GE: 'AS', GH: 'AF', GM: 'AF', GN: 'AF', GQ: 'AF', GR: 'EU', GT: 'NA', GW: 'AF', GY: 'SA',
  HK: 'AS', HN: 'NA', HR: 'EU', HT: 'NA', HU: 'EU',
  ID: 'AS', IE: 'EU', IL: 'AS', IN: 'AS', IQ: 'AS', IR: 'AS', IS: 'EU', IT: 'EU',
  JM: 'NA', JO: 'AS', JP: 'AS',
  KE: 'AF', KG: 'AS', KH: 'AS', KI: 'OC', KM: 'AF', KN: 'NA', KP: 'AS', KR: 'AS', KW: 'AS', KZ: 'AS',
  LA: 'AS', LB: 'AS', LC: 'NA', LI: 'EU', LK: 'AS', LR: 'AF', LS: 'AF', LT: 'EU', LU: 'EU', LV: 'EU', LY: 'AF',
  MA: 'AF', MC: 'EU', MD: 'EU', ME: 'EU', MG: 'AF', MH: 'OC', MK: 'EU', ML: 'AF', MM: 'AS', MN: 'AS', MR: 'AF', MT: 'EU', MU: 'AF', MV: 'AS', MW: 'AF', MX: 'NA', MY: 'AS', MZ: 'AF',
  NA: 'AF', NE: 'AF', NG: 'AF', NI: 'NA', NL: 'EU', NO: 'EU', NP: 'AS', NR: 'OC', NZ: 'OC',
  OM: 'AS',
  PA: 'NA', PE: 'SA', PG: 'OC', PH: 'AS', PK: 'AS', PL: 'EU', PS: 'AS', PT: 'EU', PW: 'OC', PY: 'SA',
  QA: 'AS',
  RO: 'EU', RS: 'EU', RU: 'EU', RW: 'AF',
  SA: 'AS', SB: 'OC', SC: 'AF', SD: 'AF', SE: 'EU', SG: 'AS', SI: 'EU', SK: 'EU', SL: 'AF', SM: 'EU', SN: 'AF', SO: 'AF', SR: 'SA', SS: 'AF', ST: 'AF', SV: 'NA', SY: 'AS', SZ: 'AF',
  TD: 'AF', TG: 'AF', TH: 'AS', TJ: 'AS', TL: 'AS', TM: 'AS', TN: 'AF', TO: 'OC', TR: 'AS', TT: 'NA', TV: 'OC', TW: 'AS', TZ: 'AF',
  UA: 'EU', UG: 'AF', US: 'NA', UY: 'SA', UZ: 'AS',
  VA: 'EU', VC: 'NA', VE: 'SA', VN: 'AS', VU: 'OC',
  WS: 'OC',
  YE: 'AS',
  ZA: 'AF', ZM: 'AF', ZW: 'AF',
};
