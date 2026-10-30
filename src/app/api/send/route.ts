import { renderCardPdf } from "@/pdf/render";
import { emailEnabled } from "@/server/env";
import { handleSend, resolveServices } from "@/server/handlers";
import { jsonError } from "@/server/http";

export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
  if (!emailEnabled(process.env)) return jsonError(503, "not_implemented", "이메일로 받기는 아직 미구현입니다.");
  return handleSend(request, resolveServices(process.env), renderCardPdf);
}
