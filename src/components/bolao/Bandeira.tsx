import { bandeiraEmoji, codigoFifaParaIso } from "@/lib/bolao/flags";
import { useState } from "react";

interface BandeiraProps {
  codigo?: string | null;
  /** Tamanho em px. Default 28. */
  size?: number;
  className?: string;
}

/**
 * Renderiza a bandeira do país via flagcdn (PNG retina).
 * Funciona em Windows/Chrome desktop (onde emoji de bandeira não renderiza).
 * Faz fallback automático para o emoji caso o CDN falhe.
 */
export function Bandeira({ codigo, size = 28, className = "" }: BandeiraProps) {
  const [erro, setErro] = useState(false);
  const iso = codigoFifaParaIso(codigo);

  if (!iso || erro) {
    return (
      <span
        className={`inline-block leading-none ${className}`}
        style={{ fontSize: size }}
        aria-label={codigo || "bandeira"}
      >
        {bandeiraEmoji(codigo)}
      </span>
    );
  }

  // flagcdn aceita "gb-eng", "gb-sct", "gb-wls" e códigos ISO2 normais (br, ar, fr...).
  const slug = iso.toLowerCase();
  // Largura dobrada para retina; altura ~ 3/4 de width (proporção padrão de bandeira)
  const wPx = Math.round(size * 1.5);
  const src = `https://flagcdn.com/w80/${slug}.png`;
  const srcSet = `https://flagcdn.com/w160/${slug}.png 2x`;

  return (
    <img
      src={src}
      srcSet={srcSet}
      onError={() => setErro(true)}
      alt={codigo || ""}
      width={wPx}
      height={size}
      loading="lazy"
      className={`inline-block rounded-[2px] object-cover shadow-sm ${className}`}
      style={{ width: wPx, height: size }}
    />
  );
}
