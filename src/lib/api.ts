import { invoke } from "@tauri-apps/api/core";

// Field names are snake_case to match the SeaORM entities serialized by Rust.
export type Category = { id: string; name: string };

export type Product = {
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    category_id: string | null;
    price: number; // kobo
    cost: number; // kobo
    stock: number;
    reorder_level: number;
    is_active: boolean;
};

// Top-level command args are camelCase; this struct needs #[serde(rename_all = "camelCase")] in Rust.
export type ProductInput = {
    name: string;
    sku: string | null;
    barcode: string | null;
    categoryId: string | null;
    price: number;
    cost: number;
    stock: number;
    reorderLevel: number;
};

export type StockMovement = {
    id: string;
    product_id: string;
    product_name: string;
    change: number;
    reason: string;
    note: string | null;
    created_at: string;
};

export type Sale = {
    id: string;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    payment_method: string;
    status: "completed" | "voided";
    created_at: string;
};

export type SaleItem = {
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
};

export type DashboardStats = {
    today_revenue: number;
    today_transactions: number;
    today_profit: number;
    low_stock_count: number;
    top_products: { name: string; units: number; revenue: number }[];
    recent_sales: Sale[];
};

export type DayRow = { day: string; transactions: number; revenue: number };
export type ProfitRow = { name: string; units: number; revenue: number; profit: number };
export type ValuationRow = { name: string; stock: number; cost_value: number; retail_value: number };

export type Settings = Record<string, string>;
export type CheckoutResult = { sale_id: string; subtotal: number; tax: number; total: number; created_at: string };

export const api = {
    listProducts: (includeInactive = false) =>
        invoke<Product[]>("list_products", { includeInactive }),
    createProduct: (input: ProductInput) => invoke<Product>("create_product", { input }),
    updateProduct: (id: string, input: ProductInput) =>
        invoke<Product>("update_product", { id, input }),
    setProductActive: (id: string, isActive: boolean) =>
        invoke<void>("set_product_active", { id, isActive }),

    listCategories: () => invoke<Category[]>("list_categories"),
    createCategory: (name: string) => invoke<Category>("create_category", { name }),

    adjustStock: (productId: string, change: number, reason: string, note: string | null) =>
        invoke<void>("adjust_stock", { productId, change, reason, note }),
    listMovements: (productId: string | null = null, limit = 100) =>
        invoke<StockMovement[]>("list_stock_movements", { productId, limit }),

    checkout: (items: { productId: string; quantity: number }[], paymentMethod: string) =>
        invoke<CheckoutResult>("checkout", { items, paymentMethod }),
    listSales: (from: string, to: string) => invoke<Sale[]>("list_sales", { from, to }),
    getSaleItems: (saleId: string) => invoke<SaleItem[]>("get_sale_items", { saleId }),
    voidSale: (saleId: string) => invoke<void>("void_sale", { saleId }),

    dashboardStats: () => invoke<DashboardStats>("dashboard_stats"),
    salesByDay: (from: string, to: string) => invoke<DayRow[]>("report_sales_by_day", { from, to }),
    profitByProduct: (from: string, to: string) =>
        invoke<ProfitRow[]>("report_profit_by_product", { from, to }),
    inventoryValuation: () => invoke<ValuationRow[]>("report_inventory_valuation"),

    getSettings: () => invoke<Settings>("get_settings"),
    saveSettings: (settings: Settings) => invoke<void>("save_settings", { settings }),
    backupDatabase: (path: string) => invoke<void>("backup_database", { path }),
};

export const errorMessage = (e: unknown) =>
    typeof e === "string"
        ? e
        : e instanceof Error
          ? e.message
          : e && typeof e === "object" && "message" in e
            ? String((e as { message: unknown }).message)
            : e
              ? String(e)
              : "Something went wrong";
