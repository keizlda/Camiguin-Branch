import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Filter, Plus, X, ChevronLeft, ChevronRight, ShoppingCart, AlertTriangle, Wallet, CreditCard, Smartphone, Landmark, FileCheck, CalendarClock, Building2, Tablet, Laptop, Watch, Headphones, Wrench, PackagePlus, Repeat, Camera, Printer } from "lucide-react";
import { useServiceData } from "../../hooks/useServiceData";
import { processSale } from "../../services/salesService";
import { getAvailableDevicesForSale, deleteDevice } from "../../services/inventoryService";
import { getPosCategories } from "../../services/referenceService";
import { getCurrentProfile } from "../../services/authService";
import { useToast } from "../../hooks/useToast";
import QuickAddDeviceModal from "../../components/sales/QuickAddDeviceModal";
import SwapTradeInModal from "../../components/sales/SwapTradeInModal";
import ScanBarcodeModal from "../../components/common/ScanBarcodeModal";
import PrintReceiptModal from "../../components/sales/PrintReceiptModal";
import { searchMatches } from "../../utils/search";

const BULK_THRESHOLD = 3;

// Check is only offered once the order actually qualifies as Bulk — it's
// the payment method bulk buyers use, not something a regular sale needs.
const paymentOptions = [
  { id: "Cash", label: "Cash", icon: Wallet },
  { id: "Credit Card", label: "Card", icon: CreditCard },
  { id: "GCash", label: "GCash", icon: Smartphone },
  { id: "Bank Transfer", label: "Bank Transfer", icon: Landmark },
  { id: "Swap", label: "Swap", icon: Repeat },
];

const installmentOptions = [
  { id: "Skyro", label: "Skyro", icon: CalendarClock },
  { id: "PayJoy", label: "PayJoy", icon: Building2 },
];

// These record a Down Payment/Balance instead of a reference number —
// Credit Card is included even though it stays in the regular Payment
// Method group (not Installment), since it's usable for any cart including
// accessories, unlike Skyro/PayJoy which are device-financing only.
const FINANCING_METHODS = ["Skyro", "PayJoy", "Credit Card"];

// Installment financing is for actual devices — a phone case or a battery
// isn't something a lender finances, and mixing one into a cart that's
// otherwise on installment doesn't make sense either.
const NON_INSTALLMENT_CATEGORIES = ["Accessories", "Repair Parts"];

const categoryIcon = {
  iPhones: Smartphone,
  iPads: Tablet,
  MacBooks: Laptop,
  "Apple Watches": Watch,
  Accessories: Headphones,
  "Repair Parts": Wrench,
};

const categoryColor = {
  iPhones: "bg-gray-100 text-gray-600",
  iPads: "bg-blue-50 text-blue-500",
  MacBooks: "bg-gray-100 text-gray-600",
  "Apple Watches": "bg-red-50 text-red-500",
  Accessories: "bg-purple-50 text-purple-500",
  "Repair Parts": "bg-amber-50 text-amber-600",
};

function NewSale() {
  const showToast = useToast();
  const posCategories = useServiceData(getPosCategories, []);
  const profile = useServiceData(getCurrentProfile, null);

  const [availableDevices, setAvailableDevices] = useState([]);
  const loadAvailableDevices = useCallback(() => {
    getAvailableDevicesForSale()
      .then(setAvailableDevices)
      .catch((err) => showToast(err.message || "Failed to load available devices. Please refresh and try again.", "error"));
  }, [showToast]);
  useEffect(() => {
    loadAvailableDevices();
  }, [loadAvailableDevices]);

  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All Categories");
  const [cart, setCart] = useState([]);
  const [payment, setPayment] = useState("Cash");
  const [referenceNumber, setReferenceNumber] = useState("N/A");
  const [downPayment, setDownPayment] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [swapTradeIn, setSwapTradeIn] = useState(null);
  const [forceBulk, setForceBulk] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  // batchCode -> quantity typed for a grouped (multi-unit accessory) row —
  // keyed by batch code, not id, since a group has no single id of its own.
  const [productQty, setProductQty] = useState({});

  const cartIds = useMemo(() => new Set(cart.map((c) => c.id)), [cart]);

  const filteredProducts = useMemo(() => {
    return availableDevices.filter((p) => {
      if (cartIds.has(p.id)) return false;
      const matchesCategory = activeCategory === "All Categories" || p.category === activeCategory;
      const matchesTextSearch = searchMatches(productSearch, p.product, p.batchCode, p.brand);
      return matchesCategory && matchesTextSearch;
    });
  }, [activeCategory, productSearch, availableDevices, cartIds]);

  // Bulk-identical accessories share one batch code across every
  // still-available unit — grouping them into one row (instead of listing
  // the same product 60 times) is what makes "buy 3 of these" a single
  // quantity typed once, rather than hunting the list for the same-named
  // row over and over. Serialized devices (always a unique code) still
  // group to exactly one unit each, so their row renders exactly as before.
  const groupedProducts = useMemo(() => {
    const order = [];
    const byBatch = new Map();
    for (const p of filteredProducts) {
      if (!byBatch.has(p.batchCode)) {
        byBatch.set(p.batchCode, []);
        order.push(p.batchCode);
      }
      byBatch.get(p.batchCode).push(p);
    }
    return order.map((code) => byBatch.get(code));
  }, [filteredProducts]);

  // actualPrice defaults to the catalog price but is editable per unit —
  // staff can see Capital (cost) alongside it and adjust what's actually
  // charged so the sale still profits instead of blindly using list price.
  const addUnitsToCart = (units) => {
    setCart((prev) => [...prev, ...units.map((u) => ({ ...u, actualPrice: u.price }))]);
  };
  const addToCart = (product) => addUnitsToCart([product]);

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((c) => c.id !== id));
  };

  const updateActualPrice = (id, value) => {
    setCart((prev) => prev.map((c) => (c.id === id ? { ...c, actualPrice: value } : c)));
  };

  // Scanning is a shortcut straight to the cart, not just a search-box
  // fill-in — staff scanning units at the counter want the unit added, not
  // an extra step of finding it in the results and clicking Plus again.
  //
  // Bulk-identical accessories share one batch code across many units (see
  // add_device's p_quantity in schema.sql), so scanning the same physical
  // barcode is exactly how someone buying 3 of the same case would ring
  // them up — once per unit, same as scanning 3 different phones. Picking
  // the first NOT-YET-IN-CART match (not just the first match overall)
  // means a second scan of the same code adds a second unit instead of
  // re-finding the one already added and refusing as a duplicate.
  const handleScanned = (value) => {
    setShowScan(false);
    const sameCode = availableDevices.filter((p) => p.batchCode.toLowerCase() === value.toLowerCase());
    const match = sameCode.find((p) => !cartIds.has(p.id));
    if (!match) {
      showToast(
        sameCode.length > 0
          ? `All ${sameCode.length} available unit${sameCode.length === 1 ? "" : "s"} of ${value} are already in the cart.`
          : `No available unit found for batch code "${value}".`,
        "error"
      );
      return;
    }
    addToCart(match);
    showToast(`${match.batchCode} added to cart.`);
  };

  // A unit that didn't exist in inventory a moment ago — goes straight into
  // the cart instead of back into "browse and add", since that's the whole
  // point of logging it mid-sale.
  const handleQuickAdded = (product) => {
    setShowQuickAdd(false);
    addToCart(product);
    loadAvailableDevices();
    showToast("Device saved and added to cart.");
  };

  // The customer's phone goes straight into inventory the moment it's
  // logged (see SwapTradeInModal) — this just remembers it here so its
  // appraised value can be weighed against the cart total.
  const handleSwapTradeInCreated = (tradeIn) => {
    setShowSwapModal(false);
    setSwapTradeIn(tradeIn);
    setReferenceNumber(`Trade-in: ${tradeIn.batchCode}`);
    loadAvailableDevices();
    showToast("Trade-in unit saved to inventory.");
  };

  // Same cleanup as "Log different unit" below — the trade-in device
  // (always priced ₱0, see SwapTradeInModal) was only ever logged for
  // this swap. Without deleting it here too, abandoning the swap via
  // Remove left it sitting in inventory as a real Available unit at ₱0,
  // indistinguishable from any other product until someone noticed.
  const handleRemoveSwapTradeIn = async () => {
    if (swapTradeIn) {
      try {
        await deleteDevice(swapTradeIn.id);
        loadAvailableDevices();
      } catch {
        // Leave it if it can't be removed — better an extra unit in
        // inventory than blocking the rest of the sale over this.
      }
    }
    setSwapTradeIn(null);
    if (payment === "Swap") {
      setPayment("Cash");
      setReferenceNumber("N/A");
    }
  };

  // Re-logging means the details entered were wrong, not that there's a
  // second phone — deletes the mistaken entry first so it doesn't sit in
  // inventory as an orphaned duplicate once the corrected one is saved.
  const handleChangeSwapTradeIn = async () => {
    if (swapTradeIn) {
      try {
        await deleteDevice(swapTradeIn.id);
        loadAvailableDevices();
      } catch {
        // Leave it if it can't be removed — better an extra unit in
        // inventory than losing the chance to log the correct one.
      }
    }
    setSwapTradeIn(null);
    setShowSwapModal(true);
  };

  const clearCart = () => setCart([]);

  // At least one real device, not every item — an accessory riding along
  // with a phone (a case bought at the same time) shouldn't block the whole
  // cart from being financed just because it's not itself financeable. A
  // cart that's 100% accessories still has nothing for a lender to finance.
  const installmentEligible = cart.some((c) => !NON_INSTALLMENT_CATEGORIES.includes(c.category));

  // Bulk either happens automatically past the unit-count threshold, or is
  // opted into manually via the toggle — e.g. a single-unit wholesale sale
  // that should still be tracked as Bulk even though the count alone
  // wouldn't trigger it.
  const isBulk = cart.length > BULK_THRESHOLD || forceBulk;

  // Check only shows up once the order qualifies as Bulk, and Installment
  // only once every item in the cart is an actual device — if either
  // selection stops qualifying, fall back to Cash so a hidden, stale
  // selection can't silently go through.
  useEffect(() => {
    if (payment === "Check" && !isBulk) {
      setPayment("Cash");
      setReferenceNumber("N/A");
    }
    if (installmentOptions.some((opt) => opt.id === payment) && !installmentEligible) {
      setPayment("Cash");
      setReferenceNumber("N/A");
      setDownPayment("");
    }
  }, [isBulk, payment, installmentEligible]);

  const totalCapital = cart.reduce((sum, c) => sum + (Number(c.purchasePrice) || 0), 0);
  const total = cart.reduce((sum, c) => sum + (Number(c.actualPrice) || 0), 0);
  const profit = total - totalCapital;

  // Derived, not typed — Balance always equals Total minus Down Payment
  // (floored at 0), so it can never drift from a number staff could
  // manually mistype. See process_sale in schema.sql, which computes the
  // same formula server-side from the same two inputs when the sale is
  // actually saved.
  const balance = FINANCING_METHODS.includes(payment) && downPayment !== "" ? Math.max(0, total - (Number(downPayment) || 0)) : null;

  // Positive: the store's unit(s) are worth more, customer tops up cash.
  // Negative: the trade-in is worth more, so the store hands back cash.
  // Either way, no separate ledger entry needed — same as any other
  // inventory purchase, the trade-in's Appraised Value (its Capital) is
  // the full cost of acquiring it, cash or otherwise. This is purely
  // informational so staff know how much cash to collect or hand over.
  const swapCashDifference = payment === "Swap" && swapTradeIn ? total - swapTradeIn.appraisedValue : 0;

  const handlePaymentChange = (method) => {
    setPayment(method);

    if (method === "Swap") {
      setDownPayment("");
      // Switching back to Swap after picking something else in between
      // needs to restore the reference to the trade-in already logged —
      // otherwise it's stuck showing whatever the other method left there.
      if (swapTradeIn) {
        setReferenceNumber(`Trade-in: ${swapTradeIn.batchCode}`);
      } else {
        setShowSwapModal(true);
      }
      return;
    }

    if (FINANCING_METHODS.includes(method)) {
      setReferenceNumber("N/A");
      return;
    }

    // Financing methods ask for a Down Payment (Balance derives from it)
    // instead of a Reference Number — clear it when switching to any other
    // method so a stale value can't leak through. Reference Number itself
    // only resets for Cash (which never needs one) or if it's still holding
    // a trade-in's batch code from Swap — every other method keeps whatever
    // was already typed, same as before Swap/financing existed.
    setDownPayment("");
    if (method === "Cash" || referenceNumber.startsWith("Trade-in:")) {
      setReferenceNumber("N/A");
    }
  };

  const handleProcessSale = async () => {
    if (cart.length === 0) return;
    setError("");
    if (cart.some((c) => !(Number(c.actualPrice) > 0))) {
      setError("Every unit needs an Actual Price Sold greater than ₱0 before processing the sale.");
      return;
    }
    if (payment === "Swap" && !swapTradeIn) {
      setError("Log the customer's trade-in phone before processing a swap sale.");
      return;
    }
    // Without this, a financed sale could be submitted with Down Payment
    // blank — it'd still succeed (down_payment/balance are nullable
    // columns), but the printed receipt would then look identical to a
    // fully-paid cash sale, with nothing on it indicating money is still
    // owed. Balance itself needs no separate check — it's derived from
    // Down Payment and the cart total, so it's always a valid number once
    // Down Payment is.
    if (FINANCING_METHODS.includes(payment) && (downPayment === "" || Number(downPayment) < 0)) {
      setError("Enter a Down Payment before processing a financed sale.");
      return;
    }
    if (FINANCING_METHODS.includes(payment) && Number(downPayment) > total) {
      setError("Down Payment cannot exceed the total price.");
      return;
    }
    setSubmitting(true);
    try {
      const saleId = await processSale({
        customerName: customerSearch.trim(),
        paymentMethod: payment,
        referenceNumber,
        notes,
        cartItems: cart.map((c) => ({ ...c, price: Number(c.actualPrice) || 0 })),
        downPayment: FINANCING_METHODS.includes(payment) && downPayment !== "" ? Number(downPayment) : null,
        forceBulk,
      });

      showToast("Sale processed.");
      // Built from what's already in hand (cart + form state) rather than
      // re-querying — every field the receipt needs was already entered
      // right here, so there's no need for a round trip back to the DB.
      // saleId comes straight from process_sale's own return value.
      setLastReceipt({
        saleId,
        soldAt: new Date().toISOString(),
        customerName: customerSearch.trim() || null,
        customerPhone: null,
        salesperson: profile?.name || null,
        paymentMethod: payment,
        paymentStatus: isBulk ? "Pending" : "Paid",
        orderType: isBulk ? "Bulk" : "Regular",
        referenceNumber,
        notes: notes.trim() || null,
        downPayment: FINANCING_METHODS.includes(payment) && downPayment !== "" ? Number(downPayment) : null,
        balance,
        items: cart.map((c) => ({
          device: c.product,
          storage: c.storage,
          color: c.color,
          batchCode: c.batchCode,
          price: Number(c.actualPrice) || 0,
        })),
      });
      clearCart();
      setReferenceNumber("N/A");
      setDownPayment("");
      setNotes("");
      setCustomerSearch("");
      setSwapTradeIn(null);
      setForceBulk(false);
      loadAvailableDevices();
    } catch (err) {
      setError(err.message || "Failed to process sale. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    {/* print:hidden here (not further out) — PrintReceiptModal's own
        print-only receipt is a true sibling below, outside this div, so an
        ancestor's display:none never hides it. Without this, the whole POS
        layout would print alongside the receipt instead of being suppressed. */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 print:hidden">
      {/* Left + Middle columns */}
      <div className="lg:col-span-2 space-y-4">
        {/* Step 1: Customer */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-semibold">1</span>
            <p className="text-sm font-semibold text-gray-700">Select Customer (Optional)</p>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Search by name or phone number..."
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Step 2: Products */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-semibold">2</span>
            <p className="text-sm font-semibold text-gray-700">Select Products</p>
          </div>

          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search by name, model, or batch code..."
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 whitespace-nowrap">
              <Filter size={14} />
              Filters
            </button>
            <button
              onClick={() => setShowScan(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 whitespace-nowrap"
            >
              <Camera size={14} />
              Scan
            </button>
            <button
              onClick={() => setShowQuickAdd(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 whitespace-nowrap"
            >
              <PackagePlus size={14} />
              New Item
            </button>
          </div>

          <div className="flex gap-4">
            {/* Category sidebar */}
            <div className="w-36 flex-shrink-0 space-y-1">
              <p className="text-xs text-gray-400 font-medium mb-1">Categories</p>
              {posCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`block w-full text-left px-3 py-2 rounded-lg text-sm ${
                    activeCategory === cat
                      ? "bg-blue-50 text-blue-600 font-medium"
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Product table */}
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-100">
                    <th className="pb-2 font-medium">Product</th>
                    <th className="pb-2 font-medium">Storage</th>
                    <th className="pb-2 font-medium">Color</th>
                    <th className="pb-2 font-medium">Price</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {groupedProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-400">
                        No products found.
                      </td>
                    </tr>
                  ) : (
                    groupedProducts.map((units) => {
                      const first = units[0];
                      const Icon = categoryIcon[first.category] || Smartphone;
                      // A batch of bulk-identical accessories — one row
                      // represents every still-available unit sharing that
                      // batch code, with a quantity to add more than one in
                      // a single click instead of hunting the list for the
                      // same product listed once per unit.
                      const isBatch = units.length > 1;
                      const qty = Math.min(Math.max(1, Number(productQty[first.batchCode]) || 1), units.length);
                      const handleAdd = () => {
                        addUnitsToCart(units.slice(0, qty));
                        setProductQty((q) => ({ ...q, [first.batchCode]: "1" }));
                      };
                      return (
                        <tr key={first.batchCode} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${categoryColor[first.category] || "bg-gray-100 text-gray-600"}`}>
                                <Icon size={15} />
                              </div>
                              <div>
                                <p className="text-gray-800 font-medium">{first.product}</p>
                                <p className="text-xs text-gray-400">
                                  {[first.brand, first.batchCode].filter(Boolean).join(" · ")}
                                  {isBatch && ` · ${units.length} available`}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 text-gray-600">{first.storage || "—"}</td>
                          <td className="py-2.5 text-gray-600">{first.color || "—"}</td>
                          <td className="py-2.5 text-gray-700">₱{first.price.toLocaleString()}</td>
                          <td className="py-2.5 text-right">
                            {isBatch ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <input
                                  type="number"
                                  min="1"
                                  max={units.length}
                                  value={productQty[first.batchCode] ?? "1"}
                                  onChange={(e) => setProductQty((q) => ({ ...q, [first.batchCode]: e.target.value }))}
                                  className="w-14 border border-gray-200 rounded-lg text-sm px-2 py-1.5 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <button
                                  onClick={handleAdd}
                                  title={`Add ${qty} to cart`}
                                  className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => addToCart(first)}
                                className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                              >
                                <Plus size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
                <p className="text-xs text-gray-500">
                  Showing 1 to {filteredProducts.length} of {filteredProducts.length} products
                </p>
                <div className="flex items-center gap-3">
                  <select className="border border-gray-200 rounded-lg text-xs px-2 py-1.5">
                    <option>10 per page</option>
                    <option>20 per page</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 border border-gray-200 rounded-lg text-gray-400">
                      <ChevronLeft size={14} />
                    </button>
                    <button className="w-7 h-7 text-xs rounded-lg bg-blue-600 text-white">1</button>
                    <button className="p-1.5 border border-gray-200 rounded-lg text-gray-400">
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Cart / Order Summary — sticky so it stays put while Steps
          1/2 scroll, but with payment method + installment fields + notes
          all stacked below the item list, its own natural height can
          exceed the viewport just as easily. Capping it to the viewport
          height (below the sticky offset) and letting it scroll in place
          means reaching the Process Sale button never needs the whole
          page to scroll — the item list's own inner scroll (below) still
          keeps a long cart from pushing payment options far down even
          within this panel's own scroll. */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 h-fit sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-semibold">3</span>
            <p className="text-sm font-semibold text-gray-700">Cart / Order Summary</p>
          </div>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-xs text-red-500 hover:underline">
              Clear Cart
            </button>
          )}
        </div>

        {cart.length === 0 ? (
          <div className="text-center py-10">
            <ShoppingCart size={28} className="text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Cart is empty</p>
            {lastReceipt && (
              <button
                onClick={() => setShowReceipt(true)}
                className="mt-3 flex items-center gap-1.5 mx-auto px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
              >
                <Printer size={14} />
                Print Receipt (Last Sale)
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3 mb-4 max-h-64 overflow-y-auto pr-1">
            {cart.map((c) => {
              const Icon = categoryIcon[c.category] || Smartphone;
              return (
                <div key={c.id} className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${categoryColor[c.category] || "bg-gray-100 text-gray-600"}`}>
                      <Icon size={13} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 font-medium truncate">{c.product}</p>
                      <p className="text-xs text-gray-400">
                        {[c.brand, c.storage, c.color, c.batchCode].filter(Boolean).join(" · ")}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Capital: ₱{(Number(c.purchasePrice) || 0).toLocaleString()} · Base: ₱
                        {(Number(c.price) || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <span className="text-xs text-gray-400">Actual Price Sold</span>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400 text-xs">₱</span>
                      <input
                        type="number"
                        value={c.actualPrice}
                        onChange={(e) => updateActualPrice(c.id, e.target.value)}
                        className="w-20 text-right border border-gray-200 rounded-lg px-1.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <button onClick={() => removeFromCart(c.id)} className="text-red-400 hover:text-red-600 mt-1.5">
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-2 text-sm border-t border-gray-100 pt-3">
          <div className="flex justify-between text-gray-500">
            <span>Total Capital ({cart.length} item{cart.length === 1 ? "" : "s"})</span>
            <span>₱{totalCapital.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-semibold text-gray-800 pt-2 border-t border-gray-100 text-base">
            <span>Total (Actual Price Sold)</span>
            <span>₱{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
          <div className={`flex justify-between font-medium ${profit < 0 ? "text-red-500" : "text-green-600"}`}>
            <span>Profit</span>
            <span>₱{profit.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-gray-100">
          <div>
            <p className="text-sm font-medium text-gray-700">Bulk Order</p>
            <p className="text-xs text-gray-400">Mark this sale as Bulk even if it's just one unit.</p>
          </div>
          <button
            type="button"
            onClick={() => setForceBulk((v) => !v)}
            className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
              forceBulk ? "bg-blue-600" : "bg-gray-300"
            }`}
            title={forceBulk ? "Bulk — click to unmark" : "Not marked as Bulk — click to mark"}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                forceBulk ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {isBulk && (
          <div className="flex items-start gap-2 bg-orange-50 border border-orange-100 rounded-lg p-2.5 mt-3">
            <AlertTriangle size={14} className="text-orange-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-orange-700">
              {cart.length > BULK_THRESHOLD
                ? `${cart.length} units — this will be recorded as a `
                : "This will be recorded as a "}
              <strong>Bulk</strong> order with payment <strong>Pending</strong>, regardless of payment method.
            </p>
          </div>
        )}

        {/* Payment Method */}
        <div className="mt-4">
          <p className="text-xs font-medium text-gray-600 mb-2">Payment Method</p>
          <div className="grid grid-cols-2 gap-2">
            {paymentOptions.map((opt) => {
              const Icon = opt.icon;
              const active = payment === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => handlePaymentChange(opt.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border ${
                    active
                      ? "border-blue-500 bg-blue-50 text-blue-600"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Icon size={14} />
                  {opt.label}
                </button>
              );
            })}
          </div>

          {isBulk && (
            <button
              onClick={() => handlePaymentChange("Check")}
              className={`w-full mt-2 flex items-center gap-2 px-3 py-2 rounded-lg text-sm border ${
                payment === "Check"
                  ? "border-blue-500 bg-blue-50 text-blue-600"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <FileCheck size={14} />
              Check
            </button>
          )}

          {installmentEligible ? (
            <>
              <p className="text-xs font-medium text-gray-600 mt-4 mb-2">Installment</p>
              <div className="grid grid-cols-2 gap-2">
                {installmentOptions.map((opt) => {
                  const Icon = opt.icon;
                  const active = payment === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handlePaymentChange(opt.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border ${
                        active
                          ? "border-blue-500 bg-blue-50 text-blue-600"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <Icon size={14} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            cart.length > 0 && (
              <p className="text-xs text-gray-400 mt-4">
                Installment isn't available — add at least one device to the cart to unlock it (an accessory-only
                cart has nothing for a lender to finance).
              </p>
            )
          )}
        </div>

        {/* Swap trade-in summary — shows what was logged and whether cash
            changes hands, in which direction. */}
        {payment === "Swap" && (
          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-3">
            {swapTradeIn ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {swapTradeIn.deviceName} <span className="text-gray-400">· {swapTradeIn.batchCode}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {[swapTradeIn.storage, swapTradeIn.color].filter(Boolean).join(" · ")} — Appraised at ₱
                      {swapTradeIn.appraisedValue.toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleChangeSwapTradeIn}
                    className="text-xs text-blue-600 hover:underline flex-shrink-0"
                  >
                    Log different unit
                  </button>
                </div>
                <div className="mt-2 pt-2 border-t border-blue-100 text-sm font-medium">
                  {swapCashDifference > 0 && (
                    <p className="text-gray-700">Customer pays ₱{swapCashDifference.toLocaleString()} in cash.</p>
                  )}
                  {swapCashDifference < 0 && (
                    <p className="text-orange-600">
                      Store pays ₱{Math.abs(swapCashDifference).toLocaleString()} cash back to the customer.
                    </p>
                  )}
                  {swapCashDifference === 0 && <p className="text-green-600">Even swap — no cash changes hands.</p>}
                </div>
                <button
                  type="button"
                  onClick={handleRemoveSwapTradeIn}
                  className="text-xs text-red-500 hover:underline mt-2"
                >
                  Remove
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowSwapModal(true)}
                className="text-sm text-blue-600 hover:underline"
              >
                Log the customer's trade-in phone
              </button>
            )}
          </div>
        )}

        {/* Financing methods record a down payment/balance instead of a
            reference number — a financed sale doesn't have one the way a
            bank transfer or GCash payment does. */}
        {FINANCING_METHODS.includes(payment) ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Down Payment</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
                <input
                  type="number"
                  value={downPayment}
                  onChange={(e) => setDownPayment(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-gray-200 rounded-lg text-sm pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Balance</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  value={(balance ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  className="w-full border border-gray-200 rounded-lg text-sm pl-7 pr-3 py-2 bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Total minus Down Payment — fills in automatically.</p>
            </div>
          </div>
        ) : (
          payment !== "Cash" && (
            <div className="mt-4">
              <p className="text-xs font-medium text-gray-600 mb-1.5">Reference Number</p>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Enter reference number..."
                className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )
        )}

        {/* Notes */}
        <div className="mt-4">
          <p className="text-xs font-medium text-gray-600 mb-1.5">Notes (Optional)</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Add notes..."
            className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button
          onClick={handleProcessSale}
          disabled={cart.length === 0 || submitting || (payment === "Swap" && !swapTradeIn)}
          className="w-full mt-4 flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ShoppingCart size={15} />
          {submitting ? "Processing..." : "Process Sale"}
        </button>
      </div>
    </div>

    {showQuickAdd && (
      <QuickAddDeviceModal onClose={() => setShowQuickAdd(false)} onCreated={handleQuickAdded} />
    )}

    {showSwapModal && (
      <SwapTradeInModal onClose={() => setShowSwapModal(false)} onCreated={handleSwapTradeInCreated} />
    )}

    {showScan && <ScanBarcodeModal onScanned={handleScanned} onClose={() => setShowScan(false)} />}

    {showReceipt && lastReceipt && (
      <PrintReceiptModal receipt={lastReceipt} onClose={() => setShowReceipt(false)} />
    )}
    </>
  );
}

export default NewSale;