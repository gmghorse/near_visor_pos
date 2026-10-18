import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import App from "./App";
import Dashboard from "./pages/dashboard";
import Pos from "./pages/pos";
import Inventory from "./pages/inventory";
import Products from "./pages/products";
import Reports from "./pages/reports";
import SalesHistory from "./pages/salesHistory";
import Settings from "./pages/settings";
import CustomerDisplay from "./pages/customerDisplay";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <BrowserRouter>
            <Routes>
                <Route path="customer-display" element={<CustomerDisplay />} />
                <Route element={<App />}>
                    <Route index element={<Dashboard />} />
                    <Route path="pos" element={<Pos />} />
                    <Route path="inventory" element={<Inventory />} />
                    <Route path="products" element={<Products />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="sales-history" element={<SalesHistory />} />
                    <Route path="settings" element={<Settings />} />
                </Route>
            </Routes>
        </BrowserRouter>
    </React.StrictMode>,
);
