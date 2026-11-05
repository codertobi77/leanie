const { chromium } = require('/home/tobi/wondertours_web_site/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  const email = `qa-target-${Date.now()}@example.com`;
  await page.goto('https://leanie.vercel.app/#settings', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill('TestPassword123!');
  await page.getByRole('button', { name: 'Sign up' }).click();
  await page.waitForTimeout(4000);
  await page.getByRole('button', { name: /New Project/ }).click();
  await page.waitForTimeout(1000);
  await page.getByPlaceholder('e.g. Validate a new service concept').fill('Targeted QA');
  await page.getByPlaceholder('What decision, problem, or opportunity should the Council examine?').fill('Test drag cycles filters pdf replay');
  await page.getByPlaceholder('What has led to this point? What evidence or uncertainty already exists?').fill('Automated targeted QA.');
  await page.getByPlaceholder('What would a useful result make possible?').fill('Evidence.');
  await page.getByText('Continue').first().click();
  await page.waitForTimeout(500);
  await page.getByText('Continue').first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Analyze my project/ }).click();
  await page.waitForURL('**/#results', { timeout: 60000 });
  await page.getByRole('button', { name: 'Open project plan' }).click();
  await page.waitForURL('**/#plan', { timeout: 15000 });
  await page.waitForTimeout(1500);
  // record order
  const before = await page.locator('.task-title').evaluateAll(els => els.map(e=>e.value));
  console.log('TASK BEFORE:', before);
  const rows = page.locator('.task-row');
  await rows.nth(0).dragTo(rows.nth(1));
  await page.waitForTimeout(1000);
  const after = await page.locator('.task-title').evaluateAll(els => els.map(e=>e.value));
  console.log('TASK AFTER :', after);
  if (before[0] !== after[1]) throw new Error('drag did not change task order');

  // dependency cycle test: open first two tasks and set circular dependency
  await rows.nth(0).locator('button[aria-label="Expand task"], .icon-button').last().click().catch(()=>{});
  // ensure task details open by clicking a chevron
  await rows.nth(0).locator('button').filter({ hasText: '' }).nth(3).click().catch(async () => {
    await rows.nth(0).locator('img').first().click().catch(()=>{});
  });
  await page.waitForTimeout(300);
  const depFields = page.locator('input[aria-label="Task dependency"]');
  const depCount = await depFields.count();
  console.log('dependency fields:', depCount);
  if (depCount >= 2) {
    await depFields.nth(0).fill(before[1]);
    await depFields.nth(0).blur();
    await page.waitForTimeout(300);
    await depFields.nth(1).fill(before[0]);
    await depFields.nth(1).blur();
    await page.waitForTimeout(500);
    const dep0 = await depFields.nth(0).inputValue();
    const dep1 = await depFields.nth(1).inputValue();
    console.log('dep0', dep0, 'dep1', dep1);
    if (dep0 === before[1] && dep1 === before[0]) throw new Error('dependency cycle was accepted');
    console.log('dependency cycle rejected (input did not persist both)');
  }
  await page.screenshot({ path:'/tmp/qa-targeted.png', fullPage:true });
  // isolated replay
  const stepResp = await page.evaluate(async () => {
    const token = window.localStorage.getItem('neon-auth-token');
    return token ? 'token present, but invocation is triggered by UI' : 'no token in localStorage';
  });
  console.log('auth storage note:', stepResp);
  const board = page.locator('select[aria-label="Council step selector"]');
  await board.selectOption('strategic');
  await page.getByRole('button', { name: 'Replay selected step' }).click();
  await page.waitForTimeout(2500);
  console.log('isolated replay clicked');
  await page.screenshot({ path:'/tmp/qa-targeted-replay.png', fullPage:true });
  // PDF
  await page.getByText('Export').first().click();
  await page.waitForTimeout(300);
  await page.getByText('PDF report').click();
  await page.waitForTimeout(1000);
  const frame = page.frameLocator('iframe');
  const pdfTitle = (await frame.locator('h1').textContent().catch(()=> ''));
  console.log('PDF iframe h1:', JSON.stringify(pdfTitle));
  if (!pdfTitle || pdfTitle.trim() === '' || pdfTitle === 'about:blank') throw new Error('PDF is blank');
  await page.screenshot({ path:'/tmp/qa-targeted-pdf.png', fullPage:true });

  // filters
  await page.getByRole('button', { name: /My Projects/ }).click();
  await page.waitForTimeout(1000);
  await page.locator('select[aria-label="Sort projects"]').selectOption('updated-desc');
  await page.locator('input[aria-label="Search projects"]').fill('Targeted QA');
  await page.waitForTimeout(500);
  const afterSearch = await page.locator('article.group').count();
  console.log('cards after search:', afterSearch);
  if (afterSearch !== 1) throw new Error('status/search filter unexpected');
  await page.locator('select[aria-label="Filter by status"]').selectOption('Plan ready');
  await page.waitForTimeout(300);
  const afterStatus = await page.locator('article.group').count();
  console.log('cards after status filter:', afterStatus);
  if (afterStatus !== 1) throw new Error('status filter unexpected');
  await page.locator('input[aria-label="Filter by tag"]').fill('prototype');
  await page.waitForTimeout(300);
  const afterTag = await page.locator('article.group').count();
  console.log('cards after tag filter:', afterTag);
  await page.screenshot({ path:'/tmp/qa-targeted-filter.png', fullPage:true });
  console.log('TARGETED QA DONE');
  await browser.close();
})().catch(err => { console.error('TARGETED QA FAIL', err); process.exit(1); });