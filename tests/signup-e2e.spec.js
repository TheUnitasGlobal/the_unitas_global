const path = require('path');
const { test, expect } = require('@playwright/test');

const fileUrl = 'file://' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');

test('real Supabase signup creates auth.users row and trigger populates profiles', async ({ page }) => {
  const testEmail = `unitas.qa.${Date.now()}@gmail.com`;
  const testPassword = 'Test-Password-123!';

  const authNetworkCalls = [];
  page.on('response', async (res) => {
    if (res.url().includes('/auth/v1/signup')) {
      authNetworkCalls.push({ status: res.status(), body: await res.text().catch(() => '') });
    }
  });

  let dialogMessage = '';
  page.on('dialog', async (dialog) => {
    dialogMessage = dialog.message();
    await dialog.dismiss();
  });

  await page.goto(fileUrl);
  await page.click('#toggle-btn');

  await page.fill('#auth-email', testEmail);
  await page.fill('#auth-password', testPassword);
  await page.fill('#reg-firstname', 'Playwright');
  await page.fill('#reg-lastname', 'QA');
  await page.fill('#reg-phone', '+1 555 000 1234');
  await page.fill('#reg-nationality', 'Estonia');
  await page.selectOption('#reg-gender', 'Other');
  await page.fill('#reg-age', '30');
  await page.selectOption('#reg-blood', 'O');
  await page.fill('#reg-mbti', 'INTJ');

  // Scroll both terms boxes to the bottom to unlock the required checkboxes.
  await page.$eval('#scroll-box-1', (el) => { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll')); });
  await page.$eval('#scroll-box-2', (el) => { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll')); });
  await expect(page.locator('#check-terms')).toBeChecked();
  await expect(page.locator('#check-privacy')).toBeChecked();

  await page.click('#auth-btn');

  // Wait for either the "check your email" alert or a reload into the dashboard.
  await page.waitForTimeout(3000);

  console.log('TEST_EMAIL:', testEmail);
  console.log('DIALOG_MESSAGE:', dialogMessage);
  console.log('AUTH_NETWORK_CALLS:', JSON.stringify(authNetworkCalls, null, 2));
  console.log('AUTH_MSG_TEXT:', await page.locator('#auth-msg').innerText().catch(() => '(n/a - reloaded)'));
  console.log('DASHBOARD_VISIBLE:', await page.locator('#portal-dashboard').isVisible().catch(() => false));
  if (await page.locator('#portal-dashboard').isVisible().catch(() => false)) {
    console.log('DISP_NAME:', await page.locator('#disp-name').innerText());
    console.log('DISP_PHONE:', await page.locator('#disp-phone').innerText());
    console.log('DISP_NAT_GEN:', await page.locator('#disp-nat-gen').innerText());
    console.log('DISP_BIO:', await page.locator('#disp-bio').innerText());
  }

  expect(authNetworkCalls.length).toBeGreaterThan(0);
  expect(authNetworkCalls[0].status).toBeLessThan(400);
});
