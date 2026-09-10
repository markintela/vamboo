import { siGooglemaps } from 'simple-icons';

export function GoogleMapsIcon({ size = 14 }: { size?: number }) {
  return (
    <svg role="img" viewBox="0 0 24 24" width={size} height={size} fill={`#${siGooglemaps.hex}`} style={{ flexShrink: 0 }} aria-hidden="true">
      <path d={siGooglemaps.path} />
    </svg>
  );
}
