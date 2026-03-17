import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const extensionPath = path.join(process.cwd(), 'dist');

(async () => {
  console.log('Launching browser with extension...');
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  try {
    console.log('Waiting for service worker to map extension ID...');
    let [background] = browser.serviceWorkers();
    if (!background) {
      background = await browser.waitForEvent('serviceworker');
    }
    const extensionId = background.url().split('/')[2];
    console.log(`Extension ID: ${extensionId}`);

    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
    const url = `chrome-extension://${extensionId}/src/sidepanel/index.html`;
    console.log(`Navigating to ${url}...`);
    await page.goto(url);

    // Give it a moment to hydrate
    await page.waitForTimeout(1000);

    console.log('Opening settings menu...');
    await page.click('[aria-label="Open sidebar settings"]');
    
    console.log('Clicking Import from Arc...');
    await page.click('text="Import from Arc"');

    console.log('Setting file input...');
    const importFilePath = path.resolve('Arc Browser Bookmarks.html');
    await page.setInputFiles('input[type="file"]', importFilePath);

    console.log('Waiting for preview step...');
    // We expect text "Import Preview"
    await page.waitForSelector('text="Import Preview"', { timeout: 10000 });
    await page.screenshot({ path: 'step1-preview.png' });
    const html = await page.evaluate(() => document.body.innerHTML);
    fs.writeFileSync('output.html', html);

    console.log('Clicking Import...');
    await page.click('button:text-is("Import")');

    console.log('Waiting for Import Complete...');
    await page.waitForSelector('text="Import Complete"', { timeout: 10000 });
    await page.screenshot({ path: 'step2-complete.png' });

    console.log('Clicking Done...');
    await page.click('button:has-text("Done")');
    await page.waitForTimeout(1000);

    // Take screenshot of the result
    await page.screenshot({ path: 'step3-final.png' });

    const spaceTabs = await page.$$('button[role="tab"]');
    for (let i = 0; i < spaceTabs.length; i++) {
        const label = await spaceTabs[i].innerText();
        console.log(`Clicking space tab ${i} (${label})...`);
        await spaceTabs[i].click();
        await page.waitForTimeout(1000);
        
        // Take a screenshot of each space
        await page.screenshot({ path: `space-${i}-${label.toLowerCase()}.png` });
        const spaceHtml = await page.evaluate(() => document.body.innerHTML);
        fs.writeFileSync(`output-space-${i}.html`, spaceHtml);
    }

    console.log('Import test finished successfully.');

  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    console.log('Closing browser...');
    await browser.close();
  }
})();
