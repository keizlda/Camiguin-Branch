import { Routes, Route, Navigate } from "react-router-dom";
import NewSale from "./sales/NewSale";
import SalesHistory from "./sales/SalesHistory";

function Sales() {
  return (
    <Routes>
      <Route index element={<Navigate to="new" replace />} />
      <Route path="new" element={<NewSale />} />
      <Route path="history" element={<SalesHistory />} />
    </Routes>
  );
}

export default Sales;