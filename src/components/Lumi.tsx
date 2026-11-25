export type EstadoLumi = 'ocioso' | 'pensando' | 'feliz'

/**
 * Lumi, a mascote do assistente: um robozinho com cabeça de lâmpada (a marca é "Lume").
 * Desenho original, em SVG. `pensando` acende mais forte e olha de lado; `feliz` sorri largo.
 */
export function Lumi({ tamanho = 120, estado = 'ocioso', flutuando = false, className = '' }: { tamanho?: number; estado?: EstadoLumi; flutuando?: boolean; className?: string }) {
  const olhoX = estado === 'pensando' ? 3 : 0
  return (
    <svg
      role="img"
      aria-label={estado === 'pensando' ? 'Lumi está pensando' : 'Lumi, o assistente'}
      data-estado={estado}
      width={tamanho}
      height={tamanho}
      viewBox="0 0 120 120"
      className={`${flutuando ? 'animate-flutuar' : ''} ${className}`}
    >
      <defs>
        <radialGradient id="lumi-brilho" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#FFE9A8" />
          <stop offset="100%" stopColor="#FFC13D" />
        </radialGradient>
      </defs>
      {/* halo */}
      <circle cx="60" cy="42" r={estado === 'pensando' ? 40 : 34} fill="#FFC13D" opacity={estado === 'pensando' ? 0.28 : 0.16} className={estado === 'pensando' ? 'animate-pulse' : ''} />
      {/* antena */}
      <path d="M60 8v-0" stroke="#18274F" strokeWidth="3" strokeLinecap="round" />
      {/* corpo */}
      <rect x="34" y="78" width="52" height="32" rx="14" fill="#18274F" />
      <rect x="44" y="88" width="32" height="9" rx="4.5" fill="#243664" />
      <circle cx="52" cy="92.5" r="2.4" fill="#FFC13D" />
      <circle cx="60" cy="92.5" r="2.4" fill="#FFC13D" opacity=".55" />
      <circle cx="68" cy="92.5" r="2.4" fill="#FFC13D" opacity=".3" />
      {/* bracinhos */}
      <rect x="22" y="84" width="14" height="8" rx="4" fill="#243664" />
      <rect x="84" y="84" width="14" height="8" rx="4" fill="#243664" />
      {/* base de rosca (pescoço) */}
      <rect x="46" y="68" width="28" height="12" rx="4" fill="#8590AA" />
      <path d="M46 72h28M46 76h28" stroke="#5B6785" strokeWidth="1.6" />
      {/* bulbo */}
      <path d="M60 10c-17 0-30 12.5-30 28 0 9 4.5 15.5 10.5 21 2.2 2 3.5 4.6 3.5 7.5V68h32v-1.5c0-2.9 1.3-5.5 3.5-7.5C85.5 53.5 90 47 90 38 90 22.5 77 10 60 10Z" fill="url(#lumi-brilho)" />
      <path d="M44 22c4-4 9-6 14-6.5" stroke="#fff" strokeOpacity=".75" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      {/* rosto */}
      <g className="origin-center animate-piscar" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
        <ellipse cx={49 + olhoX} cy="38" rx="4.2" ry="5.2" fill="#101C3D" />
        <ellipse cx={71 + olhoX} cy="38" rx="4.2" ry="5.2" fill="#101C3D" />
        <circle cx={50.4 + olhoX} cy="36" r="1.4" fill="#fff" />
        <circle cx={72.4 + olhoX} cy="36" r="1.4" fill="#fff" />
      </g>
      {estado === 'feliz' ? (
        <path d="M51 49c3 5 15 5 18 0z" fill="#101C3D" />
      ) : estado === 'pensando' ? (
        <path d="M54 51h12" stroke="#101C3D" strokeWidth="2.6" strokeLinecap="round" />
      ) : (
        <path d="M52 49.5c3 3.4 13 3.4 16 0" stroke="#101C3D" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      )}
      <circle cx="42" cy="47" r="3.6" fill="#F5A524" opacity=".45" />
      <circle cx="78" cy="47" r="3.6" fill="#F5A524" opacity=".45" />
    </svg>
  )
}
