// 운영 주체와 서비스 값을 한 곳에 모은다. 회사 사이트에 공개된 값만 적는다.
export const site = {
  name: "스노트",
  url: "https://snote.stock-snow.com",
  description: "손글씨 느낌의 매매일지 카드를 로그인 없이 작성하고 PDF로 받는 도구",
  operator: {
    company: "주식회사 스노우볼",
    companyEn: "snowball Co., Ltd.",
    businessNumber: "270-81-03788",
    location: "경기도 화성시",
    email: "snowb4631@gmail.com",
    privacyOfficer: "대표이사",
  },
  disclaimer: "스노트는 매매 기록 도구이며 투자 권유가 아닙니다.",
} as const;
