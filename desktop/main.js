const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

// Aponta pro Vamboh publicado. Pra testar contra o servidor local em vez
// disso (`npm run dev`/`npm run start` na raiz do projeto), defina
// VAMBOO_DESKTOP_URL=http://localhost:3000 antes de rodar/buildar.
const APP_URL = process.env.VAMBOO_DESKTOP_URL || 'https://vamboo.vercel.app';

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

  // Se o servidor não estiver acessível (ex: esqueceu de rodar `npm run
  // dev`/`npm run start` antes de abrir o app), mostra uma tela explicando
  // em vez de deixar a janela em branco — com um botão pra tentar de novo
  // sem precisar fechar e reabrir o app.
  win.webContents.on('did-fail-load', (_event, errorCode, _errorDescription, _validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return; // -3 = ERR_ABORTED (comum em navegação/redirect normal, não é falha de verdade)
    const html = `<!doctype html>
      <html><head><meta charset="utf-8"><title>Vamboh</title>
      <style>
        body { margin:0; height:100vh; display:flex; align-items:center; justify-content:center; background:#f4f2ee; font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif; }
        .card { max-width:420px; text-align:center; padding:32px; }
        h1 { font-size:20px; margin:0 0 12px; }
        p { color:#6b6f79; font-size:14px; line-height:1.5; margin:0 0 20px; }
        code { background:#eef0f4; padding:2px 6px; border-radius:6px; }
        button { background:#2f9be0; color:#fff; border:none; padding:10px 20px; border-radius:10px; font-weight:700; font-size:14px; cursor:pointer; }
      </style></head>
      <body>
        <div class="card">
          <h1>Não foi possível conectar ao Vamboh</h1>
          <p>Não consegui carregar <code>${APP_URL}</code>. Se esse é um endereço local, confirme que o servidor está rodando (<code>npm run dev</code> ou <code>npm run start</code> na raiz do projeto) e tente de novo.</p>
          <button onclick="location.reload()">Tentar novamente</button>
        </div>
      </body></html>`;
    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  });

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
