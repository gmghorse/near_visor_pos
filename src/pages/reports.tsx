import { useEffect, useState } from "react";
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/date-picker";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    api,
    errorMessage,
    type DayRow,
    type ProfitRow,
    type ValuationRow,
} from "@/lib/api";
import { dateString, downloadCsv, formatMoney } from "@/lib/format";

const naira = (kobo: number) => (kobo / 100).toFixed(2);

export default function Reports() {
    const [from, setFrom] = useState(dateString(-30));
    const [to, setTo] = useState(dateString());
    const [days, setDays] = useState<DayRow[]>([]);
    const [profit, setProfit] = useState<ProfitRow[]>([]);
    const [valuation, setValuation] = useState<ValuationRow[]>([]);
    const [error, setError] = useState("");

    useEffect(() => {
        setError("");
        Promise.all([
            api.salesByDay(from, to),
            api.profitByProduct(from, to),
            api.inventoryValuation(),
        ])
            .then(([d, p, v]) => {
                setDays(d);
                setProfit(p);
                setValuation(v);
            })
            .catch((e) => setError(errorMessage(e)));
    }, [from, to]);

    const totalRevenue = days.reduce((s, d) => s + d.revenue, 0);
    const totalProfit = profit.reduce((s, p) => s + p.profit, 0);

    const exportButton = (onClick: () => void) => (
        <Button size="sm" variant="outline" onClick={onClick}>
            <DownloadSimpleIcon /> Export CSV
        </Button>
    );

    const empty = (cols: number) => (
        <TableRow>
            <TableCell colSpan={cols} className="text-muted-foreground">
                No data for this period.
            </TableCell>
        </TableRow>
    );

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold">Reports</h1>

            <div className="flex flex-wrap items-center gap-3">
                <DatePicker label="From" value={from} onChange={setFrom} />
                <DatePicker label="To" value={to} onChange={setTo} />
                <span className="ml-auto text-sm text-muted-foreground">
                    Revenue {formatMoney(totalRevenue)} · Profit {formatMoney(totalProfit)}
                </span>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Card>
                <CardHeader className="flex-row items-center justify-between">
                    <CardTitle>Sales by day</CardTitle>
                    {exportButton(() =>
                        downloadCsv(`sales-by-day_${from}_${to}.csv`, [
                            ["Day", "Transactions", "Revenue"],
                            ...days.map((d) => [d.day, d.transactions, naira(d.revenue)]),
                        ]),
                    )}
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Day</TableHead>
                                <TableHead className="text-right">Transactions</TableHead>
                                <TableHead className="text-right">Revenue</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {days.length === 0 && empty(3)}
                            {days.map((d) => (
                                <TableRow key={d.day}>
                                    <TableCell>{d.day}</TableCell>
                                    <TableCell className="text-right">{d.transactions}</TableCell>
                                    <TableCell className="text-right">{formatMoney(d.revenue)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex-row items-center justify-between">
                    <CardTitle>Profit by product</CardTitle>
                    {exportButton(() =>
                        downloadCsv(`profit-by-product_${from}_${to}.csv`, [
                            ["Product", "Units", "Revenue", "Profit"],
                            ...profit.map((p) => [p.name, p.units, naira(p.revenue), naira(p.profit)]),
                        ]),
                    )}
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead className="text-right">Units</TableHead>
                                <TableHead className="text-right">Revenue</TableHead>
                                <TableHead className="text-right">Profit</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {profit.length === 0 && empty(4)}
                            {profit.map((p) => (
                                <TableRow key={p.name}>
                                    <TableCell>{p.name}</TableCell>
                                    <TableCell className="text-right">{p.units}</TableCell>
                                    <TableCell className="text-right">{formatMoney(p.revenue)}</TableCell>
                                    <TableCell className="text-right">{formatMoney(p.profit)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex-row items-center justify-between">
                    <CardTitle>Inventory valuation (current)</CardTitle>
                    {exportButton(() =>
                        downloadCsv("inventory-valuation.csv", [
                            ["Product", "Stock", "Value at cost", "Value at price"],
                            ...valuation.map((v) => [
                                v.name,
                                v.stock,
                                naira(v.cost_value),
                                naira(v.retail_value),
                            ]),
                        ]),
                    )}
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead className="text-right">Stock</TableHead>
                                <TableHead className="text-right">Value at cost</TableHead>
                                <TableHead className="text-right">Value at price</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {valuation.length === 0 && empty(4)}
                            {valuation.map((v) => (
                                <TableRow key={v.name}>
                                    <TableCell>{v.name}</TableCell>
                                    <TableCell className="text-right">{v.stock}</TableCell>
                                    <TableCell className="text-right">{formatMoney(v.cost_value)}</TableCell>
                                    <TableCell className="text-right">{formatMoney(v.retail_value)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
