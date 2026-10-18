import { useEffect, useMemo, useRef, useState } from "react";
import { MonitorPlayIcon, MinusIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { emitTo, listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, errorMessage, type CheckoutResult, type Product } from "@/lib/api";
import { formatDate, formatMoney, selectClass } from "@/lib/format";

type CartLine = { product: Product; qty: number };
type Notice = { kind: "ok" | "error"; text: string };

export default function Pos() {
    const [products, setProducts] = useState<Product[]>([]);
    const [query, setQuery] = useState("");
    const [cart, setCart] = useState<CartLine[]>([]);
    const [payment, setPayment] = useState("cash");
    const [taxRate, setTaxRate] = useState(0);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<Notice | null>(null);
    const [receipt, setReceipt] = useState<{ result: CheckoutResult; lines: CartLine[] } | null>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    const loadProducts = () => api.listProducts().then(setProducts);

    useEffect(() => {
        loadProducts().catch((e) => setNotice({ kind: "error", text: errorMessage(e) }));
        api.getSettings()
            .then((s) => setTaxRate(Number(s.tax_rate ?? 0)))
            .catch(() => {});
        searchRef.current?.focus();
    }, []);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return products.filter(
            (p) =>
                !q ||
                p.name.toLowerCase().includes(q) ||
                p.sku?.toLowerCase().includes(q) ||
                p.barcode?.toLowerCase() === q,
        );
    }, [products, query]);

    const addToCart = (product: Product) => {
        setNotice(null);
        setCart((prev) => {
            const line = prev.find((l) => l.product.id === product.id);
            if (line) {
                if (line.qty >= product.stock) return prev;
                return prev.map((l) => (l === line ? { ...l, qty: l.qty + 1 } : l));
            }
            return product.stock > 0 ? [...prev, { product, qty: 1 }] : prev;
        });
    };

    const changeQty = (id: string, delta: number) =>
        setCart((prev) =>
            prev
                .map((l) =>
                    l.product.id === id
                        ? { ...l, qty: Math.min(l.qty + delta, l.product.stock) }
                        : l,
                )
                .filter((l) => l.qty > 0),
        );

    const removeLine = (id: string) => setCart((prev) => prev.filter((l) => l.product.id !== id));

    // USB scanners behave like a keyboard and normally append Enter.
    const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== "Enter") return;
        const q = query.trim().toLowerCase();
        const match = products.find(
            (p) => p.barcode?.toLowerCase() === q || p.sku?.toLowerCase() === q,
        );
        if (match) {
            addToCart(match);
            setQuery("");
        }
    };

    const subtotal = cart.reduce((sum, l) => sum + l.product.price * l.qty, 0);
    const tax = Math.round((subtotal * taxRate) / 100);
    const total = subtotal + tax;

    const charge = async () => {
        setBusy(true);
        try {
            const completedLines = cart;
            const result = await api.checkout(
                cart.map((l) => ({ productId: l.product.id, quantity: l.qty })),
                payment,
            );
            setCart([]);
            setReceipt({ result, lines: completedLines });
            setNotice({ kind: "ok", text: "Sale completed." });
            await loadProducts();
            searchRef.current?.focus();
        } catch (e) {
            setNotice({ kind: "error", text: errorMessage(e) });
        } finally {
            setBusy(false);
        }
    };

    const printReceipt = () => window.print();

    const displayPayload = {
        lines: cart.map(({ product, qty }) => ({ name: product.name, quantity: qty, unitPrice: product.price })),
        subtotal,
        tax,
        total,
    };

    useEffect(() => {
        void emitTo("customer-display", "customer-cart-updated", displayPayload).catch(() => {});
    }, [cart, subtotal, tax, total]);

    useEffect(() => {
        let stop: (() => void) | undefined;
        listen("customer-display-ready", () => {
            void emitTo("customer-display", "customer-cart-updated", displayPayload).catch(() => {});
        }).then((unlisten) => { stop = unlisten; });
        return () => stop?.();
    }, [cart, subtotal, tax, total]);

    const openCustomerDisplay = async () => {
        const existing = await WebviewWindow.getByLabel("customer-display");
        if (existing) {
            await existing.show();
            await existing.setFocus();
            return;
        }
        const display = new WebviewWindow("customer-display", {
            url: "/customer-display",
            title: "NearVisor Customer Display",
            width: 900,
            height: 650,
            resizable: true,
        });
        display.once("tauri://error", (event) => setNotice({ kind: "error", text: `Customer display could not open: ${String(event.payload)}` }));
    };

    return (
        <>
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-3"><h1 className="text-2xl font-semibold">POS</h1><Button size="sm" variant="outline" onClick={openCustomerDisplay}><MonitorPlayIcon /> Customer display</Button></div>
                <Input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onSearchKey}
                    inputMode="search"
                    autoComplete="off"
                    placeholder="Search or scan a barcode…"
                />
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                    {visible.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => addToCart(p)}
                            disabled={p.stock <= 0}
                            className="rounded-lg border p-3 text-left transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <div className="font-medium leading-tight">{p.name}</div>
                            <div className="mt-1 text-sm">{formatMoney(p.price)}</div>
                            <div
                                className={`text-xs ${
                                    p.stock <= p.reorder_level
                                        ? "text-destructive"
                                        : "text-muted-foreground"
                                }`}
                            >
                                {p.stock <= 0 ? "Out of stock" : `${p.stock} in stock`}
                            </div>
                        </button>
                    ))}
                    {visible.length === 0 && (
                        <p className="col-span-full text-muted-foreground">
                            No products match. Add products on the Products page.
                        </p>
                    )}
                </div>
            </div>

            <Card className="h-fit lg:sticky lg:top-4">
                <CardHeader>
                    <CardTitle>Current sale</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {cart.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Select a product to add it to the sale.
                        </p>
                    ) : (
                        <ul className="space-y-3">
                            {cart.map(({ product, qty }) => (
                                <li key={product.id} className="flex items-center gap-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-medium">
                                            {product.name}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {formatMoney(product.price)} each
                                        </div>
                                    </div>
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        className="quantity-button"
                                        aria-label="Decrease quantity"
                                        onClick={() => changeQty(product.id, -1)}
                                    >
                                        <MinusIcon />
                                    </Button>
                                    <span className="w-6 text-center text-sm">{qty}</span>
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        className="quantity-button"
                                        aria-label="Increase quantity"
                                        disabled={qty >= product.stock}
                                        onClick={() => changeQty(product.id, 1)}
                                    >
                                        <PlusIcon />
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        aria-label="Remove item"
                                        onClick={() => removeLine(product.id)}
                                    >
                                        <TrashIcon />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="space-y-1 border-t pt-3 text-sm">
                        <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span>{formatMoney(subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                            <span>Tax ({taxRate}%)</span>
                            <span>{formatMoney(tax)}</span>
                        </div>
                        <div className="flex justify-between text-lg font-semibold">
                            <span>Total</span>
                            <span>{formatMoney(total)}</span>
                        </div>
                    </div>

                    <select
                        className={selectClass}
                        value={payment}
                        onChange={(e) => setPayment(e.target.value)}
                        aria-label="Payment method"
                    >
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="transfer">Transfer</option>
                    </select>

                    {notice && (
                        <p
                            className={`text-sm ${
                                notice.kind === "ok" ? "text-green-600" : "text-destructive"
                            }`}
                        >
                            {notice.text}
                        </p>
                    )}

                    <Button
                        className="w-full"
                        size="lg"
                        disabled={cart.length === 0 || busy}
                        onClick={charge}
                    >
                        {busy ? "Processing…" : `Charge ${formatMoney(total)}`}
                    </Button>
                    {cart.length > 0 && (
                        <Button variant="ghost" className="w-full" onClick={() => setCart([])}>
                            Clear sale
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
        {receipt && (
            <section className="receipt-print mt-6 max-w-md rounded-xl border bg-card p-5 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div><h2 className="font-semibold">Receipt ready</h2><p className="text-xs text-muted-foreground">Sale {receipt.result.sale_id.slice(-8)} · {formatDate(receipt.result.created_at)}</p></div>
                    <Button size="sm" onClick={printReceipt}>Print receipt</Button>
                </div>
                <div className="receipt-paper space-y-2 text-sm">
                    {receipt.lines.map(({ product, qty }) => <div key={product.id} className="flex justify-between gap-4"><span>{qty} × {product.name}</span><span>{formatMoney(product.price * qty)}</span></div>)}
                    <div className="mt-3 space-y-1 border-t pt-3"><div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(receipt.result.subtotal)}</span></div><div className="flex justify-between"><span>Tax</span><span>{formatMoney(receipt.result.tax)}</span></div><div className="flex justify-between font-semibold"><span>Total</span><span>{formatMoney(receipt.result.total)}</span></div></div>
                </div>
            </section>
        )}
        </>
    );
}
