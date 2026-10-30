import { useMemo } from "react";
import { PAGE } from "@/lib/card/layout";
import { buildScene } from "@/lib/card/scene";
import type { Card } from "@/lib/card/schema";

/** The same scene the PDF draws. Scales with its container, so its geometry cannot drift. */
export function CardSvg({ card, className, testId }: { card: Card; className?: string; testId?: string }) {
  const scene = useMemo(() => buildScene(card), [card]);
  return (
    <svg
      viewBox={`0 0 ${PAGE.w} ${PAGE.h}`}
      role="img"
      aria-label="매매일지 카드 미리보기"
      data-testid={testId}
      className={className}
      style={{ display: "block", width: "100%", height: "auto", fontFamily: "var(--font-nanum-pen)", background: "#fff" }}
    >
      {scene.map((p, i) => {
        switch (p.t) {
          case "rect":
            return <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx} fill={p.fill ?? "none"} stroke={p.stroke} strokeWidth={p.sw} strokeDasharray={p.dash} />;
          case "line":
            return <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.stroke} strokeWidth={p.sw} strokeDasharray={p.dash} />;
          case "path":
            return <path key={i} d={p.d} fill={p.fill} fillOpacity={p.opacity} />;
          case "text":
            return (
              <text key={i} x={p.x} y={p.y} fontSize={p.size} fill={p.fill} style={{ whiteSpace: "pre" }}>
                {p.value}
              </text>
            );
          case "image":
            return <image key={i} x={p.x} y={p.y} width={p.w} height={p.h} href={p.href} preserveAspectRatio="none" />;
        }
      })}
    </svg>
  );
}
