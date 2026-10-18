const ngn = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" });

export const formatMoney = (kobo: number) => ngn.format(kobo / 100);

/** "1250.50" (naira) -> 125050 (kobo) */
export const toKobo = (naira: string | number) => Math.round(Number(naira) * 100);

/** 125050 (kobo) -> "1250.5" for form inputs */
export const fromKobo = (kobo: number) => String(kobo / 100);

/** Database timestamps are UTC with no zone marker, so add one before parsing. */
export const formatDate = (value: string) => {
    const iso = value.includes("T") ? value : value.replace(" ", "T");
    const date = new Date(/(Z|[+-]\d\d:\d\d)$/.test(iso) ? iso : iso + "Z");
    return date.toLocaleString();
};

/** Local date as YYYY-MM-DD, offset by a number of days. */
export const dateString = (offsetDays = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toLocaleDateString("en-CA");
};

export const downloadCsv = (filename: string, rows: (string | number)[][]) => {
    const escape = (v: string | number) => {
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};

/** Matches shadcn input styling for native <select> elements. */
export const selectClass =
    "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
