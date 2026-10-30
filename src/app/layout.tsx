import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import { connection } from "next/server";
import { BrandIcon } from "@/components/BrandIcon";
import { site } from "@/lib/site";
import { adConfig, emailEnabled } from "@/server/env";
import "./globals.css";

const pen = localFont({
  src: "../fonts/NanumPenScript-Regular.woff2",
  variable: "--font-nanum-pen",
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} - 손글씨 매매일지 카드`, template: `%s | ${site.name}` },
  description: site.description,
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection(); // the footer and the AdSense meta read env per request, so no page bakes in build-time values
  const ad = adConfig(process.env);
  return (
    <html lang="ko" className={pen.variable}>
      {/* A plain tag, not generateMetadata, which may stream into the body where the AdSense check can miss it. */}
      <head>{ad && <meta name="google-adsense-account" content={ad.client} />}</head>
      <body className="min-h-dvh flex flex-col">
        <header className="mx-auto w-full max-w-[1180px] px-4 pt-4 pb-3 flex items-center justify-between gap-4">
          <Link href="/" className="font-pen text-[30px] leading-none inline-flex items-center gap-1.5">
            <BrandIcon className="size-8 shrink-0" />
            <span className="mark px-1">{site.name}</span>
          </Link>
          <nav className="flex gap-4 text-sm text-ink-soft">
            <Link className="hover:text-ink" href="/guides">가이드</Link>
            <Link className="hover:text-ink" href="/privacy">개인정보 처리방침</Link>
          </nav>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="mx-auto w-full max-w-[1180px] px-4 pt-10 pb-8 text-xs leading-relaxed text-ink-soft">
          <p className="font-medium" data-testid="disclaimer">{site.disclaimer}</p>
          <p className="mt-1">© {site.operator.company}. 작성 내용은 {site.name} 서버에 저장되지 않습니다.{emailEnabled(process.env) && " 이메일로 받으면 발송 대행사가 자체 정책에 따라 메일을 보관할 수 있습니다."}</p>
        </footer>
      </body>
    </html>
  );
}
