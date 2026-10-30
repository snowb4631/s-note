import { renderCardPdf } from "@/pdf/render";
import { handlePdf, resolvePdfLimiters } from "@/server/handlers";

export const maxDuration = 30;

export function POST(request: Request): Promise<Response> {
  return handlePdf(request, resolvePdfLimiters(process.env), renderCardPdf);
}
