import { createFileRoute } from "@tanstack/react-router";

// Login and account management for the barber area (public/nova-era.html).
// Every privileged action is checked inside the database functions via the session token.
export const Route = createFileRoute("/api/public/barber-accounts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Record<string, unknown>;
        try { body = await request.json(); } catch { return Response.json({ error: "bad" }, { status: 400 }); }
        const s = (k: string) => (typeof body[k] === "string" ? (body[k] as string).slice(0, 200) : "");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;
        const action = s("action");
        let r: { data: unknown; error: unknown };
        if (action === "login") r = await db.rpc("ne_login", { _name: s("name"), _pin: s("pin") });
        else if (action === "list") r = await db.rpc("ne_list", { _token: s("token") });
        else if (action === "setPin") r = await db.rpc("ne_set_pin", { _token: s("token"), _id: s("id"), _pin: s("pin") });
        else if (action === "delete") r = await db.rpc("ne_delete", { _token: s("token"), _id: s("id") });
        else return Response.json({ error: "bad" }, { status: 400 });
        if (r.error) return Response.json({ error: "forbidden" }, { status: 403 });
        if (action === "login" && !r.data) return Response.json({ error: "invalid" }, { status: 401 });
        return Response.json({ ok: true, data: r.data ?? null });
      },
    },
  },
});
