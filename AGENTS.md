<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Architecture
- All data access goes through `src/services/api.ts`; components never touch `mockApi`/`mockDb` — so the mock can be swapped for the REST backend via `VITE_USE_MOCK=false`.
- `src/types/index.ts` mirrors the backend contract exactly; do not rename fields — the Node/Postgres backend depends on it.
- Order status transitions live only in `src/lib/orderStatus.ts` — one source of truth for labels, colors and per-role permissions.
- Realtime goes through `src/services/realtime.ts` (socket.io-like `on/off/emit`) — swappable for a real socket.
- No Lovable Cloud/Supabase in this project — the user's own backend will be connected later.
- Leaflet is loaded only via `components/map/LazyMap` (ClientOnly + lazy) — it breaks SSR if imported directly.
- tsconfig keeps `strict` but disables exactOptionalPropertyTypes/noUncheckedIndexedAccess — they fought shadcn/radix prop types.
