"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_AMOUNT, MAX_PRICE, MAX_QUANTITY, type StopLossMode, exceedsMaxTotal, reconcileTotal, resetTotalToAuto, resolveStopLoss, setManualTotal, setStopLossMode, todayIso } from "@/lib/card/calc";
import { fitBody, fitTicker } from "@/lib/card/fit";
import { BOXES, type Box, boxVars, maxLines } from "@/lib/card/layout";
import { type Card, DATE_MESSAGE, MAX_DATE, MIN_DATE, cardSchema, emptyCard, isBlankCard, isValidDate } from "@/lib/card/schema";
import { hasUnsupported } from "@/lib/card/text";
import { compressImage } from "@/lib/compress-image";
import { type SaveStatus, clearDraft, loadDraft, saveDraft } from "@/lib/draft";
import { getPendingSend, setPendingSend } from "@/lib/send-store";
import { CardSvg } from "./CardSvg";
import { HandwritingField } from "./HandwritingField";
import { NumberField, PercentField } from "./NumberField";

const BLANK = emptyCard("2000-01-01");
const place = (box: Box) => boxVars(box) as React.CSSProperties;

function Writing({ field, box, label, placeholder, onChange }: {
  field: Card["reason"];
  box: Box;
  label: string;
  placeholder: string;
  onChange: (f: Card["reason"]) => void;
}) {
  const [trimmed, setTrimmed] = useState(false);
  return (
    <>
      {field.mode === "text" ? (
        <>
          <textarea
            className="writing"
            aria-label={label}
            placeholder={placeholder}
            style={{ "--lines": maxLines(box) } as React.CSSProperties}
            value={field.text}
            rows={maxLines(box)}
            onChange={(e) => {
              const fit = fitBody(e.target.value, box);
              setTrimmed(fit.trimmed);
              onChange({ ...field, text: fit.text });
            }}
          />
          {trimmed && <p className="note text-xs text-danger">칸이 가득 찼어요. 더 적으려면 앞의 내용을 줄여 주세요.</p>}
          {hasUnsupported(field.text) && <p className="note text-xs text-danger">손글씨 폰트에 없는 글자(이모지 등)는 ?로 표시돼요.</p>}
        </>
      ) : (
        <HandwritingField box={box} strokes={field.strokes} label={label} onChange={(strokes) => onChange({ ...field, strokes })} />
      )}
    </>
  );
}

function ModeSwitch({ mode, onChange }: { mode: "text" | "draw"; onChange: (m: "text" | "draw") => void }) {
  return (
    <span className="ml-auto inline-flex gap-1 mode-switch">
      <button type="button" className="tool" aria-pressed={mode === "text"} onClick={() => onChange("text")}>타이핑</button>
      <button type="button" className="tool" aria-pressed={mode === "draw"} onClick={() => onChange("draw")}>필기</button>
    </span>
  );
}

/**
 * Browsers report every step of typing a year (0002, 0020, 0202), so a bad value is held here
 * instead of being refused outright. The card only ever gets a valid date.
 */
function DateField({ value, ready, onChange }: { value: string; ready: boolean; onChange: (v: string) => void }) {
  const [typing, setTyping] = useState<string | null>(null);
  const [error, setError] = useState(false);
  return (
    <label className="field placed wide" style={place(BOXES.date)}>
      <span className="field-label">날짜</span>
      <input
        type="date"
        className="field-input"
        min={MIN_DATE}
        max={MAX_DATE}
        value={ready ? typing ?? value : ""}
        required
        aria-invalid={error}
        onChange={(e) => {
          setTyping(e.target.value);
          if (isValidDate(e.target.value)) {
            setError(false);
            onChange(e.target.value);
          }
        }}
        onBlur={() => {
          if (typing !== null && !isValidDate(typing)) setError(true);
          setTyping(null);
        }}
      />
      {error && <span className="field-error block" role="alert">{DATE_MESSAGE} 이전 날짜로 되돌렸어요.</span>}
    </label>
  );
}

export function CardEditor({ emailEnabled }: { emailEnabled: boolean }) {
  const router = useRouter();
  const [card, setCard] = useState<Card>(BLANK);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<SaveStatus | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [big, setBig] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [repaired, setRepaired] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  // Bumped by 새 카드: remounting the form clears every field's own state, undo history included.
  const [generation, setGeneration] = useState(0);
  const imageRequest = useRef(0);
  const latest = useRef(card);

  useEffect(() => {
    let alive = true;
    // Back from /send: the in-memory card has what a failed save could not keep.
    const pending = getPendingSend();
    (pending ? Promise.resolve({ card: pending.card, repaired: false }) : loadDraft()).then((draft) => {
      if (!alive) return;
      setCard(draft?.card ?? emptyCard(todayIso()));
      setRepaired(draft?.repaired ?? false);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    latest.current = card;
    if (!ready) return;
    if (getPendingSend()?.card !== card) setPendingSend(null);
    const timer = setTimeout(() => {
      saveDraft(card).then(setStatus);
    }, 300);
    return () => clearTimeout(timer);
  }, [card, ready]);

  useEffect(() => {
    if (!ready) return;
    const flush = () => void saveDraft(latest.current);
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [ready]);

  const update = useCallback((patch: Partial<Card>) => setCard((c) => reconcileTotal({ ...c, ...patch })), []);

  const onImage = async (file: File | undefined) => {
    if (!file) return;
    // Only the latest pick counts; a newer pick or 새 카드 makes this one stale.
    const request = ++imageRequest.current;
    setImageError(null);
    setImageBusy(true);
    try {
      const image = await compressImage(file);
      if (request === imageRequest.current) setCard((c) => ({ ...c, image }));
    } catch {
      if (request === imageRequest.current) setImageError("이미지를 읽지 못했어요. JPEG나 PNG 파일로 다시 시도해 주세요.");
    } finally {
      if (request === imageRequest.current) setImageBusy(false);
    }
  };

  const openPreview = () => {
    const parsed = cardSchema.safeParse(card);
    if (!parsed.success) {
      setProblem(parsed.error.issues[0]?.message ?? "입력한 내용을 확인해 주세요.");
      return;
    }
    setProblem(null);
    setPreview(true);
  };

  const download = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(card),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setProblem(data?.message ?? "PDF를 만들지 못했습니다.");
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `snote-${card.date}.pdf`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setProblem("네트워크 오류로 PDF를 받지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const toSend = async () => {
    setBusy(true);
    const saved = await saveDraft(card);
    setPendingSend({ card, saveFailed: saved !== "saved" });
    router.push("/send");
  };

  const reset = async () => {
    imageRequest.current += 1;
    setImageBusy(false);
    setImageError(null);
    setConfirmReset(false);
    setRepaired(false);
    setProblem(null);
    setPendingSend(null);
    setCard(emptyCard(todayIso()));
    setGeneration((g) => g + 1);
    await clearDraft();
  };

  const stop = resolveStopLoss(card);
  const blank = isBlankCard(card);

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4" data-ready={ready} data-testid="editor">
      <form key={generation} className="sheet" inert={!ready} onSubmit={(e) => e.preventDefault()} data-testid="sheet">
        <h1 className="placed font-pen text-[38px] leading-none lg:text-[calc(var(--u)*38)]" style={place({ x: 30, y: 26, w: 300, h: 40 })}>
          <span className="mark px-1">매매일지</span>
        </h1>

        <div className="sheet-row">
          <DateField value={card.date} ready={ready} onChange={(date) => update({ date })} />
          <label className="field placed wide" style={place(BOXES.ticker)}>
            <span className="field-label">종목</span>
            <input
              className="field-input"
              value={card.ticker}
              placeholder="종목 이름"
              autoComplete="off"
              onChange={(e) => update({ ticker: fitTicker(e.target.value) })}
            />
          </label>
          <div className="field placed wide" style={place(BOXES.side)} role="group" aria-label="매수 또는 매도">
            <span className="field-label">매수 / 매도</span>
            <div className="flex justify-around border-b-[1.5px] border-ink pb-[2px]">
              <button type="button" className="side" aria-pressed={card.side === "buy"} onClick={() => update({ side: card.side === "buy" ? null : "buy" })}>매수</button>
              <button type="button" className="side" aria-pressed={card.side === "sell"} onClick={() => update({ side: card.side === "sell" ? null : "sell" })}>매도</button>
            </div>
          </div>
        </div>

        <div className="sheet-row">
          <div className="field placed" style={place(BOXES.quantity)}>
            <label className="field-label" htmlFor="quantity">수량</label>
            <NumberField id="quantity" ariaLabel="수량" suffix="주" max={MAX_QUANTITY} value={card.quantity} onChange={(quantity) => update({ quantity })} />
          </div>
          <div className="field placed" style={place(BOXES.price)}>
            <label className="field-label" htmlFor="price">1주당 가격</label>
            <NumberField id="price" ariaLabel="1주당 가격" suffix="원" max={MAX_PRICE} value={card.price} onChange={(price) => update({ price })} />
          </div>
          <div className="field placed" style={place(BOXES.total)}>
            <span className="flex items-center justify-between gap-1">
              <label className="field-label" htmlFor="total">총 거래금액</label>
              {card.totalManual && (
                <button type="button" className="tool !py-[3px]" onClick={() => setCard((c) => resetTotalToAuto(c))}>자동계산으로</button>
              )}
            </span>
            <NumberField id="total" ariaLabel="총 거래금액" suffix="원" max={MAX_AMOUNT} value={card.total} onChange={(total) => setCard((c) => setManualTotal(c, total))} />
          </div>
          <div className="field placed" style={place(BOXES.stopLoss)}>
            <span className="stop-head">
              <label className="field-label" htmlFor="stop">손절매 금액(예정)</label>
              <output className="stop-text" htmlFor="stop" data-testid="stop-converted">{stop.text}</output>
            </span>
            <div className="stop-row">
              {card.stopLossMode === "won" ? (
                <NumberField id="stop" ariaLabel="손절매 금액 (1주당 손절 가격)" suffix="원" placeholder="1주당 손절 가격" max={MAX_AMOUNT} value={card.stopLoss} onChange={(stopLoss) => update({ stopLoss })} />
              ) : (
                <PercentField id="stop" ariaLabel="손절매 비율 (1주당 가격 대비 하락률)" placeholder="가격 대비 %" value={card.stopLossPct} onChange={(stopLossPct) => update({ stopLossPct })} />
              )}
              <select
                className="unit-select"
                aria-label="손절매 입력 단위"
                value={card.stopLossMode}
                onChange={(e) => setCard((c) => setStopLossMode(c, e.target.value as StopLossMode))}
              >
                <option value="won">원</option>
                <option value="pct">%</option>
              </select>
            </div>
          </div>
        </div>
        {stop.needsPrice && (
          <p className="text-xs text-danger" role="status" data-testid="stop-needs-price">1주당 가격이 없어 손절매 금액을 계산할 수 없어요. 1주당 가격을 넣어 주세요.</p>
        )}
        {stop.overPrice && (
          <p className="text-xs text-danger" role="status" data-testid="stop-over-price">손절매 금액이 1주당 가격보다 커요. 금액은 그대로 표시하고 비율 대신 &lsquo;1주당 가격 초과&rsquo;로 적어요.</p>
        )}
        {!card.totalManual && exceedsMaxTotal(card.quantity, card.price) && (
          <p className="text-xs text-danger" role="alert">금액이 너무 커서 자동계산할 수 없어요. 총 거래금액을 직접 입력해 주세요.</p>
        )}

        <section className="frame placed" style={place(BOXES.reasonFrame)} aria-label="매수/매도 이유">
          <div className="frame-head">
            <span>매수/매도 이유</span>
            <ModeSwitch mode={card.reason.mode} onChange={(mode) => update({ reason: { ...card.reason, mode } })} />
          </div>
          <div className="placed-inner" style={insetInFrame(BOXES.reasonWriting, BOXES.reasonFrame)} data-writing={card.reason.mode}>
            <Writing
              field={card.reason}
              box={BOXES.reasonWriting}
              label="매수/매도 이유"
              placeholder="왜 이 가격에, 왜 지금 사고파는지 적어 보세요"
              onChange={(reason) => update({ reason })}
            />
          </div>
          <div className="slot placed-inner" style={insetInFrame(BOXES.imageSlot, BOXES.reasonFrame)}>
            {card.image ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
                <img src={card.image} alt="첨부한 이미지" className="max-w-full max-h-full object-contain" />
                <button type="button" className="tool absolute top-1 right-1" onClick={() => setCard((c) => ({ ...c, image: null }))}>삭제</button>
              </>
            ) : (
              <label className="flex flex-col items-center gap-1 cursor-pointer text-center p-3 w-full h-full justify-center">
                <span className="font-pen text-[20px] lg:text-[calc(var(--u)*16)] text-ink-soft">{imageBusy ? "이미지 줄이는 중..." : "+ 이미지 1장 (뉴스 캡처 등)"}</span>
                <input type="file" accept="image/*" className="sr-only" data-testid="image-input" onChange={(e) => { void onImage(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            )}
            {imageError && <p className="absolute bottom-1 inset-x-1 text-xs text-danger text-center" role="alert">{imageError}</p>}
          </div>
        </section>

        <section className="frame placed" style={place(BOXES.memoFrame)} aria-label="메모">
          <div className="frame-head">
            <span>메모</span>
            <span className="frame-hint">예상과 달랐던 이유 등</span>
            <ModeSwitch mode={card.memo.mode} onChange={(mode) => update({ memo: { ...card.memo, mode } })} />
          </div>
          <div className="placed-inner" style={insetInFrame(BOXES.memoWriting, BOXES.memoFrame)} data-writing={card.memo.mode}>
            <Writing field={card.memo} box={BOXES.memoWriting} label="메모" placeholder="" onChange={(memo) => update({ memo })} />
          </div>
        </section>
      </form>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={openPreview} disabled={!ready}>미리보기</button>
        {confirmReset ? (
          <span className="inline-flex flex-wrap items-center gap-2" role="group" aria-label="새 카드 확인" data-testid="reset-confirm">
            <span className="text-sm">지금 카드의 내용을 모두 지울까요?</span>
            <button type="button" className="btn btn-primary" onClick={() => void reset()}>지우고 새로 쓰기</button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmReset(false)}>취소</button>
          </span>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={() => (blank ? void reset() : setConfirmReset(true))} disabled={!ready}>새 카드</button>
        )}
        <p className="text-xs text-ink-soft" data-testid="save-status" role="status">
          {status === "saved" && "이 브라우저에만 임시 저장했어요."}
          {status === "saved-without-attachments" && "저장 공간이 부족해 필기와 이미지는 임시 저장하지 못했어요. 작성은 계속할 수 있어요."}
          {status === "unavailable" && "이 브라우저에서는 임시 저장을 할 수 없어요. 작성은 계속할 수 있어요."}
        </p>
      </div>
      {repaired && <p className="mt-2 text-sm text-danger" role="status" data-testid="draft-repaired">임시 저장본 일부가 손상되어 읽을 수 있는 칸만 불러왔어요. 내용을 확인해 주세요.</p>}
      {problem && !preview && <p className="mt-2 text-sm text-danger" role="alert">{problem}</p>}

      {preview && (
        <div className="fixed inset-0 z-40 bg-ink/70 overflow-y-auto p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="카드 미리보기" data-testid="preview-dialog">
          <div className="mx-auto w-full max-w-[1040px] bg-desk rounded-lg p-3 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="font-pen text-[28px] leading-none">PDF와 같은 모습이에요</h2>
              <button type="button" className="tool !text-sm lg:!text-sm" onClick={() => setPreview(false)}>닫기</button>
            </div>
            <div className="overflow-x-auto shadow">
              <div style={{ width: big ? "220%" : "100%" }}>
                <CardSvg card={card} testId="preview-card" />
              </div>
            </div>
            <button type="button" className="tool !text-sm mt-2 lg:hidden" aria-pressed={big} onClick={() => setBig((v) => !v)}>
              {big ? "화면에 맞추기" : "크게 보기"}
            </button>
            {problem && <p className="mt-2 text-sm text-danger" role="alert">{problem}</p>}
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <button type="button" className="btn btn-primary flex-1" disabled={busy} onClick={() => void download()}>
                {busy ? "만드는 중..." : "PDF 다운로드"}
              </button>
              {emailEnabled && (
                <button type="button" className="btn btn-ghost flex-1" disabled={busy || blank} onClick={() => void toSend()}>이메일로 받기</button>
              )}
            </div>
            {emailEnabled && blank && <p className="mt-2 text-sm text-ink-soft" data-testid="blank-note">카드에 내용을 적으면 이메일로 받을 수 있어요.</p>}
          </div>
        </div>
      )}
    </main>
  );
}

function insetInFrame(inner: Box, frame: Box) {
  const pct = {
    "--ix": `${((inner.x - frame.x) / frame.w) * 100}%`,
    "--iy": `${((inner.y - frame.y) / frame.h) * 100}%`,
    "--iw": `${(inner.w / frame.w) * 100}%`,
    "--ih": `${(inner.h / frame.h) * 100}%`,
  };
  return pct as React.CSSProperties;
}
