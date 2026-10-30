import { connection } from "next/server";
import { adConfig } from "@/server/env";

export async function GET(): Promise<Response> {
  await connection(); // env is read per request so keys need no rebuild
  const ad = adConfig(process.env);
  if (!ad) return new Response("Not Found", { status: 404 });
  return new Response(`google.com, ${ad.client.replace("ca-", "")}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
