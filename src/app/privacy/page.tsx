import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "개인정보 처리방침" };

const CF_ADDENDUM = "https://www.cloudflare.com/privacypolicy/southkorea-addendum/";

const contents = [
  ["purpose", "개인정보의 처리 목적"],
  ["items", "처리하는 개인정보의 항목"],
  ["children", "14세 미만 아동의 개인정보 처리"],
  ["retention", "개인정보의 처리 및 보유 기간"],
  ["destruction", "개인정보의 파기 절차 및 방법"],
  ["third-party", "개인정보의 제3자 제공"],
  ["entrustment", "개인정보 처리업무의 위탁"],
  ["overseas", "개인정보의 국외 이전"],
  ["security", "개인정보의 안전성 확보조치"],
  ["cookies", "개인정보 자동 수집 장치의 설치·운영 및 거부"],
  ["behavioral", "제3자가 수집해 가는 행태정보"],
  ["rights", "정보주체와 법정대리인의 권리·의무 및 행사방법"],
  ["officer", "개인정보 보호책임자"],
  ["remedies", "정보주체의 권익침해에 대한 구제방법"],
  ["not-applicable", "해당하지 않는 사항"],
  ["changes", "개인정보 처리방침의 변경"],
] as const;

type SectionId = (typeof contents)[number][0];

function Section({ id, children }: { id: SectionId; children: React.ReactNode }) {
  const index = contents.findIndex(([key]) => key === id);
  return (
    <section id={id} className="mt-8 scroll-mt-4">
      <h2 className="text-lg font-bold">{index + 1}. {contents[index][1]}</h2>
      <div className="mt-2 text-[15px] leading-[1.8] space-y-2">{children}</div>
    </section>
  );
}

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return <a className="underline" href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

function Email() {
  return <>이메일: <a className="underline" href={`mailto:${site.operator.email}`}>{site.operator.email}</a></>;
}

const th = "border border-rule bg-slot p-2 text-left font-semibold align-top";
const td = "border border-rule p-2 align-top";

function Table({ head, rows, min = 620 }: { head: string[]; rows: React.ReactNode[][]; min?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth: min }}>
        <thead>
          <tr>{head.map((h) => <th key={h} className={th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>{row.map((cell, c) => <td key={c} className={td}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The version published before this one. The guideline asks that earlier versions stay readable. */
function PreviousPolicy() {
  const o = site.operator;
  const h3 = "mt-4 font-bold";
  return (
    <div className="mt-2 text-sm leading-[1.7] space-y-2 border-l-2 border-rule pl-3">
      <h3 className={h3}>1. 처리하는 개인정보와 목적</h3>
      <p>{o.company}(이하 &lsquo;회사&rsquo;)가 운영하는 {site.name}는 회원가입과 계정이 없으며, 아래 정보만 처리합니다.</p>
      <ul className="list-disc pl-5">
        <li>카드 작성 내용 / PDF 생성 / 서버 메모리에서만 처리하고 PDF 생성 후 폐기합니다. 저장하지 않습니다.</li>
        <li>IP 주소의 해시값(HMAC, 원문 복원 불가) / IP당 시간당 요청 횟수 제한(악용 방지) / 서버 메모리에 최대 1시간 보관 후 자동 삭제합니다.</li>
        <li>IP 주소, 브라우저가 보내는 요청 정보 / 접속 처리, 서비스 보안 / {site.name} 애플리케이션은 저장하지 않습니다. 앞단 웹 서버의 접속 기록과 3항의 사업자에게 남을 수 있습니다.</li>
      </ul>
      <h3 className={h3}>2. 브라우저 임시 저장</h3>
      <p>작성 중인 카드는 새로고침에 대비해 이용자 브라우저의 저장소(IndexedDB 또는 localStorage)에만 보관됩니다. 카드 내용은 PDF 다운로드를 누를 때에만 서버로 전송됩니다. &lsquo;새 카드&rsquo;를 누르거나 브라우저 데이터를 삭제하면 지워집니다.</p>
      <h3 className={h3}>3. 처리 위탁 및 외부 서비스</h3>
      <p>서비스 제공을 위해 아래 사업자의 서비스를 이용합니다. 각 사업자의 보관 항목과 기간은 해당 사업자의 정책을 따릅니다.</p>
      <ul className="list-disc pl-5">
        <li>네이버클라우드 / 서비스 호스팅(서버 인프라) / IP 주소, 요청 내용</li>
        <li>Cloudflare / CDN 및 보안 프록시. 사이트로 오는 모든 요청이 거쳐 갑니다. / IP 주소, 요청 내용(PDF 생성 시 카드 내용 포함)</li>
        <li>Google / 가이드 페이지의 광고 게재(AdSense) / 쿠키, 광고 식별자, IP 주소 등</li>
      </ul>
      <p>Cloudflare와 Google은 해외 사업자이므로 위 정보가 국외에서 처리될 수 있습니다.</p>
      <h3 className={h3}>4. 광고와 쿠키</h3>
      <p>가이드 페이지(가이드 목록과 각 글)에는 Google AdSense 광고가 표시될 수 있으며, Google과 파트너는 광고 제공을 위해 쿠키를 사용합니다. 이용자는 브라우저 설정에서 쿠키를 차단하거나 Google 광고 설정에서 맞춤 광고를 끌 수 있습니다.</p>
      <p>카드 작성 화면과 이 페이지에는 광고 스크립트를 불러오지 않습니다. 다만 가이드 페이지의 광고 스크립트는 같은 사이트에서 실행되므로, 기술적으로는 그 브라우저에 임시 저장된 카드에 접근할 수 있습니다. 회사가 카드 내용을 Google에 제공하지는 않습니다. 이를 원하지 않으면 가이드를 읽기 전에 &lsquo;새 카드&rsquo;로 임시 저장을 지워 주세요.</p>
      <p>회사는 자체 추적 쿠키를 쓰지 않습니다.</p>
      <h3 className={h3}>5. 이메일 기능</h3>
      <p>이메일로 PDF를 받는 기능은 현재 제공하지 않으며, 이메일 주소를 수집하지 않습니다. 이 기능을 시작하게 되면 시작 전에 이 방침을 먼저 고칩니다.</p>
      <h3 className={h3}>6. 파기</h3>
      <p>회사가 저장하지 않는 정보는 처리 직후 회사 서버의 메모리에서 사라집니다. IP 주소의 해시값은 1항의 기간이 지나면 자동 삭제됩니다. 3항 사업자의 보관은 각 사업자의 정책을 따릅니다.</p>
      <h3 className={h3}>7. 이용자의 권리</h3>
      <p>계정이 없고 카드 내용과 IP 주소를 저장하지 않으므로, 대부분의 경우 회사가 조회하거나 삭제할 정보가 남아 있지 않습니다. 개인정보에 관한 문의와 열람, 정정, 삭제 요청은 8항의 이메일로 할 수 있습니다.</p>
      <h3 className={h3}>8. 개인정보 보호책임자와 운영자</h3>
      <p>상호: {o.company} ({o.companyEn}) / 사업자등록번호: {o.businessNumber} / 소재지: {o.location} / 개인정보 보호책임자: {o.privacyOfficer} / 이메일: {o.email}</p>
      <h3 className={h3}>9. 만 14세 미만 아동</h3>
      <p>{site.name}는 나이를 묻거나 수집하지 않고 계정도 만들지 않습니다. 따라서 이용자가 만 14세 미만인지 확인하지 않습니다.</p>
      <h3 className={h3}>10. 권익 침해 구제</h3>
      <p>개인정보 침해에 관한 상담과 신고는 KISA 개인정보침해 신고센터((국번 없이) 118, privacy.kisa.or.kr), 경찰청 사이버범죄 신고시스템((국번 없이) 182, ecrm.police.go.kr)에 할 수 있습니다.</p>
      <h3 className={h3}>11. 시행일</h3>
      <p>이 방침은 2026년 10월 31일부터 시행합니다.</p>
    </div>
  );
}

export default function PrivacyPage() {
  const o = site.operator;
  return (
    <main className="mx-auto w-full max-w-[780px] px-4">
      <article className="bg-paper rounded p-5 sm:p-9 shadow-sm">
        <h1 className="font-pen text-[34px] sm:text-[42px] leading-tight"><span className="mark px-1">{o.company} 개인정보 처리방침</span></h1>

        <p className="mt-4 text-[15px] leading-[1.8]">
          {o.company}(이하 &lsquo;회사&rsquo;)는 자신이 운영하는 서비스 {site.name}({site.url})에서 개인정보가 어떻게 처리되는지 정보주체에게 알리고, 관련 고충을 신속하고 원활하게 처리하기 위하여 「개인정보 보호법」 제30조에 따라 이 개인정보 처리방침을 공개합니다. {site.name}는 회원가입과 계정이 없고 데이터베이스를 두지 않으며, 서비스 제공에 필요한 최소한의 정보만 처리합니다.
        </p>

        <section aria-labelledby="summary" className="mt-6 rounded border border-rule p-4 text-sm leading-[1.7]">
          <h2 id="summary" className="font-bold">주요 내용 요약</h2>
          <ul className="mt-1 list-disc pl-5">
            <li>처리 항목: PDF 생성을 요청할 때의 카드 내용(저장하지 않음), IP 주소와 그 해시값, 웹 서버 접속 기록, 문의 메일</li>
            <li>제3자 제공: 회사가 개인정보를 제3자에게 전달하지 않습니다. 가이드 페이지에서는 Google이 광고용 정보를 직접 수집합니다.</li>
            <li>국외 이전: Cloudflare를 거치는 접속 정보, Google 광고와 메일</li>
            <li>고충 처리: 개인정보 보호책임자 {o.privacyOfficer}, <Email /></li>
          </ul>
          <p className="mt-1">이 요약은 아래 전문의 일부만 옮긴 것입니다. 자세한 내용은 전문을 보세요.</p>
        </section>

        <nav aria-label="목차" className="mt-6 text-sm leading-[1.9]">
          <h2 className="font-bold">목차</h2>
          <ol className="mt-1 list-decimal pl-5">
            {contents.map(([id, title]) => (
              <li key={id}><a className="underline" href={`#${id}`}>{title}</a></li>
            ))}
          </ol>
        </nav>

        <Section id="purpose">
          <p>회사는 다음 목적으로만 개인정보를 처리합니다. 목적이 바뀌면 「개인정보 보호법」 제18조에 따라 필요한 조치를 하고 이 방침을 고칩니다.</p>
          <ol className="list-decimal pl-5">
            <li>PDF 생성: 이용자가 요청한 매매일지 카드를 PDF로 만들어 돌려주기 위해</li>
            <li>요청 횟수 제한: 같은 곳에서 PDF 생성 요청이 몰리는 악용을 막기 위해</li>
            <li>접속 처리와 보안: 사이트 접속 요청을 처리하고 웹 서버에 접속 기록을 남기기 위해</li>
            <li>문의 처리: 개인정보 관련 문의와 권리 행사 요청에 답하기 위해</li>
          </ol>
          <p>광고 게재를 위한 Google의 수집은 <a className="underline" href="#behavioral">11항</a>에서 설명합니다.</p>
        </Section>

        <Section id="items">
          <p>회사는 처리 목적에 필요한 최소한의 항목만 처리합니다. 정보주체의 동의를 받아 처리하는 개인정보는 없으며, 모두 아래의 법적 근거로 동의 없이 처리합니다.</p>
          <Table
            head={["처리 업무", "처리하는 항목", "법적 근거"]}
            rows={[
              [
                "PDF 생성(이용자가 PDF 다운로드를 누를 때만)",
                "카드 작성 내용: 날짜, 종목, 매수·매도 구분, 수량, 가격, 금액, 손절 기준, 이유와 메모(글 또는 손글씨), 첨부 이미지",
                "「개인정보 보호법」 제15조제1항제4호(계약 체결·이행)",
              ],
              [
                "요청 횟수 제한(PDF 생성 요청 때만)",
                "IP 주소(IPv6는 앞 64비트), 이를 비밀키로 변환한 HMAC 해시값(서비스 과정에서 생성)",
                "「개인정보 보호법」 제15조제1항제6호(개인정보처리자의 정당한 이익)",
              ],
              [
                "접속 처리와 보안(모든 접속)",
                "이용자 IP 주소가 포함된 웹 서버 접속 기록, 브라우저가 요청과 함께 보내는 정보",
                "「개인정보 보호법」 제15조제1항제6호(개인정보처리자의 정당한 이익)",
              ],
              [
                "문의 처리(이용자가 메일을 보낼 때만)",
                "보낸 사람의 이메일 주소, 메일 내용",
                "「개인정보 보호법」 제15조제1항제4호(계약 체결·이행)",
              ],
            ]}
          />
          <p><strong>이용자 기기 안에서만 처리되는 정보.</strong> 작성 중인 카드는 새로고침에 대비해 이용자 브라우저의 저장소(IndexedDB 또는 localStorage)에 보관됩니다. 이 임시 저장본은 서버로 전송되지 않으며, 회사는 볼 수 없습니다. &lsquo;새 카드&rsquo;를 누르거나 브라우저 데이터를 삭제하면 지워집니다.</p>
          <p><strong>이메일 받기 기능.</strong> 이메일로 PDF를 받는 기능은 제공하지 않으며, 이를 위해 이메일 주소를 수집하지 않습니다. 이 기능을 시작하게 되면 시작 전에 이 방침을 먼저 고칩니다.</p>
          <p>카드에는 이용자가 직접 적은 내용이 그대로 들어갑니다. 다른 사람의 개인정보나 민감한 내용은 적지 않기를 권합니다.</p>
        </Section>

        <Section id="children">
          <p>{site.name}는 나이를 묻거나 수집하지 않고 계정도 만들지 않으며, 14세 미만 아동을 대상으로 동의를 받아 처리하는 개인정보가 없습니다. 법정대리인의 동의를 받는 절차도 두고 있지 않습니다.</p>
          <p>회사는 이용자가 14세 미만인지 알지 못하므로, <a className="underline" href="#behavioral">11항</a>의 Google 광고를 아동과 구분해 제공하지 못합니다. 아동이 가이드 페이지를 이용할 때에는 법정대리인이 11항의 방법으로 맞춤 광고를 차단할 수 있습니다.</p>
        </Section>

        <Section id="retention">
          <Table
            min={520}
            head={["항목", "처리 및 보유 기간"]}
            rows={[
              ["카드 작성 내용", "서버 메모리에서 PDF를 만드는 동안만 처리하고, 응답을 보낸 뒤 폐기합니다. 저장하지 않습니다."],
              ["IP 주소", "요청을 처리하는 동안 서버 메모리에서만 사용합니다. 애플리케이션은 저장하지 않습니다. 웹 서버 접속 기록에 남는 IP 주소는 이 표의 접속 기록 항목을 따릅니다."],
              ["IP 주소의 해시값", "서버 메모리에 최대 1시간 보관합니다. 1시간 단위의 제한 시간이 끝나면 자동 삭제되고, 서버가 다시 시작될 때에도 사라집니다."],
              ["웹 서버 접속 기록", "일수로 정한 보유 기간은 없고 용량 기준으로 보유합니다. 파일 하나가 10MB가 되면 새 파일로 넘어가고, 최근 파일 3개를 넘는 기록은 자동으로 삭제됩니다. 보유 기간을 정하면 이 방침을 고칩니다."],
              ["문의 메일", "일수로 정한 보유 기간이 없습니다. 문의 처리에 더 이상 필요하지 않게 되면 삭제합니다."],
              ["이용자 브라우저의 임시 저장본", "이용자가 지울 때까지 이용자 기기에 남습니다. 회사는 보유하지 않습니다."],
            ]}
          />
          <p>애플리케이션의 오류 기록에는 오류 종류의 이름만 남으며, IP 주소와 카드 내용은 남기지 않습니다. Cloudflare와 Google의 보유 기간은 <a className="underline" href="#overseas">8항</a>에 적었습니다.</p>
        </Section>

        <Section id="destruction">
          <p>회사는 보유 기간이 지나거나 처리 목적을 달성해 개인정보가 불필요하게 되면 지체 없이 파기합니다. 다른 법령에 따라 보존하는 개인정보는 없습니다.</p>
          <ul className="list-disc pl-5">
            <li>파기 절차: 카드 내용과 IP 주소, 해시값은 프로그램이 자동으로 지웁니다. 접속 기록은 용량 기준에 따라 오래된 로그 파일부터 자동으로 삭제되고, 문의 메일은 메일을 삭제하는 방식으로 지웁니다.</li>
            <li>파기 방법: 메모리의 정보는 해당 처리가 끝나거나 제한 시간이 끝날 때 삭제합니다. 파일과 메일은 삭제합니다.</li>
          </ul>
        </Section>

        <Section id="third-party">
          <p>회사는 개인정보를 제3자에게 전달하지 않습니다. 가이드 페이지에서 이용자 브라우저가 Google로 정보를 직접 보내는 내용은 <a className="underline" href="#behavioral">11항</a>과 <a className="underline" href="#overseas">8항</a>에 적었습니다.</p>
        </Section>

        <Section id="entrustment">
          <p>회사는 서비스 운영을 위해 다음과 같이 개인정보 처리 업무를 맡기고 있습니다. 수탁자나 업무가 바뀌면 이 방침을 고칩니다.</p>
          <Table
            min={520}
            head={["위탁받는 자(수탁자)", "위탁 업무", "서버 위치"]}
            rows={[
              [<>네이버클라우드 주식회사 (<Ext href="https://privacy.navercloudcorp.com/ko/ncp/PrivacyPolicy/ncp-p">개인정보 처리방침</Ext>)</>, "서비스 호스팅(서버 인프라)", "대한민국"],
              ["Cloudflare, Inc.", "CDN(콘텐츠 전송)과 보안 프록시. 사이트로 오는 모든 요청이 거쳐 갑니다. 자세한 내용은 8항에 적었습니다.", "8항 참고"],
            ]}
          />
        </Section>

        <Section id="overseas">
          <p>아래 내용은 Cloudflare와 Google이 공개한 자료를 옮긴 것입니다. 해당 사업자가 자료를 바꾸면 이 표와 달라질 수 있으므로 함께 적은 원문 링크를 보세요.</p>

          <h3 className="font-bold pt-2">가. Cloudflare (국외 처리위탁)</h3>
          <Table
            min={520}
            head={["구분", "내용"]}
            rows={[
              ["법적 근거", "「개인정보 보호법」 제28조의8제1항제3호(계약 체결·이행을 위한 국외 처리위탁·보관, 이 방침을 통한 공개)"],
              ["이전하는 항목", "IP 주소, 트래픽 경로 정보, 시스템 구성 정보, 요청 내용(PDF 생성 시 카드 내용 포함)"],
              ["이전 국가", <>미국, 영국, 싱가포르, 호주, 독일, 포르투갈, 프랑스, 일본, 캐나다, 네덜란드, 아랍에미리트, 인도, 멕시코, 말레이시아, 스웨덴. Cloudflare는 이 밖에도 <Ext href="https://www.cloudflare.com/network/">여러 나라의 데이터센터</Ext>로 요청을 처리하며, 요청이 어느 곳을 거칠지 회사가 지정하고 있지 않습니다.</>],
              ["이전 시기 및 방법", "사이트에 접속할 때마다 네트워크를 통해 즉시"],
              ["이전받는 자", <>Cloudflare, Inc. 및 그 자회사 (101 Townsend St., San Francisco, CA 94107, USA), 연락처 이메일: <a className="underline" href="mailto:dpo@cloudflare.com">dpo@cloudflare.com</a></>],
              ["이용 목적", "CDN과 보안 프록시를 통한 사이트 요청 전달, 해당 서비스의 운영과 개선"],
              ["보유 및 이용 기간", "Cloudflare는 구체적인 기간을 밝히지 않고, 업무 목적에 맞는 기간 또는 법적 의무 이행에 필요한 기간 동안 보유한다고 안내합니다."],
              ["거부 방법, 절차, 효과", <>사이트로 오는 모든 요청이 Cloudflare를 거치므로, 거부하려면 {site.name}에 접속하지 않아야 하며 이 경우 서비스를 이용할 수 없습니다. 접속을 하더라도 PDF 다운로드를 누르지 않으면 카드 내용은 전송되지 않습니다. 궁금한 점은 <Email />로 보내 주세요.</>],
              ["출처", <Ext key="source" href={CF_ADDENDUM}>Cloudflare 대한민국 이용자 부속서</Ext>],
            ]}
          />

          <h3 className="font-bold pt-2">나. Google (이용자 브라우저와 메일에서 Google로 직접 전송)</h3>
          <p>아래 전송은 회사가 정보를 보내는 것이 아니라, 이용자의 브라우저나 메일 프로그램이 Google로 직접 보내는 것입니다. Google은 자체 정책에 따라 이 정보를 처리합니다.</p>
          <Table
            head={["구분", "가이드 페이지의 광고(AdSense)", "문의 메일(Gmail)"]}
            rows={[
              ["이전하는 항목", "방문 중인 페이지의 URL, IP 주소, Google 광고 쿠키에 담긴 정보", "보낸 사람의 이메일 주소, 메일 내용"],
              ["이전 국가", <>Google은 전 세계에 서버를 두고 있으며 특정 국가를 지정해 안내하지 않습니다. <Ext href="https://datacenters.google/locations/">Google 데이터센터 위치</Ext>를 볼 수 있습니다.</>, "왼쪽과 같습니다."],
              ["이전 시기 및 방법", "가이드 페이지를 열 때 브라우저에서 Google 서버로 네트워크를 통해 전송", "메일을 보낼 때 네트워크를 통해 전송"],
              ["이전받는 자", <>Google LLC, 연락처 이메일: <a className="underline" href="mailto:googlekrsupport@google.com">googlekrsupport@google.com</a></>, "왼쪽과 같습니다."],
              ["이용 목적", "광고 게재, 광고 개인 최적화, 광고 효과 측정", "회사의 문의 메일 수신과 보관"],
              ["보유 및 이용 기간", "쿠키: NID는 마지막 사용 후 6개월, IDE·ID는 24개월(유럽 경제 지역, 스위스, 영국은 13개월), _gads는 13개월, DSID는 2주. 서버 로그의 광고 데이터는 Google이 정한 기간이 지나면 자동 삭제하거나 익명화한다고 안내합니다.", "회사가 메일을 삭제할 때까지"],
              ["거부 방법, 절차, 효과", <>가이드 페이지를 열지 않거나 <a className="underline" href="#behavioral">11항</a>의 방법으로 차단합니다. 카드 작성과 PDF 생성에는 영향이 없습니다.</>, "메일을 보내지 않으면 전송되지 않습니다. 이 경우 메일을 통한 문의와 권리 행사를 할 수 없습니다."],
              ["출처", <><Ext href="https://policies.google.com/privacy?hl=ko">Google 개인정보처리방침</Ext>, <Ext href="https://policies.google.com/technologies/cookies?hl=ko">Google 쿠키 안내</Ext></>, <Ext key="source" href="https://policies.google.com/privacy?hl=ko">Google 개인정보처리방침</Ext>],
            ]}
          />
        </Section>

        <Section id="security">
          <p>회사는 {site.name}에 다음의 기술적 조치를 적용하고 있습니다.</p>
          <ul className="list-disc pl-5">
            <li>전송 구간 암호화: 사이트 접속에 HTTPS(TLS 1.2 이상)를 사용하고, HTTP 접속은 HTTPS로 옮깁니다.</li>
            <li>저장 최소화: 데이터베이스가 없으며, 카드 내용은 서버 메모리에서만 처리하고 PDF 응답은 저장되지 않도록(no-store) 보냅니다.</li>
            <li>해시 처리: 요청 횟수 제한에는 IP 주소 원문 대신 비밀키를 쓴 HMAC-SHA256 해시값을 사용합니다.</li>
            <li>악용 방지: IP당 PDF 생성 횟수를 제한하고, 요청 크기를 제한합니다.</li>
            <li>기록 최소화: 애플리케이션의 오류 기록에는 오류 종류의 이름만 남깁니다.</li>
            <li>광고 분리: 카드 작성 화면과 이 페이지에는 광고 스크립트를 불러오지 않습니다.</li>
            <li>브라우저 보호 설정: 콘텐츠 유형 추측 방지, 다른 사이트의 프레임 삽입 차단 응답 헤더를 보냅니다.</li>
          </ul>
          <p>서버는 네이버클라우드 인프라에서 운영합니다.</p>
        </Section>

        <Section id="cookies">
          <p>쿠키(cookie)는 웹사이트가 이용자의 브라우저로 보내 기기에 저장해 두는 소량의 정보로, 해당 웹사이트에 접속할 때 브라우저가 자동으로 다시 보냅니다.</p>
          <p>회사는 자체 쿠키를 설치하거나 운영하지 않으며, 행태정보를 직접 수집하지 않습니다. 가이드 페이지에는 <a className="underline" href="#behavioral">11항</a>의 Google 광고 쿠키가 사용됩니다. 차단 방법도 11항에 적었습니다.</p>
        </Section>

        <Section id="behavioral">
          <p>회사는 가이드 페이지(가이드 목록과 각 글)에서 Google이 광고 쿠키를 통해 행태정보를 수집하도록 허용합니다. 회사는 이 정보를 받지 않으며, 이를 이용해 개인을 식별하지 않습니다. 카드 작성 화면과 이 페이지에는 광고 스크립트를 불러오지 않습니다.</p>
          <Table
            head={["수집 장치 명칭", "종류", "수집해 가는 사업자", "수집해 가는 행태정보", "목적"]}
            rows={[
              ["Google AdSense 광고 스크립트(adsbygoogle.js)", "자바스크립트, 쿠키(웹페이지)", "Google LLC", "방문 중인 페이지의 URL, IP 주소, 광고 쿠키에 담긴 정보", "광고 게재, 광고 개인 최적화, 광고 효과 측정"],
            ]}
          />
          <p>회사는 이 사이트에서 Google의 수집에 대한 별도의 동의를 받지 않습니다. 원하지 않으면 아래 방법으로 차단하거나 가이드 페이지를 열지 않으면 됩니다. Google의 처리 내용은 <Ext href="https://policies.google.com/technologies/partner-sites?hl=ko">Google의 안내</Ext>에서 볼 수 있습니다.</p>
          <p><strong>임시 저장된 카드에 관한 안내.</strong> 가이드 페이지의 광고 스크립트는 같은 사이트에서 실행되므로, 기술적으로는 그 브라우저에 임시 저장된 카드에 접근할 수 있습니다. 회사가 카드 내용을 Google에 제공하지는 않습니다. 이를 원하지 않으면 가이드를 읽기 전에 &lsquo;새 카드&rsquo;로 임시 저장을 지워 주세요.</p>
          <p><strong>차단 방법</strong></p>
          <ul className="list-disc pl-5">
            <li><Ext href="https://adssettings.google.com/">Google 광고 설정</Ext>: 개인 맞춤 광고를 끕니다. Google은 쿠키를 차단하더라도 이 설정을 끄지 않으면 다른 기술로 광고를 맞춤 설정할 수 있다고 안내합니다.</li>
            <li>크롬(PC): 오른쪽 상단 &lsquo;⋮&rsquo; &gt; 설정 &gt; 개인정보 보호 및 보안 &gt; 서드파티 쿠키 &gt; 서드파티 쿠키 차단</li>
            <li>엣지(PC): 오른쪽 상단 &lsquo;···&rsquo; &gt; 설정 &gt; 개인 정보, 검색 및 서비스 &gt; 추적 방지 수준 선택(균형 조정 또는 엄격)</li>
            <li>크롬(안드로이드): 오른쪽 상단 &lsquo;⋮&rsquo; &gt; 설정 &gt; 사이트 설정 &gt; 서드파티 쿠키 &gt; 서드파티 쿠키 차단</li>
            <li>사파리(아이폰): 기기 설정 &gt; 앱 &gt; Safari &gt; 고급 &gt; 모든 쿠키 차단</li>
            <li>삼성 인터넷: 하단 &lsquo;≡&rsquo; &gt; 개인정보 &gt; 개인정보 보호 현황 &gt; 스마트 추적 방지 &gt; 엄격</li>
          </ul>
          <p>브라우저 버전에 따라 메뉴 이름이 다를 수 있습니다. 쿠키를 차단해도 카드 작성과 PDF 생성은 이용할 수 있습니다. 다만 사이트 데이터까지 차단하거나 지우면 임시 저장된 카드가 저장되지 않거나 지워질 수 있습니다. 행태정보에 관한 문의와 거부권 행사, 피해 신고는 <Email />로 할 수 있습니다.</p>
        </Section>

        <Section id="rights">
          <ol className="list-decimal pl-5 space-y-1">
            <li>정보주체는 회사에 언제든지 개인정보 열람, 정정, 삭제, 처리정지를 요구할 수 있습니다(이하 &lsquo;권리 행사&rsquo;). 14세 미만 아동의 권리 행사는 법정대리인이 직접 해야 하며, 14세 이상 미성년자는 본인이 직접 하거나 법정대리인을 통해 할 수 있습니다.</li>
            <li>권리 행사는 아래 연락처로 메일을 보내는 방법으로 할 수 있습니다. 메일에 요청 내용을 적어 주세요. 별도의 양식은 필요하지 않습니다. <Email /></li>
            <li>법정대리인이나 위임을 받은 대리인을 통해 권리를 행사할 수도 있습니다. 이 경우 「개인정보 처리 방법에 관한 고시」 별지 제11호 서식의 위임장을 내야 합니다.</li>
            <li>회사는 권리 행사를 한 사람이 본인이거나 정당한 대리인인지 확인합니다. 계정이 없으므로, 접속 기록을 찾으려면 접속한 IP 주소와 시각을 알려 주셔야 할 수 있습니다.</li>
            <li>회사는 요청을 받은 날부터 10일 이내에 회신합니다.</li>
            <li>열람과 처리정지 요구는 「개인정보 보호법」 제35조제4항과 제37조제2항에 따라 제한될 수 있고, 다른 법령에서 수집 대상으로 명시한 개인정보는 삭제를 요구할 수 없습니다.</li>
            <li>계정이 없고 카드 내용을 저장하지 않으므로, 회사가 조회하거나 삭제할 수 있는 정보는 접속 기록과 문의 메일입니다. 메모리의 해시값은 최대 1시간 안에 자동으로 지워지며, 브라우저의 임시 저장본은 이용자가 직접 지웁니다(&lsquo;새 카드&rsquo; 또는 브라우저 데이터 삭제).</li>
            <li>회사는 「개인정보 보호법」 제35조의2의 전송요구 대상 정보를 처리하지 않습니다.</li>
          </ol>
        </Section>

        <Section id="officer">
          <p>회사는 개인정보 처리 업무를 총괄하고 정보주체의 불만 처리와 피해 구제를 맡도록 다음과 같이 개인정보 보호책임자를 두고 있습니다. 개인정보 보호 업무와 고충 처리, 권리 행사 접수도 같은 연락처에서 맡습니다.</p>
          <ul className="list-disc pl-5">
            <li>개인정보 보호책임자: {o.privacyOfficer}</li>
            <li><Email /></li>
            <li>상호: {o.company} ({o.companyEn})</li>
            <li>사업자등록번호: {o.businessNumber}</li>
            <li>소재지: {o.location}</li>
          </ul>
          <p>{site.name}를 이용하면서 생긴 개인정보 관련 문의, 불만, 피해 구제 요청은 위 연락처로 보내 주세요. 지체 없이 답변하고 처리합니다.</p>
        </Section>

        <Section id="remedies">
          <p>회사를 통한 피해 구제가 원만하게 이루어지지 않으면, 아래 기관에 분쟁 해결이나 상담을 신청할 수 있습니다.</p>
          <ul className="list-disc pl-5">
            <li>개인정보 분쟁조정위원회: (국번 없이) 1833-6972, <Ext href="https://www.kopico.go.kr">www.kopico.go.kr</Ext></li>
            <li>개인정보침해 신고센터: (국번 없이) 118, <Ext href="https://privacy.kisa.or.kr/main.do">privacy.kisa.or.kr</Ext></li>
            <li>경찰청: (국번 없이) 182, <Ext href="https://ecrm.police.go.kr/minwon/main">ecrm.police.go.kr</Ext></li>
          </ul>
        </Section>

        <Section id="not-applicable">
          <p>회사는 {site.name}에서 다음을 처리하거나 운영하지 않습니다.</p>
          <ul className="list-disc pl-5">
            <li>동의 없는 추가적인 이용·제공이 지속적으로 발생하는 처리</li>
            <li>서비스 과정에서 공개되는 민감정보(카드는 공개되지 않습니다)</li>
            <li>「개인정보 보호법」 제28조의2에 따른 가명정보 처리</li>
            <li>완전히 자동화된 시스템으로 개인정보를 처리해 이루어지는 결정(「개인정보 보호법」 제37조의2)</li>
            <li>국외에서 국내 정보주체의 개인정보를 직접 수집하는 처리, 국내대리인 지정(회사는 국내 사업자입니다)</li>
            <li>이 서비스와 관련한 고정형·이동형 영상정보처리기기</li>
          </ul>
        </Section>

        <Section id="changes">
          <p>이 개인정보 처리방침은 2026년 10월 31일부터 적용합니다. 처리하는 항목이나 목적이 바뀌면 시행 전 또는 시행 즉시 변경 전후를 비교할 수 있도록 이 페이지에 안내합니다.</p>
          <p><strong>이번 변경의 주요 내용</strong></p>
          <ul className="list-disc pl-5">
            <li>문의 메일(이메일 주소, 메일 내용)을 처리 항목에 추가했습니다.</li>
            <li>웹 서버 접속 기록은 일수가 아니라 용량 기준으로 보유한다는 사실을 적었습니다.</li>
            <li>Cloudflare와 Google의 국외 이전 내용을 국가, 시기와 방법, 이전받는 자, 보유 기간, 거부 방법으로 나누어 적었습니다.</li>
            <li>각 항목의 법적 근거, 정보주체의 권리 행사 방법, 분쟁조정 기관을 추가했습니다.</li>
          </ul>
          <details className="mt-2">
            <summary className="cursor-pointer underline">이전 개인정보 처리방침 보기 (2026년 10월 31일 게시, 이 방침 적용 전까지 적용)</summary>
            <PreviousPolicy />
          </details>
          <p>이 방침의 내용에 관한 문의는 <Email />로 보내 주세요.</p>
        </Section>
      </article>
    </main>
  );
}
