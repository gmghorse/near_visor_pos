import { useEffect, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage, type Settings as SettingsMap } from "@/lib/api";
import { dateString, selectClass } from "@/lib/format";

const defaults: SettingsMap = {
    business_name: "My Store",
    address: "",
    phone: "",
    currency_symbol: "₦",
    tax_rate: "0",
    receipt_header: "",
    receipt_footer: "Thank you for your purchase!",
    receipt_width: "80mm",
    allow_negative_stock: "false",
};

type Notice = { kind: "ok" | "error"; text: string } | null;

export default function Settings() {
    const [values, setValues] = useState<SettingsMap>(defaults);
    const [notice, setNotice] = useState<Notice>(null);

    useEffect(() => {
        api.getSettings()
            .then((s) => setValues({ ...defaults, ...s }))
            .catch((e) => setNotice({ kind: "error", text: errorMessage(e) }));
    }, []);

    const field = (key: string) => ({
        id: key,
        value: values[key] ?? "",
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
            setValues((v) => ({ ...v, [key]: e.target.value })),
    });

    const saveAll = async () => {
        const rate = Number(values.tax_rate);
        if (Number.isNaN(rate) || rate < 0 || rate > 100)
            return setNotice({ kind: "error", text: "Tax rate must be between 0 and 100." });
        try {
            await api.saveSettings(values);
            setNotice({ kind: "ok", text: "Settings saved." });
        } catch (e) {
            setNotice({ kind: "error", text: errorMessage(e) });
        }
    };

    const backup = async () => {
        try {
            const path = await save({
                defaultPath: `pos-backup-${dateString()}.db`,
                filters: [{ name: "SQLite database", extensions: ["db"] }],
            });
            if (!path) return;
            await api.backupDatabase(path);
            setNotice({ kind: "ok", text: `Backup saved to ${path}` });
        } catch (e) {
            setNotice({ kind: "error", text: errorMessage(e) });
        }
    };

    return (
        <div className="max-w-2xl space-y-6">
            <h1 className="text-2xl font-semibold">Settings</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Business</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor="business_name">Business name</Label>
                        <Input {...field("business_name")} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor="address">Address</Label>
                        <Input {...field("address")} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="phone">Phone</Label>
                        <Input {...field("phone")} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="currency_symbol">Currency symbol</Label>
                        <Input {...field("currency_symbol")} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="tax_rate">Tax rate (%)</Label>
                        <Input type="number" min="0" max="100" step="0.01" {...field("tax_rate")} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="allow_negative_stock">Selling out-of-stock items</Label>
                        <select className={selectClass} {...field("allow_negative_stock")}>
                            <option value="false">Not allowed</option>
                            <option value="true">Allowed</option>
                        </select>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Receipt</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor="receipt_header">Header text</Label>
                        <Input {...field("receipt_header")} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor="receipt_footer">Footer text</Label>
                        <Input {...field("receipt_footer")} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="receipt_width">Paper width</Label>
                        <select className={selectClass} {...field("receipt_width")}>
                            <option value="58mm">58 mm</option>
                            <option value="80mm">80 mm</option>
                        </select>
                    </div>
                </CardContent>
            </Card>

            {notice && (
                <p className={`text-sm ${notice.kind === "ok" ? "text-green-600" : "text-destructive"}`}>
                    {notice.text}
                </p>
            )}

            <Button onClick={saveAll}>Save settings</Button>

            <Card>
                <CardHeader>
                    <CardTitle>Backup</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        Save a copy of your database to a drive or folder you choose. Do this
                        regularly, since all your data lives on this computer.
                    </p>
                    <Button variant="outline" onClick={backup}>
                        Back up database
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
