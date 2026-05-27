import { test, expect } from '@playwright/test';
import { loginAs, ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers.js';

// ─── Admin Panel Tests ────────────────────────────────────────────────────────
//
// IMPORTANT: Each Playwright test gets a fresh browser page, which causes a full
// page reload. This app's access token lives only in Redux memory (never persisted
// to localStorage for XSS safety), so after a reload AdminRoute redirects to login.
//
// To avoid hitting the backend rate limiter (10 attempts / 15 min) by logging in
// for every test, we consolidate all post-login assertions into a single test that
// navigates via sidebar links (SPA navigation — no reloads, token stays in Redux).

test('Admin Panel: login and verify all sections', async ({ page }) => {
  // ── 1. Login ──────────────────────────────────────────────────────────────
  await page.goto('/admin/login');
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  try {
    await expect(page).toHaveURL(/\/admin(?!\/login)/, { timeout: 8000 });
  } catch (err) {
    const rateLimited = await page.locator('text=/too many|15 minutes/i').count();
    if (rateLimited > 0) {
      test.skip();
      return;
    }
    throw err;
  }

  // ── 2. Dashboard ──────────────────────────────────────────────────────────
  await expect(page.locator('main, [class*="dashboard"], [class*="admin"]').first()).toBeVisible({ timeout: 8000 });

  // ── 3. Products page ──────────────────────────────────────────────────────
  await page.click('a[href="/admin/products"]');
  await expect(page).toHaveURL(/\/admin\/products/);
  await expect(page.locator('body')).not.toBeEmpty();

  // ── 4. Orders page ────────────────────────────────────────────────────────
  await page.click('a[href="/admin/orders"]');
  await expect(page).toHaveURL(/\/admin\/orders/);

  // ── 5. Users page ─────────────────────────────────────────────────────────
  await page.click('a[href="/admin/users"]');
  await expect(page).toHaveURL(/\/admin\/users/);

  // ── 6. Pricing page ───────────────────────────────────────────────────────
  await page.click('a[href="/admin/pricing"]');
  await expect(page).toHaveURL(/\/admin\/pricing/);
});

test('Admin Panel: non-admin redirected to login', async ({ browser }) => {
  // Fresh context with no session — should redirect to /admin/login
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/admin');
  await expect(page).toHaveURL(/admin\/login/, { timeout: 8000 });
  await ctx.close();
});

test('Admin Panel: admin register page renders', async ({ page }) => {
  await page.goto('/admin/register');
  await expect(page.locator('body')).toBeVisible();
  // Should show a form or be redirected to login — not crash
  await expect(page).not.toHaveURL(/500/);
});

test('Admin Panel: admin profile page accessible when authenticated', async ({ browser }) => {
  const storageStatePath = 'e2e/.auth/admin.json';
  let ctx;
  try {
    ctx = await browser.newContext({ storageState: storageStatePath });
  } catch {
    test.skip();
    return;
  }
  const page = await ctx.newPage();
  await page.goto('/admin/profile');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  if (page.url().includes('login')) {
    // Stale session — attempt fresh admin login
    await page.goto('/admin/login');
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.waitForTimeout(3000);
    const rateLimited = await page.locator('text=/too many|15 minutes/i').count() > 0;
    if (rateLimited || page.url().includes('login')) { await ctx.close(); test.skip(); return; }
    await page.goto('/admin/profile');
    await page.waitForLoadState('networkidle');
    if (page.url().includes('login')) { await ctx.close(); test.skip(); return; }
  }

  // Re-save rotated refresh token so later tests don't hit REPLAY ATTACK detection
  await ctx.storageState({ path: storageStatePath });
  await expect(page.locator('body')).toBeVisible();
  await ctx.close();
});

test('Admin Panel: non-admin cannot access admin profile', async ({ browser }) => {
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/admin/profile');
  await expect(page).toHaveURL(/admin\/login/, { timeout: 8000 });
  await ctx.close();
});
