import { Pool } from "pg";

// Admin council configuration management. A config assigns a provider+model
// to every Council step. Publishing a config makes it the production setup
// used by the public `council` function.
export default async function leanieConfigs(request: Request): Promise<Response> {
  const cors = {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization",
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    if (request.method === "GET") {
      const { rows } = await pool.query(
        `SELECT id, name, steps, status, created_at, updated_at
         FROM public.leanie_council_configs ORDER BY updated_at DESC`,
      );
      return new Response(JSON.stringify({
        configs: rows.map((c: any) => ({
          id: c.id,
          name: c.name,
          steps: c.steps ?? {},
          status: c.status,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        })),
      }), { headers: cors });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });
    }

    const body = await request.json().catch(() => null);
    if (!body?.action) return new Response(JSON.stringify({ error: "action is required" }), { status: 400, headers: cors });
    const action = String(body.action);

    if (action === "save") {
      const name = String(body.name || "").trim().slice(0, 80) || "Untitled config";
      const steps = body.steps && typeof body.steps === "object" ? body.steps : {};
      // Only keep well-formed step entries: {providerId, model}
      const clean: Record<string, { providerId: string; model: string }> = {};
      for (const step of ["strategic", "feasibility", "critique", "arbiter"]) {
        const entry = (steps as Record<string, any>)[step];
        if (entry?.providerId && entry?.model) {
          clean[step] = { providerId: String(entry.providerId), model: String(entry.model).slice(0, 120) };
        }
      }
      const id = typeof body.id === "string" && body.id ? body.id : crypto.randomUUID();
      await pool.query(
        `INSERT INTO public.leanie_council_configs (id, name, steps, status)
         VALUES ($1, $2, $3::jsonb, 'draft')
         ON CONFLICT (id) DO UPDATE SET name = $2, steps = $3::jsonb, updated_at = now()`,
        [id, name, JSON.stringify(clean)],
      );
      return new Response(JSON.stringify({ id }), { headers: cors });
    }

    if (action === "publish") {
      const id = String(body.id || "");
      if (!id) return new Response(JSON.stringify({ error: "id is required" }), { status: 400, headers: cors });
      const { rows } = await pool.query(`SELECT id FROM public.leanie_council_configs WHERE id = $1`, [id]);
      if (!rows.length) return new Response(JSON.stringify({ error: "Config not found" }), { status: 404, headers: cors });
      await pool.query("BEGIN");
      await pool.query(`UPDATE public.leanie_council_configs SET status = 'draft', updated_at = now() WHERE status = 'published'`);
      await pool.query(`UPDATE public.leanie_council_configs SET status = 'published', updated_at = now() WHERE id = $1`, [id]);
      await pool.query("COMMIT");
      return new Response(JSON.stringify({ ok: true }), { headers: cors });
    }

    if (action === "unpublish") {
      await pool.query(`UPDATE public.leanie_council_configs SET status = 'draft', updated_at = now() WHERE status = 'published'`);
      return new Response(JSON.stringify({ ok: true }), { headers: cors });
    }

    if (action === "delete") {
      const id = String(body.id || "");
      if (!id) return new Response(JSON.stringify({ error: "id is required" }), { status: 400, headers: cors });
      await pool.query(`DELETE FROM public.leanie_council_configs WHERE id = $1`, [id]);
      return new Response(JSON.stringify({ ok: true }), { headers: cors });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: cors });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: cors });
  } finally {
    await pool.end().catch(() => {});
  }
}
