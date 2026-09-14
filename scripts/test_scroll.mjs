import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

  // Scroll down to Video Showcase
  await page.evaluate(() => window.scrollBy(0, 1000));
  await new Promise(r => setTimeout(r, 500));

  const scrollBefore = await page.evaluate(() => window.scrollY);
  console.log('Scroll before expand:', scrollBefore);

  // Find expandable section button (e.g. AI Prompts or NEW SECTION)
  const buttons = await page.$$('button[aria-expanded]');
  console.log('Found expandable buttons count:', buttons.length);

  if (buttons.length > 0) {
    // Click the first expandable button
    await buttons[0].click();
    await new Promise(r => setTimeout(r, 500));

    const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
    const htmlOverflow = await page.evaluate(() => document.documentElement.style.overflow);
    const bodyComputedOverflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
    const htmlComputedOverflow = await page.evaluate(() => getComputedStyle(document.documentElement).overflow);

    console.log('After expand:');
    console.log('  document.body.style.overflow:', bodyOverflow);
    console.log('  document.documentElement.style.overflow:', htmlOverflow);
    console.log('  body computed overflow:', bodyComputedOverflow);
    console.log('  html computed overflow:', htmlComputedOverflow);

    // Check activeElement and its style
    const activeElemTag = await page.evaluate(() => document.activeElement?.tagName);
    console.log('  Active element tag:', activeElemTag);

    // Try scrolling with wheel
    await page.mouse.wheel({ deltaY: 300 });
    await new Promise(r => setTimeout(r, 500));

    const scrollAfterWheel = await page.evaluate(() => window.scrollY);
    console.log('Scroll after wheel down:', scrollAfterWheel);

    // Try scrolling with ArrowDown key
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await new Promise(r => setTimeout(r, 500));

    const scrollAfterKey = await page.evaluate(() => window.scrollY);
    console.log('Scroll after ArrowDown:', scrollAfterKey);
  }

  await browser.close();
})();
