import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Filter, Plus, X, ChevronLeft, ChevronRight, ShoppingCart, AlertTriangle, Wallet, CreditCard, Smartphone, Landmark, FileCheck, CalendarClock, Building2, Tablet, Laptop, Watch, Headphones, Wrench, PackagePlus, Repeat } from "lucide-react";
import { useServiceData } from "../../hooks/useServiceData";
import { processSale } from "../../services/salesService";
import { getAvailableDevicesForSale, deleteDevice } from "../../services/inventoryService";
import { getPosCategories } from "../../services/referenceService";
import { useToast } from "../../hooks/useToast";
import QuickAddDeviceModal from "../../components/sales/QuickAddDeviceModal";
import SwapTradeInModal from "../../components/sales/SwapTradeInModal";

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
  { id: "Home Credit", label: "Home Credit", icon: Building2 },
];

// These record a Down Payment/Balance instead of a reference number —
// Credit Card is included even though it stays in the regular Payment
// Method group (not Installment), since it's usable for any cart including
// accessories, unlike Skyro/Home Credit which are device-financing only.
const FINANCING_METHODS = ["Skyro", "Home Credit", "Credit Card"];

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

  const [availableDevices, setAvailableDevices] = useState([]);
  const loadAvailableDevices = useCallback(() => {
    getAvailableDevicesForSale().then(setAvailableDevices);
  }, []);
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
  const [balance, setBalance] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapTradeIn, setSwapTradeIn] = useState(null);

  const cartIds = useMemo(() => new Set(cart.map((c) => c.id)), [cart]);

  const filteredProducts = useMemo(() => {
    return availableDevices.filter((p) => {
      if (cartIds.has(p.id)) return false;
      const matchesCategory = activeCategory === "All Categories" || p.category === activeCategory;
      const matchesSearch =
        !productSearch ||
        p.product.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.batchCode.toLowerCase().includes(productSearch.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, productSearch, availableDevices, cartIds]);

  // actualPrice defaults to the catalog price but is editable per unit —
  // staff can see Capital (cost) alongside it and adjust what's actually
  // charged so the sale still profits instead of blindly using list price.
  const addToCart = (product) => {
    setCart((prev) => [...prev, { ...product, actualPrice: product.price }]);
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((c) => c.id !== id));
  };

  const updateActualPrice = (id, value) => {
    setCart((prev) => prev.map((c) => (c.id === id ? { ...c, actualPrice: value } : c)));
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

  const handleRemoveSwapTradeIn = () => {
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

  const installmentEligible = cart.length > 0 && cart.every((c) => !NON_INSTALLMENT_CATEGORIES.includes(c.category));

  // Check only shows up once the order qualifies as Bulk, and Installment
  // only once every item in the cart is an actual device — if either
  // selection stops qualifying, fall back to Cash so a hidden, stale
  // selection can't silently go through.
  useEffect(() => {
    if (payment === "Check" && cart.length <= BULK_THRESHOLD) {
      setPayment("Cash");
      setReferenceNumber("N/A");
    }
    if (installmentOptions.some((opt) => opt.id === payment) && !installmentEligible) {
      setPayment("Cash");
      setReferenceNumber("N/A");
      setDownPayment("");
      setBalance("");
    }
  }, [cart.length, payment, installmentEligible]);

  const totalCapital = cart.reduce((sum, c) => sum + (Number(c.purchasePrice) || 0), 0);
  const total = cart.reduce((sum, c) => sum + (Number(c.actualPrice) || 0), 0);
  const profit = total - totalCapital;

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
      setBalance("");
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

    // Financing methods ask for Down Payment/Balance instead of a Reference
    // Number — clear both when switching to any other method so stale
    // values can't leak through. Reference Number itself only resets for
    // Cash (which never needs one) or if it's still holding a trade-in's
    // batch code from Swap — every other method keeps whatever was already
    // typed, same as before Swap/financing existed.
    setDownPayment("");
    setBalance("");
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
    setSubmitting(true);
    try {
      await processSale({
        customerName: customerSearch.trim(),
        paymentMethod: payment,
        referenceNumber,
        notes,
        cartItems: cart.map((c) => ({ ...c, price: Number(c.actualPrice) || 0 })),
        downPayment: FINANCING_METHODS.includes(payment) && downPayment !== "" ? Number(downPayment) : null,
        balance: FINANCING_METHODS.includes(payment) && balance !== "" ? Number(balance) : null,
      });

      showToast("Sale processed.");
      clearCart();
      setReferenceNumber("N/A");
      setDownPayment("");
      setBalance("");
      setNotes("");
      setCustomerSearch("");
      setSwapTradeIn(null);
      loadAvailableDevices();
    } catch (err) {
      setError(err.message || "Failed to process sale. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-400">
                        No products found.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const Icon = categoryIcon[p.category] || Smartphone;
                      return (
                        <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${categoryColor[p.category] || "bg-gray-100 text-gray-600"}`}>
                                <Icon size={15} />
                              </div>
                              <div>
                                <p className="text-gray-800 font-medium">{p.product}</p>
                                <p className="text-xs text-gray-400">{p.batchCode}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 text-gray-600">{p.storage || "—"}</td>
                          <td className="py-2.5 text-gray-600">{p.color || "—"}</td>
                          <td className="py-2.5 text-gray-700">₱{p.price.toLocaleString()}</td>
                          <td className="py-2.5 text-right">
                            <button
                              onClick={() => addToCart(p)}
                              className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                              <Plus size={14} />
                            </button>
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

      {/* Right: Cart / Order Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 h-fit sticky top-20">
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
                        {[c.storage, c.color, c.batchCode].filter(Boolean).join(" · ")}
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

        {cart.length > BULK_THRESHOLD && (
          <div className="flex items-start gap-2 bg-orange-50 border border-orange-100 rounded-lg p-2.5 mt-3">
            <AlertTriangle size={14} className="text-orange-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-orange-700">
              {cart.length} units — this will be recorded as a <strong>Bulk</strong> order with payment{" "}
              <strong>Pending</strong>, regardless of payment method.
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

          {cart.length > BULK_THRESHOLD && (
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
                Installment isn't available — remove any accessories or repair parts from the cart to unlock it.
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
                  type="number"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-gray-200 rounded-lg text-sm pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
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

      {showQuickAdd && (
        <QuickAddDeviceModal onClose={() => setShowQuickAdd(false)} onCreated={handleQuickAdded} />
      )}

      {showSwapModal && (
        <SwapTradeInModal onClose={() => setShowSwapModal(false)} onCreated={handleSwapTradeInCreated} />
      )}
    </div>
  );
}

export default NewSale;