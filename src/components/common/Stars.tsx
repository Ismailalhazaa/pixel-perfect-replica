import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Rating({ value, count, className }: { value: number; count?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm font-semibold", className)}>
      <Star className="h-4 w-4 fill-brand text-brand" aria-hidden />
      {value.toFixed(1)}
      {count !== undefined && <span className="font-normal text-muted-foreground">({count})</span>}
    </span>
  );
}

export function StarInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1" dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} نجوم`}
          onClick={() => onChange(n)}
          className="grid h-11 w-11 place-items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Star className={cn("h-7 w-7", n <= value ? "fill-brand text-brand" : "text-border")} />
        </button>
      ))}
    </div>
  );
}
