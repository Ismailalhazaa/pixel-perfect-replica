import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { useSession } from "@/stores/session";
import { useCart } from "@/stores/cart";
import { socket } from "@/services/realtime";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-muted-foreground">الصفحة التي تبحث عنها غير موجودة أو تم نقلها.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">تعذّر تحميل الصفحة</h1>
        <p className="mt-2 text-sm text-muted-foreground">حدث خطأ ما. حاول التحديث أو عد للرئيسية.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            إعادة المحاولة
          </button>
          <a href="/" className="inline-flex h-11 items-center justify-center rounded-xl border border-input bg-card px-5 text-sm font-semibold">
            الرئيسية
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "وصّلني – توصيل الطعام والطلبات" },
      { name: "description", content: "وصّلني: اطلب من مطاعمك ومحلاتك المفضلة وتابع طلبك مباشرة على الخريطة، والدفع نقداً عند الاستلام." },
      { property: "og:title", content: "وصّلني – توصيل الطعام والطلبات" },
      { property: "og:description", content: "اطلب من مطاعمك المفضلة وتابع طلبك مباشرة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;800&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/** Rehydrates persisted stores and wires realtime events to the query cache. */
function ClientBridge() {
  const qc = useQueryClient();
  useEffect(() => {
    void useSession.persist.rehydrate();
    void useCart.persist.rehydrate();
    const onOrder = () => {
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "driverLocation" });
    };
    const onLoc = () => void qc.invalidateQueries({ queryKey: ["driverLocation"] });
    socket.on("order:created", onOrder).on("order:updated", onOrder).on("db:changed", onOrder).on("driver:location", onLoc);
    return () => {
      socket.off("order:created", onOrder).off("order:updated", onOrder).off("db:changed", onOrder).off("driver:location", onLoc);
    };
  }, [qc]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ClientBridge />
      <Outlet />
      <Toaster position="top-center" dir="rtl" richColors />
    </QueryClientProvider>
  );
}
