import { useMemo } from "react";
import { X, Printer } from "lucide-react";
import { getPrintPlatform } from "../../utils/platform";
import ReceiptBodyAndroid from "./receiptBodies/ReceiptBodyAndroid";
import ReceiptBodyMac from "./receiptBodies/ReceiptBodyMac";
import ReceiptBodyWindows from "./receiptBodies/ReceiptBodyWindows";

const RECEIPT_BODIES = {
  android: ReceiptBodyAndroid,
  mac: ReceiptBodyMac,
  windows: ReceiptBodyWindows,
};

// receipt shape: { saleId, soldAt, customerName, customerPhone, salesperson,
// paymentMethod, paymentStatus, orderType, referenceNumber, notes,
// downPayment, balance, items: [{ device, storage, color, batchCode, price }] }
//
// The actual receipt markup lives in three separate components under
// receiptBodies/ (Android/Mac/Windows), picked here by detected OS — not
// one shared template with platform conditionals sprinkled through it.
// That's deliberate: this shop's Android tablet print path extracts
// plain text and drops non-ASCII characters and CSS layout entirely,
// while the Mac path renders real CSS — a fix tuned for one of those
// kept visibly degrading the other when they shared code (an Android fix
// once shrank the font on every desktop print too; a font-size increase
// for desktop once broke Android's character-width math). Full physical
// separation means editing one platform's file can't touch what the
// others print. See receiptBodies/ReceiptBodyAndroid.jsx for the
// specific real-print bugs that shaped its differences from the other
// two, and utils/platform.js for the detection itself.
//
// This shell — modal chrome, backdrop, Close/Print buttons — is shared,
// since none of it affects what actually prints (print:hidden). Only
// print:hidden on this wrapper (not further out) keeps the receipt
// content — a sibling below, not a descendant — from being hidden too;
// see the label/receipt print bug this project already hit once with a
// naive print:hidden wrapper.
function PrintReceiptModal({ receipt, onClose }) {
  const platform = useMemo(() => getPrintPlatform(), []);
  const ReceiptBody = RECEIPT_BODIES[platform] || ReceiptBodyMac;
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

        <ReceiptBody receipt={receipt} />

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
