import { formatDate, formatTime } from "../../../utils/datetime";
import Barcode from "../../common/Barcode";
import { STORE_ADDRESS, STORE_PHONE, RETURN_POLICY, getSaleReference } from "./receiptShared";

// A real Android-tablet print showed every ₱ sign missing — that print
// path's font apparently doesn't carry the peso glyph and just drops it,
// even though the same "₱" prints fine through the desktop/thermal-driver
// path. "P" is plain ASCII, safe on any printer's built-in font regardless
// of Unicode support.
const peso = (n) => "P" + (Number(n) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// That same real print also showed every label/value row (Subtotal,
// TOTAL, item prices) collapsed into plain concatenated text with a
// single space between them instead of spread label-left/value-right —
// exactly what happens when a print path extracts plain text from the
// page instead of rendering it visually, discarding flexbox (and any
// other CSS layout) entirely. Building these rows as one manually
// space-padded monospace string instead survives that: the alignment
// IS the text content, not a layout effect a stripped-CSS print path can
// undo. Kept as a single text node (not separate label/value elements)
// so a plain-text extractor can't insert its own extra space between
// them the way it did with the old two-span flex row.
//
// RECEIPT_FONT_PX bakes in a legible size directly (staff were manually
// setting the print dialog's Scale to 110% every sale, easy to forget) —
// 20 characters is what actually fits the 46mm print area at that size
// (46mm ≈ 174px at the CSS-standard 96dpi reference pixel; Courier's
// advance width is ~0.6em/character). Both figures are provisional
// pending a real test print, like every other physical measurement here.
// white-space: pre-wrap preserves the padding (unlike normal, which
// collapses repeated spaces) while still wrapping instead of overflowing
// horizontally if a line ends up longer than expected.
const RECEIPT_FONT_PX = 14;
const RECEIPT_CHARS = 20;

function padLine(left, right) {
  const gap = RECEIPT_CHARS - left.length - right.length;
  if (gap < 1) {
    // Doesn't fit on one line — value goes on its own line instead of
    // running off the page, same reason flex-wrap was needed elsewhere.
    return `${left}\n${right.padStart(RECEIPT_CHARS)}`;
  }
  return `${left}${" ".repeat(gap)}${right}`;
}

function Row({ label, value }) {
  return <div style={{ whiteSpace: "pre-wrap" }}>{padLine(label, value)}</div>;
}

// Receipt body tuned for this shop's Android tablet print path
// specifically, which (confirmed via real prints) extracts plain text
// from the page and strips both CSS layout and non-ASCII characters —
// every choice here (monospace padding instead of flexbox, ASCII "P"
// instead of "₱", ASCII " - " instead of "·") exists because of a real
// print that came out wrong otherwise. Deliberately a separate component
// from ReceiptBodyMac/ReceiptBodyWindows (not a shared template with an
// Android flag) — editing this file for an Android-specific fix should
// never be able to change what those print.
function ReceiptBodyAndroid({ receipt }) {
  const subtotal = receipt.items.reduce((sum, i) => sum + (Number(i.price) || 0), 0);
  const saleReference = getSaleReference(receipt.soldAt, receipt.saleId);
  const hasReferenceSection =
    (receipt.referenceNumber && receipt.referenceNumber !== "N/A") ||
    receipt.downPayment != null ||
    receipt.balance != null;
  // Down Payment/Balance only get recorded for a financed sale (see
  // FINANCING_METHODS in NewSale.jsx) — labeling the total explicitly as
  // the device's full price avoids it reading as "amount paid today" when
  // that's actually the down payment shown just below it.
  const isInstallment = receipt.downPayment != null || receipt.balance != null;

  return (
    <div
      className="mx-auto w-[320px] max-w-full p-5 print:w-[46mm] print:ml-0 print:mr-auto print:p-0 text-gray-900 max-h-[65vh] overflow-y-auto print:max-h-none print:overflow-visible"
      style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: `${RECEIPT_FONT_PX}px` }}
    >
      <div className="text-center">
        <div className="w-11 h-11 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-sm mx-auto mb-1.5">
          MG
        </div>
        <p className="text-sm font-bold tracking-wide">MARK GADGETS & ACCESSORIES SHOP</p>
        <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
          {STORE_ADDRESS.map((line) => (
            <span key={line}>
              {line}
              <br />
            </span>
          ))}
          {STORE_PHONE}
        </p>
      </div>

      <div className="border-t border-dashed border-gray-400 my-2.5" />

      <div className="space-y-0.5">
        {/* Date and time as two rows, not one "Date:" row holding both —
            "Date: Aug 8, 2026 6:57 PM" runs past RECEIPT_CHARS on its own,
            which padLine then wraps into a lone "Date:" label sitting
            above a right-padded value on the next line. Two short rows
            both fit on one line each regardless of the exact character
            budget, instead of depending on getting that budget exactly
            right. */}
        <Row label="Date:" value={formatDate(receipt.soldAt)} />
        <Row label="Time:" value={formatTime(receipt.soldAt)} />
        {receipt.customerName && <Row label="Customer:" value={receipt.customerName} />}
        {receipt.customerPhone && <Row label="Contact:" value={receipt.customerPhone} />}
      </div>

      <div className="border-t border-dashed border-gray-400 my-2.5" />

      <div>
        {receipt.items.map((item, i) => (
          <div key={i} className="mb-2">
            <p className="font-bold">{item.device}</p>
            {item.storage && (
              <p className="text-gray-500">{item.storage}</p>
            )}
            {item.batchCode && <p className="text-gray-500">Batch: {item.batchCode}</p>}
            {/* Every unit here is a serialized device — qty is always
                exactly 1, so a separate "1 x price" alongside the same
                price again as a line total was always showing the same
                number twice. One value, right-aligned when CSS is
                honored (text-right), still perfectly readable flush left
                on a print path that strips CSS instead — unlike a
                label/value pair, a single number is never ambiguous
                either way. */}
            <p className="mt-0.5 text-right">{peso(item.price)}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-gray-400 my-2.5" />

      <div className="space-y-0.5">
        <div style={{ whiteSpace: "pre-wrap" }}>{padLine("Subtotal", peso(subtotal))}</div>
        <div className="font-bold text-base border-t border-gray-900 pt-1.5 mt-1" style={{ whiteSpace: "pre-wrap" }}>
          {padLine(isInstallment ? "DEVICE TOTAL" : "TOTAL", peso(subtotal))}
        </div>
      </div>

      {hasReferenceSection && (
        <>
          <div className="border-t border-dashed border-gray-400 my-2.5" />
          <div className="space-y-0.5">
            {receipt.referenceNumber && receipt.referenceNumber !== "N/A" && (
              <Row label="Reference #:" value={receipt.referenceNumber} />
            )}
            {receipt.downPayment != null && <Row label="Down Payment:" value={peso(receipt.downPayment)} />}
            {receipt.balance != null && <Row label="Balance:" value={peso(receipt.balance)} />}
          </div>
        </>
      )}

      {saleReference && (
        <>
          <div className="border-t border-dashed border-gray-400 my-2.5" />
          <div className="text-center">
            <Barcode value={saleReference.barcodeValue} height={30} className="mx-auto max-w-full h-auto" />
            <p className="text-[10px] tracking-widest mt-0.5">{saleReference.label}</p>
          </div>
        </>
      )}

      <p className="text-center font-bold mt-2.5">Thank you and God Bless</p>
      <p className="text-center text-[11px] text-gray-500 mt-3 leading-relaxed">
        {RETURN_POLICY}
        <br />
        Please keep this receipt for warranty and return purposes.
        <br />
        &copy; 2019 MARK Gadgets & Accessories Shop. All rights reserved.
      </p>

      {receipt.notes && <p className="text-[11px] text-gray-500 mt-2 pt-2 border-t border-dashed border-gray-400">{receipt.notes}</p>}
    </div>
  );
}

export default ReceiptBodyAndroid;
