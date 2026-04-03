import { app, BrowserWindow } from 'electron';
import path from 'path';

// 开发模式检测
const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        title: '小鸣同学',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,
        },
        // macOS 样式
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 15, y: 15 },
    });

    // 加载应用
    if (isDev) {
        // 开发模式: 加载Vite开发服务器
        mainWindow.loadURL('http://localhost:5173');
        // 打开开发者工具
        mainWindow.webContents.openDevTools();
    } else {
        // 生产模式: 加载打包后的文件
        // 使用 app.getAppPath() 获取应用路径，在打包后指向 app.asar
        const appPath = app.getAppPath();
        const indexPath = path.join(appPath, 'dist', 'index.html');
        console.log('App path:', appPath);
        console.log('Loading index.html from:', indexPath);
        mainWindow.loadFile(indexPath);
    }

    // 窗口关闭事件
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// 应用准备就绪
app.whenReady().then(() => {
    createWindow();

    // macOS: 点击dock图标时重新创建窗口
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// 所有窗口关闭时退出应用 (macOS除外)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// 禁用硬件加速(可选,解决某些显卡兼容问题)
// app.disableHardwareAcceleration();
