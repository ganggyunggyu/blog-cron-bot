'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  hardenSession,
  hardenWebContents,
  isAllowedNavigation,
} = require('../src/security.cjs');

test('설정된 제어판과 같은 출처의 경로만 허용한다', () => {
  const origin = 'https://dashboard.example.com';
  assert.equal(isAllowedNavigation(`${origin}/runs/1`, origin), true);
  assert.equal(isAllowedNavigation(`${origin}/api/files?name=result.csv`, origin), true);
});

test('외부 출처와 URL 형태가 아닌 주소는 차단한다', () => {
  const origin = 'https://dashboard.example.com';
  assert.equal(isAllowedNavigation('https://attacker.example.com', origin), false);
  assert.equal(isAllowedNavigation('javascript:alert(1)', origin), false);
  assert.equal(isAllowedNavigation('not-a-url', origin), false);
});

test('최신 Electron 탐색 이벤트에서도 외부 프레임 이동을 막는다', () => {
  const handlers = new Map();
  const contents = {
    setWindowOpenHandler() {},
    on(name, handler) {
      handlers.set(name, handler);
    },
  };
  hardenWebContents(contents, 'https://dashboard.example.com');

  let prevented = false;
  handlers.get('will-frame-navigate')({
    url: 'https://attacker.example.com/frame',
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
});

test('브라우저 권한 확인과 요청을 모두 거부한다', () => {
  let permissionCheckHandler;
  let permissionRequestHandler;
  hardenSession({
    setPermissionCheckHandler(handler) {
      permissionCheckHandler = handler;
    },
    setPermissionRequestHandler(handler) {
      permissionRequestHandler = handler;
    },
  });

  assert.equal(permissionCheckHandler(), false);
  permissionRequestHandler(null, 'camera', (allowed) => assert.equal(allowed, false));
});
