'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { DEFAULT_DASHBOARD_URL, readDashboardUrl } = require('../src/config.cjs');

test('기본 운영 제어판 주소를 사용한다', () => {
  assert.equal(readDashboardUrl({}).href, `${DEFAULT_DASHBOARD_URL}/`);
});

test('HTTPS 제어판 주소를 환경변수로 바꿀 수 있다', () => {
  assert.equal(
    readDashboardUrl({ NOCHULJIGI_DASHBOARD_URL: 'https://example.com/control#status' }).href,
    'https://example.com/control',
  );
});

test('로컬 개발을 제외한 HTTP 주소는 거부한다', () => {
  assert.throws(
    () => readDashboardUrl({ NOCHULJIGI_DASHBOARD_URL: 'http://example.com' }),
    /HTTPS/,
  );
  assert.equal(
    readDashboardUrl({ NOCHULJIGI_DASHBOARD_URL: 'http://localhost:4500' }).origin,
    'http://localhost:4500',
  );
});
