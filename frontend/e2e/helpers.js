/**
 * Shared E2E helpers
 */

export const TEST_USER = {
  name: 'E2E Tester',
  email: `e2e_${Date.now()}@test.com`,
  password: 'Test@1234',
  mobile: '9876543210',
};

export const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'rajdeepbiswas272@gmail.com';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@1234';

/**
 * Wait for toast notification containing text
 */
export async function expectToast(page, text, timeout = 8000) {
  await page.waitForSelector(
    `text=${text}`,
    { timeout }
  );
}

/**
 * Fill and submit the login form, then wait for the network response.
 * Returns the response object so callers can inspect status if needed.
 */
export async function loginAs(page, email, password) {
  const emailInput = page.locator('input[type="email"], input[name="identifier"], input[placeholder*="email" i]').first();
  await emailInput.fill(email);
  await page.fill('input[type="password"]', password);

  const [response] = await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/auth/login') || resp.url().includes('/admin-auth/login'), { timeout: 10000 }).catch(() => null),
    page.locator('button[type="submit"]').first().click(),
  ]);
  return response;
}

/**
 * Navigate to login page and sign in
 */
export async function loginUser(page, email = TEST_USER.email, password = TEST_USER.password) {
  await page.goto('/login');
  await page.getByRole('tab', { name: /sign in/i }).click().catch(() => {});
  await loginAs(page, email, password);
}
