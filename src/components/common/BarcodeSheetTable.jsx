import Barcode from "./Barcode";

// The print-only # / CODE / ITEM / BARCODE table shared by Print Labels
// and Print Reference Sheet — both print on plain A4/Letter bondpaper now
// (no more small adhesive stick-on labels), so there's no reason for their
// output to look any different from each other. Sizing/spacing here is
// matched by eye against the shop's own reference-sheet sample (five rows
// per printed page there) — see the .barcode-sheet rule in index.css for
// what's scoped to escape the generic Reports/Financial print table
// styling, and the same caveat as that rule: not ruler-verified against a
// real printout, worth checking before trusting it at the edges.
function BarcodeSheetTable({ rows }) {
  return (
    <table className="barcode-sheet w-full text-sm border-collapse">
      <thead>
        <tr>
          <th className="border border-gray-800 px-2 py-1.5 text-left font-bold">#</th>
          <th className="border border-gray-800 px-2 py-1.5 text-left font-bold">CODE</th>
          <th className="border border-gray-800 px-2 py-1.5 text-left font-bold">ITEM</th>
          <th className="border border-gray-800 px-2 py-1.5 text-left font-bold">BARCODE</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((d, i) => {
          const variant = [d.brand, d.storage].filter(Boolean).join(" · ");
          return (
            <tr key={d.batchCode}>
              <td className="border border-gray-800 px-2 align-top">{i + 1}</td>
              <td className="border border-gray-800 px-2 align-top">{d.batchCode}</td>
              <td className="border border-gray-800 px-2 align-top">
                <p>{d.device}</p>
                {variant && <p className="text-gray-500">{variant}</p>}
              </td>
              <td className="border border-gray-800 px-2 align-top">
                <div className="inline-block border border-dashed border-gray-400 p-2">
                  <Barcode value={d.batchCode} height={80} className="barcode-sheet-img h-auto" />
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default BarcodeSheetTable;
