import { Routes, Route, Navigate } from "react-router-dom";
import CustomerReturns from "./aftersales/CustomerReturns";

function AfterSales() {
  return (
    <Routes>
      <Route index element={<Navigate to="customer-returns" replace />} />
      <Route path="customer-returns" element={<CustomerReturns />} />
    </Routes>
  );
}

export default AfterSales;