import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
  if (!emailEnabled(process.env)) redirect("/");
  const ad = adConfig(process.env);
  const slot = ad?.slot;
  return (
    <main className="mx-auto w-full max-w-[1180px] px-4">
      <h1 className="font-pen text-[34px] leading-none mb-5"><span className="mark px-1">이메일로 받기</span></h1>
      <SendClient turnstileSiteKey={process.env.TURNSTILE_SITE_KEY || null} showCard={!slot} />
      {ad && slot && <AdSlot client={ad.client} slot={slot} />}
    </main>
  );
}
