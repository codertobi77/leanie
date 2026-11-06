const { chromium } = require('/home/tobi/wondertours_web_site/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  pageA.on('console', m => { if (m.text().includes('shared persist') || m.text().includes('Plan poll') || m.text().includes('Plan polling')) console.log('A', m.text()); });
  pageA.on('request', req => { if (req.url().includes('share.compute') && req.method()==='GET') console.log('A REQ GET remote token', req.url().split('token=')[1]); });
  pageA.on('requestfailed', r=>console.log('A FAIL', r.url(), r.failure()?.errorText));
  const emailA = `ca-${Date.now()}@example.com`;
  const emailB = `cb-${Date.now()}@example.com`;
  await pageA.goto('https://leanie.vercel.app/#settings', {waitUntil:'domcontentloaded'});
  await pageA.waitForTimeout(4000);
  await pageA.getByPlaceholder('Email').fill(emailA);
  await pageA.getByPlaceholder('Password').fill('TestPassword123!');
  await pageA.getByRole('button',{name:'Sign up'}).click();
  await pageA.waitForTimeout(7000);
  await pageA.getByRole('button',{name:/New Project/}).click();
  await pageA.waitForTimeout(1500);
  await pageA.getByPlaceholder('e.g. Validate a new service concept').fill('Collab E2E Project');
  await pageA.getByPlaceholder('What decision, problem, or opportunity should the Council examine?').fill('Verify two account collaborative editing end to end reliably.');
  await pageA.getByPlaceholder('What has led to this point? What evidence or uncertainty already exists?').fill('Automated two account E2E verification.');
  await pageA.getByPlaceholder('What would a useful result make possible?').fill('Evidence for P3 completion and collaboration.');
  await pageA.locator('form button[type="submit"]').click();
  await pageA.waitForTimeout(1500);
  await pageA.locator('form button[type="submit"]').click();
  await pageA.waitForTimeout(1500);
  await pageA.locator('button', { hasText:'Analyze' }).first().click();
  await pageA.waitForURL('**/#results', {timeout:180000});
  await pageA.getByRole('button', {name:'Open project plan'}).click();
  await pageA.waitForURL('**/#plan',{timeout:20000});
  await pageA.waitForTimeout(4000);
  await pageA.locator('.title-input').first().fill('Account A initial title');
  await pageA.waitForTimeout(3000);
  await pageA.getByRole('button',{name:'Create share link'}).click();
  await pageA.waitForTimeout(6000);
  const bodyText = await pageA.locator('body').innerText();
  const shareMatch = bodyText.match(/https?:\/\/[^\s]*#shared\/[0-9a-f-]+/i);
  if(!shareMatch) throw new Error('No share link found');
  const shareUrl = shareMatch[0];
  console.log('SHARE URL', shareUrl);
  const pageB = await browser.newPage();
  pageB.on('console', m => console.log('B CONSOLE', m.text()));
  pageB.on('requestfailed', req => { if (req.url().endsWith('.share.compute.c-8.us-east-2.aws.neon.tech') || req.url().includes('share.compute')) console.log('B REQUEST FAILED', req.method(), req.url(), req.failure()?.errorText); });
  await pageB.goto(shareUrl,{waitUntil:'domcontentloaded'});
  await pageB.waitForTimeout(12000);
  const bBefore = await pageB.locator('.title-input').first().inputValue();
  console.log('B before edit:', bBefore);
  const token = shareUrl.split('#shared/')[1];
  const putPromise = pageB.evaluate(async (t) => {
    // instrumentation not needed; let UI trigger
  }, token);
  await pageB.locator('.title-input').first().fill('Account B collaboration edit');
  await pageB.waitForTimeout(500);
  await pageB.locator('body').click({position:{x:1,y:1}}); // blur
  await pageB.waitForTimeout(8000);
  for(let i=0;i<12;i++){
    await pageA.waitForTimeout(4000);
    const t=await pageA.locator('.title-input').first().inputValue();
    console.log('A poll', i+1, t);
    if (t==='Account B collaboration edit') break;
  }
  const aFinal=await pageA.locator('.title-input').first().inputValue();
  console.log('A final:', aFinal);
  if (aFinal !== 'Account B collaboration edit') throw new Error('A did not see B update');
  console.log('COLLAB TITLE PASS');
  await browser.close();
})().catch(err=>{console.error('COLLAB FAIL', err && err.message ? err.message : err); process.exit(1);});