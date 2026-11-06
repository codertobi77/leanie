import { Pool } from "pg";

export default async function handler(request: Request): Promise<Response> {
  const cors = {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS, POST",
    "access-control-allow-headers": "Content-Type, Authorization",
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (request.method === "GET") {
    if (!token) return new Response(JSON.stringify({ error: "token is required" }), { status: 400, headers: cors });
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
      const { rows } = await pool.query(
        `SELECT p.* FROM public.leanie_projects p JOIN public.leanie_shares s ON s.project_id = p.id WHERE s.token = $1 AND (` +
          `s.role = 'editor' OR s.role = 'viewer')`,
        [token],
      );
      if (!rows.length) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: cors });
      return new Response(JSON.stringify(rows[0]), { headers: cors });
    } catch (error) {
      return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: cors });
    } finally {
      await pool.end().catch(() => {});
    }
  }

  if (request.method === "POST") {
    const body = await request.json().catch(() => null);
    const putToken = token || String(body?.token || "");
    const project = body?.project;
    const expectedRevision = Number(body?.revision ?? project?.revision ?? 1);
    if (!putToken) return new Response(JSON.stringify({ error: "token is required" }), { status: 400, headers: cors });
    if (!project) return new Response(JSON.stringify({ error: "project body is required" }), { status: 400, headers: cors });
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
      await pool.query("BEGIN");
      const { rows } = await pool.query(
        `SELECT p.*, s.role FROM public.leanie_projects p JOIN public.leanie_shares s ON s.project_id = p.id WHERE s.token = $1 AND s.role = 'editor' FOR UPDATE OF p`,
        [putToken],
      );
      if (!rows.length) {
        await pool.query("ROLLBACK");
        return new Response(JSON.stringify({ error: "Not found or read-only" }), { status: 404, headers: cors });
      }
      const current = rows[0];
      const role = current.role;
      const currentRevision = Number(current.revision ?? 1);
      if (role !== "editor") {
        await pool.query("ROLLBACK");
        return new Response(JSON.stringify({ error: "Editor permission required" }), { status: 403, headers: cors });
      }
      if (expectedRevision !== currentRevision) {
        await pool.query("ROLLBACK");
        // Return the current DB state for conflict resolution.
        return new Response(JSON.stringify({ error: "Conflict", current }), { status: 409, headers: cors });
      }
      const newRevision = currentRevision + 1;
      const { rows: updated } = await pool.query(
        `UPDATE public.leanie_projects
         SET title=$2, objective=$3, context=$4, outcome=$5, target_date=$6, budget=$7, resources=$8,
             status=$9, phases=$10::jsonb, risks=$11::jsonb, assumptions=$12::jsonb,
             success_criteria=$13::jsonb, tags=$14::jsonb, updated_at=now(), revision=$15
         WHERE id=$1 RETURNING *`,
        [
          current.id,
          project.title ?? "",
          project.objective ?? "",
          project.context ?? "",
          project.outcome ?? "",
          project.targetDate ?? null,
          project.budget ?? null,
          project.resources ?? null,
          project.status ?? "Plan ready",
          JSON.stringify(project.phases ?? []),
          JSON.stringify(project.risks ?? []),
          JSON.stringify(project.assumptions ?? []),
          JSON.stringify(project.successCriteria ?? []),
          JSON.stringify(project.tags ?? []),
          newRevision,
        ],
      );
      await pool.query("COMMIT");
      return new Response(JSON.stringify(updated[0]), { headers: cors });
    } catch (error) {
      await pool.query("ROLLBACK").catch(() => {});
      return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: cors });
    } finally {
      await pool.end().catch(() => {});
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });
}
