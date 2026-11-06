const { chromium } = require('/home/tobi/wondertours_web_site/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  const email = `p3-${Date.now()}@example.com`;
  const password = 'TestPassword123!';
  console.log('email', email);
  await page.goto('https://leanie.vercel.app/#settings', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: 'Sign up' }).click();
  await page.waitForTimeout(5000);
  await page.getByRole('button', { name: /New Project/ }).click();
  await page.waitForTimeout(1000);
  await page.getByPlaceholder('e.g. Validate a new service concept').fill('P3 QA project');
  await page.getByPlaceholder('What decision, problem, or opportunity should the Council examine?').fill('P3 verifies editing filtering drag drop and PDF.');
  await page.getByPlaceholder('What has led to this point? What evidence or uncertainty already exists?').fill('Automated multi-account test.');
  await page.getByPlaceholder('What would a useful result make possible?').fill('Evidence for P3 completion.');
  await page.locator('form button[type="submit"]').click();
  await page.waitForTimeout(1000);
  await page.locator('form button[type="submit"]').click();
  await page.waitForTimeout(1000);
  await page.locator('button', { hasText: 'Analyze' }).first().click();
  await page.waitForURL('**/#council', { timeout: 30000 });
  await page.waitForURL('**/#results', { timeout: 120000 });
  await page.getByRole('button', { name: 'Open project plan' }).click();
  await page.waitForURL('**/#plan', { timeout: 20000 });
  await page.waitForTimeout(2000);
  const download = await (async () => {
    const [d] = await Promise.all([
      page.waitForEvent('download'),
      (async () => {
        await page.getByText('Export').first().click();
        await page.waitForTimeout(300);
        await page.getByText('Export JSON').click();
      })()
    ]);
    return d;
  })();
  console.log('downloaded file:', download.suggestedFilename(), await download.path());
  // share
  await page.getByRole('button', { name: 'Create share link' }).click();
  await page.waitForTimeout(2000);
  const pageText = await page.locator('body').innerText();
  const match = pageText.match(/https?:\/\/[^\s]*#shared\/[0-9a-f-]+/i);
  if (!match) throw new Error('share link not found');
  const shareUrl = match[0];
  console.log('SHARE URL:', shareUrl);
  // version restore before changing
  const titleInput = page.locator('.title-input').first();
  await titleInput.fill('Offline queued final');
  await page.waitForTimeout(1000);
  const firstVersionButton = page.locator('button', { hasText: /\d{4}/ }).first();
  if (await firstVersionButton.count()) {
    await firstVersionButton.click();
    await page.waitForTimeout(1000);
    const restoredTitle = await titleInput.inputValue();
    console.log('title after version restore:', restoredTitle);
  }
  // account B
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  pageB.setDefaultTimeout(60000);
  await pageB.goto(shareUrl, { waitUntil: 'domcontentloaded' });
  await pageB.waitForTimeout(6000);
  const sharedText = await pageB.locator('body').innerText();
  if (!sharedText.includes('P3 QA project')) throw new Error('shared plan did not open correctly');
  console.log('shared view loaded url:', pageB.url());
  // offline
  const context = page.context();
  await context.setOffline(true);
  await page.locator('.title-input').first().fill('Offline Title Queued');
  await page.waitForTimeout(300);
  await context.setOffline(false);
  console.log('offline write queued; waiting sync');
  await page.waitForTimeout(8000);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const reloadedTitle = await page.locator('.title-input').first().inputValue();
  console.log('title after offline sync reload:', reloadedTitle);
  if (!reloadedTitle.includes('Offline Title Queued')) throw new Error('offline sync did not flush: ' + reloadedTitle);
  // import downloaded file
  await page.goto('https://leanie.vercel.app/#projects', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.locator('input[type="file"]').setInputFiles(await download.path());
  await page.waitForTimeout(3000);
  const offlineTitle = `Offline queued final`;
  console.log('QA P3 DONE');
  await browser.close();
})().catch(err => { console.error('QA P3 FAIL', err); process.exit(1); });