# 项目长期记忆 · demo1

## 是什么
复古小霸王风格的 Web 端 NES 模拟器。Vue 3 + Vite + TypeScript，NES 内核用开源库 **jsnes**（MIT）。
仅面向桌面浏览器。开发端口 5180。

## 目录约定
- `src/core/` —— 与框架完全解耦的内核层（模拟器调度、音频、输入、ROM 解析、存储）。
  改内核只动这里，不要往组件里塞逻辑。
- `src/composables/useConsole.ts` —— 全局单例状态中枢，是内核与 UI 唯一的接线处。
- `src/components/` —— 纯展示/交互组件，只从 `useConsole()` 取状态。
- `public/roms/` —— 内置自由软件试玩卡带。

## 必须遵守的技术约束
- **绝对不要调用 `nes.reset()`**。jsnes 2.x 的 `NES#reset()` 不执行 `mmap.loadROM()`，
  调用后下一帧必定抛 `Game crashed, invalid opcode`。复位统一走 `nes.reloadROM()`；
  `loadROM()` 内部已含完整 reset，之后也不要再手动 reset。
- 模拟器主循环速度由音频缓冲水位校正，`AudioEngine.bufferedSeconds` 是调节依据，
  改动主循环时不要破坏这个反馈。
- 存档 / 卡带库 / 记忆电池一律走 IndexedDB（`src/core/storage.ts`），
  设置与键位走 localStorage。浏览器可能禁用本地存储，所有调用都要能降级。
- **音频永远不能阻塞画面**。`AudioEngine.start()` / `suspend()` 必须
  「不抛错、不长时间挂起」：浏览器自动播放策略下 `ctx.resume()` 是永久 pending
  （不是 reject），一旦把 `await audio.start()` 放在启动模拟器之前，
  就会变成「电源灯亮、卡带插了，但永远没画面」。开机流程里对音频只允许
  发后不管（`void`），且 `resume()` 必须有超时兜底。

## 风格约定
- UI 是「复古小霸王」：米白塑料机身 + 面板红 `#a8202a` + 金色 `#d9a93b`，
  所有控件有立体按压感，屏幕带 CRT 扫描线/暗角。
- 通用控件样式（`.panel` / `.btn` / `.switch` / `.slider` / `.tag`）定义在
  `src/styles/main.css`，组件内不要重复造。

## 环境注意
- 这台机器装依赖必须加 `--registry=https://registry.npmmirror.com`，官方源会卡死。
- npm 可能漏装 esbuild / rollup 的 Windows 平台包，已用 `optionalDependencies` 兜底，
  删掉 package.json 里那两项会导致 vite 起不来。
- **截图/自动化要走 PowerShell 通道**：Bash 通道里无头 Edge 会被沙箱拦（CDP 端口返回 502），
  但 PowerShell 通道可以 `Start-Process` 启动 Edge，再用 Node 脚本通过
  `--remote-debugging-port` + CDP 驱动（截图、注入键鼠、读画布像素、抓 console 异常）。
  Edge 必须与探针脚本在同一条 PowerShell 命令内启动，否则父进程退出会回收子进程。
- 本机 GPU 进程会崩，`Page.captureScreenshot` 合成 canvas 层时有一道斜切伪影；
  判断页面本身有没有问题要看 `canvas.toDataURL()`，那个是干净的。
