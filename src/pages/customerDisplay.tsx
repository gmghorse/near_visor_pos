import { useEffect, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { formatMoney } from "@/lib/format";

type DisplayLine = { name: string; quantity: number; unitPrice: number };
type DisplayPayload = { lines: DisplayLine[]; subtotal: number; tax: number; total: number };

const empty: DisplayPayload = { lines: [], subtotal: 0, tax: 0, total: 0 };

export default function CustomerDisplay() {
    const [sale, setSale] = useState<DisplayPayload>(empty);

    useEffect(() => {
        let unlisten: (() => void) | undefined;
        listen<DisplayPayload>("customer-cart-updated", (event) => setSale(event.payload)).then((stop) => {
            unlisten = stop;
            void emit("customer-display-ready");
        });
        return () => unlisten?.();
    }, []);

    return (
        <main className="customer-display">
            <div className="customer-brand"><div className="customer-brand-mark">N</div><div><strong>NearVisor</strong><span>Thank you for shopping with us</span></div></div>
            {sale.lines.length === 0 ? (
                <div className="customer-empty"><div className="customer-empty-icon">✦</div><h1>Welcome</h1><p>Your items will appear here as they are scanned.</p></div>
            ) : (
                <div className="customer-sale">
                    <div className="customer-sale-heading"><span>Your order</span><span>{sale.lines.reduce((sum, line) => sum + line.quantity, 0)} items</span></div>
                    <div className="customer-lines">{sale.lines.map((line, index) => <div className="customer-line" key={`${line.name}-${index}`}><div><strong>{line.name}</strong><span>{line.quantity} × {formatMoney(line.unitPrice)}</span></div><strong>{formatMoney(line.quantity * line.unitPrice)}</strong></div>)}</div>
                    <div className="customer-totals"><div><span>Subtotal</span><span>{formatMoney(sale.subtotal)}</span></div><div><span>Tax</span><span>{formatMoney(sale.tax)}</span></div><div className="customer-total"><strong>Total</strong><strong>{formatMoney(sale.total)}</strong></div></div>
                </div>
            )}
            <div className="customer-footer">Powered by NearVisor POS</div>
        </main>
    );
}
