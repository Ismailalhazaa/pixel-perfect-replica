import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bike, ChefHat, ShieldCheck, ShoppingBag, Loader2 } from "lucide-react";
import type { Role } from "@/types";
import * as api from "@/services/api";
import { HOME_BY_ROLE, useSession } from "@/stores/session";
import { Logo } from "@/components/common/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const ROLES: Role[] = ["CUSTOMER", "RESTAURANT", "DRIVER", "ADMIN"];

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { role: Role | undefined } => ({
    role: ROLES.includes(s.role as Role) ? (s.role as Role) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "تسجيل الدخول – وصّلني" },
      { name: "description", content: "سجّل دخولك إلى وصّلني كزبون أو مطعم أو سائق أو مدير." },
      { property: "og:title", content: "تسجيل الدخول – وصّلني" },
      { property: "og:description", content: "ادخل إلى حسابك في وصّلني." },
    ],
  }),
  component: LoginPage,
});

/** Demo accounts seeded by the mock layer (password 123456). */
const DEMO: { role: Role; label: string; phone: string; icon: typeof Bike }[] = [
  { role: "CUSTOMER", label: "زبون", phone: "0933111111", icon: ShoppingBag },
  { role: "RESTAURANT", label: "مطعم", phone: "0944000001", icon: ChefHat },
  { role: "DRIVER", label: "سائق", phone: "0955000001", icon: Bike },
  { role: "ADMIN", label: "مدير", phone: "0911000000", icon: ShieldCheck },
];

const schema = z.object({
  phone: z.string().regex(/^09\d{8}$/, "أدخل رقم هاتف سوري صحيح يبدأ بـ 09"),
  password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل"),
});
type FormValues = z.infer<typeof schema>;

function LoginPage() {
  const { role } = Route.useSearch();
  const navigate = useNavigate();
  const setSession = useSession((s) => s.setSession);
  const initial = DEMO.find((d) => d.role === role) ?? DEMO[0];
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { phone: initial.phone, password: "123456" } });

  const m = useMutation({
    mutationFn: (v: FormValues) => api.login(v.phone, v.password),
    onSuccess: ({ user, token }) => {
      setSession(user, token);
      toast.success(`أهلاً ${user.name}`);
      navigate({ to: HOME_BY_ROLE[user.role] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const phone = form.watch("phone");

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link to="/" aria-label="الرئيسية"><Logo className="h-12" /></Link>
          <h1 className="mt-8 text-3xl">أهلاً بعودتك</h1>
          <p className="mt-2 text-muted-foreground">سجّل دخولك لتتابع طلباتك.</p>

          <fieldset className="mt-6">
            <legend className="mb-2 text-sm font-semibold">حسابات تجريبية</legend>
            <div className="grid grid-cols-4 gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.role}
                  type="button"
                  aria-pressed={phone === d.phone}
                  onClick={() => form.reset({ phone: d.phone, password: "123456" })}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border-2 border-border bg-card text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    phone === d.phone && "border-primary bg-brand-soft text-primary",
                  )}
                >
                  <d.icon className="h-5 w-5" /> {d.label}
                </button>
              ))}
            </div>
          </fieldset>

          <form className="mt-6 space-y-4" onSubmit={form.handleSubmit((v) => m.mutate(v))} noValidate>
            <div className="space-y-2">
              <Label htmlFor="phone">رقم الهاتف</Label>
              <Input id="phone" dir="ltr" inputMode="tel" className="h-12 text-right" {...form.register("phone")} aria-invalid={!!form.formState.errors.phone} />
              {form.formState.errors.phone && <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input id="password" type="password" dir="ltr" className="h-12 text-right" {...form.register("password")} aria-invalid={!!form.formState.errors.password} />
              {form.formState.errors.password && <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>}
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={m.isPending}>
              {m.isPending && <Loader2 className="animate-spin" />} دخول
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            ليس لديك حساب؟{" "}
            <Link to="/register" className="font-semibold text-primary underline-offset-4 hover:underline">إنشاء حساب</Link>
          </p>
        </div>
      </div>
      <div className="hero-glow hidden flex-col justify-end p-12 lg:flex">
        <Logo variant="dark" className="mb-auto h-14 self-start" />
        <p className="text-4xl font-extrabold leading-tight text-brand-ink-foreground">أطيب أكلات الشام<br />لعند باب بيتك.</p>
        <p className="mt-4 max-w-md text-brand-ink-foreground/80">تابع طلبك لحظة بلحظة على الخريطة، وادفع نقداً عند الاستلام.</p>
      </div>
    </div>
  );
}
