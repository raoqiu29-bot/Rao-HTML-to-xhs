/**
 * 把 9 张 HTML 卡片渲染成 1242×1656 PNG(retina 2x → 2484×3312)
 * 用本机 Chrome,不下载 Chromium
 *
 * 用法:
 *   node render.js                                  # 默认 HTML + 全部 9 张
 *   node render.js --html <path> --out <dir>        # 自定义路径
 *   node render.js --page 5                         # 只重渲染第 5 张
 *   node render.js --page 3,5,7                     # 多张选择性重渲染
 *   node render.js --page 5 --html <path> --out <dir>
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

// ============== CLI 参数解析(轻量,无依赖) ==============
function parseArgs(argv) {
  const args = { html: null, out: null, pages: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if ((a === '--html' || a === '-i') && argv[i + 1]) { args.html = argv[++i]; }
    else if ((a === '--out' || a === '-o') && argv[i + 1]) { args.out = argv[++i]; }
    else if ((a === '--page' || a === '--pages' || a === '-p') && argv[i + 1]) {
      args.pages = argv[++i].split(',').map(s => parseInt(s.trim(), 10)).filter(n => n >= 1 && n <= 9);
    }
    else if (a === '--help' || a === '-h') {
      console.log(`
用法:
  node render.js                                  # 默认 HTML + 全部 9 张
  node render.js --html <path> --out <dir>        # 自定义路径
  node render.js --page 5                         # 只重渲染第 5 张
  node render.js --page 3,5,7                     # 多张选择性重渲染
  node render.js -p 5 -i <path> -o <dir>          # 短参数

参数:
  --html, -i   HTML 源文件路径(默认: ../示范-AI给我的第一版总差口气/F风格-完整9张-定稿.html)
  --out,  -o   PNG 输出目录(默认: ../示范-AI给我的第一版总差口气/导出)
  --page, -p   只渲染指定页(1-9,逗号分隔多页)
  --help, -h   显示本帮助
`.trim());
      process.exit(0);
    }
  }
  return args;
}

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const NAMES = [
  '封面', '结论', '误区', '关键判断', '完整提示词',
  '改前vs改后', '金句', '适用场景', 'CTA',
];

const cli = parseArgs(process.argv);
const HTML_PATH = cli.html
  ? path.resolve(cli.html)
  : path.resolve(__dirname, '../示范-AI给我的第一版总差口气/F风格-完整9张-定稿.html');
const OUT_DIR = cli.out
  ? path.resolve(cli.out)
  : path.resolve(__dirname, '../示范-AI给我的第一版总差口气/导出');

// 决定要渲染哪些页(默认全部 1-9)
const TARGET_PAGES = cli.pages && cli.pages.length > 0
  ? cli.pages
  : [1, 2, 3, 4, 5, 6, 7, 8, 9];

(async () => {
  if (!fs.existsSync(HTML_PATH)) {
    console.error(`❌ HTML 文件不存在: ${HTML_PATH}`);
    process.exit(1);
  }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const mode = TARGET_PAGES.length === 9 ? '全部 9 张' : `指定页 [${TARGET_PAGES.join(', ')}]`;
  console.log(`启动 Chrome… 模式: ${mode}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    defaultViewport: null,
  });

  const page = await browser.newPage();
  await page.setViewport({
    width: 1300,
    height: 1700,
    deviceScaleFactor: 2,  // retina 质量,输出实际 2484×3312
  });

  console.log(`加载 HTML: ${HTML_PATH}`);
  await page.goto(`file://${HTML_PATH}`, { waitUntil: 'networkidle0', timeout: 60000 });

  // 等字体全部加载
  console.log('等待字体加载…');
  await page.evaluateHandle('document.fonts.ready');
  await new Promise(r => setTimeout(r, 2000));

  // 解除所有预览限制,让 .slide 以真实 1242×1656 尺寸独立渲染
  await page.evaluate(() => {
    const header = document.querySelector('header.page-head');
    if (header) header.style.display = 'none';
    document.querySelectorAll('.slide-label').forEach(el => el.style.display = 'none');

    document.querySelectorAll('.slide-wrap').forEach(w => {
      w.style.width = '1242px';
      w.style.height = '1656px';
      w.style.overflow = 'visible';
      w.style.boxShadow = 'none';
      w.style.border = 'none';
      w.style.margin = '0';
    });

    document.querySelectorAll('.slide').forEach(s => {
      s.style.transform = 'none';
    });

    const stage = document.querySelector('.stage');
    if (stage) {
      stage.style.gap = '60px';
      stage.style.padding = '20px 0';
    }

    document.body.style.background = '#fff';
  });

  // 等一帧渲染
  await new Promise(r => setTimeout(r, 500));

  const slides = await page.$$('.slide');
  console.log(`HTML 含 ${slides.length} 张,本次渲染 ${TARGET_PAGES.length} 张:\n`);

  let rendered = 0;
  for (const pageNum of TARGET_PAGES) {
    const i = pageNum - 1;
    if (i >= slides.length) {
      console.warn(`⚠️  第 ${pageNum} 张超出 HTML 范围(共 ${slides.length} 张),跳过`);
      continue;
    }
    const num = String(pageNum).padStart(2, '0');
    const name = NAMES[i] || `slide${num}`;
    const filename = `${num}-${name}.png`;
    const outPath = path.join(OUT_DIR, filename);

    await slides[i].scrollIntoView();
    await new Promise(r => setTimeout(r, 200));
    await slides[i].screenshot({ path: outPath, omitBackground: false });

    const stat = fs.statSync(outPath);
    console.log(`✓ ${filename}  (${(stat.size / 1024).toFixed(0)} KB)`);
    rendered++;
  }

  await browser.close();
  console.log(`\n完成 ${rendered}/${TARGET_PAGES.length} 张,输出到:\n${OUT_DIR}`);
})().catch(err => {
  console.error('❌ 渲染失败:', err);
  process.exit(1);
});
