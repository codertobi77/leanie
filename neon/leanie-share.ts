import { Pool } from "pg";

export default async function handler(request: Request): Promise<Response> {
  const cors = {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "Content-Type",
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "GET") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || url.pathname.replace(/^\/+/, "");
  if (!token) return new Response(JSON.stringify({ error: "token is required" }), { status: 400, headers: cors });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const { rows } = await pool.query(
      `SELECT p.* FROM public.leanie_projects p JOIN public.leanie_shares s ON s.project_id = p.id WHERE s.token = $1`,
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
