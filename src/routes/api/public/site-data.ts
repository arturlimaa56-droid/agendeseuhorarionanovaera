import { createFileRoute } from "@tanstack/react-router";

// Shared data for public/nova-era.html: site content, photos and bookings.
// Public: read site/photos/busy slots and create a booking. Barber session token required for everything else.
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
async function session(db: any, token: string) {
  if (!token) return null;
  const { data } = await db.rpc("ne_session", { _token: token });
  return data as { id: string; b: string | null; master: boolean } | null;
}

export const Route = createFileRoute("/api/public/site-data")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const db = await admin();
        const since = new URL(request.url).searchParams.get("since") || "";
        const today = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const [site, busy, last] = await Promise.all([
          db.from("site_content").select("value").eq("key", "site").maybeSingle(),
          db.from("bookings").select("id,barber,date,time,dur").gte("date", today),
          db.from("site_content").select("updated_at").like("key", "photo:%").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        ]);
        const ver = String(last.data?.updated_at || "") + ":" + String((await db.from("site_content").select("key", { count: "exact", head: true }).like("key", "photo:%")).count || 0);
        let photos = null;
        if (ver !== since) {
          const p = await db.from("site_content").select("value").like("key", "photo:%");
          photos = (p.data || []).map((r: any) => r.value);
        }
        return Response.json({ site: site.data?.value ?? null, busy: busy.data || [], photos, ver });
      },
      POST: async ({ request }) => {
        let body: any;
        try { body = await request.json(); } catch { return Response.json({ error: "bad" }, { status: 400 }); }
        const db = await admin();
        const action = str(body.action);
        if (action === "book") {
          const b = body.booking || {};
          const row = { id: str(b.id, 60), barber: str(b.barber, 10), date: str(b.date, 10), time: str(b.time, 5), dur: Math.min(240, Math.max(5, Number(b.dur) || 30)) };
          if (!row.id || !/^b\d$/.test(row.barber) || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !/^\d{2}:\d{2}$/.test(row.time)) return Response.json({ error: "bad" }, { status: 400 });
          const clash = await db.from("bookings").select("id").eq("barber", row.barber).eq("date", row.date).eq("time", row.time).limit(1);
          if (clash.data?.length) return Response.json({ error: "taken" }, { status: 409 });
          const data: Record<string, string | number> = {};
          for (const k of ["id", "barber", "barberName", "date", "time", "name", "phone", "service"]) data[k] = str(b[k]);
          data["dur"] = row.dur;
          const r = await db.from("bookings").insert({ ...row, data });
          return r.error ? Response.json({ error: "fail" }, { status: 500 }) : Response.json({ ok: true });
        }
        const me = await session(db, str(body.token));
        if (!me) return Response.json({ error: "forbidden" }, { status: 403 });
        if (action === "list") {
          let q = db.from("bookings").select("data");
          if (me.b) q = q.eq("barber", me.b);
          const r = await q;
          return Response.json({ ok: true, data: (r.data || []).map((x: any) => x.data) });
        }
        if (action === "cancel") {
          let q = db.from("bookings").delete().eq("id", str(body.id, 60));
          if (me.b) q = q.eq("barber", me.b);
          await q;
          return Response.json({ ok: true });
        }
        if (action === "setSite") {
          const raw = JSON.stringify(body.meta ?? null);
          if (raw.length > 200000) return Response.json({ error: "big" }, { status: 413 });
          await db.from("site_content").upsert({ key: "site", value: body.meta, updated_at: new Date().toISOString() });
          return Response.json({ ok: true });
        }
        if (action === "setPhoto" || action === "delPhoto") {
          const key = str(body.key, 20);
          if (!/^b\d_\d{1,2}$/.test(key)) return Response.json({ error: "bad" }, { status: 400 });
          if (me.b && !key.startsWith(me.b + "_")) return Response.json({ error: "forbidden" }, { status: 403 });
          if (action === "delPhoto") { await db.from("site_content").delete().eq("key", "photo:" + key); return Response.json({ ok: true }); }
          const v = body.v || {};
          const u = str(v.u, 260000);
          if (!/^data:image\/jpeg;base64,/.test(u)) return Response.json({ error: "bad" }, { status: 400 });
          await db.from("site_content").upsert({ key: "photo:" + key, value: { b: str(v.b, 5), i: Number(v.i) || 0, u }, updated_at: new Date().toISOString() });
          return Response.json({ ok: true });
        }
        return Response.json({ error: "bad" }, { status: 400 });
      },
    },
  },
});
