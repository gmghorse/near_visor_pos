import { useMemo, useState } from "react";
import { CalendarIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type DatePickerProps = { value: string; onChange: (value: string) => void; label: string };

const toDate = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
};

const toValue = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

export function DatePicker({ value, onChange, label }: DatePickerProps) {
    const [open, setOpen] = useState(false);
    const selected = useMemo(() => toDate(value), [value]);

    return (
        <div className="flex items-center gap-2 text-sm">
            <span>{label}</span>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger
                    render={
                        <Button variant="outline" className="date-picker-trigger w-40 justify-start font-normal">
                            <CalendarIcon />
                            {selected.toLocaleDateString(undefined, { dateStyle: "medium" })}
                        </Button>
                    }
                />
                <PopoverContent align="start" className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={selected}
                        onSelect={(date) => {
                            if (!date) return;
                            onChange(toValue(date));
                            setOpen(false);
                        }}
                    />
                </PopoverContent>
            </Popover>
        </div>
    );
}
