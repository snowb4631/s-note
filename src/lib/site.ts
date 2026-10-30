// 잠정 결정 값을 한 곳에 모은다. 미확정 값은 지어내지 않는다.
export const UNCONFIRMED = "[확인 필요]";

export const site = {
  name: "스노트",
  url: "https://snote.stock-snow.com",
  description: "손글씨 느낌의 매매일지 카드를 로그인 없이 작성하고 PDF나 이메일로 받는 도구",
  operator: {
    company: "주식회사 스노우볼",
    representative: UNCONFIRMED,
    privacyOfficer: UNCONFIRMED,
    email: UNCONFIRMED,
    address: UNCONFIRMED,
    phone: UNCONFIRMED,
  },
  disclaimer: "스노트는 매매 기록 도구이며 투자 권유가 아닙니다.",
} as const;
