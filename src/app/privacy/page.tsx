import type { Metadata } from "next";
import { UNCONFIRMED, site } from "@/lib/site";

export const metadata: Metadata = { title: "개인정보처리방침" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-2 text-[15px] leading-[1.8] space-y-2">{children}</div>
    </section>
  );
}

const th = "border border-rule bg-slot p-2 text-left font-semibold align-top";
const td = "border border-rule p-2 align-top";

export default function PrivacyPage() {
  const o = site.operator;
  return (
    <main className="mx-auto w-full max-w-[780px] px-4">
      <article className="bg-paper rounded p-5 sm:p-9 shadow-sm">
        <h1 className="font-pen text-[42px] leading-none"><span className="mark px-1">개인정보처리방침</span></h1>
        <p className="mt-4 rounded border-[1.5px] border-danger p-3 text-sm leading-relaxed text-danger font-medium" role="note" data-testid="review-note">
          초안입니다. 출시 전에 개인정보 전문가의 검토가 필요하며, {UNCONFIRMED}로 표시한 값은 아직 확정되지 않았습니다.
        </p>

        <Section title="1. 처리하는 개인정보와 목적">
          <p>{o.company}(이하 &lsquo;회사&rsquo;)는 {site.name} 서비스에서 회원가입 없이 아래 정보만 처리합니다.</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-[520px]">
              <thead>
                <tr><th className={th}>항목</th><th className={th}>목적</th><th className={th}>보관</th></tr>
              </thead>
              <tbody>
                <tr><td className={td}>이메일 주소</td><td className={td}>요청한 PDF 발송</td><td className={td}>회사 서버에 저장하지 않으며 발송 처리 후 즉시 파기. 발송 대행사(Cloudflare)의 보관은 3항 참고</td></tr>
                <tr><td className={td}>수신 주소의 해시값(HMAC, 원문 복원 불가)</td><td className={td}>수신 주소당 일일 발송 횟수 제한(악용 방지)</td><td className={td}>서버 메모리에 최대 24시간 보관 후 자동 삭제</td></tr>
                <tr><td className={td}>IP 주소의 해시값</td><td className={td}>IP당 시간당 요청 횟수 제한(악용 방지)</td><td className={td}>서버 메모리에 최대 1시간 보관 후 자동 삭제</td></tr>
                <tr><td className={td}>IP 주소</td><td className={td}>봇 방지 확인, 서비스 운영 과정의 접속 처리</td><td className={td}>회사는 별도로 저장하지 않음. 수탁사 로그 보관 기간은 {UNCONFIRMED}</td></tr>
                <tr><td className={td}>카드 작성 내용</td><td className={td}>PDF 생성</td><td className={td}>회사 서버에 저장하지 않으며 PDF 생성·발송 후 메모리에서 폐기. 이메일로 받기를 쓰면 PDF가 첨부된 메일이 발송 대행사(Cloudflare)를 거치며, 보관은 3항 참고</td></tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="2. 브라우저 임시 저장">
          <p>작성 중인 카드는 새로고침에 대비해 이용자 브라우저의 저장소(IndexedDB 또는 localStorage)에만 보관되며 서버로 전송되지 않습니다. &lsquo;새 카드&rsquo;를 누르거나 브라우저 데이터를 삭제하면 지워집니다.</p>
        </Section>

        <Section title="3. 처리 위탁 및 국외 이전">
          <p>서비스 제공을 위해 아래 해외 사업자에게 처리를 위탁하며, 이 과정에서 개인정보가 국외로 이전될 수 있습니다. 이전 국가, 시기, 방법 등 세부 내용은 계약 확인 후 기재합니다.</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-[520px]">
              <thead>
                <tr><th className={th}>수탁사</th><th className={th}>위탁 업무</th><th className={th}>이전 항목</th><th className={th}>이전 국가</th></tr>
              </thead>
              <tbody>
                <tr><td className={td}>네이버클라우드</td><td className={td}>서비스 호스팅(서버 인프라)</td><td className={td}>IP 주소, 요청 내용</td><td className={td}>{UNCONFIRMED}</td></tr>
                <tr><td className={td}>Cloudflare</td><td className={td}>이메일 발송(Email Service), 봇 방지(Turnstile)</td><td className={td}>이메일 주소, 첨부 PDF, IP 주소, 브라우저 정보</td><td className={td}>{UNCONFIRMED}</td></tr>
                <tr><td className={td}>Google</td><td className={td}>광고 게재(AdSense, 사용 시)</td><td className={td}>쿠키, 광고 식별자, IP 주소 등</td><td className={td}>{UNCONFIRMED}</td></tr>
              </tbody>
            </table>
          </div>
          <p>Cloudflare는 자체 정책에 따라 발송한 메일과 발송 기록을 보관할 수 있습니다. 보관 항목과 기간은 {UNCONFIRMED}입니다. 회사는 이를 삭제할 수 없을 수 있습니다.</p>
        </Section>

        <Section title="4. 광고와 쿠키">
          <p>이메일 발송 화면에는 Google AdSense 광고가 표시될 수 있으며, Google과 파트너는 광고 제공을 위해 쿠키를 사용할 수 있습니다. 이용자는 브라우저 설정에서 쿠키를 차단하거나 Google 광고 설정에서 맞춤 광고를 끌 수 있습니다. 동의가 필요한 지역에는 AdSense의 동의 메시지를 표시합니다. 회사는 자체 추적 쿠키를 쓰지 않습니다.</p>
          <p>광고가 켜져 있으면 이메일 발송 화면에 카드 내용을 표시하지 않습니다. 다만 광고 스크립트는 같은 페이지에서 실행되므로, 기술적으로는 그 화면에 입력하는 이메일 주소와 브라우저에 임시 저장된 카드에 접근할 수 있습니다. 회사는 Google이 이를 수집하는지 확인하지 못했습니다({UNCONFIRMED}). 이를 원하지 않으면 이메일 대신 PDF 다운로드를 이용해 주세요. PDF 다운로드 화면에는 광고가 없습니다.</p>
        </Section>

        <Section title="5. 파기">
          <p>회사가 저장하지 않는 정보는 처리 직후 회사 서버의 메모리에서 사라집니다. 수탁사의 보관은 3항을 따릅니다. 해시값은 저장소의 만료 설정에 따라 기간이 지나면 자동 삭제됩니다.</p>
        </Section>

        <Section title="6. 이용자의 권리">
          <p>회사는 이메일 주소 원문을 저장하지 않으므로 대부분의 경우 회사가 조회·삭제할 정보가 남아 있지 않습니다. 문의는 아래 연락처로 할 수 있습니다. 만 14세 미만 아동의 이용 기준은 {UNCONFIRMED}입니다.</p>
        </Section>

        <Section title="7. 개인정보 보호책임자">
          <ul className="list-disc pl-5">
            <li>회사: {o.company}</li>
            <li>대표자: {o.representative}</li>
            <li>보호책임자: {o.privacyOfficer}</li>
            <li>이메일: {o.email}</li>
            <li>전화: {o.phone}</li>
            <li>주소: {o.address}</li>
          </ul>
        </Section>

        <Section title="8. 시행일">
          <p>{UNCONFIRMED}</p>
        </Section>
      </article>
    </main>
  );
}
