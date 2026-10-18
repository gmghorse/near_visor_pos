import { useEffect, useMemo, useState } from "react";
import { PlusIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
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
import { api, errorMessage, type Category, type Product } from "@/lib/api";
import { formatMoney, fromKobo, selectClass, toKobo } from "@/lib/format";

type Form = {
    name: string;
    sku: string;
    barcode: string;
    categoryId: string;
    price: string;
    cost: string;
    stock: string;
    reorderLevel: string;
};

const emptyForm: Form = {
    name: "",
    sku: "",
    barcode: "",
    categoryId: "",
    price: "",
    cost: "",
    stock: "0",
    reorderLevel: "0",
};

export default function Products() {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [query, setQuery] = useState("");
    const [showInactive, setShowInactive] = useState(false);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Product | null>(null);
    const [form, setForm] = useState<Form>(emptyForm);
    const [newCategory, setNewCategory] = useState("");
    const [error, setError] = useState("");

    const load = async () => {
        const [p, c] = await Promise.all([api.listProducts(showInactive), api.listCategories()]);
        setProducts(p);
        setCategories(c);
    };

    useEffect(() => {
        load().catch((e) => setError(errorMessage(e)));
    }, [showInactive]);

    const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "—";

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return products.filter(
            (p) =>
                !q ||
                p.name.toLowerCase().includes(q) ||
                p.sku?.toLowerCase().includes(q) ||
                p.barcode?.toLowerCase().includes(q),
        );
    }, [products, query]);

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setError("");
        setOpen(true);
    };

    const openEdit = (p: Product) => {
        setEditing(p);
        setForm({
            name: p.name,
            sku: p.sku ?? "",
            barcode: p.barcode ?? "",
            categoryId: p.category_id ?? "",
            price: fromKobo(p.price),
            cost: fromKobo(p.cost),
            stock: String(p.stock),
            reorderLevel: String(p.reorder_level),
        });
        setError("");
        setOpen(true);
    };

    const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value }));

    const save = async () => {
        if (!form.name.trim()) return setError("Enter a product name.");
        if (form.price === "" || Number(form.price) < 0) return setError("Enter a valid price.");
        const input = {
            name: form.name.trim(),
            sku: form.sku.trim() || null,
            barcode: form.barcode.trim() || null,
            categoryId: form.categoryId || null,
            price: toKobo(form.price),
            cost: toKobo(form.cost || 0),
            stock: Math.trunc(Number(form.stock || 0)),
            reorderLevel: Math.trunc(Number(form.reorderLevel || 0)),
        };
        try {
            if (editing) await api.updateProduct(editing.id, input);
            else await api.createProduct(input);
            setOpen(false);
            await load();
        } catch (e) {
            setError(errorMessage(e));
        }
    };

    const toggleActive = async (p: Product) => {
        try {
            await api.setProductActive(p.id, !p.is_active);
            await load();
        } catch (e) {
            setError(errorMessage(e));
        }
    };

    const addCategory = async () => {
        const name = newCategory.trim();
        if (!name) return;
        try {
            await api.createCategory(name);
            setNewCategory("");
            await load();
        } catch (e) {
            setError(errorMessage(e));
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-2xl font-semibold">Products</h1>
                <Button onClick={openCreate}>
                    <PlusIcon /> Add product
                </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Input
                    className="max-w-sm"
                    placeholder="Search by name, SKU or barcode"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={showInactive}
                        onChange={(e) => setShowInactive(e.target.checked)}
                    />
                    Show inactive
                </label>
                <div className="ml-auto flex items-center gap-2">
                    <Input
                        className="w-48"
                        placeholder="New category"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addCategory()}
                    />
                    <Button variant="outline" onClick={addCategory}>
                        Add category
                    </Button>
                </div>
            </div>

            {!open && error && <p className="text-sm text-destructive">{error}</p>}

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filtered.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={7} className="text-muted-foreground">
                                No products yet. Add your first product to start selling.
                            </TableCell>
                        </TableRow>
                    )}
                    {filtered.map((p) => (
                        <TableRow key={p.id} className={p.is_active ? "" : "opacity-60"}>
                            <TableCell className="font-medium">
                                {p.name}{" "}
                                {!p.is_active && <Badge variant="secondary">Inactive</Badge>}
                            </TableCell>
                            <TableCell>{p.sku ?? "—"}</TableCell>
                            <TableCell>{categoryName(p.category_id)}</TableCell>
                            <TableCell className="text-right">{formatMoney(p.price)}</TableCell>
                            <TableCell className="text-right">{formatMoney(p.cost)}</TableCell>
                            <TableCell className="text-right">{p.stock}</TableCell>
                            <TableCell className="space-x-2 text-right">
                                <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                                    Edit
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => toggleActive(p)}>
                                    {p.is_active ? "Deactivate" : "Activate"}
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editing ? "Edit product" : "Add product"}</DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 space-y-1">
                            <Label htmlFor="name">Name</Label>
                            <Input id="name" value={form.name} onChange={set("name")} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="sku">SKU</Label>
                            <Input id="sku" value={form.sku} onChange={set("sku")} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="barcode">Barcode</Label>
                            <Input id="barcode" value={form.barcode} onChange={set("barcode")} />
                        </div>
                        <div className="col-span-2 space-y-1">
                            <Label htmlFor="category">Category</Label>
                            <select
                                id="category"
                                className={selectClass}
                                value={form.categoryId}
                                onChange={set("categoryId")}
                            >
                                <option value="">No category</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="price">Price (₦)</Label>
                            <Input
                                id="price"
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.price}
                                onChange={set("price")}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="cost">Cost (₦)</Label>
                            <Input
                                id="cost"
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.cost}
                                onChange={set("cost")}
                            />
                        </div>
                        {!editing && (
                            <div className="space-y-1">
                                <Label htmlFor="stock">Opening stock</Label>
                                <Input
                                    id="stock"
                                    type="number"
                                    className="quantity-input"
                                    min="0"
                                    value={form.stock}
                                    onChange={set("stock")}
                                />
                            </div>
                        )}
                        <div className="space-y-1">
                            <Label htmlFor="reorder">Reorder level</Label>
                            <Input
                                id="reorder"
                                type="number"
                                className="quantity-input"
                                min="0"
                                value={form.reorderLevel}
                                onChange={set("reorderLevel")}
                            />
                        </div>
                    </div>

                    {editing && (
                        <p className="text-xs text-muted-foreground">
                            To change stock, use a stock adjustment on the Inventory page so the
                            change is logged.
                        </p>
                    )}
                    {error && <p className="text-sm text-destructive">{error}</p>}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={save}>{editing ? "Save changes" : "Add product"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
