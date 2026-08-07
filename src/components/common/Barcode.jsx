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
      textMargin: 4,
      // A barcode's "quiet zone" (blank space flanking the bars) isn't
      // cosmetic — decoders (including phone cameras) need it to lock onto
      // where the symbol starts/ends. jsbarcode's own default is 10; an
      // earlier version of this component overrode it down to 4 to save
      // space in the printed label, which produced barcodes real-world
      // scanners couldn't reliably read even though the bar encoding
      // itself was correct. Left at the library default here.
      margin: 10,
      height,
    });
  }, [value, height]);

  return <svg ref={svgRef} className={className} shapeRendering="crispEdges" role="img" aria-label={value ? `Barcode ${value}` : "Barcode"} />;
}

export default Barcode;
