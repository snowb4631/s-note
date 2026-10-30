import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { Card } from "@/lib/card/schema";
import { CardDocument } from "./CardPdf";

export function renderCardPdf(card: Card): Promise<Buffer> {
  return renderToBuffer(createElement(CardDocument, { card }) as unknown as ReactElement<DocumentProps>);
}
