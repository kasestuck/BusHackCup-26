import { useMemo } from "react";
import { encode } from "uqr";

/**
 * QR as a single SVG path. Dark modules on a light field with a quiet zone:
 * the most reliable contrast for phone cameras, even on a dark UI.
 */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const { d, size } = useMemo(() => {
    const qr = encode(value, { ecc: "M", border: 2 });
    let path = "";
    qr.data.forEach((row, y) => {
      row.forEach((on, x) => {
        if (on) path += `M${x} ${y}h1v1h-1z`;
      });
    });
    return { d: path, size: qr.size };
  }, [value]);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={size} height={size} fill="#F5F7F2" />
      <path d={d} fill="#101417" />
    </svg>
  );
}
