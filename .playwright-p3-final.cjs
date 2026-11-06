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
  await page.getByPlaceholder('What decision, problem, or opportunity should the Council examine?').fill('QA P3 verifies editing filtering drag drop and PDF.');
  await page.getByPlaceholder('What has led to this point? What evidence or uncertainty already exists?').fill('Automated multi-account test.');
  await page.getByPlaceholder('What would a useful result make possible?').fill('Evidence for P3 completion.');
  await page.getByText('Continue').first().click();
  await page.waitForTimeout(1000);
  await page.getByText('Continue').first().click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /Analyze my project/ }).click();
  console.log('submitted');
  await page.waitForURL('**/#council', { timeout: 30000 }).catch(() => {});
  console.log('council url', page.url());
  await page.waitForURL('**/#results', { timeout: 120000 });
  console.log('results', page.url());
  await page.getByRole('button', { name: 'Open project plan' }).click();
  await page.waitForURL('**/#plan', { timeout: 20000 });
  await page.waitForTimeout(2000);
  const titleInput = page.locator('.title-input').first();
  await titleInput.fill('Offline queued title');
  await page.waitForTimeout(1000);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    (async () => { await page.getByText('Export').first().click(); await page.waitForTimeout(300); await page.getByText('Export JSON').click(); })()
  ]);
  const downloadPath = await download.path();
  console.log('downloaded', download.suggestedFilename());
  // share
  await page.getByRole('button', { name: 'Create share link' }).click();
  await page.waitForTimeout(3000);
  const pageText = await page.locator('body').innerText();
  const shareMatch = pageText.match(/https?:\/\/[^\s]*#shared\/[0-9a-f-]+/i);
  console.log('after share screen text excerpt', pageText.slice(0, 200).replace(/\n/g,' '));
  if (shareMatch) console.log('SHARE URL', shareMatch[0]);
  else throw new Error('share link not found');
  const shareUrl = shareMatch[0];
  // version restore
  const firstVersionButton = page.locator('button', { hasText: /\d{4}/ }).first();
  if (await firstVersionButton.count()) {
    await page.locator('.title-input').first().fill('Version candidate title');
    await page.waitForTimeout(500);
    await firstVersionButton.click();
    await page.waitForTimeout(1000);
    const restoredTitle = await page.locator('.title-input').first().inputValue();
    console.log('title after restore:', restoredTitle);
    if (restoredTitle === 'Version candidate title') throw new Error('version restore did not apply');
  } else console.log('no version button found');
  // offline sync
  const ctx = page.context();
  await ctx.setOffline(true);
  await page.locator('.title-input').first().fill('Offline Title Queued');
  await page.waitForTimeout(500);
  await ctx.setOffline(false);
  await page.waitForTimeout(8000);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const reloadedTitle = await page.locator('.title-input').first().inputValue();
  console.log('title after offline reload:', reloadedTitle);
  if (!reloadedTitle.includes('Offline Title Queued')) throw new Error('offline sync did not flush: ' + reloadedTitle);
  // account B
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await pageB.goto(shareUrl, { waitUntil: 'domcontentloaded' });
  await pageB.waitForTimeout(6000);
  const sharedText = await pageB.locator('body').innerText();
  if (!sharedText.includes('P3 QA project')) throw new Error('shared plan did not open');
  console.log('shared account loaded:', pageB.url());
  // import
  await page.goto('https://leanie.vercel.app/#projects', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.locator('input[type="file"]').setInputFiles(downloadPath);
  await page.waitForTimeout(4000);
  const ptext = await page.locator('body').innerText();
  if (!ptext.toLowerCase().includes('p3 qa project')) throw new Error('import flow did not create a project');
  console.log('IMPORT OK');
  console.log('P3 FINAL DONE');
  await browser.close();
})().catch(err => { console.error('P3 FAIL', err); process.exit(1); });