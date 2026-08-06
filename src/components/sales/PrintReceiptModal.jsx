import { X, Printer } from "lucide-react";
import { formatDate, formatTime } from "../../utils/datetime";
import Barcode from "../common/Barcode";

// Placeholder business info — user confirmed (2026-08-06) to ship these as
// placeholders for now rather than blocking on real values. Swap these for
// the real address/phone/return policy whenever they're available; nothing
// else about the receipt depends on them.
const STORE_ADDRESS = ["Claro M. Recto Ave., Lapasan", "Cagayan de Oro City, 9000"];
const STORE_PHONE = "0912 345 6789";
const RETURN_POLICY = "No returns after 7 days.";

const peso = (n) => "₱" + (Number(n) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const paymentStatusPillClass = {
  Pending: "bg-amber-100 text-amber-800",
  Paid: "bg-green-100 text-green-800",
};

// A real printed test revealed the thermal driver wasn't honoring the
// named @page width — content rendered against a much wider assumed
// canvas, so anything past the paper's actual ~46mm printable area (long
// payment method values, longer totals) never printed at all rather than
// wrapping. flex-wrap lets the value drop to its own line instead of
// running off the page when it doesn't fit next to the label; min-w-0
// overrides flex's default min-width:auto, which otherwise blocks a flex
// child from shrinking/wrapping even when its sibling needs the room.
function Row({ label, children }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-2">
      <span className="text-gray-500">{label}</span>
      <span className="min-w-0 text-right break-words">{children}</span>
    </div>
  );
}

// Not a stored/sequential invoice number — this app's sales are identified
// by UUID, not a counter. Derived entirely from real fields (the sale's own
// date + a slice of its real id) purely for a shorter, receipt-friendly
// reference, not a fabricated fact.
//
// label (shown as text) and barcodeValue (what's actually encoded) are
// deliberately different lengths: a receipt's printable width is much
// narrower than a device label's. Verified by simulated decode at the
// actual usable width of a 58mm thermal roll (the narrowest paper this
// app supports) — a 12-character encoded value already failed there, so
// the barcode carries an 8-character value (MMDD + 4 hex chars of the
// real sale id) while the full "SALE-MMDDYY-XXXXXX" still prints as
// human-readable text underneath.
function getSaleReference(soldAt, saleId) {
  if (!soldAt || !saleId) return null;
  const d = new Date(soldAt);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const fullSuffix = saleId.replace(/-/g, "").slice(-6).toUpperCase();
  return {
    label: `SALE-${mm}${dd}${yy}-${fullSuffix}`,
    barcodeValue: `${mm}${dd}${fullSuffix.slice(-4)}`,
  };
}

// receipt shape: { saleId, soldAt, customerName, customerPhone, salesperson,
// paymentMethod, paymentStatus, orderType, referenceNumber, notes,
// downPayment, balance, items: [{ device, storage, color, batchCode, price }] }
//
// The styled receipt below is shared as-is between the on-screen preview and
// the printed page — only the surrounding modal chrome (header, backdrop,
// Close/Print buttons) is print:hidden, restyled with print: overrides
// rather than hidden outright, so nothing in its ancestor chain ever gets
// display:none (which would hide the receipt content too, since it's a
// descendant, not a sibling — see the label/receipt print bug this project
// already hit once with a naive print:hidden wrapper).
function PrintReceiptModal({ receipt, onClose }) {
  const subtotal = receipt.items.reduce((sum, i) => sum + (Number(i.price) || 0), 0);
  const saleReference = getSaleReference(receipt.soldAt, receipt.saleId);
  const handlePrint = () => window.print();

  return (
    <div className="receipt-page fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 print:static print:inset-auto print:block print:bg-transparent print:p-0 print:z-auto">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl print:shadow-none print:rounded-none print:max-w-none print:w-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 print:hidden">
          <div className="flex items-center gap-2">
            <Printer size={16} className="text-blue-500" />
            <p className="font-semibold text-gray-800">Print Receipt</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        {/* The receipt itself — identical on screen and on paper. Fixed
            320px width on screen (reads like a receipt in the preview).
            Print content has repeatedly shown right-side cutoff on real
            hardware even after narrowing to 46mm and centering, on prints
            that vary run to run despite unchanged code — pointing at the
            true printable area being narrower/positioned differently than
            assumed, not something CSS alone can fully pin down blind.
            Pushed flush left (no centering) instead of guessing another
            centered width, so whatever margin exists is on the right,
            away from where content has been getting cut. */}
        <div
          className="mx-auto w-[320px] max-w-full p-5 print:w-[46mm] print:ml-0 print:mr-auto print:p-1 text-gray-900 text-xs max-h-[65vh] overflow-y-auto print:max-h-none print:overflow-visible"
          style={{ fontFamily: "'Courier New', Courier, monospace" }}
        >
          <div className="text-center">
            <div className="w-11 h-11 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-sm mx-auto mb-1.5">
              MG
            </div>
            <p className="text-sm font-bold tracking-wide">MARK GADGETS CGN</p>
            <p className="text-[10px] text-gray-500 tracking-wide">POS &amp; INVENTORY SYSTEM</p>
            <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
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
            <Row label="Date:">
              {formatDate(receipt.soldAt)} {formatTime(receipt.soldAt)}
            </Row>
            {receipt.salesperson && <Row label="Salesperson:">{receipt.salesperson}</Row>}
            {receipt.customerName && <Row label="Customer:">{receipt.customerName}</Row>}
            {receipt.customerPhone && <Row label="Contact:">{receipt.customerPhone}</Row>}
          </div>

          <div className="border-t border-dashed border-gray-400 my-2.5" />

          <div>
            {receipt.items.map((item, i) => (
              <div key={i} className="mb-2">
                <p className="font-bold">{item.device}</p>
                {(item.storage || item.color) && (
                  <p className="text-gray-500">{[item.storage, item.color].filter(Boolean).join(" · ")}</p>
                )}
                {item.batchCode && <p className="text-gray-500">Batch: {item.batchCode}</p>}
                <div className="flex flex-wrap justify-between gap-x-2 mt-0.5">
                  <span>1 x {peso(item.price)}</span>
                  <span className="min-w-0 text-right">{peso(item.price)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-gray-400 my-2.5" />

          <div className="space-y-0.5">
            <div className="flex flex-wrap justify-between gap-x-2">
              <span className="text-gray-500">Subtotal</span>
              <span className="min-w-0 text-right">{peso(subtotal)}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-x-2 font-bold text-sm border-t border-gray-900 pt-1.5 mt-1">
              <span>TOTAL</span>
              <span className="min-w-0 text-right">{peso(subtotal)}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-400 my-2.5" />

          <div className="space-y-0.5">
            {receipt.orderType && (
              <Row label="Order Type:">{receipt.orderType === "Bulk" ? "Bulk Order" : "Regular"}</Row>
            )}
            <Row label="Payment Method:">{receipt.paymentMethod}</Row>
            <div className="flex flex-wrap justify-between gap-x-2 items-center">
              <span className="text-gray-500">Payment Status:</span>
              <span
                className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide ${
                  paymentStatusPillClass[receipt.paymentStatus] || "bg-gray-100 text-gray-700"
                }`}
              >
                {receipt.paymentStatus?.toUpperCase()}
              </span>
            </div>
            {receipt.referenceNumber && receipt.referenceNumber !== "N/A" && (
              <Row label="Reference #:">{receipt.referenceNumber}</Row>
            )}
            {receipt.downPayment != null && <Row label="Down Payment:">{peso(receipt.downPayment)}</Row>}
            {receipt.balance != null && <Row label="Balance:">{peso(receipt.balance)}</Row>}
          </div>

          {saleReference && (
            <>
              <div className="border-t border-dashed border-gray-400 my-2.5" />
              <div className="text-center">
                <Barcode value={saleReference.barcodeValue} height={30} className="mx-auto max-w-full h-auto" />
                <p className="text-[9px] tracking-widest mt-0.5">{saleReference.label}</p>
              </div>
            </>
          )}

          <p className="text-center font-bold mt-2.5">Thank you for your business!</p>
          <p className="text-center text-[10px] text-gray-500 mt-3 leading-relaxed">
            {RETURN_POLICY}
            <br />
            Please keep this receipt for warranty and return purposes.
            <br />
            &copy; {new Date().getFullYear()} Mark Gadgets CGN. All rights reserved.
          </p>

          {receipt.notes && <p className="text-[10px] text-gray-500 mt-2 pt-2 border-t border-dashed border-gray-400">{receipt.notes}</p>}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3 print:hidden">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Printer size={14} />
            Print
          </button>
        </div>
      </div>
    </div>
  );
}

export default PrintReceiptModal;
