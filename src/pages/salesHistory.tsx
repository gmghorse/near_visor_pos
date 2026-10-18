import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/date-picker";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { api, errorMessage, type Sale, type SaleItem } from "@/lib/api";
import { dateString, formatDate, formatMoney } from "@/lib/format";

export default function SalesHistory() {
    const [from, setFrom] = useState(dateString(-7));
    const [to, setTo] = useState(dateString());
    const [sales, setSales] = useState<Sale[]>([]);
    const [selected, setSelected] = useState<Sale | null>(null);
    const [items, setItems] = useState<SaleItem[]>([]);
    const [confirmVoid, setConfirmVoid] = useState(false);
    const [error, setError] = useState("");

    const load = () =>
        api
            .listSales(from, to)
            .then(setSales)
            .catch((e) => setError(errorMessage(e)));

    useEffect(() => {
        load();
    }, [from, to]);

    const view = async (sale: Sale) => {
        setSelected(sale);
        setConfirmVoid(false);
        setError("");
        try {
            setItems(await api.getSaleItems(sale.id));
        } catch (e) {
            setError(errorMessage(e));
        }
    };

    const voidSale = async () => {
        if (!selected) return;
        try {
            await api.voidSale(selected.id);
            setSelected(null);
            await load();
        } catch (e) {
            setError(errorMessage(e));
        }
    };

    const completedTotal = sales
        .filter((s) => s.status === "completed")
        .reduce((sum, s) => sum + s.total, 0);

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Sales history</h1>

            <div className="flex flex-wrap items-center gap-3">
                <DatePicker label="From" value={from} onChange={setFrom} />
                <DatePicker label="To" value={to} onChange={setTo} />
                <span className="ml-auto text-sm text-muted-foreground">
                    {sales.length} sales · {formatMoney(completedTotal)} completed
                </span>
            </div>

            {!selected && error && <p className="text-sm text-destructive">{error}</p>}

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Sale ID</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sales.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="text-muted-foreground">
                                No sales in this date range.
                            </TableCell>
                        </TableRow>
                    )}
                    {sales.map((s) => (
                        <TableRow key={s.id} className={s.status === "voided" ? "opacity-60" : ""}>
                            <TableCell>{formatDate(s.created_at)}</TableCell>
                            <TableCell className="font-mono text-xs">{s.id.slice(-8)}</TableCell>
                            <TableCell className="capitalize">{s.payment_method}</TableCell>
                            <TableCell>
                                <Badge variant={s.status === "voided" ? "destructive" : "outline"}>
                                    {s.status}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">{formatMoney(s.total)}</TableCell>
                            <TableCell className="text-right">
                                <Button size="sm" variant="outline" onClick={() => view(s)}>
                                    View
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Sale {selected?.id.slice(-8)}</DialogTitle>
                        <DialogDescription>
                            {selected && formatDate(selected.created_at)}
                        </DialogDescription>
                    </DialogHeader>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Item</TableHead>
                                <TableHead className="text-right">Qty</TableHead>
                                <TableHead className="text-right">Price</TableHead>
                                <TableHead className="text-right">Line total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((i) => (
                                <TableRow key={i.id}>
                                    <TableCell>{i.product_name}</TableCell>
                                    <TableCell className="text-right">{i.quantity}</TableCell>
                                    <TableCell className="text-right">
                                        {formatMoney(i.unit_price)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {formatMoney(i.unit_price * i.quantity)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    {selected && (
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span>Subtotal</span>
                                <span>{formatMoney(selected.subtotal)}</span>
                            </div>
                            {selected.discount > 0 && (
                                <div className="flex justify-between">
                                    <span>Discount</span>
                                    <span>-{formatMoney(selected.discount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span>Tax</span>
                                <span>{formatMoney(selected.tax)}</span>
                            </div>
                            <div className="flex justify-between font-semibold">
                                <span>Total</span>
                                <span>{formatMoney(selected.total)}</span>
                            </div>
                        </div>
                    )}

                    {error && <p className="text-sm text-destructive">{error}</p>}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelected(null)}>
                            Close
                        </Button>
                        {selected?.status === "completed" &&
                            (confirmVoid ? (
                                <Button variant="destructive" onClick={voidSale}>
                                    Confirm void and restock
                                </Button>
                            ) : (
                                <Button variant="destructive" onClick={() => setConfirmVoid(true)}>
                                    Void sale
                                </Button>
                            ))}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
