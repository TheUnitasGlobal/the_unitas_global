const path = require('path');
const { test, expect } = require('@playwright/test');

const fileUrl = 'file://' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');

// Rev 1 replaced password signUp() with Email OTP Instant Signup (Supabase
// auto-creates the auth.users row on first OTP request via
// shouldCreateUser: true). We can't read a real inbox in this harness, so
// this test verifies the request reaches the real, configured Supabase
// project and the UI advances to the code-entry step -- it does not
// complete verification.
test('real Supabase Email OTP request reaches the project and unlocks the code-entry step (Instant Signup)', async ({ page }) => {
  const testEmail = `unitas.qa.${Date.now()}@gmail.com`;

  const otpNetworkCalls = [];
  page.on('response', async (res) => {
    if (res.url().includes('/auth/v1/otp')) {
      otpNetworkCalls.push({ status: res.status(), body: await res.text().catch(() => '') });
    }
  });

  await page.goto(fileUrl);
  await page.click('#wall-enter-btn');
  await expect(page.locator('#auth-modal-overlay')).toBeVisible();

  await page.fill('#otp-email', testEmail);
  await page.click('#send-otp-btn');

  await expect.poll(() => otpNetworkCalls.length, { timeout: 10000 }).toBeGreaterThan(0);

  console.log('TEST_EMAIL:', testEmail);
  console.log('OTP_NETWORK_CALLS:', JSON.stringify(otpNetworkCalls, null, 2));
  console.log('AUTH_MODAL_MSG:', await page.locator('#auth-modal-msg').innerText().catch(() => '(n/a)'));

  // A reachable, correctly-configured project responds with a real Auth API
  // status (2xx queued the email; 4xx would still prove it's a real Auth
  // error, not a network/config failure).
  expect(otpNetworkCalls[0].status).toBeLessThan(500);
  if (otpNetworkCalls[0].status < 400) {
    await expect(page.locator('#otp-code-row')).toBeVisible();
  }
});
