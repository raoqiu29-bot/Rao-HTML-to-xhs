/**
 * 把 F风格-完整9张-定稿.html 渲染成 9 张 1242×1656 PNG
 * 用本机 Chrome,不下载 Chromium
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const HTML_PATH = path.resolve(__dirname, '../示范-AI给我的第一版总差口气/F风格-完整9张-定稿.html');
const OUT_DIR = path.resolve(__dirname, '../示范-AI给我的第一版总差口气/导出');

const NAMES = [
  '封面',
  '结论',
  '误区',
  '关键判断',
  '完整提示词',
  '改前vs改后',
  '金句',
  '适用场景',
  'CTA',
];

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('启动 Chrome…');
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
    // 隐藏所有装饰
    const header = document.querySelector('header.page-head');
    if (header) header.style.display = 'none';
    document.querySelectorAll('.slide-label').forEach(el => el.style.display = 'none');

    // 移除 .slide-wrap 的尺寸/裁剪限制(原来是 522×696 + overflow hidden)
    document.querySelectorAll('.slide-wrap').forEach(w => {
      w.style.width = '1242px';
      w.style.height = '1656px';
      w.style.overflow = 'visible';
      w.style.boxShadow = 'none';
      w.style.border = 'none';
      w.style.margin = '0';
    });

    // 移除 .slide 的 transform scale,显示原始尺寸
    document.querySelectorAll('.slide').forEach(s => {
      s.style.transform = 'none';
    });

    // 调整 stage 间距,避免渲染时图与图重叠
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
  console.log(`发现 ${slides.length} 张图,开始渲染…\n`);

  for (let i = 0; i < slides.length; i++) {
    const num = String(i + 1).padStart(2, '0');
    const name = NAMES[i] || `slide${num}`;
    const filename = `${num}-${name}.png`;
    const outPath = path.join(OUT_DIR, filename);

    // 滚动到该元素并截图
    await slides[i].scrollIntoView();
    await new Promise(r => setTimeout(r, 200));
    await slides[i].screenshot({ path: outPath, omitBackground: false });

    const stat = fs.statSync(outPath);
    console.log(`✓ ${filename}  (${(stat.size / 1024).toFixed(0)} KB)`);
  }

  await browser.close();
  console.log(`\n全部 ${slides.length} 张已导出到:\n${OUT_DIR}`);
})().catch(err => {
  console.error('渲染失败:', err);
  process.exit(1);
});
