const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

// URL de produção do Vamboh — troque pelo domínio real antes de gerar o
// instalador (ex: https://vamboo.vercel.app). Pra testar localmente contra
// `npm run dev`, rode com VAMBOO_DESKTOP_URL=http://localhost:3000.
const APP_URL = process.env.VAMBOO_DESKTOP_URL || 'https://REPLACE_WITH_PRODUCTION_URL';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'Vamboh',
    backgroundColor: '#f4f2ee',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL(APP_URL);

  // Links que abririam uma nova aba (convite por e-mail, Google Maps nos
  // lugares para visitar, etc.) abrem no navegador padrão do Windows, não
  // numa segunda janela do app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
