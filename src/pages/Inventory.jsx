import { Routes, Route, Navigate } from "react-router-dom";
import AllDevices from "./inventory/AllDevices";
import AddDevice from "./inventory/AddDevice";
import SupplierDefective from "./inventory/SupplierDefective";
import Reserved from "./inventory/Reserved";
import LowStock from "./inventory/LowStock";

function Inventory() {
  return (
    <Routes>
      <Route index element={<Navigate to="all" replace />} />
      <Route path="all" element={<AllDevices />} />
      <Route path="add" element={<AddDevice />} />
      <Route path="supplier-defective" element={<SupplierDefective />} />
      <Route path="reserved" element={<Reserved />} />
      <Route path="low-stock" element={<LowStock />} />
    </Routes>
  );
}

export default Inventory;