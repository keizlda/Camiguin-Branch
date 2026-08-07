import { useMemo } from "react";
import { QRCodeWriter, BarcodeFormat } from "@zxing/library";

// Renders `value` as a QR code SVG using @zxing/library's own encoder — no
// extra dependency needed since @zxing/library is already installed as
// @zxing/browser's decoder backend (verified via a throwaway smoke test
// before wiring this in: QRCodeWriter.encode() returns a BitMatrix of
// on/off cells, same shape as the BitMatrix used elsewhere in this app for
// barcode-decode verification).
// shape-rendering="crispEdges" avoids anti-aliasing blur at cell
// boundaries — same reasoning as the Code128 quiet-zone fix: a camera
// decoding this later needs sharp module edges, not soft ones.
function QRCode({ value, className = "" }) {
  const cells = useMemo(() => {
    if (!value) return null;
    const matrix = new QRCodeWriter().encode(value, BarcodeFormat.QR_CODE, 200, 200, new Map());
    const width = matrix.getWidth();
    const height = matrix.getHeight();
    const on = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (matrix.get(x, y)) on.push(`${x}-${y}`);
      }
    }
    return { width, height, on };
  }, [value]);

  if (!cells) return null;

  return (
    <svg viewBox={`0 0 ${cells.width} ${cells.height}`} className={className} shapeRendering="crispEdges">
      <rect width={cells.width} height={cells.height} fill="white" />
      {cells.on.map((key) => {
        const [x, y] = key.split("-").map(Number);
        return <rect key={key} x={x} y={y} width={1} height={1} fill="black" />;
      })}
    </svg>
  );
}

export default QRCode;
