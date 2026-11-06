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
  await page.getByPlaceholder('What decision, problem, or opportunity should the Council examine?').fill('P3 verification.');
  await page.getByPlaceholder('What has led to this point? What evidence or uncertainty already exists?').fill('Automated multi-account test.');
  await page.getByPlaceholder('What would a useful result make possible?').fill('Evidence for P3 completion.');
  await page.locator('form button[type="submit"]').click();
  await page.waitForTimeout(1000);
  await page.locator('form button[type="submit"]').click();
  await page.waitForTimeout(1000);
  await page.locator('button', { hasText: 'Analyze' }).first().click();
  console.log('submitted');
  await page.waitForURL('**/#council', { timeout: 30000 });
  console.log('council', page.url());
  await page.waitForURL('**/#results', { timeout: 120000 });
  console.log('results', page.url());
  await page.getByRole('button', { name: 'Open project plan' }).click();
  await page.waitForURL('**/#plan', { timeout: 20000 });
  await page.waitForTimeout(2000);
  console.log('plan', page.url());
  // immediate presence of share button (auth check)
  const shareBtn = page.getByRole('button', { name: 'Create share link' });
  console.log('share button count', await shareBtn.count());
  if (await shareBtn.count() === 0) throw new Error('share button missing: user not authenticated');
  // export JSON
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    (async () => { await page.getByText('Export').first().click(); await page.waitForTimeout(300); await page.getByText('Export JSON').click(); })()
  ]);
  const downloadPath = await download.path();
  console.log('downloaded', download.suggestedFilename());
  // create share link
  await page.getByRole('button', { name: 'Create share link' }).click();
  await page.waitForTimeout(2000);
  const pageText = await page.locator('body').innerText();
  const match = pageText.match(/https?:\/\/[^\s]*#shared\/[0-9a-f-]+/i);
  if (!match) throw new Error('share link not found');
  const shareUrl = match[0];
  console.log('share url', shareUrl);
  // version restore
  const titleInput = page.locator('.title-input').first();
  const beforeRestore = await titleInput.inputValue();
  await titleInput.fill('Version candidate title');
  await page.waitForTimeout(1000);
  const firstVersionButton = page.locator('button', { hasText: /\d{4}/ }).first();
  if (await firstVersionButton.count()) {
    await firstVersionButton.click();
    await page.waitForTimeout(1000);
    const restored = await titleInput.inputValue();
    console.log('before restore:', beforeRestore, 'after:', restored);
    if (restored === 'Version candidate title') throw new Error('version restore stayed on latest');
  } else {
    console.log('no version button found');
  }
  // offline flush
  await context.setOffline(true);
  await page.locator('.title-input').first().fill('Offline queued title');
  await page.waitForTimeout(500);
  await context.setOffline(false);
  await page.waitForTimeout(8000);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const reloaded = await page.locator('.title-input').first().inputValue();
  console.log('reloaded title', reloaded);
  if (!reloaded.includes('Offline queued title')) throw new Error('offline sync did not flush: ' + reloaded);
  // account B share
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await pageB.goto(shareUrl, { waitUntil: 'domcontentloaded' });
  await pageB.waitForTimeout(6000);
  const sharedText = await pageB.locator('body').innerText();
  if (!sharedText.includes('P3 QA project')) throw new Error('shared plan did not open');
  console.log('shared account loaded', pageB.url());
  // import JSON
  await page.goto('https://leanie.vercel.app/#projects', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.locator('input[type="file"]').setInputFiles(downloadPath);
  await page.waitForTimeout(4000);
  const projectsText = await page.locator('body').innerText();
  if (!projectsText.includes('p3 qa project')) throw new Error('import flow did not create a project');
  console.log('import ok');
  console.log('P3 FULL DONE');
  await browser.close();
})().catch(err => { console.error('P3 FAIL', err); process.exit(1); });