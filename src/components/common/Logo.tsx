import logo from "@/assets/brand/waselni-logo.svg";
import logoDark from "@/assets/brand/waselni-logo-on-dark.svg";
import icon from "@/assets/brand/waselni-icon.svg";
import { cn } from "@/lib/utils";

export function Logo({ variant = "light", className }: { variant?: "light" | "dark" | "icon"; className?: string }) {
  const src = variant === "dark" ? logoDark : variant === "icon" ? icon : logo;
  return <img src={src} alt="وصّلني" className={cn("h-10 w-auto", className)} />;
}
