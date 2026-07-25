import { LogoMark } from './Logo';

export function LogoWatermark() {
  return (
    <div className="logo-watermark" aria-hidden="true">
      <div className="logo-watermark-mark">
        <LogoMark size={900} />
      </div>
    </div>
  );
}
