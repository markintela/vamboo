interface FlagProps {
  code: string;
  size?: number;
  className?: string;
}

/**
 * Bandeira como imagem (flagcdn.com), não emoji Unicode — no Windows a
 * maioria dos navegadores não tem fonte de emoji de bandeira e mostra só
 * as duas letras do código do país em vez da bandeira.
 */
export function Flag({ code, size = 20, className }: FlagProps) {
  const cc = code.toLowerCase();
  const h = Math.round(size * 0.75);
  return (
    <img
      src={`https://flagcdn.com/w40/${cc}.png`}
      srcSet={`https://flagcdn.com/w80/${cc}.png 2x`}
      width={size}
      height={h}
      alt=""
      loading="lazy"
      className={`flag-img${className ? ` ${className}` : ''}`}
    />
  );
}
