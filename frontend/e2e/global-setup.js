import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_DIR   = resolve(__dirname, '.auth');
const BASE_URL   = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

const EMPTY_STATE = JSON.stringify({ cookies: [], origins: [] });

function ensureAuthDir() {
  if (!existsSync(AUTH_DIR)) mkdirSync(AUTH_DIR, { recursive: true });
}

function writeEmptyState(path) {
  writeFileSync(path, EMPTY_STATE);
}

/** Returns true if the state file has refresh cookie + mb_user in localStorage AND is fresh (< 12 min old) */
function hasValidState(path) {
  if (!existsSync(path)) return false;
  try {
    const state = JSON.parse(readFileSync(path, 'utf8'));
    // Must have at least one cookie (refresh token)
    if (!state.cookies?.length) return false;
    // Must have mb_user in localStorage (required for silentRefresh to fire)
    const hasMbUser = state.origins?.some(o =>
      o.localStorage?.some(s => s.name === 'mb_user')
    );
    if (!hasMbUser) return false;
    // Access token expires in 15m — reuse only if file is < 12 minutes old
    const ageMs = Date.now() - statSync(path).mtimeMs;
    return ageMs < 12 * 60 * 1000;
  } catch {
    return false;
  }
}

async function loginAndSave(browser, loginPath, email, password, statePath, opts = {}) {
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}${loginPath}`);
    await page.waitForLoadState('networkidle');

    if (!opts.adminPortal) {
      await page.getByRole('tab', { name: /sign in|login/i }).click().catch(() => {});
    }

    const emailInput = page
      .locator('input[type="email"], input[name="identifier"], input[placeholder*="email" i]')
      .first();
    await emailInput.fill(email);
    await page.fill('input[type="password"]', password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(4000);

    const url         = page.url();
    const isLoggedIn  = !url.includes('login') && !url.includes('auth');
    const rateLimited = (await page.locator('text=/too many|15 minutes/i').count()) > 0;

    if (isLoggedIn && !rateLimited) {
      await page.context().storageState({ path: statePath });
      console.log(`[setup] ✓ saved ${statePath}`);
    } else {
      writeEmptyState(statePath);
      console.warn(`[setup] ✗ login failed for ${email} (rate limited or wrong creds) — writing empty state`);
    }
  } catch (err) {
    writeEmptyState(statePath);
    console.warn(`[setup] ✗ error for ${email}:`, err.message);
  } finally {
    await page.close();
  }
}

export default async function globalSetup() {
  ensureAuthDir();

  const USER_EMAIL     = process.env.USER_EMAIL     || 'sitabiswas029@gmail.com';
  const USER_PASSWORD  = process.env.USER_PASSWORD  || 'Amiami@029';
  const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'rajdeepbiswas272@gmail.com';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@1234';
  const DP_EMAIL       = process.env.DP_EMAIL       || 'grandddummy029@gmail.com';
  const DP_PASSWORD    = process.env.DP_PASSWORD    || 'Gari@029';

  const userPath  = resolve(AUTH_DIR, 'user.json');
  const adminPath = resolve(AUTH_DIR, 'admin.json');
  const dpPath    = resolve(AUTH_DIR, 'dp.json');

  // Skip login if saved state already has tokens (avoids consuming rate limit)
  const skipUser  = hasValidState(userPath);
  const skipAdmin = hasValidState(adminPath);
  const skipDp    = hasValidState(dpPath);

  if (skipUser && skipAdmin && skipDp) {
    console.log('[setup] All auth states valid — skipping logins');
    return;
  }

  const browser = await chromium.launch();
  try {
    if (!skipUser) {
      await loginAndSave(browser, '/login', USER_EMAIL, USER_PASSWORD, userPath);
    } else {
      console.log('[setup] ✓ user state reused');
    }

    if (!skipAdmin) {
      await loginAndSave(browser, '/admin/login', ADMIN_EMAIL, ADMIN_PASSWORD, adminPath, { adminPortal: true });
    } else {
      console.log('[setup] ✓ admin state reused');
    }

    if (!skipDp) {
      let dpLoggedIn = false;
      for (const path of ['/delivery/login', '/dp/login', '/delivery']) {
        const page = await browser.newPage();
        try {
          await page.goto(`${BASE_URL}${path}`);
          await page.waitForTimeout(500);
          if ((await page.locator('input[type="password"]').count()) > 0) {
            const emailInput = page.locator('input[type="email"], input[name="identifier"], input[placeholder*="email" i]').first();
            await emailInput.fill(DP_EMAIL);
            await page.fill('input[type="password"]', DP_PASSWORD);
            await page.locator('button[type="submit"]').first().click();
            await page.waitForTimeout(4000);
            const url         = page.url();
            const rateLimited = (await page.locator('text=/too many|15 minutes/i').count()) > 0;
            if (!url.includes('login') && !rateLimited) {
              await page.context().storageState({ path: dpPath });
              console.log(`[setup] ✓ saved ${dpPath}`);
              dpLoggedIn = true;
            }
            await page.close();
            break;
          }
          await page.close();
        } catch {
          await page.close();
        }
      }
      if (!dpLoggedIn) {
        writeEmptyState(dpPath);
        console.warn('[setup] ✗ DP login failed — writing empty state');
      }
    } else {
      console.log('[setup] ✓ dp state reused');
    }
  } finally {
    await browser.close();
  }
}
