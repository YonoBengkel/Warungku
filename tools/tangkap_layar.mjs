// Tangkap layar halaman lewat Chrome DevTools Protocol, ukuran layar presisi.
// Dipakai untuk gambar laporan (docs/laporan/diagram.py dan tangkapan layar aplikasi).
// Pakai: node tools/tangkap_layar.mjs <daftar.json> <folder-keluaran>
// Butuh Google Chrome (jalurnya bisa diganti lewat variabel CHROME) dan Node 22+.
// daftar.json: [{ "nama": "beranda-hp", "url": "http://...", "lebar": 390, "tinggi": 844, "hp": true,
//                 "penuh": false, "tunggu": 1500, "skrip": "opsional JS dijalankan sebelum tangkap" }]
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const [daftarBerkas, keluar] = process.argv.slice(2)
const daftar = JSON.parse(readFileSync(daftarBerkas, 'utf8'))
mkdirSync(keluar, { recursive: true })
const profil = join(tmpdir(), 'cdp-profil-' + process.pid)
const PORT = 9333
const chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profil}`,
  '--hide-scrollbars', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--force-color-profile=srgb', 'about:blank',
], { stdio: 'ignore' })

const tidur = (ms) => new Promise((r) => setTimeout(r, ms))
let target
for (let i = 0; i < 50; i++) {
  try {
    const t = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
    target = t.find((x) => x.type === 'page')
    if (target) break
  } catch {}
  await tidur(200)
}
if (!target) { console.error('Chrome tidak siap'); process.exit(1) }

const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
let id = 0
const tunggu = new Map()
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && tunggu.has(m.id)) { tunggu.get(m.id)(m); tunggu.delete(m.id) }
})
const kirim = (method, params = {}) => new Promise((r) => { const i = ++id; tunggu.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })

await kirim('Page.enable')
await kirim('Runtime.enable')
for (const h of daftar) {
  await kirim('Emulation.setDeviceMetricsOverride', {
    width: h.lebar, height: h.tinggi, deviceScaleFactor: h.skala || 2, mobile: !!h.hp,
  })
  await kirim('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: h.gelap ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] })
  await kirim('Page.navigate', { url: h.url })
  await tidur(h.tunggu || 1800)
  if (h.skrip) {
    await kirim('Runtime.evaluate', { expression: h.skrip, awaitPromise: true })
    await tidur(h.tungguSkrip || 800)
  }
  const p = { format: 'png', captureBeyondViewport: !!h.penuh }
  if (h.penuh) {
    const m = await kirim('Page.getLayoutMetrics')
    const tinggi = Math.min(Math.ceil(m.result.cssContentSize.height), h.batasTinggi || 4000)
    p.clip = { x: 0, y: 0, width: h.lebar, height: tinggi, scale: 1 }
  }
  const r = await kirim('Page.captureScreenshot', p)
  writeFileSync(join(keluar, h.nama + '.png'), Buffer.from(r.result.data, 'base64'))
  console.log('ok', h.nama)
}
ws.close()
chrome.kill()
await tidur(500)
try { rmSync(profil, { recursive: true, force: true }) } catch {}
