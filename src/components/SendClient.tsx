"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Card } from "@/lib/card/schema";
import { emailSchema, isBlankCard } from "@/lib/card/schema";
import { clearDraft, loadDraft } from "@/lib/draft";
import { getPendingSend, setPendingSend } from "@/lib/send-store";
import { CardSvg } from "./CardSvg";
import { Turnstile } from "./Turnstile";

type Done = { delivered: boolean; message?: string };

/** showCard is false when an ad script shares this page: card values then stay out of its DOM. */
export function SendClient({ turnstileSiteKey, showCard }: { turnstileSiteKey: string | null; showCard: boolean }) {
  const router = useRouter();
  const [card, setCard] = useState<Card | null | undefined>(undefined);
  const [warning, setWarning] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);

  useEffect(() => {
    let alive = true;
    const pending = getPendingSend();
    if (pending) {
      // Already in memory; the state updates are deferred like the draft path below.
      void Promise.resolve().then(() => {
        if (!alive) return;
        setCard(pending.card);
        if (pending.saveFailed) setWarning("임시 저장에 실패해 필기나 이미지가 저장되지 않았어요. 지금 보내는 메일에는 모두 들어가지만, 새로고침하면 사라져요.");
      });
    } else {
      loadDraft().then((draft) => {
        if (!alive) return;
        setCard(draft?.card ?? null);
        if (draft?.dropped) setWarning("저장 공간이 부족해 필기와 이미지가 빠진 카드를 불러왔어요. 빠진 내용은 메일에 들어가지 않아요.");
      });
    }
    return () => {
      alive = false;
    };
  }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!emailSchema.safeParse(address).success) {
      setError("이메일 주소를 확인해 주세요.");
      return;
    }
    if (turnstileSiteKey && !token) {
      setError("봇 확인이 끝난 뒤 보낼 수 있어요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card, email: address, turnstileToken: token }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.message ?? "메일을 보내지 못했습니다.");
        setToken("");
        setResetKey((k) => k + 1);
        return;
      }
      setDone({ delivered: data.delivered, message: data.message });
    } catch {
      setError("네트워크 오류로 보내지 못했습니다.");
      setToken("");
      setResetKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };

  const startNew = async () => {
    await clearDraft();
    setPendingSend(null);
    router.push("/");
  };

  if (card === undefined) return <p className="py-10 text-sm text-ink-soft" data-testid="send-loading">카드를 불러오는 중...</p>;
  if (card === null || isBlankCard(card)) {
    return (
      <div className="py-10">
        <p className="mb-4">보낼 카드가 없어요. 카드를 먼저 작성해 주세요.</p>
        <Link href="/" className="btn btn-primary">카드 작성하기</Link>
      </div>
    );
  }

  if (done) {
    return (
      <section className="py-8" data-testid="send-done" role="status">
        <h2 className="font-pen text-[34px] leading-tight"><span className="mark px-1">{done.delivered ? "메일을 보냈어요" : "발송을 건너뛰었어요"}</span></h2>
        <p className="mt-3 text-sm leading-relaxed">
          {done.delivered ? "메일함을 확인해 주세요. 스팸함에 들어갈 수도 있어요." : done.message}
        </p>
        <button type="button" className="btn btn-primary mt-6" onClick={() => void startNew()}>새 카드 작성</button>
      </section>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
      {showCard ? (
        <div className="shadow rounded-sm overflow-hidden">
          <CardSvg card={card} testId="send-card" />
        </div>
      ) : (
        <p className="rounded border border-rule bg-paper p-4 text-sm leading-relaxed" data-testid="send-card-hidden">
          카드가 준비됐어요. 광고가 함께 표시되는 화면이라 내용은 여기에 보여 주지 않아요. 앞 화면의 미리보기와 같은 카드가 PDF로 첨부됩니다.
        </p>
      )}
      <form onSubmit={(e) => void send(e)} className="flex flex-col gap-4" noValidate>
        {warning && <p className="text-sm text-danger" role="alert" data-testid="send-warning">{warning}</p>}
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          받을 이메일 주소
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            className="h-12 rounded-md border-[1.5px] border-ink bg-paper px-3 text-base font-normal"
            placeholder="me@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {turnstileSiteKey && <Turnstile siteKey={turnstileSiteKey} onToken={setToken} resetKey={resetKey} />}
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy} data-testid="send-button">
          {busy ? "보내는 중..." : "이메일로 보내기"}
        </button>
        <p className="text-xs leading-relaxed text-ink-soft">
          주소는 이 PDF를 보내는 데만 쓰고 스노트 서버에 저장하지 않습니다. 메일 발송을 맡은 Cloudflare는 자체 정책에 따라 발송 기록과 메일을 보관할 수 있습니다. 악용 방지를 위한 횟수 제한에는 해시값만 최대 24시간 보관합니다.{" "}
          <Link href="/privacy" className="underline">개인정보처리방침</Link>
        </p>
        <Link href="/" className="text-sm underline text-ink-soft self-start">카드로 돌아가기</Link>
      </form>
    </div>
  );
}
