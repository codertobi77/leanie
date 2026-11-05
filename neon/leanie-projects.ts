/// <reference types="@neon/functions" />
// Neon Function API: Postgres is provided via DATABASE_URL.
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export default async function handler(request: Request): Promise<Response> {
  const headers = { "content-type": "application/json", "access-control-allow-origin": "*" };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/+/, "");

  try {
    if (request.method === "GET" && path.endsWith("projects")) {
      const ownerId = url.searchParams.get("user_id");
      if (!ownerId) return new Response(JSON.stringify({ error: "user_id is required" }), { status: 400, headers });
      const rows = await sql`SELECT * FROM public.leanie_projects WHERE user_id = ${ownerId} ORDER BY updated_at DESC`;
      return new Response(JSON.stringify(rows), { headers });
    }

    if (request.method === "POST" && path.endsWith("projects")) {
      const body = await request.json();
      const row = body;
      const result = await sql`
        INSERT INTO public.leanie_projects (id, user_id, title, objective, context, outcome, target_date, budget, resources, status, phases, risks, analysis, created_at, updated_at)
        VALUES (${row.id}, ${row.user_id}, ${row.title}, ${row.objective}, ${row.context ?? ""}, ${row.outcome ?? ""}, ${row.target_date ?? null}, ${row.budget ?? null}, ${row.resources ?? null}, ${row.status ?? "Analyzing"}, ${JSON.stringify(row.phases ?? [])}::jsonb, ${JSON.stringify(row.risks ?? [])}::jsonb, ${row.analysis ? JSON.stringify(row.analysis) : null}::jsonb, ${row.created_at}, ${row.updated_at})
        ON CONFLICT (id) DO UPDATE SET
          title=EXCLUDED.title, objective=EXCLUDED.objective, context=EXCLUDED.context, outcome=EXCLUDED.outcome,
          target_date=EXCLUDED.target_date, budget=EXCLUDED.budget, resources=EXCLUDED.resources,
          status=EXCLUDED.status, phases=EXCLUDED.phases, risks=EXCLUDED.risks, analysis=EXCLUDED.analysis,
          updated_at=EXCLUDED.updated_at
        RETURNING *
      `;
      return new Response(JSON.stringify(result[0]), { headers });
    }

    if (request.method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) return new Response(JSON.stringify({ error: "id is required" }), { status: 400, headers });
      await sql`DELETE FROM public.leanie_projects WHERE id = ${id}`;
      return new Response(JSON.stringify({ ok: true }), { headers });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers });
  }
}
