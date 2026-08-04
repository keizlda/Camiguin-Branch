import { Menu, Calendar, User } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useServiceData } from "../../hooks/useServiceData";
import { getCurrentProfile } from "../../services/authService";

const roleLabels = {
  admin: "Administrator",
  staff: "Staff",
};

const PAGE_TITLES = {
  "/dashboard": "Dashboard",
  "/inventory/all": "All Devices",
  "/inventory/add": "Add Device",
  "/inventory/supplier-defective": "Supplier Defective",
  "/inventory/reserved": "Reserved",
  "/inventory/low-stock": "Low Stock",
  "/sales/new": "New Sale",
  "/sales/history": "Sales History",
  "/after-sales/customer-returns": "Customer Returns",
  "/reports": "Reports",
  "/supplier-payables": "Supplier Payables",
  "/financial": "Financial",
};

function Topbar({ onMenuClick }) {
  const location = useLocation();
  const pageTitle = PAGE_TITLES[location.pathname] || "Dashboard";
  const profile = useServiceData(getCurrentProfile, null);

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 fixed top-0 left-0 md:left-64 right-0 z-20">
      <div className="flex items-center gap-4 min-w-0">
        <button onClick={onMenuClick} className="text-gray-500 md:hidden flex-shrink-0">
          <Menu size={22} />
        </button>
        <h2 className="font-semibold text-gray-800 truncate">{pageTitle}</h2>
      </div>

      <div className="flex items-center gap-3 sm:gap-6 flex-shrink-0">
        <div className="hidden lg:flex items-center gap-2 text-sm text-gray-500">
          <Calendar size={16} />
          {today}
        </div>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
            <User size={16} className="text-gray-500" />
          </div>
          <div className="text-sm hidden sm:block">
            <p className="font-medium text-gray-800 leading-none">{profile?.email?.split("@")[0] || "..."}</p>
            <p className="text-gray-400 text-xs">{roleLabels[profile?.role] || "Staff"}</p>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Topbar;