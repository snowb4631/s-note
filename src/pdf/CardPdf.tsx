import path from "node:path";
import { Document, Font, G, Image, Line, Page, Path, Rect, Svg, Text, View } from "@react-pdf/renderer";
import { parseImageDataUrl } from "@/lib/card/image";
import { PAGE } from "@/lib/card/layout";
import { buildScene } from "@/lib/card/scene";
import type { Card } from "@/lib/card/schema";

export const PDF_FONT = "NanumPenScript";

// Traced into the serverless bundle through outputFileTracingIncludes in next.config.ts.
Font.register({
  family: PDF_FONT,
  src: path.join(process.cwd(), "src/fonts/NanumPenScript-Regular.ttf"),
});
// Korean has no hyphens. Without this, a long unspaced run cannot wrap or gets "-" added.
Font.registerHyphenationCallback((word) => Array.from(word).flatMap((char) => [char, ""]));

export function CardDocument({ card }: { card: Card }) {
  const scene = buildScene(card);
  return (
    <Document title="매매일지" author="스노트" creator="스노트" producer="스노트">
      <Page size="A4" orientation="landscape" style={{ fontFamily: PDF_FONT, padding: 0 }}>
        <View style={{ position: "absolute", left: 0, top: 0, width: PAGE.w, height: PAGE.h }}>
          <Svg width={PAGE.w} height={PAGE.h} viewBox={`0 0 ${PAGE.w} ${PAGE.h}`}>
            <G>
              {scene.map((p, i) => {
                switch (p.t) {
                  case "rect":
                    return (
                      <Rect
                        key={i}
                        x={p.x}
                        y={p.y}
                        width={p.w}
                        height={p.h}
                        rx={p.rx}
                        ry={p.rx}
                        fill={p.fill ?? "none"}
                        stroke={p.stroke}
                        strokeWidth={p.sw}
                        strokeDasharray={p.dash}
                      />
                    );
                  case "line":
                    return (
                      <Line
                        key={i}
                        x1={p.x1}
                        y1={p.y1}
                        x2={p.x2}
                        y2={p.y2}
                        stroke={p.stroke}
                        strokeWidth={p.sw}
                        strokeDasharray={p.dash}
                      />
                    );
                  case "path":
                    return <Path key={i} d={p.d} fill={p.fill} fillOpacity={p.opacity} />;
                  case "text":
                    return (
                      <Text key={i} x={p.x} y={p.y} fill={p.fill} style={{ fontFamily: PDF_FONT, fontSize: p.size }}>
                        {p.value}
                      </Text>
                    );
                  default:
                    return null;
                }
              })}
            </G>
          </Svg>
        </View>
        {scene.map((p, i) => {
          if (p.t !== "image") return null;
          const image = parseImageDataUrl(p.href);
          if (!image) return null;
          // Bytes only: react-pdf would fetch a URL, so one must never reach this prop.
          // cache={false}: its module-level cache would otherwise keep the last 30 users' images.
          return (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
            <Image
              key={i}
              cache={false}
              src={{ data: Buffer.from(image.bytes), format: image.format }}
              style={{ position: "absolute", left: p.x, top: p.y, width: p.w, height: p.h }}
            />
          );
        })}
      </Page>
    </Document>
  );
}
