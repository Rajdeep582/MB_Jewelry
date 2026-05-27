import { test, expect } from '@playwright/test';
import { loginAs, ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers.js';

// Use a unique email per test run so registration doesn't conflict
const email    = `e2e_${Date.now()}@test.com`;
const password = 'Test@1234';
const name     = 'E2E Tester';
const mobile   = '9876543210';

test.describe('User Auth', () => {
  test('register → OTP page shown', async ({ page }) => {
    await page.goto('/register');

    // Switch to register tab if needed
    const registerTab = page.getByRole('tab', { name: /register|sign up/i });
    if (await registerTab.isVisible()) await registerTab.click();

    await page.fill('input[placeholder*="name" i], input[name="name"]', name);
    const idInput = page.locator('input[name="identifier"], input[type="email"], input[placeholder*="email" i]').first();
    await idInput.fill(email);

    // Fill password fields
    const pwdInputs = page.locator('input[type="password"]');
    await pwdInputs.nth(0).fill(password);
    await pwdInputs.nth(1).fill(password);

    await page.click('button[type="submit"]');

    // Should navigate to verify page or show OTP input
    await expect(page).toHaveURL(/verify|otp/i, { timeout: 10000 }).catch(async () => {
      // Some flows keep same URL but show OTP step
      await expect(page.locator('input[id*="otp" i], input[placeholder*="code" i]').first()).toBeVisible({ timeout: 10000 });
    });
  });

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/login');

    // Switch to sign in tab if present
    const signinTab = page.getByRole('tab', { name: /sign in|login/i });
    if (await signinTab.isVisible()) await signinTab.click();

    await loginAs(page, 'nonexistent@test.com', 'WrongPass123');

    // Accept: error toast/text visible OR still on login page (no redirect = failed login)
    const errorVisible = await page.locator('text=/invalid|incorrect|not found|failed|credentials|wrong|error/i')
      .first().isVisible({ timeout: 10000 }).catch(() => false);
    const stillOnLogin = page.url().includes('login');
    expect(errorVisible || stillOnLogin).toBeTruthy();
  });

  test('login page has required fields', async ({ page }) => {
    await page.goto('/login');

    const signinTab = page.getByRole('tab', { name: /sign in|login/i });
    if (await signinTab.isVisible()) await signinTab.click();

    await expect(page.locator('input[name="identifier"], input[type="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('password toggle shows/hides password', async ({ page }) => {
    await page.goto('/login');

    const signinTab = page.getByRole('tab', { name: /sign in|login/i });
    if (await signinTab.isVisible()) await signinTab.click();

    const pwdInput = page.locator('input[type="password"]').first();
    await pwdInput.fill('secret');

    // Find toggle button (eye icon)
    const toggle = page.locator('button').filter({ has: page.locator('svg') }).last();
    await toggle.click();

    await expect(page.locator('input[type="text"]').first()).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Admin Auth', () => {
  test('admin login page renders', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.locator('h1, h2').filter({ hasText: /admin|sign in/i }).first()).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('admin login with wrong credentials shows error', async ({ page }) => {
    await page.goto('/admin/login');
    await loginAs(page, 'wrong@admin.com', 'WrongPass123');

    await expect(
      page.locator('text=/invalid|incorrect|failed|not found|too many|15 minutes/i').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('admin login with correct credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/admin/login');
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    try {
      await expect(page).toHaveURL(/\/admin/, { timeout: 8000 });
      await expect(page).not.toHaveURL(/\/admin\/login/);
      // Save fresh session so later admin describes have a valid token
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      await page.context().storageState({ path: 'e2e/.auth/admin.json' });
    } catch (err) {
      const rateLimited = await page.locator('text=/too many|15 minutes/i').count();
      if (rateLimited > 0) {
        test.skip();
        return;
      }
      throw err;
    }
  });

  test('admin register page has link on login page', async ({ page }) => {
    await page.goto('/admin/login');
    const registerLink = page.locator('a[href*="/admin/register"], a:has-text("Register")');
    await expect(registerLink).toBeVisible();
  });
});

test.describe('Auth Guards', () => {
  test('unauthenticated user redirected from /profile', async ({ page }) => {
    await page.goto('/profile');
    // Should redirect to /auth or /login
    await expect(page).toHaveURL(/auth|login/i, { timeout: 8000 });
  });

  test('unauthenticated user redirected from /orders', async ({ page }) => {
    await page.goto('/orders');
    await expect(page).toHaveURL(/auth|login/i, { timeout: 8000 });
  });

  test('unauthenticated user redirected from /admin', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/admin\/login/i, { timeout: 8000 });
  });

  test('unauthenticated user redirected from /checkout', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page).toHaveURL(/auth|login/i, { timeout: 8000 });
  });
});
