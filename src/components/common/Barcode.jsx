import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

// Renders `value` as a Code128 barcode directly onto an SVG element.
// JsBarcode sets a viewBox matching its own rendered width/height, so
// letting the SVG scale via CSS (width: 100%, height: auto) keeps it crisp
// and proportional at any print/label size instead of stretching.
function Barcode({ value, height = 40, className = "" }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    JsBarcode(svgRef.current, value, {
      format: "CODE128",
      displayValue: true,
      fontSize: 14,
      textMargin: 2,
      margin: 4,
      height,
    });
  }, [value, height]);

  return <svg ref={svgRef} className={className} />;
}

export default Barcode;
