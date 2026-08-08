import { formatDate, formatTime } from "../../../utils/datetime";
import Barcode from "../../common/Barcode";
import { STORE_ADDRESS, STORE_PHONE, RETURN_POLICY, getSaleReference } from "./receiptShared";

const peso = (n) => "₱" + (Number(n) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// This shop's Mac + thermal-driver print path renders real CSS (confirmed
// across many real prints) — unlike the Android tablet's path, which
// extracts plain text and drops non-ASCII characters. flex-wrap lets a
// value drop to its own line instead of running off the page when it
// doesn't fit next to the label; min-w-0 overrides flex's default
// min-width:auto, which otherwise blocks a flex child from shrinking/
// wrapping even when its sibling needs the room.
function Row({ label, children }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-2">
      <span className="text-gray-500">{label}</span>
      <span className="min-w-0 text-right break-words">{children}</span>
    </div>
  );
}

// Receipt body tuned for this shop's Mac (macOS + thermal driver) print
// path specifically. Deliberately a separate component from
// ReceiptBodyAndroid/ReceiptBodyWindows (not a shared template with a
// platform flag) — editing this file for a Mac-specific fix should never
// be able to change what those print. See PrintReceiptModal.jsx.
function ReceiptBodyMac({ receipt }) {
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
      className="mx-auto w-[320px] max-w-full p-5 print:w-[46mm] print:ml-0 print:mr-auto print:p-0 text-gray-900 text-sm max-h-[65vh] overflow-y-auto print:max-h-none print:overflow-visible"
      style={{ fontFamily: "'Courier New', Courier, monospace" }}
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
        <Row label="Date:">
          {formatDate(receipt.soldAt)} {formatTime(receipt.soldAt)}
        </Row>
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
            {/* Every unit here is a serialized device — qty is always
                exactly 1, so a separate "1 x price" alongside the same
                price again as a line total was always showing the same
                number twice. */}
            <p className="mt-0.5 text-right">{peso(item.price)}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-gray-400 my-2.5" />

      <div className="space-y-0.5">
        <div className="flex flex-wrap justify-between gap-x-2">
          <span className="text-gray-500">Subtotal</span>
          <span className="min-w-0 text-right">{peso(subtotal)}</span>
        </div>
        <div className="flex flex-wrap justify-between gap-x-2 font-bold text-base border-t border-gray-900 pt-1.5 mt-1">
          <span>{isInstallment ? "DEVICE TOTAL" : "TOTAL"}</span>
          <span className="min-w-0 text-right">{peso(subtotal)}</span>
        </div>
      </div>

      {hasReferenceSection && (
        <>
          <div className="border-t border-dashed border-gray-400 my-2.5" />
          <div className="space-y-0.5">
            {receipt.referenceNumber && receipt.referenceNumber !== "N/A" && (
              <Row label="Reference #:">{receipt.referenceNumber}</Row>
            )}
            {receipt.downPayment != null && <Row label="Down Payment:">{peso(receipt.downPayment)}</Row>}
            {receipt.balance != null && <Row label="Balance:">{peso(receipt.balance)}</Row>}
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

export default ReceiptBodyMac;
