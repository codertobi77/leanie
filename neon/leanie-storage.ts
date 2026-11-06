import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export default async function leanieStorage(request: Request): Promise<Response> {
  const cors = {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization",
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });

  const { path, content, contentType } = await request.json().catch(() => ({}));
  if (!path || !content) return new Response(JSON.stringify({ error: "path and content are required" }), { status: 400, headers: cors });

  const client = new S3Client({
    region: process.env.AWS_REGION || "us-east-2",
    endpoint: process.env.AWS_ENDPOINT_URL_S3,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  await client.send(new PutObjectCommand({
    Bucket: "assets",
    Key: path,
    Body: content,
    ContentType: contentType || "text/plain",
  }));
  return new Response(JSON.stringify({ path, url: `${process.env.AWS_ENDPOINT_URL_S3}/assets/${encodeURIComponent(path)}` }), { headers: cors });
}
