import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/stores/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className, variant = "outline" }: { className?: string; variant?: "outline" | "ghost" }) {
  const theme = useTheme((s) => s.theme);
  const toggle = useTheme((s) => s.toggle);
  const dark = theme === "dark";
  return (
    <Button type="button" variant={variant} size="icon" className={cn(className)} onClick={toggle} aria-label={dark ? "الوضع الفاتح" : "الوضع الداكن"} title={dark ? "الوضع الفاتح" : "الوضع الداكن"}>
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
