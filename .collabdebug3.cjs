const { chromium } = require('/home/tobi/wondertours_web_site/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', m => console.log('CONSOLE', m.text()));
  const runUrl='https://leanie.vercel.app/#shared/32fbb674-7c46-4030-86e9-18e59a065e65';
  await page.goto(runUrl, {waitUntil:'domcontentloaded'});
  await new Promise(r=>setTimeout(r,20000));
  console.log('URL', page.url());
  await browser.close();
})();
JS: null