# 小霸王 · Web 端 NES 模拟器

复古小霸王（红白机）风格的浏览器 NES / FC 模拟器。内核直接使用开源库
[jsnes](https://github.com/bfirsh/jsnes)，本项目负责模拟器调度、音频输出、
输入映射、存档持久化与整套复古 UI。

- 技术栈：**Vue 3 + Vite + TypeScript**
- 目标平台：**桌面端浏览器**（暂不适配移动端）
- 在线试玩地址：本地开发服务器 `http://127.0.0.1:5180`

---

## 快速开始

```bash
npm install
npm run dev        # 开发服务器，默认 http://127.0.0.1:5180
npm run build      # 类型检查 + 生产构建，产物在 dist/
npm run preview    # 预览生产构建
npm run smoke      # 内核联调冒烟测试（Node 环境，无需浏览器）
npm run e2e        # 浏览器端到端回归测试（需要 CDP，见下）
```

`npm run smoke` 覆盖内核层：ROM 装载、帧生成、音频回调、快照往返、复位。
但它跑在 Node 里，**碰不到浏览器特有的行为**（最典型的就是自动播放策略）。

`npm run e2e` 补上这一层：驱动真实浏览器点击内置卡带、读回画布像素、
注入键盘事件确认画面会响应。用法：

```bash
npm run dev                 # 终端 1
msedge --headless=new --remote-debugging-port=9333 \
       --user-data-dir=/tmp/nes-e2e about:blank      # 终端 2
npm run e2e                 # 终端 3
```

它的第一条用例就是「**无用户手势**点击卡带也必须出画面」——
这正是下面「音频绝不能挡住画面」那个缺陷的复现条件。

### 插入卡带

三种方式，任选其一：

1. 点击右侧「卡带插槽」里的 **插入卡带（选择 .nes 文件）**；
2. 把 `.nes` 文件直接**拖到屏幕或卡带槽**上；
3. 点击 **内置试玩卡带**（LJ65 / Concentration Room，自由软件，可立即开玩）。

载入过的卡带会自动进入「卡带架」，下次一键插卡。

> 本项目**不附带任何商业游戏 ROM**。请只载入你合法拥有的卡带转储文件。

---

## 功能一览

### 模拟器
- jsnes 内核（支持 Mapper 0/1/2/3/4/5/7/9/11/34/38/66/71/79/94/118/119/140/180/240/241）
- `requestAnimationFrame` 主循环 + 固定步长累加器，NTSC 60.0988 FPS
- **音频时钟校正**：以 Web Audio 缓冲水位反推补帧 / 丢帧，画面与声音不会互相拖累
- Web Audio 输出，1.5 秒环形缓冲，欠载时直流保持（不爆音）
- 快进 2/3/5/10 倍速，快进时自动静音
- 暂停 / 复位 / 弹出卡带

### 手柄与输入
- 键盘：每个按键支持 **两个键位**（主 / 副），全部可自定义
- 游戏手柄：标准 XInput 手柄即插即用，支持十字键与左摇杆、肩键快进
- 屏幕上的**虚拟手柄**可鼠标点按，并实时高亮当前按下的键

### 存档
- **5 个即时存档槽**，带画面缩略图，保存在浏览器 IndexedDB
- **快速存档 / 读档**：F5 / F8
- **记忆电池**：带电池记忆的卡带会自动续玩（每 15 秒 + 切后台 + 关页面时落盘）
- 卡带架：收藏载入过的 ROM，可单独移除

### 复古画面
- CRT 扫描线、球面暗角、荧光增艳，可逐项开关
- 4:3 电视比例 / 1:1 方像素切换
- 整数倍缩放开关（追求像素完全对齐时打开）
- 开关机电源动画、待机画面、暂停遮罩
- 一键截图，导出 3 倍放大的 PNG 到本地

---

## 按键说明

### 玩家 1（默认）

| 功能 | 主键位 | 副键位 |
| --- | --- | --- |
| 方向 | ↑ ↓ ← → | W A S D |
| A 键 | Z | J |
| B 键 | X | K |
| 连发 A | C | — |
| 连发 B | V | — |
| START | Enter | — |
| SELECT | 右 Shift | — |

### 玩家 2（默认）

方向 `I J K L`，A `N`，B `M`，连发 `,` `.`，START `1`，SELECT `2`。

### 全局快捷键

| 按键 | 作用 |
| --- | --- |
| `P` | 暂停 / 继续 |
| `M` | 静音开关 |
| `Tab` | 按住快进 |
| `F` | 全屏切换 |
| `F5` / `F8` | 快速存档 / 快速读档（槽位 5） |
| `Esc` | 退出全屏 |

所有键位都可以在右上角 **按键设置** 里重新绑定（左键重设、右键清除）。

---

## 目录结构

```
src/
├── App.vue                    主机外壳与整体布局
├── main.ts
├── core/                      与框架无关的模拟器内核层
│   ├── NesEmulator.ts         帧循环调度、ROM 装载、快照存取
│   ├── AudioEngine.ts         Web Audio 环形缓冲输出
│   ├── InputManager.ts        键盘 / 手柄 / 虚拟手柄 → NES 手柄
│   ├── rom.ts                 iNES / NES 2.0 卡带头解析、ROM 指纹
│   ├── storage.ts             IndexedDB + localStorage 持久化
│   └── constants.ts           按键映射、常量、快捷键表
├── composables/
│   ├── useConsole.ts          全局单例状态中枢（内核 + UI 的接线处）
│   └── useToast.ts
├── components/
│   ├── ScreenPanel.vue        CRT 屏幕、待机画面、拖拽插卡
│   ├── PowerDeck.vue          电源开关、指示灯、RESET
│   ├── CartridgeBay.vue       卡带插槽、内置卡带、卡带架
│   ├── PlayControls.vue       暂停 / 快进 / 音量 / 全屏 / 截图
│   ├── DisplaySettings.vue    画面与存档偏好
│   ├── SaveBay.vue            5 个即时存档槽
│   ├── VirtualPad.vue         虚拟手柄
│   ├── KeymapDialog.vue       按键设置弹窗
│   └── ToastStack.vue
└── styles/main.css            复古设计变量与通用控件样式

scripts/
├── smoke.mjs                  内核冒烟测试（Node）
└── e2e-browser.mjs            浏览器端到端回归测试（CDP 驱动）
```

`core/` 与 `composables/` 完全解耦于组件，方便换成 React / 原生实现。

---

## 实现备忘

### jsnes 2.x 的 `NES#reset()` 有坑

`reset()` 只重建 `cpu / ppu / papu` 与 mapper 实例，**不会调用 `mmap.loadROM()`**，
因此 CPU 的地址空间没有重新装载 PRG，下一帧就会抛
`Game crashed, invalid opcode`。

所以要复位时不要调 `nes.reset()`，改用 `nes.reloadROM()`
（内部是完整的 `loadROM` 流程）。本项目里对应 `NesEmulator.reset()`。

另外 `toJSON()` 不包含 `romData`，`fromJSON()` 内部也会调到这个有问题的
`reset()`，但随后 `cpu.fromJSON()` 会恢复完整内存镜像，所以读档是安全的。

### 音频绝不能挡住画面（曾经的「插卡无画面」）

浏览器自动播放策略下，未获得用户手势时 `new AudioContext()` 会停在
`suspended`，而且 **`ctx.resume()` 返回的 Promise 永远不会 settle**——
不是 reject，是永久 pending。

最初的 `setPowered()` 写成这样，顺序上把音频放在了开机必经路径上：

```ts
await audio.start()   // ← 被自动播放策略拦住，永久挂起
emulator.start()
```

只要这一句挂住，`startRom()` 就永远执行不到，于是表现为
**电源灯亮了、卡带也插上了，但屏幕一直是待机画面 / 全黑**。
在跨域 iframe 预览（没有 `allow="autoplay"`）里也踩同一个坑。

现在分三层防住：

1. `AudioEngine.start()` 保证「绝不抛错、绝不长时间挂起」：
   构造失败（部分声卡不接受强制采样率 → 回退设备默认值）一律静音降级，
   构造得起的异常一律吞掉。
2. `resume()` 用 `Promise.race` 加 350 ms 超时兜底，超时就放行，
   等用户真正产生手势后上下文会自然恢复。
3. `setPowered()` 里先启动模拟器与输入，音频挪到最后并且 **绝不 await**
   （`void startAudio()`）。

音频被拦下时会提示一次「点一下页面任意处即可恢复」，
但**画面完全不受影响**——静音也要能玩。

### 音频与画面如何对齐

jsnes 每模拟一帧回调约 734 个采样点（44.1 kHz / 60.0988 FPS）。
这些采样写进 1.5 秒的环形缓冲，由 `ScriptProcessorNode` 按音频时钟取走。
主循环用 `rAF` + 累加器推进模拟；当缓冲见底时多跑一帧、积压过多时少跑一帧，
让声音成为事实上的时基。

`ScriptProcessorNode` 虽已标记废弃但所有主流浏览器仍支持，且能直接共享主线程
环形缓冲（换成 AudioWorklet 需要跨线程传音频，收益不成正比）。

---

## 部署到 GitHub Pages

仓库内置了 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)，
推送到 `main` 分支即自动构建并发布到 GitHub Pages（项目站点）。

1. 在仓库 **Settings → Pages** 里把 Source 设为 **GitHub Actions**；
2. 把仓库推到 GitHub：`git push origin main`；
3. 等到 Actions 跑完，站点地址为 `https://<用户名>.github.io/<仓库名>/`。

要点：

- 工作流用 `--base=/<仓库名>/` 动态写入 Vite 的 `base`，
  保证资源在项目子路径下也能正确加载（无需手写仓库名）。
- 本地 `npm run dev / build` **不受影响**，`base` 只在 CI 构建时被覆盖。
- 单页应用、无路由，所以不配置 SPA fallback 也没问题；
  若日后加了 `vue-router`，记得在 `vite.config.ts` 里改用 `createWebHistory()`
  并在 Pages 侧处理 404 回退。

---

## 第三方与授权

| 组件 | 授权 |
| --- | --- |
| jsnes（模拟器内核） | MIT |
| 内置卡带 LJ65 | © 2009 Damian Yerrick · GPLv2+ |
| 内置卡带 Concentration Room | © 2010 Damian Yerrick · GPLv3+（附 iNES 二进制分发例外） |

内置卡带的完整授权文本见 [`public/roms/THIRD-PARTY.txt`](public/roms/THIRD-PARTY.txt)。

> Nintendo、Family Computer、Famicom、NES 均为任天堂株式会社的注册商标。
> 本项目与任天堂无任何关联，也未获得其授权或认可。
> 「小霸王」为相关权利人的商标，本项目仅以其作为视觉风格致敬，不代表任何关联或背书。
