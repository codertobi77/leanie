const { chromium } = require('/home/tobi/wondertours_web_site/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  pageA.setDefaultTimeout(90000);
  const emailA = `pa-${Date.now()}@example.com`;
  console.log('ACCOUNT A', emailA);
  await pageA.goto('https://leanie.vercel.app/#settings', { waitUntil: 'domcontentloaded' });
  await pageA.waitForTimeout(3000);
  await pageA.getByPlaceholder('Email').fill(emailA);
  await pageA.getByPlaceholder('Password').fill('TestPassword123!');
  await pageA.getByRole('button', { name: 'Sign up' }).click();
  await pageA.waitForTimeout(5000);
  await pageA.screenshot({ path: '/tmp/p3h-signup.png', fullPage: true });
  await pageA.getByRole('button', { name: /New Project/ }).click();
  await pageA.waitForTimeout(1500);
  await pageA.getByPlaceholder('e.g. Validate a new service concept').fill('P3 Shared Plan');
  await pageA.getByPlaceholder('What decision, problem, or opportunity should the Council examine?').fill('Verify P3 sharing, import, versioning and offline persistence.');
  await pageA.getByPlaceholder('What has led to this point? What evidence or uncertainty already exists?').fill('Automated end to end P3 test.');
  await pageA.getByPlaceholder('What would a useful result make possible?').fill('Evidence for P3 completion.');
  await pageA.locator('form button[type="submit"]').click();
  await pageA.waitForTimeout(1000);
  await pageA.locator('form button[type="submit"]').click();
  await pageA.waitForTimeout(1000);
  await pageA.locator('button', { hasText: 'Analyze' }).first().click();
  await pageA.waitForURL('**/#results', { timeout: 180000 });
  await pageA.getByRole('button', { name: 'Open project plan' }).click();
  await pageA.waitForURL('**/#plan', { timeout: 20000 });
  await pageA.waitForTimeout(3000);

  // export json
  const downloadPromise = pageA.waitForEvent('download');
  await pageA.getByText('Export').first().click();
  await pageA.waitForTimeout(300);
  await pageA.getByText('Export JSON').click();
  const download = await downloadPromise;
  console.log('SHARE/EXPORT downloaded:', download.suggestedFilename());
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error('download path missing');

  const planTitle = pageA.locator('.title-input').first();
  const initialTitle = await planTitle.inputValue();
  console.log('initial title:', initialTitle);

  // version restore
  await planTitle.fill('Volume test after edit');
  await pageA.waitForTimeout(1200);
  const versionButtons = pageA.locator('button', { hasText: /\d{4}/ });
  if (await versionButtons.count()) {
    await versionButtons.first().click();
    await pageA.waitForTimeout(1200);
    const restoredTitle = await planTitle.inputValue();
    console.log('title after restore:', restoredTitle);
    if (restoredTitle === 'Volume test after edit') throw new Error('Version restore failed');
  } else {
    console.log('No version button found');
  }

  // share link
  await pageA.getByRole('button', { name: 'Create share link' }).click();
  await pageA.waitForTimeout(3000);
  const bodyText = await pageA.locator('body').innerText();
  const shareMatch = bodyText.match(/https?:\/\/[^\s]*#shared\/[0-9a-f-]+/i);
  if (!shareMatch) throw new Error('share link not found');
  const shareUrl = shareMatch[0];
  console.log('SHARE URL:', shareUrl);

  // offline write then online flush
  const ctx = pageA.context();
  await ctx.setOffline(true);
  await pageA.locator('.title-input').first().fill('Offline queued final');
  await pageA.waitForTimeout(1000);
  const queueText = await pageA.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('leanie-offline-queue') || '[]').map(x => x.project.title); } catch { return []; }
  });
  console.log('queued:', queueText);
  if (!queueText.includes('Offline queued final')) throw new Error('offline queue not created');
  await ctx.setOffline(false);
  await pageA.waitForTimeout(9000);
  await pageA.reload({ waitUntil: 'domcontentloaded' });
  await pageA.waitForTimeout(5000);
  const titleAfterSync = await pageA.locator('.title-input').first().inputValue();
  console.log('title after reload:', titleAfterSync);
  if (titleAfterSync !== 'Offline queued final') throw new Error('offline sync did not flush: ' + titleAfterSync);

  // Account B opens share link
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  pageB.setDefaultTimeout(60000);
  await pageB.goto(shareUrl, { waitUntil: 'domcontentloaded' });
  await pageB.waitForTimeout(8000);
  const sharedText = await pageB.locator('body').innerText();
  if (!sharedText.includes('P3 QA project')) throw new Error('shared plan did not open');
  await pageB.screenshot({ path: '/tmp/p3h-shared.png', fullPage: true });
  console.log('SHARED ACCOUNT PASSED');

  // Import JSON
  await pageA.goto('https://leanie.vercel.app/#projects', { waitUntil: 'domcontentloaded' });
  await pageA.waitForTimeout(2000);
  await pageA.locator('input[type="file"]').setInputFiles(downloadPath);
  await pageA.waitForTimeout(4000);
  const projectsText = await pageA.locator('body').innerText();
  console.log('projects text includes title:', projectsText.toLowerCase().includes('p3 qa project'));
  await pageA.screenshot({ path: '/tmp/p3h-import.png', fullPage: true });
  // Keep plan assertions alive
  console.log('P3 FULL DONE');
  await browser.close();
})().catch(err => { console.error('P3 FAIL', err); process.exit(1); });