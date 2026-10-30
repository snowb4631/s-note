"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { type Box, COLORS, TYPE, maxLines } from "@/lib/card/layout";
import { COORD_MAX, MAX_POINTS_PER_FIELD, MAX_POINTS_PER_STROKE, MAX_STROKES, PRESSURE_MAX, type Stroke } from "@/lib/card/schema";
import { eraserHits, strokeToPath } from "@/lib/card/strokes";

type Tool = "pen" | "eraser";

const MIN_STEP = 8; // of COORD_MAX. Skips near-duplicate points so the limits last longer.
const ERASE_RADIUS_PT = 7;

const clamp = (v: number, max: number) => Math.min(max, Math.max(0, Math.round(v)));
const pointCount = (strokes: Stroke[]) => strokes.reduce((sum, s) => sum + s.pts.length / 3, 0);

function Surface({ box, strokes, tool, onCommit, onErase, onFull, label, rotated = false }: {
  /** The SVG is turned 90deg clockwise on screen, so screen axes map to swapped strokes axes. */
  rotated?: boolean;
  box: Box;
  strokes: Stroke[];
  tool: Tool;
  onCommit: (s: Stroke) => void;
  onErase: (path: { x: number; y: number }[]) => void;
  onFull: () => void;
  label: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const active = useRef<{ id: number; pts: number[]; sim: boolean } | null>(null);
  const penSeen = useRef(false);
  const lastErase = useRef<{ x: number; y: number } | null>(null);
  const [live, setLive] = useState<Stroke | null>(null);

  // iOS Safari can still scroll on a touch-action:none element without this.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stop = (e: TouchEvent) => e.preventDefault();
    el.addEventListener("touchstart", stop, { passive: false });
    el.addEventListener("touchmove", stop, { passive: false });
    return () => {
      el.removeEventListener("touchstart", stop);
      el.removeEventListener("touchmove", stop);
    };
  }, []);

  const toCoord = (e: { clientX: number; clientY: number }) => {
    const rect = ref.current!.getBoundingClientRect();
    if (rotated) {
      return {
        x: clamp(((e.clientY - rect.top) / rect.height) * COORD_MAX, COORD_MAX),
        y: clamp((1 - (e.clientX - rect.left) / rect.width) * COORD_MAX, COORD_MAX),
      };
    }
    return {
      x: clamp(((e.clientX - rect.left) / rect.width) * COORD_MAX, COORD_MAX),
      y: clamp(((e.clientY - rect.top) / rect.height) * COORD_MAX, COORD_MAX),
    };
  };

  const add = (e: { clientX: number; clientY: number; pressure: number }) => {
    const stroke = active.current!;
    if (stroke.pts.length / 3 >= MAX_POINTS_PER_STROKE) return;
    if (pointCount(strokes) + stroke.pts.length / 3 >= MAX_POINTS_PER_FIELD) return;
    const { x, y } = toCoord(e);
    const n = stroke.pts.length;
    if (n >= 3 && Math.abs(stroke.pts[n - 3] - x) < MIN_STEP && Math.abs(stroke.pts[n - 2] - y) < MIN_STEP) return;
    stroke.pts.push(x, y, stroke.sim ? 50 : clamp(e.pressure * PRESSURE_MAX, PRESSURE_MAX));
  };

  const down = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "pen") penSeen.current = true;
    // Palm rejection: once a pen has been used here, fingers no longer draw.
    if (e.pointerType === "touch" && penSeen.current) return;
    if (active.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool === "eraser") {
      active.current = { id: e.pointerId, pts: [], sim: true };
      lastErase.current = toCoord(e);
      onErase([lastErase.current]);
      return;
    }
    if (strokes.length >= MAX_STROKES || pointCount(strokes) >= MAX_POINTS_PER_FIELD) {
      onFull();
      return;
    }
    active.current = { id: e.pointerId, pts: [], sim: e.pointerType !== "pen" };
    add(e);
    setLive({ sim: active.current.sim, pts: [...active.current.pts] });
  };

  const move = (e: ReactPointerEvent<SVGSVGElement>) => {
    const stroke = active.current;
    if (!stroke || stroke.id !== e.pointerId) return;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
    const samples = events.length ? events : [e];
    if (tool === "eraser") {
      const path = samples.map(toCoord);
      if (lastErase.current) path.unshift(lastErase.current);
      lastErase.current = path[path.length - 1];
      onErase(path);
      return;
    }
    for (const ev of samples) add(ev);
    setLive({ sim: stroke.sim, pts: [...stroke.pts] });
  };

  const up = (e: ReactPointerEvent<SVGSVGElement>) => {
    const stroke = active.current;
    if (!stroke || stroke.id !== e.pointerId) return;
    active.current = null;
    setLive(null);
    if (tool === "pen" && stroke.pts.length >= 3) onCommit({ sim: stroke.sim, pts: stroke.pts });
  };

  const lines = [];
  for (let i = 1; i <= maxLines(box); i += 1) {
    const y = box.y + i * TYPE.bodyLeading - 1;
    lines.push(<line key={i} x1={box.x} x2={box.x + box.w} y1={y} y2={y} stroke={COLORS.rule} strokeWidth={0.6} strokeDasharray="2 3" />);
  }

  return (
    <svg
      ref={ref}
      className="pad"
      role="img"
      aria-label={label}
      data-testid="pad"
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      style={tool === "eraser" ? { cursor: "cell" } : undefined}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {lines}
      {strokes.map((s, i) => (
        <path key={i} d={strokeToPath(s, box)} fill={COLORS.ink} />
      ))}
      {live && <path d={strokeToPath(live, box)} fill={COLORS.ink} />}
    </svg>
  );
}

function stageFor(box: Box, viewW: number, viewH: number) {
  const availW = Math.min(viewW - 24, 1100);
  const availH = viewH - 130;
  const aspect = box.w / box.h;
  const fit = (w: number, h: number) => (w / aspect <= h ? { w, h: w / aspect } : { w: h * aspect, h });
  const flat = fit(availW, availH);
  const turned = fit(availH, availW);
  if (viewH > viewW && turned.w > flat.w * 1.2) {
    return { rotated: true, w: turned.w, h: turned.h, boxW: turned.h, boxH: turned.w };
  }
  return { rotated: false, w: flat.w, h: flat.h, boxW: flat.w, boxH: flat.h };
}

export function HandwritingField({ box, strokes, onChange, label }: {
  box: Box;
  strokes: Stroke[];
  onChange: (s: Stroke[]) => void;
  label: string;
}) {
  const [tool, setTool] = useState<Tool>("pen");
  const [zoom, setZoom] = useState(false);
  const [full, setFull] = useState(false);
  const [stage, setStage] = useState<ReturnType<typeof stageFor> | null>(null);
  const [history, setHistory] = useState<Stroke[][]>([]);

  // Several pointer events can land before React re-renders. Without this, each would start
  // from the same old list and bring back what the previous one erased.
  const current = useRef(strokes);
  useLayoutEffect(() => {
    current.current = strokes;
  }, [strokes]);

  const change = (next: Stroke[]) => {
    const previous = current.current;
    current.current = next;
    setHistory((h) => [...h.slice(-49), previous]);
    onChange(next);
  };
  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((h) => h.slice(0, -1));
    current.current = previous;
    onChange(previous);
    setFull(false);
  };

  // On a portrait phone the box is turned sideways so the writing area uses the long side.
  useEffect(() => {
    if (!zoom) return;
    const measure = () => setStage(stageFor(box, window.innerWidth, window.innerHeight));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [zoom, box]);

  useEffect(() => {
    if (!zoom) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoom(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [zoom]);

  const tools = (
    <div className="flex flex-wrap gap-1 items-center" role="toolbar" aria-label={`${label} 필기 도구`}>
      <button type="button" className="tool" aria-pressed={tool === "pen"} onClick={() => setTool("pen")}>펜</button>
      <button type="button" className="tool" aria-pressed={tool === "eraser"} onClick={() => setTool("eraser")}>지우개</button>
      <button type="button" className="tool" disabled={history.length === 0} onClick={undo}>되돌리기</button>
      <button type="button" className="tool" disabled={strokes.length === 0} onClick={() => { change([]); setFull(false); }}>전체 지우기</button>
    </div>
  );

  const surface = (rotated = false) => (
    <Surface
      rotated={rotated}
      box={box}
      strokes={strokes}
      tool={tool}
      label={label}
      onCommit={(s) => change([...current.current, s])}
      onFull={() => setFull(true)}
      onErase={(path) => {
        const next = current.current.filter((s) => !eraserHits(s, box, path, ERASE_RADIUS_PT));
        if (next.length !== current.current.length) change(next);
      }}
    />
  );

  return (
    <>
      <div className="contents" data-testid="pad-field">
        {!zoom && surface()}
        {zoom && <div style={{ aspectRatio: `${box.w} / ${box.h}` }} />}
        <div className="pad-tools flex flex-wrap gap-1 items-center">
          {tools}
          <button type="button" className="tool" onClick={() => setZoom(true)}>확대 필기</button>
          {full && <span className="text-xs text-danger">필기 공간이 가득 찼어요.</span>}
        </div>
      </div>
      {zoom && (
        <div className="fixed inset-0 z-50 bg-ink flex flex-col items-center justify-center gap-3 p-3" role="dialog" aria-modal="true" aria-label={`${label} 확대 필기`}>
          <div className="flex flex-wrap items-center justify-between gap-2 w-full max-w-[1100px]">
            {tools}
            <button type="button" className="btn btn-primary !bg-marker !text-ink !min-h-9" onClick={() => setZoom(false)}>완료</button>
          </div>
          {stage && (
            <div className="flex items-center justify-center" style={{ width: stage.boxW, height: stage.boxH }}>
              <div
                className="bg-paper rounded shrink-0"
                style={{ width: stage.w, height: stage.h, transform: stage.rotated ? "rotate(90deg)" : undefined }}
              >
                {surface(stage.rotated)}
              </div>
            </div>
          )}
          {stage?.rotated && <p className="text-xs text-paper/80">기기를 옆으로 돌려서 쓰세요.</p>}
        </div>
      )}
    </>
  );
}
