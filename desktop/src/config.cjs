'use strict';

const DEFAULT_DASHBOARD_URL =
  'https://blog-cron-bot-production.up.railway.app';

function isLoopback(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function readDashboardUrl(environment = process.env) {
  const candidate = environment.NOCHULJIGI_DASHBOARD_URL?.trim() || DEFAULT_DASHBOARD_URL;
  let dashboardUrl;

  try {
    dashboardUrl = new URL(candidate);
  } catch {
    throw new Error('NOCHULJIGI_DASHBOARD_URL은 올바른 URL이어야 합니다.');
  }

  const hasSafeProtocol = dashboardUrl.protocol === 'https:';
  const isLocalDevelopment = dashboardUrl.protocol === 'http:' && isLoopback(dashboardUrl.hostname);
  if (!hasSafeProtocol && !isLocalDevelopment) {
    throw new Error('제어판 주소는 HTTPS를 사용해야 합니다. 로컬 개발 주소만 HTTP를 허용합니다.');
  }

  dashboardUrl.hash = '';
  return dashboardUrl;
}

module.exports = {
  DEFAULT_DASHBOARD_URL,
  readDashboardUrl,
};
