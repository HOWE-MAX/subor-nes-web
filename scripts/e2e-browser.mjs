/**
 * 浏览器端到端回归测试（真实内核 + 真实浏览器）
 *
 * 覆盖 Node 冒烟测试碰不到的一层：浏览器自动播放策略。
 * 曾经的真实缺陷——AudioContext 被策略拦下后 resume() 永久 pending，
 * 把 setPowered() 卡死，导致「插了卡带却永远没画面」。
 * 这个脚本用「无用户手势点击」复现那个场景，是防回归的关键用例。
 *
 * 用法：
 *   1. 先起开发服务器： npm run dev
 *   2. 另开一个终端启动带远程调试的浏览器：
 *      msedge --headless=new --remote-debugging-port=9333 --user-data-dir=<临时目录> about:blank
 *   3. npm run e2e
 *
 * 环境变量：E2E_CDP（默认 http://127.0.0.1:9333）、E2E_URL（默认 http://127.0.0.1:5180/）
 */
const CDP = process.env.E2E_CDP || 'http://127.0.0.1:9333'
const PAGE_URL = process.env.E2E_URL || 'http://127.0.0.1:5180/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let seq = 0
function rpc(ws, method, params = {}) {
  const id = ++seq
  return new Promise((resolve, reject) => {
    const onMsg = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id !== id) return
      ws.removeEventListener('message', onMsg)
      if (msg.error) reject(new Error(`${method} -> ${JSON.stringify(msg.error)}`))
      else resolve(msg.result)
    }
    ws.addEventListener('message', onMsg)
    ws.send(JSON.stringify({ id, method, params }))
    setTimeout(() => reject(new Error('timeout ' + method)), 30000)
  })
}

const checks = []
const check = (name, ok, extra = '') => {
  checks.push([name, ok, extra])
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? '  ' + extra : ''}`)
}

async function main() {
  let targets
  try {
    targets = await (await fetch(CDP + '/json/list')).json()
  } catch {
    console.error(`连不上 CDP：${CDP}`)
    console.error('请先启动带 --remote-debugging-port 的浏览器（见文件头注释）。')
    process.exit(2)
  }
  const page = targets.find((t) => t.type === 'page')
  if (!page) throw new Error('没有可用的 page target')

  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.addEventListener('open', res)
    ws.addEventListener('error', rej)
  })

  const exceptions = []
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.method === 'Runtime.exceptionThrown') {
      exceptions.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text)
    }
  })

  await rpc(ws, 'Runtime.enable')
  await rpc(ws, 'Page.enable')
  await rpc(ws, 'Page.navigate', { url: PAGE_URL })
  await sleep(3000)

  const ev = async (expression) => {
    const r = await rpc(ws, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'evaluate failed')
    return r.result.value
  }

  const snapshot = () =>
    ev(`(() => {
      const c = document.getElementById('nes-screen')
      const d = c.getContext('2d').getImageData(0, 0, 256, 240).data
      let nonBlack = 0, hash = 0
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] || d[i + 1] || d[i + 2]) nonBlack++
        hash = (Math.imul(hash, 31) + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0
      }
      return {
        rom: document.querySelectorAll('.chip .v')[0]?.textContent,
        status: document.querySelector('.chip .label')?.textContent,
        fps: document.querySelectorAll('.chip .v')[2]?.textContent,
        standby: !!document.querySelector('.standby'),
        err: document.querySelector('.err')?.textContent || null,
        nonBlack, hash,
      }
    })()`)

  console.log('\n--- 1. 无用户手势点击内置卡带（关键回归用例）---')
  await ev(`document.querySelectorAll('.builtin-item')[0].click()`)
  await sleep(3500)
  const a = await snapshot()
  console.log('  状态:', JSON.stringify(a))
  check('卡带已装载', a.rom === 'lj65', `rom=${a.rom}`)
  check('状态为播放中', a.status === '播放中', `status=${a.status}`)
  check('待机画面已撤下', a.standby === false)
  check('画布有画面（非全黑）', a.nonBlack > 500, `nonBlack=${a.nonBlack}`)
  check('无错误提示', a.err === null, a.err || '')
  check('帧率正常', Number(a.fps) > 40, `fps=${a.fps}`)

  console.log('\n--- 2. 输入能改变画面（确认是活的，不是冻帧）---')
  for (let i = 0; i < 3; i++) {
    await rpc(ws, 'Input.dispatchKeyEvent', {
      type: 'rawKeyDown', code: 'Enter', key: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13,
    })
    await sleep(120)
    await rpc(ws, 'Input.dispatchKeyEvent', {
      type: 'keyUp', code: 'Enter', key: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13,
    })
    await sleep(600)
  }
  await sleep(1200)
  const b = await snapshot()
  console.log('  状态:', JSON.stringify({ nonBlack: b.nonBlack, hash: b.hash }))
  check('按 START 后画面发生变化', b.hash !== a.hash)
  check('画面仍在正常输出', b.nonBlack > 500, `nonBlack=${b.nonBlack}`)

  console.log('\n--- 3. 第二张内置卡带 + 复位 ---')
  await ev(`document.querySelectorAll('.builtin-item')[1].click()`)
  await sleep(3000)
  const c = await snapshot()
  check('Croom 可装载', c.rom === 'croom', `rom=${c.rom}`)
  check('Croom 有画面', c.nonBlack > 500, `nonBlack=${c.nonBlack}`)

  await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'RESET')?.click()`)
  await sleep(1800)
  const d = await snapshot()
  check('复位后仍在运行', d.status === '播放中' && d.nonBlack > 500, `status=${d.status} nonBlack=${d.nonBlack}`)

  check('无未捕获异常', exceptions.length === 0, exceptions.join(' | '))

  const failed = checks.filter(([, ok]) => !ok)
  console.log(failed.length ? `\n${failed.length} 项未通过 ✘` : '\n全部通过 ✔')
  ws.close()
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error('FAILED:', e.stack || e.message)
  process.exit(1)
})
