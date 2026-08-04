import { useState } from "react";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { ToastProvider } from "./components/common/ToastProvider";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import ScrollToTop from "./components/layout/ScrollToTop";
import RequireAuth from "./components/auth/RequireAuth";
import RequireAdmin from "./components/auth/RequireAdmin";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Sales from "./pages/Sales";
import AfterSales from "./pages/AfterSales";
import Reports from "./pages/Reports";
import SupplierPayables from "./pages/SupplierPayables";
import Financial from "./pages/Financial";

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="print:hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <Topbar onMenuClick={() => setSidebarOpen((o) => !o)} />
      </div>
      <main className="md:ml-64 pt-16 px-4 pb-4 sm:px-6 sm:pb-6 print:ml-0 print:pt-0 print:p-0">
        <Outlet />
      </main>
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Login />} />
          <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/inventory/*" element={<Inventory />} />
            <Route path="/sales/*" element={<Sales />} />
            <Route path="/after-sales/*" element={<AfterSales />} />
            <Route path="/reports" element={<Reports />} />
            <Route
              path="/supplier-payables"
              element={<RequireAdmin><SupplierPayables /></RequireAdmin>}
            />
            <Route
              path="/financial"
              element={<RequireAdmin><Financial /></RequireAdmin>}
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;