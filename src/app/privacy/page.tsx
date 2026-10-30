import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "개인정보처리방침" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-2 text-[15px] leading-[1.8] space-y-2">{children}</div>
    </section>
  );
}

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return <a className="underline" href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

const th = "border border-rule bg-slot p-2 text-left font-semibold align-top";
const td = "border border-rule p-2 align-top";

export default function PrivacyPage() {
  const o = site.operator;
  return (
    <main className="mx-auto w-full max-w-[780px] px-4">
      <article className="bg-paper rounded p-5 sm:p-9 shadow-sm">
        <h1 className="font-pen text-[42px] leading-none"><span className="mark px-1">개인정보처리방침</span></h1>

        <Section title="1. 처리하는 개인정보와 목적">
          <p>{o.company}(이하 &lsquo;회사&rsquo;)가 운영하는 {site.name}는 회원가입과 계정이 없으며, 아래 정보만 처리합니다.</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-[520px]">
              <thead>
                <tr><th className={th}>항목</th><th className={th}>목적</th><th className={th}>보관</th></tr>
              </thead>
              <tbody>
                <tr><td className={td}>카드 작성 내용</td><td className={td}>PDF 생성</td><td className={td}>서버 메모리에서만 처리하고 PDF 생성 후 폐기합니다. 저장하지 않습니다.</td></tr>
                <tr><td className={td}>IP 주소의 해시값(HMAC, 원문 복원 불가)</td><td className={td}>IP당 시간당 요청 횟수 제한(악용 방지)</td><td className={td}>서버 메모리에 최대 1시간 보관 후 자동 삭제합니다.</td></tr>
                <tr><td className={td}>IP 주소, 브라우저가 보내는 요청 정보</td><td className={td}>접속 처리, 서비스 보안</td><td className={td}>{site.name} 애플리케이션은 저장하지 않습니다. 앞단 웹 서버의 접속 기록과 3항의 사업자에게 남을 수 있습니다.</td></tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="2. 브라우저 임시 저장">
          <p>작성 중인 카드는 새로고침에 대비해 이용자 브라우저의 저장소(IndexedDB 또는 localStorage)에만 보관됩니다. 카드 내용은 PDF 다운로드를 누를 때에만 서버로 전송됩니다. &lsquo;새 카드&rsquo;를 누르거나 브라우저 데이터를 삭제하면 지워집니다.</p>
        </Section>

        <Section title="3. 처리 위탁 및 외부 서비스">
          <p>서비스 제공을 위해 아래 사업자의 서비스를 이용합니다. 각 사업자의 보관 항목과 기간은 해당 사업자의 정책을 따릅니다.</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-[520px]">
              <thead>
                <tr><th className={th}>사업자</th><th className={th}>업무</th><th className={th}>처리되는 정보</th><th className={th}>정책</th></tr>
              </thead>
              <tbody>
                <tr><td className={td}>네이버클라우드</td><td className={td}>서비스 호스팅(서버 인프라)</td><td className={td}>IP 주소, 요청 내용</td><td className={td}><Ext href="https://privacy.navercloudcorp.com/ko/ncp/PrivacyPolicy/ncp-p">개인정보 처리방침</Ext></td></tr>
                <tr><td className={td}>Cloudflare</td><td className={td}>CDN 및 보안 프록시. 사이트로 오는 모든 요청이 거쳐 갑니다.</td><td className={td}>IP 주소, 요청 내용(PDF 생성 시 카드 내용 포함)</td><td className={td}><Ext href="https://www.cloudflare.com/privacypolicy/">Privacy Policy</Ext></td></tr>
                <tr><td className={td}>Google</td><td className={td}>가이드 페이지의 광고 게재(AdSense)</td><td className={td}>쿠키, 광고 식별자, IP 주소 등</td><td className={td}><Ext href="https://policies.google.com/privacy?hl=ko">개인정보처리방침</Ext></td></tr>
              </tbody>
            </table>
          </div>
          <p>Cloudflare와 Google은 해외 사업자이므로 위 정보가 국외에서 처리될 수 있습니다.</p>
        </Section>

        <Section title="4. 광고와 쿠키">
          <p>가이드 페이지(가이드 목록과 각 글)에는 Google AdSense 광고가 표시될 수 있으며, Google과 파트너는 광고 제공을 위해 쿠키를 사용합니다. 자세한 내용은 <Ext href="https://policies.google.com/technologies/ads?hl=ko">Google의 광고 정책 안내</Ext>에서 볼 수 있습니다. 이용자는 브라우저 설정에서 쿠키를 차단하거나 <Ext href="https://adssettings.google.com/">Google 광고 설정</Ext>에서 맞춤 광고를 끌 수 있습니다.</p>
          <p>카드 작성 화면과 이 페이지에는 광고 스크립트를 불러오지 않습니다. 다만 가이드 페이지의 광고 스크립트는 같은 사이트에서 실행되므로, 기술적으로는 그 브라우저에 임시 저장된 카드에 접근할 수 있습니다. 회사가 카드 내용을 Google에 제공하지는 않습니다. 이를 원하지 않으면 가이드를 읽기 전에 &lsquo;새 카드&rsquo;로 임시 저장을 지워 주세요.</p>
          <p>회사는 자체 추적 쿠키를 쓰지 않습니다.</p>
        </Section>

        <Section title="5. 이메일 기능">
          <p>이메일로 PDF를 받는 기능은 현재 제공하지 않으며, 이메일 주소를 수집하지 않습니다. 이 기능을 시작하게 되면 시작 전에 이 방침을 먼저 고칩니다.</p>
        </Section>

        <Section title="6. 파기">
          <p>회사가 저장하지 않는 정보는 처리 직후 회사 서버의 메모리에서 사라집니다. IP 주소의 해시값은 1항의 기간이 지나면 자동 삭제됩니다. 3항 사업자의 보관은 각 사업자의 정책을 따릅니다.</p>
        </Section>

        <Section title="7. 이용자의 권리">
          <p>계정이 없고 카드 내용과 IP 주소를 저장하지 않으므로, 대부분의 경우 회사가 조회하거나 삭제할 정보가 남아 있지 않습니다. 개인정보에 관한 문의와 열람, 정정, 삭제 요청은 8항의 이메일로 할 수 있습니다.</p>
        </Section>

        <Section title="8. 개인정보 보호책임자와 운영자">
          <ul className="list-disc pl-5">
            <li>상호: {o.company} ({o.companyEn})</li>
            <li>사업자등록번호: {o.businessNumber}</li>
            <li>소재지: {o.location}</li>
            <li>개인정보 보호책임자: {o.privacyOfficer}</li>
            <li>이메일: {o.email}</li>
          </ul>
        </Section>

        <Section title="9. 만 14세 미만 아동">
          <p>{site.name}는 나이를 묻거나 수집하지 않고 계정도 만들지 않습니다. 따라서 이용자가 만 14세 미만인지 확인하지 않습니다.</p>
        </Section>

        <Section title="10. 권익 침해 구제">
          <p>개인정보 침해에 관한 상담과 신고는 아래 기관에 할 수 있습니다.</p>
          <ul className="list-disc pl-5">
            <li>KISA 개인정보침해 신고센터: (국번 없이) 118, <Ext href="https://privacy.kisa.or.kr/main.do">privacy.kisa.or.kr</Ext></li>
            <li>경찰청 사이버범죄 신고시스템: (국번 없이) 182, <Ext href="https://ecrm.police.go.kr/minwon/main">ecrm.police.go.kr</Ext></li>
          </ul>
        </Section>

        <Section title="11. 시행일">
          <p>이 방침은 2026년 10월 31일부터 시행합니다.</p>
        </Section>
      </article>
    </main>
  );
}
