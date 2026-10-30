import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { GuideAds } from "@/components/GuideAds";
import { guides } from "@/content/guides";
import { adConfig } from "@/server/env";

export const metadata: Metadata = {
  title: "매매일지 가이드",
  description: "매매일지 작성법, 손절 원칙, 복기 루틴 등 기록 습관을 위한 글 모음",
};

export default async function GuidesPage() {
  await connection(); // env is read per request so ad keys need no rebuild
  const ad = adConfig(process.env);
  return (
    <main className="mx-auto w-full max-w-[780px] px-4">
      <h1 className="font-pen text-[42px] leading-none mt-4 mb-2"><span className="mark px-1">매매일지 가이드</span></h1>
      <p className="text-sm text-ink-soft mb-8">기록하고 돌아보는 습관에 관한 글입니다. 특정 종목이나 매매를 권하지 않습니다.</p>
      <ul className="flex flex-col gap-4">
        {guides.map((g) => (
          <li key={g.slug}>
            <Link href={`/guides/${g.slug}`} className="block rounded bg-paper p-5 shadow-sm hover:shadow transition-shadow">
              <h2 className="font-pen text-[28px] leading-tight">{g.title}</h2>
              <p className="mt-1 text-sm text-ink-soft leading-relaxed">{g.summary}</p>
            </Link>
          </li>
        ))}
      </ul>
      {ad && <GuideAds client={ad.client} slot={null} />}
    </main>
  );
}
