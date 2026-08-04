import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  RotateCcw,
  FileText,
  Wallet,
  Coins,
  LogOut,
  ChevronDown,
  X,
} from "lucide-react";
import { useState } from "react";
import { signOut, getCurrentProfile } from "../../services/authService";
import { useServiceData } from "../../hooks/useServiceData";

function Sidebar({ open, onClose }) {
  const navigate = useNavigate();
  const [inventoryOpen, setInventoryOpen] = useState(true);
  const [salesOpen, setSalesOpen] = useState(true);
  const profile = useServiceData(getCurrentProfile, null);
  const isAdmin = profile?.role === "admin";

  const handleLogout = async () => {
    try {
      await signOut();
    } finally {
      navigate("/");
    }
  };

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
      isActive
        ? "bg-blue-600 text-white"
        : "text-gray-300 hover:bg-gray-800 hover:text-white"
    }`;

  const subLinkClass = ({ isActive }) =>
    `flex items-center gap-3 pl-11 pr-4 py-2 rounded-lg text-sm transition-colors ${
      isActive
        ? "bg-blue-600 text-white"
        : "text-gray-400 hover:bg-gray-800 hover:text-white"
    }`;

  return (
    <>
      {/* Mobile-only backdrop — tapping it closes the drawer */}
      {open && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
        />
      )}

      <aside
        className={`w-64 h-screen bg-[#161616] flex flex-col fixed left-0 top-0 border-r border-gray-800 z-40 transition-transform duration-200 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">
              MARK GADGETS CGN
            </h1>
            <p className="text-gray-500 text-xs">POS & INVENTORY SYSTEM</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white md:hidden">
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <NavLink to="/dashboard" className={linkClass} onClick={onClose}>
            <LayoutDashboard size={18} />
            Dashboard
          </NavLink>

          {/* Inventory group */}
          <div>
            <button
              onClick={() => setInventoryOpen(!inventoryOpen)}
              className="flex items-center justify-between w-full px-4 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <span className="flex items-center gap-3">
                <Package size={18} />
                Inventory
              </span>
              <ChevronDown
                size={16}
                className={`transition-transform ${
                  inventoryOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {inventoryOpen && (
              <div className="mt-1 space-y-1">
                <NavLink to="/inventory/all" className={subLinkClass} onClick={onClose}>
                  All Devices
                </NavLink>
                <NavLink to="/inventory/add" className={subLinkClass} onClick={onClose}>
                  Add Device
                </NavLink>
                <NavLink to="/inventory/supplier-defective" className={subLinkClass} onClick={onClose}>
                  Supplier Defective
                </NavLink>
                <NavLink to="/inventory/reserved" className={subLinkClass} onClick={onClose}>
                  Reserved
                </NavLink>
                <NavLink to="/inventory/low-stock" className={subLinkClass} onClick={onClose}>
                  Low Stock
                </NavLink>
              </div>
            )}
          </div>

          {/* Sales group */}
          <div>
            <button
              onClick={() => setSalesOpen(!salesOpen)}
              className="flex items-center justify-between w-full px-4 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <span className="flex items-center gap-3">
                <ShoppingCart size={18} />
                Sales
              </span>
              <ChevronDown
                size={16}
                className={`transition-transform ${
                  salesOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {salesOpen && (
              <div className="mt-1 space-y-1">
                <NavLink to="/sales/new" className={subLinkClass} onClick={onClose}>
                  New Sale
                </NavLink>
                <NavLink to="/sales/history" className={subLinkClass} onClick={onClose}>
                  Sales History
                </NavLink>
              </div>
            )}
          </div>

          {/* After Sales — direct link, no dropdown */}
          <NavLink to="/after-sales/customer-returns" className={linkClass} onClick={onClose}>
            <RotateCcw size={18} />
            After Sales
          </NavLink>

          <NavLink to="/reports" className={linkClass} onClick={onClose}>
            <FileText size={18} />
            Reports
          </NavLink>

          {isAdmin && (
            <>
              <NavLink to="/supplier-payables" className={linkClass} onClick={onClose}>
                <Wallet size={18} />
                Supplier Payables
              </NavLink>
              <NavLink to="/financial" className={linkClass} onClick={onClose}>
                <Coins size={18} />
                Financial
              </NavLink>
            </>
          )}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-4 border-t border-gray-800 space-y-1">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white w-full transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;