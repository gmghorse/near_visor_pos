import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { api, errorMessage, type DashboardStats } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";

export default function Dashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        api.dashboardStats().then(setStats).catch((e) => setError(errorMessage(e)));
    }, []);

    if (error) return <p className="text-destructive">{error}</p>;
    if (!stats) return <p className="text-muted-foreground">Loading…</p>;

    const cards = [
        { label: "Today's sales", value: formatMoney(stats.today_revenue) },
        { label: "Transactions", value: String(stats.today_transactions) },
        { label: "Today's profit", value: formatMoney(stats.today_profit) },
    ];

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold">Dashboard</h1>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {cards.map((c) => (
                    <Card key={c.label}>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                {c.label}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-2xl font-semibold">{c.value}</CardContent>
                    </Card>
                ))}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Low stock items
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Link
                            to="/inventory"
                            className={`text-2xl font-semibold ${
                                stats.low_stock_count > 0 ? "text-destructive" : ""
                            }`}
                        >
                            {stats.low_stock_count}
                        </Link>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Top sellers today</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead className="text-right">Units</TableHead>
                                    <TableHead className="text-right">Revenue</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stats.top_products.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-muted-foreground">
                                            No sales yet today.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {stats.top_products.map((p) => (
                                    <TableRow key={p.name}>
                                        <TableCell>{p.name}</TableCell>
                                        <TableCell className="text-right">{p.units}</TableCell>
                                        <TableCell className="text-right">
                                            {formatMoney(p.revenue)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Recent sales</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Payment</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stats.recent_sales.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-muted-foreground">
                                            Completed sales will show up here.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {stats.recent_sales.map((s) => (
                                    <TableRow key={s.id}>
                                        <TableCell>{formatDate(s.created_at)}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="capitalize">
                                                {s.payment_method}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {formatMoney(s.total)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
