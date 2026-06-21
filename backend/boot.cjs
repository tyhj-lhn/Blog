// ═════════════════════════════════════════════════════════════
//  CJS Boot Wrapper — PM2 fork mode + ESM 兼容桥梁
// ═════════════════════════════════════════════════════════════
//  问题: PM2 7.x fork 模式不能直接运行 "type": "module" 的 .js 文件。
//  解决: 此 .cjs 文件通过动态 import() 加载 ESM 入口并调用 startServer()。
//  原理: 动态 import() 在任何模块系统中都能正常解析 ESM 模块图。
// ═════════════════════════════════════════════════════════════
(async () => {
  try {
    const mod = await import('./dist/index.js');
    if (typeof mod.startServer === 'function') {
      await mod.startServer();
    } else {
      //  fallback: 旧版没有 startServer 导出，依赖 isMain 自身逻辑
      console.error('startServer() not exported from dist/index.js — did you rebuild?');
      process.exit(1);
    }
  } catch (err) {
    console.error('BOOT FAILED:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
