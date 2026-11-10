import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import * as api from "@/services/api";
import { useSession } from "@/stores/session";
import { Logo } from "@/components/common/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "إنشاء حساب – وصّلني" },
      { name: "description", content: "أنشئ حسابك في وصّلني واطلب من أفضل مطاعم دمشق." },
      { property: "og:title", content: "إنشاء حساب – وصّلني" },
      { property: "og:description", content: "حساب جديد في وصّلني خلال دقيقة." },
    ],
  }),
  component: RegisterPage,
});

const schema = z
  .object({
    name: z.string().min(3, "أدخل اسمك الكامل"),
    phone: z.string().regex(/^09\d{8}$/, "أدخل رقم هاتف سوري صحيح يبدأ بـ 09"),
    email: z.string().email("بريد إلكتروني غير صالح").optional().or(z.literal("")),
    password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "كلمتا المرور غير متطابقتين", path: ["confirm"] });
type FormValues = z.infer<typeof schema>;

function RegisterPage() {
  const navigate = useNavigate();
  const setSession = useSession((s) => s.setSession);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "", phone: "", email: "", password: "", confirm: "" } });
  const m = useMutation({
    mutationFn: (v: FormValues) => api.register({ name: v.name, phone: v.phone, email: v.email || undefined, password: v.password }),
    onSuccess: ({ user, token }) => {
      setSession(user, token);
      toast.success("تم إنشاء حسابك بنجاح");
      navigate({ to: "/" });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const err = form.formState.errors;
  const field = (name: keyof FormValues, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} className="h-12" aria-invalid={!!err[name]} {...props} {...form.register(name)} />
      {err[name] && <p className="text-sm text-destructive">{err[name]?.message}</p>}
    </div>
  );
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="surface w-full max-w-md p-6 md:p-8">
        <Link to="/" aria-label="الرئيسية"><Logo className="h-11" /></Link>
        <h1 className="mt-6 text-2xl">إنشاء حساب جديد</h1>
        <form className="mt-6 space-y-4" onSubmit={form.handleSubmit((v) => m.mutate(v))} noValidate>
          {field("name", "الاسم الكامل")}
          {field("phone", "رقم الهاتف", { dir: "ltr", inputMode: "tel", className: "h-12 text-right" })}
          {field("email", "البريد الإلكتروني (اختياري)", { dir: "ltr", type: "email", className: "h-12 text-right" })}
          {field("password", "كلمة المرور", { type: "password", dir: "ltr", className: "h-12 text-right" })}
          {field("confirm", "تأكيد كلمة المرور", { type: "password", dir: "ltr", className: "h-12 text-right" })}
          <Button type="submit" size="lg" className="w-full" disabled={m.isPending}>
            {m.isPending && <Loader2 className="animate-spin" />} إنشاء الحساب
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          لديك حساب؟{" "}
          <Link to="/login" search={{ role: undefined }} className="font-semibold text-primary hover:underline">تسجيل الدخول</Link>
        </p>
      </div>
    </div>
  );
}
