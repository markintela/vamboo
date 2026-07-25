const MOSAIC = [
  '#e8524b', '#ef9a3d', '#9a6fe0',
  '#f0bc2e', '#b4b79b', '#2f9be0',
  '#79c94a', '#23b287', '#24b8bd',
];

export function LogoMark({ size = 40 }: { size?: number }) {
  const cell = size / 3;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      <g transform={`rotate(45 ${size / 2} ${size / 2})`}>
        {MOSAIC.map((c, i) => {
          const row = Math.floor(i / 3);
          const col = i % 3;
          return <rect key={i} x={col * cell} y={row * cell} width={cell + 0.5} height={cell + 0.5} fill={c} />;
        })}
      </g>
    </svg>
  );
}

/**
 * O nome é dimensionado a partir do tamanho da marca (markSize), não com um
 * font-size fixo — assim os dois sempre ficam visualmente equilibrados,
 * em qualquer lugar que a logo apareça (topo, login, etc).
 */
export function Logo({ markSize = 40 }: { markSize?: number }) {
  const fontSize = Math.round(markSize * 0.72);
  return (
    <div className="logo">
      <div className="logo-mark"><LogoMark size={markSize} /></div>
      <div className="logo-word" style={{ fontSize }}>Vamboo</div>
    </div>
  );
}
