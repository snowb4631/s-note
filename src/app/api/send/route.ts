import { renderCardPdf } from "@/pdf/render";
import { handleSend, resolveServices } from "@/server/handlers";

export const maxDuration = 30;

export function POST(request: Request): Promise<Response> {
  return handleSend(request, resolveServices(process.env), renderCardPdf);
}
