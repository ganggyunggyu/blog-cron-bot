import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the Korean onboarding and download page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /lang="ko"/);
  assert.match(html, /노출지기 \| 버튼 한 번으로 끝내는 노출체크/);
  assert.match(html, /복잡한 노출체크를/);
  assert.match(html, /루트 더보기 노출체크/);
  assert.match(html, /macOS용 다운로드/);
  assert.match(html, /Windows용 다운로드/);
  assert.match(html, /원본 시트는 읽기 전용/);
  assert.match(html, /IP 위장·우회 기능 없음/);
  assert.match(html, /blog-cron-bot-production\.up\.railway\.app/);
});
