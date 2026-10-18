import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { api, errorMessage, type Product, type StockMovement } from "@/lib/api";
import { formatDate, formatMoney, selectClass } from "@/lib/format";

type View = "levels" | "log";
type Filter = "all" | "low" | "out";

const reasons = [
    { value: "restock", label: "Restock / received goods" },
    { value: "recount", label: "Recount correction" },
    { value: "damage", label: "Damaged" },
    { value: "theft", label: "Theft / loss" },
    { value: "other", label: "Other" },
];

export default function Inventory() {
    const [view, setView] = useState<View>("levels");
    const [filter, setFilter] = useState<Filter>("all");
    const [query, setQuery] = useState("");
    const [products, setProducts] = useState<Product[]>([]);
    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [target, setTarget] = useState<Product | null>(null);
    const [change, setChange] = useState("");
    const [reason, setReason] = useState("restock");
    const [note, setNote] = useState("");
    const [error, setError] = useState("");

    const load = async () => {
        const [p, m] = await Promise.all([api.listProducts(), api.listMovements(null, 200)]);
        setProducts(p);
        setMovements(m);
    };

    useEffect(() => {
        load().catch((e) => setError(errorMessage(e)));
    }, []);

    const rows = useMemo(() => {
        const q = query.trim().toLowerCase();
        return products.filter((p) => {
            if (q && !p.name.toLowerCase().includes(q) && !p.sku?.toLowerCase().includes(q))
                return false;
            if (filter === "out") return p.stock <= 0;
            if (filter === "low") return p.stock > 0 && p.stock <= p.reorder_level;
            return true;
        });
    }, [products, query, filter]);

    const totalCostValue = rows.reduce((s, p) => s + p.stock * p.cost, 0);

    const openAdjust = (p: Product) => {
        setTarget(p);
        setChange("");
        setReason("restock");
        setNote("");
        setError("");
    };

    const submit = async () => {
        const n = Math.trunc(Number(change));
        if (!target || !n) return setError("Enter a quantity above or below zero.");
        try {
            await api.adjustStock(target.id, n, reason, note.trim() || null);
            setTarget(null);
            await load();
        } catch (e) {
            setError(errorMessage(e));
        }
    };

    const status = (p: Product) =>
        p.stock <= 0 ? (
            <Badge variant="destructive">Out of stock</Badge>
        ) : p.stock <= p.reorder_level ? (
            <Badge variant="secondary">Low</Badge>
        ) : (
            <Badge variant="outline">In stock</Badge>
        );

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-2xl font-semibold">Inventory</h1>
                <div className="flex gap-2">
                    <Button
                        variant={view === "levels" ? "default" : "outline"}
                        onClick={() => setView("levels")}
                    >
                        Stock levels
                    </Button>
                    <Button
                        variant={view === "log" ? "default" : "outline"}
                        onClick={() => setView("log")}
                    >
                        Movement log
                    </Button>
                </div>
            </div>

            {!target && error && <p className="text-sm text-destructive">{error}</p>}

            {view === "levels" ? (
                <>
                    <div className="flex flex-wrap items-center gap-3">
                        <Input
                            className="max-w-sm"
                            placeholder="Search products"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                        {(["all", "low", "out"] as Filter[]).map((f) => (
                            <Button
                                key={f}
                                size="sm"
                                variant={filter === f ? "default" : "outline"}
                                onClick={() => setFilter(f)}
                            >
                                {f === "all" ? "All" : f === "low" ? "Low stock" : "Out of stock"}
                            </Button>
                        ))}
                        <span className="ml-auto text-sm text-muted-foreground">
                            Stock value at cost: {formatMoney(totalCostValue)}
                        </span>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead className="text-right">Stock</TableHead>
                                <TableHead className="text-right">Reorder level</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Value (cost)</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-muted-foreground">
                                        Nothing to show for this filter.
                                    </TableCell>
                                </TableRow>
                            )}
                            {rows.map((p) => (
                                <TableRow key={p.id}>
                                    <TableCell className="font-medium">{p.name}</TableCell>
                                    <TableCell className="text-right">{p.stock}</TableCell>
                                    <TableCell className="text-right">{p.reorder_level}</TableCell>
                                    <TableCell>{status(p)}</TableCell>
                                    <TableCell className="text-right">
                                        {formatMoney(p.stock * p.cost)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button size="sm" variant="outline" onClick={() => openAdjust(p)}>
                                            Adjust stock
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-right">Change</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Note</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {movements.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-muted-foreground">
                                    Every sale, void and adjustment is recorded here.
                                </TableCell>
                            </TableRow>
                        )}
                        {movements.map((m) => (
                            <TableRow key={m.id}>
                                <TableCell>{formatDate(m.created_at)}</TableCell>
                                <TableCell>{m.product_name}</TableCell>
                                <TableCell
                                    className={`text-right font-medium ${
                                        m.change < 0 ? "text-destructive" : "text-green-600"
                                    }`}
                                >
                                    {m.change > 0 ? `+${m.change}` : m.change}
                                </TableCell>
                                <TableCell className="capitalize">{m.reason}</TableCell>
                                <TableCell className="text-muted-foreground">{m.note ?? "—"}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Adjust stock</DialogTitle>
                        <DialogDescription>
                            {target?.name} currently has {target?.stock} in stock.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <div className="space-y-1">
                            <Label htmlFor="change">Quantity change</Label>
                            <Input
                                id="change"
                                type="number"
                                placeholder="e.g. 24 to add, -3 to remove"
                                value={change}
                                onChange={(e) => setChange(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="reason">Reason</Label>
                            <select
                                id="reason"
                                className={selectClass}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            >
                                {reasons.map((r) => (
                                    <option key={r.value} value={r.value}>
                                        {r.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="note">Note (optional)</Label>
                            <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
                        </div>
                        {error && <p className="text-sm text-destructive">{error}</p>}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTarget(null)}>
                            Cancel
                        </Button>
                        <Button onClick={submit}>Save adjustment</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
