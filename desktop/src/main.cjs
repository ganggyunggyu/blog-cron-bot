'use strict';

const { app, BrowserWindow, dialog, Menu, session } = require('electron');
const { readDashboardUrl } = require('./config.cjs');
const { hardenSession, hardenWebContents } = require('./security.cjs');

const APP_TITLE = '노출지기';
let mainWindow = null;

function createWindow(dashboardUrl) {
  const window = new BrowserWindow({
    title: APP_TITLE,
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    backgroundColor: '#f6f7fb',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged,
    },
  });

  hardenWebContents(window.webContents, dashboardUrl.origin);
  window.on('page-title-updated', (event) => {
    event.preventDefault();
    window.setTitle(APP_TITLE);
  });
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => {
    mainWindow = null;
  });

  window.loadURL(dashboardUrl.href).catch((error) => {
    dialog.showErrorBox(
      '제어판 연결 실패',
      `노출지기 제어판에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 실행해 주세요.\n\n${error.message}`,
    );
  });

  return window;
}

function focusOrCreateWindow(dashboardUrl) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    return;
  }
  mainWindow = createWindow(dashboardUrl);
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  let dashboardUrl;
  try {
    dashboardUrl = readDashboardUrl();
  } catch (error) {
    app.whenReady().then(() => {
      dialog.showErrorBox('설정 오류', error.message);
      app.quit();
    });
  }

  app.setName(APP_TITLE);
  app.setAppUserModelId('kr.co.21lab.nochuljigi');
  app.on('second-instance', () => {
    if (dashboardUrl) focusOrCreateWindow(dashboardUrl);
  });

  app.whenReady().then(() => {
    if (!dashboardUrl) return;
    Menu.setApplicationMenu(null);
    hardenSession(session.defaultSession);
    focusOrCreateWindow(dashboardUrl);

    app.on('activate', () => focusOrCreateWindow(dashboardUrl));
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
