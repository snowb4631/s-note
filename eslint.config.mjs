import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: [".next/**", "artifacts/**", "next-env.d.ts", "src/lib/card/metrics.generated.ts"] },
];
export default config;
