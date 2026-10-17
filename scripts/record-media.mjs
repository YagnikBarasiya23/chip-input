import { chromium } from '@playwright/test';
import { mkdirSync, renameSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const BASE = 'http://localhost:5176/media/scene.html';
mkdirSync('media', { recursive: true });
rmSync('media/.tmp', { recursive: true, force: true });
const browser = await chromium.launch();

{
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, recordVideo: { dir: 'media/.tmp', size: { width: 960, height: 540 } } });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.waitForTimeout(700);
  await page.locator('.chip-input__input').click();
  await page.keyboard.type('design,', { delay: 90 });           await page.waitForTimeout(500);
  await page.keyboard.type('New York,', { delay: 90 });         await page.waitForTimeout(500);
  await page.keyboard.type('motion', { delay: 90 }); await page.keyboard.press('Enter'); await page.waitForTimeout(700);
  await page.keyboard.type('Design,', { delay: 90 });           await page.waitForTimeout(1200);   // duplicate swings the original
  await page.evaluate(() => {
    const dt = new DataTransfer(); dt.setData('text', 'research, prototype\nui\ncopy');
    document.querySelector('.chip-input__input').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(1500);
  await page.keyboard.press('Backspace'); await page.waitForTimeout(900);                           // pull "copy" back
  await page.keyboard.type('s'); await page.keyboard.press('Enter'); await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Remove prototype' }).click(); await page.waitForTimeout(1200);
  const vid = page.video();
  await ctx.close();
  renameSync(await vid.path(), 'media/.tmp/demo.webm');
}
for (const [w, h, out] of [[960, 540, 'media/poster.png'], [1200, 630, 'media/share.png']]) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
  await page.goto(BASE);
  await page.evaluate(() => window.chips.setValues(['design', 'New York', 'motion', 'research', 'ui', 'accessibility'], true));
  await page.waitForTimeout(500);
  await page.screenshot({ path: out });
}
await browser.close();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', 'media/.tmp/demo.webm', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', 'media/demo.mp4']);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', 'media/.tmp/demo.webm', '-vf', 'fps=15,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', 'media/demo.gif']);
rmSync('media/.tmp', { recursive: true, force: true });
console.log('media done');
