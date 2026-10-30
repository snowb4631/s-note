import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { guideBySlug, guides } from "@/content/guides";
import { site } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return guides.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = guideBySlug((await params).slug);
  return guide ? { title: guide.title, description: guide.summary } : {};
}

export default async function GuidePage({ params }: Props) {
  const guide = guideBySlug((await params).slug);
  if (!guide) notFound();
  return (
    <main className="mx-auto w-full max-w-[720px] px-4">
      <article className="bg-paper rounded p-5 sm:p-9 shadow-sm">
        <h1 className="font-pen text-[38px] sm:text-[44px] leading-[1.15]">{guide.title}</h1>
        <p className="mt-2 text-sm text-ink-soft">{guide.summary}</p>
        {guide.sections.map((s) => (
          <section key={s.heading} className="mt-8">
            <h2 className="text-lg font-bold"><span className="mark px-0.5">{s.heading}</span></h2>
            {s.paragraphs.map((p) => (
              <p key={p} className="mt-3 text-[15.5px] leading-[1.85]">{p}</p>
            ))}
            {s.list && (
              <ul className="mt-3 list-disc pl-5 space-y-1.5 text-[15.5px] leading-[1.75]">
                {s.list.map((item) => <li key={item}>{item}</li>)}
              </ul>
            )}
          </section>
        ))}
        <p className="mt-10 border-t border-rule pt-4 text-xs leading-relaxed text-ink-soft">
          이 글은 기록 습관에 관한 일반적인 정보이며 투자 자문이나 권유가 아닙니다. 투자 판단과 그 결과의 책임은 본인에게 있습니다. {site.disclaimer}
        </p>
      </article>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/" className="btn btn-primary">매매일지 카드 쓰기</Link>
        <Link href="/guides" className="btn btn-ghost">다른 글 보기</Link>
      </div>
    </main>
  );
}
