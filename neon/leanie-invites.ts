import { Pool } from "pg";

const CORS = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "Content-Type, Authorization",
};

export default async function leanieInvites(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const url = new URL(request.url);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    if (request.method === "GET") {
      const token = url.searchParams.get("token");
      if (!token) return new Response(JSON.stringify({ error: "token required" }), { status: 400, headers: CORS });
      const { rows } = await pool.query(
        `SELECT i.*, p.title AS project_title, p.objective
         FROM public.leanie_project_invites i
         JOIN public.leanie_projects p ON p.id = i.project_id
         WHERE i.token = $1`,
        [token],
      );
      if (!rows.length) return new Response(JSON.stringify({ error: "Invite not found" }), { status: 404, headers: CORS });
      const invite = rows[0];
      if (invite.status !== "pending") {
        return new Response(JSON.stringify({ error: "Invite no longer active", status: invite.status }), { status: 410, headers: CORS });
      }
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        await pool.query("UPDATE public.leanie_project_invites SET status='expired' WHERE id=$1", [invite.id]);
        return new Response(JSON.stringify({ error: "Invite expired" }), { status: 410, headers: CORS });
      }
      return new Response(JSON.stringify(invite), { headers: CORS });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: CORS });
    }

    const body = (await request.json().catch(() => null)) ?? {};
    const action = String(body.action ?? "");

    if (action === "create") {
      const projectId = String(body.projectId ?? "");
      const inviteeEmail = String(body.inviteeEmail ?? "").trim().toLowerCase();
      const inviterId = String(body.inviterId ?? "");
      const role = body.role === "editor" ? "editor" : "viewer";
      const expiresInDays = Math.min(30, Math.max(1, Number(body.expiresInDays ?? 7)));
      if (!projectId || !inviteeEmail || !inviterId) {
        return new Response(JSON.stringify({ error: "projectId, inviteeEmail, inviterId required" }), { status: 400, headers: CORS });
      }
      const { rows: inserted } = await pool.query(
        `INSERT INTO public.leanie_project_invites (project_id, inviter_id, invitee_email, role, token, expires_at)
         VALUES ($1, $2, $3, $4, gen_random_uuid()::text, now() + ($5 || ' days')::interval)
         RETURNING *`,
        [projectId, inviterId, inviteeEmail, role, String(expiresInDays)],
      );
      return new Response(JSON.stringify(inserted[0]), { status: 201, headers: CORS });
    }

    if (action === "list") {
      const projectId = String(body.projectId ?? "");
      if (!projectId) return new Response(JSON.stringify({ error: "projectId required" }), { status: 400, headers: CORS });
      const { rows } = await pool.query(
        `SELECT * FROM public.leanie_project_invites WHERE project_id = $1 ORDER BY created_at DESC`,
        [projectId],
      );
      return new Response(JSON.stringify({ invites: rows }), { headers: CORS });
    }

    if (action === "revoke") {
      const id = String(body.id ?? "");
      if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: CORS });
      await pool.query("UPDATE public.leanie_project_invites SET status='revoked' WHERE id=$1", [id]);
      return new Response(JSON.stringify({ ok: true }), { headers: CORS });
    }

    if (action === "accept") {
      const token = String(body.token ?? "");
      const userId = String(body.userId ?? "");
      const userEmail = String(body.userEmail ?? "").toLowerCase();
      if (!token || !userId) return new Response(JSON.stringify({ error: "token, userId required" }), { status: 400, headers: CORS });
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const { rows } = await client.query(
          `SELECT * FROM public.leanie_project_invites WHERE token=$1 FOR UPDATE`,
          [token],
        );
        if (!rows.length) {
          await client.query("ROLLBACK");
          return new Response(JSON.stringify({ error: "Invite not found" }), { status: 404, headers: CORS });
        }
        const invite = rows[0];
        if (invite.status !== "pending") {
          await client.query("ROLLBACK");
          return new Response(JSON.stringify({ error: "Invite no longer active", status: invite.status }), { status: 410, headers: CORS });
        }
        if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
          await client.query("UPDATE public.leanie_project_invites SET status='expired' WHERE id=$1", [invite.id]);
          await client.query("COMMIT");
          return new Response(JSON.stringify({ error: "Invite expired" }), { status: 410, headers: CORS });
        }
        if (invite.invitee_email && invite.invitee_email !== "" && userEmail && invite.invitee_email !== userEmail) {
          await client.query("ROLLBACK");
          return new Response(JSON.stringify({ error: "Invite is for a different email" }), { status: 403, headers: CORS });
        }
        // grant access via share row (one per invitee+project+token)
        const { rows: shareRows } = await client.query(
          `INSERT INTO public.leanie_shares (project_id, token, role, created_by, expires_at)
           VALUES ($1, $2, $3, $4, (SELECT expires_at FROM public.leanie_project_invites WHERE id=$5))
           ON CONFLICT (token) DO UPDATE SET role=EXCLUDED.role, expires_at=EXCLUDED.expires_at
           RETURNING token, role, project_id`,
          [invite.project_id, token, invite.role, userId, invite.id],
        );
        await client.query(
          `UPDATE public.leanie_project_invites SET status='accepted', accepted_by=$2, accepted_at=now() WHERE id=$1`,
          [invite.id, userId],
        );
        await client.query("COMMIT");
        return new Response(JSON.stringify({ token: shareRows[0].token, role: shareRows[0].role, projectId: shareRows[0].project_id }), { headers: CORS });
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: CORS });
      } finally {
        client.release();
      }
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: CORS });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: CORS });
  } finally {
    await pool.end().catch(() => {});
  }
}
