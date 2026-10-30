"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

type Api = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: Api;
  }
}

/** Tokens are single use: bump resetKey after any send attempt to get a fresh one. */
export function Turnstile({ siteKey, onToken, resetKey }: { siteKey: string; onToken: (t: string) => void; resetKey: number }) {
  const el = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);

  const mount = useCallback(() => {
    if (!el.current || !window.turnstile || id.current) return;
    id.current = window.turnstile.render(el.current, {
      sitekey: siteKey,
      language: "ko",
      callback: (token: string) => {
        setFailed(false);
        onToken(token);
      },
      "expired-callback": () => onToken(""),
      "error-callback": () => {
        onToken("");
        setFailed(true);
      },
    });
  }, [siteKey, onToken]);

  useEffect(() => {
    mount();
    return () => {
      if (id.current) window.turnstile?.remove(id.current);
      id.current = null;
    };
  }, [mount]);

  useEffect(() => {
    if (resetKey > 0 && id.current) window.turnstile?.reset(id.current);
  }, [resetKey]);

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={mount} onError={() => setFailed(true)} />
      <div ref={el} data-testid="turnstile" />
      {failed && (
        <p className="text-sm text-danger" role="alert" data-testid="turnstile-error">
          봇 확인을 불러오지 못해 메일을 보낼 수 없어요. 네트워크와 광고 차단 확장 프로그램을 확인한 뒤 새로고침해 주세요. PDF 다운로드는 카드 화면에서 그대로 쓸 수 있어요.
        </p>
      )}
    </>
  );
}
