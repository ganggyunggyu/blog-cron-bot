'use strict';

function isAllowedNavigation(candidate, allowedOrigin) {
  try {
    const target = new URL(candidate);
    return target.origin === allowedOrigin;
  } catch {
    return false;
  }
}

function hardenSession(electronSession) {
  electronSession.setPermissionCheckHandler(() => false);
  electronSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
}

function hardenWebContents(webContents, allowedOrigin) {
  webContents.setWindowOpenHandler(({ url }) => ({
    action: isAllowedNavigation(url, allowedOrigin) ? 'allow' : 'deny',
    overrideBrowserWindowOptions: {
      show: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    },
  }));

  const blockExternalNavigation = (event, legacyUrl) => {
    const url = typeof legacyUrl === 'string' ? legacyUrl : event.url;
    if (!isAllowedNavigation(url, allowedOrigin)) {
      event.preventDefault();
    }
  };

  webContents.on('will-navigate', blockExternalNavigation);
  webContents.on('will-frame-navigate', blockExternalNavigation);
  webContents.on('will-redirect', blockExternalNavigation);
  webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
  webContents.on('did-create-window', (childWindow) => {
    hardenWebContents(childWindow.webContents, allowedOrigin);
  });
}

module.exports = {
  hardenSession,
  hardenWebContents,
  isAllowedNavigation,
};
