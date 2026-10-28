const { app, BrowserWindow, Menu, session } = require("electron");
const path = require("node:path");
const gotLock = app.requestSingleInstanceLock();
let window;
if (!gotLock) app.quit();
else {
  app.on("second-instance", () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    session.defaultSession.setPermissionRequestHandler(
      (_webContents, _permission, callback) => callback(false),
    );
    window = new BrowserWindow({
      width: 1480,
      height: 980,
      minWidth: 860,
      minHeight: 640,
      backgroundColor: "#11151c",
      title: "Bar Estimate",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        devTools: !app.isPackaged,
      },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", (event) => event.preventDefault());
    window.loadFile(path.join(__dirname, "../dist/index.html"));
  });
  app.on("window-all-closed", () => app.quit());
}
