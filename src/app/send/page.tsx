import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AdSlot } from "@/components/AdSlot";
import { SendClient } from "@/components/SendClient";
import { adConfig, emailEnabled } from "@/server/env";

export const metadata: Metadata = {
  title: "이메일로 받기",
  robots: { index: false },
};

export default async function SendPage() {
  await connection(); // env is read per request so keys need no rebuild
  if (!emailEnabled(process.env)) {
    return (
      <main className="mx-auto w-full max-w-[1180px] px-4">
        <h1 className="font-pen text-[34px] leading-none mb-5"><span className="mark px-1">이메일로 받기</span></h1>
        <p data-testid="email-off">이메일로 받기는 아직 미구현입니다. PDF 다운로드를 이용해 주세요.</p>
        <Link className="btn btn-primary inline-block mt-4" href="/">카드 작성으로 돌아가기</Link>
      </main>
    );
  }
  const ad = adConfig(process.env);
  return (
    <main className="mx-auto w-full max-w-[1180px] px-4">
      <h1 className="font-pen text-[34px] leading-none mb-5"><span className="mark px-1">이메일로 받기</span></h1>
      <SendClient turnstileSiteKey={process.env.TURNSTILE_SITE_KEY || null} showCard={!ad} />
      {ad && <AdSlot client={ad.client} slot={ad.slot} />}
    </main>
  );
}
