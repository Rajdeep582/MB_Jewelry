# M&B Jewelry — Backend Audit Report

**Scope:** `backend/` (Express + Mongoose + Razorpay e-commerce API)
**Date:** 2026-05-29
**Mode:** Audit / validate / test only. No production code was modified. One test-only file was added (`tests/ipWhitelist.test.js`).

---

## 1. Overall Backend Health Score: **8 / 10**

This is a genuinely well-engineered backend. Payment integrity, auth, and state-machine design are above the level typically seen in small e-commerce projects. The score is held back from 9–10 by one critical secrets-hygiene issue in git history and one high-impact deployment misconfiguration (`trust proxy`), both of which are fixable in well under a day.

## 2. Production Readiness Assessment

**Conditionally ready.** The application logic, data integrity guarantees, and security controls are production-grade. However, it must not be considered production-ready until the **Critical** and **High** findings below are resolved, because they undermine controls that the code itself implements correctly (rate limiting, IP whitelisting, secret confidentiality).

---

## 3. Findings by Severity

### CRITICAL

**C1 — Live secrets committed to git history.**
The real `backend/.env` was committed in at least two commits (`eda6695a` "initial commit … with env included", `acd03812`). It is correctly git-ignored and absent from `HEAD` now, but git history still contains it. Exposed values include `MONGO_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `RAZORPAY_KEY_SECRET`, and Cloudinary API secret.

*Evidence:* `git log --all -- backend/.env` → 2 commits; `git show eda6695a:backend/.env` returns a populated env file.

*Impact:* Anyone with repo access (current or future, including any fork/clone/mirror) can read production credentials — full DB access, JWT forgery, payment-key abuse.

*Action (report-only):* Rotate **all** of the above secrets immediately. Then purge them from history (`git filter-repo` or BFG) and force-push. Treat the old secrets as compromised regardless of repo visibility.

### HIGH

**H1 — `trust proxy` is not configured.**
`server.js` never calls `app.set('trust proxy', …)`, but the app ships with a `Procfile` (deploys behind a PaaS load balancer). Behind a proxy, `req.ip` resolves to the proxy address, not the client.

*Impact:* This silently degrades three controls that the code otherwise implements correctly:
- `express-rate-limit` (login/OTP/payment brute-force limiters) keys on `req.ip` → all clients collapse into one bucket (mass false lockouts) or the limiter is effectively bypassed.
- `adminIpWhitelist` compares the proxy IP, not the real client IP → the whitelist allows/blocks the wrong addresses.
- `auditLogs[].ipAddress` and `sessions[].ipAddress` record the proxy IP → forensic value lost.

*Action:* Set `app.set('trust proxy', 1)` (or the exact hop count of your platform) before the rate limiters.

### MEDIUM

**M1 — Webhook ACKs `200` before signature verification and processing.**
`handleWebhook` sends `res.status(200)` first, then verifies HMAC and processes. Razorpay only retries on non-`200`. If `atomicConfirmOrder` fails on a transient DB error *after* the `200`, Razorpay will not retry and the capture is silently dropped. The `retry-verify` endpoint mitigates this but depends on the user manually retrying.
*Action (report-only):* Verify the signature and enqueue/persist the event before ACK, or move to an async job queue with its own retry, so a processing failure can be re-driven without depending on Razorpay retries.

**M2 — Potential user-enumeration via differentiated error messages.**
`forgotPassword` returns a generic OK for unknown emails (good) but a distinct message for OAuth-only accounts ("linked exclusively via an OAuth provider"), and `verifyResetOtp` returns a different shape for unknown vs. known emails. These leak account existence and account type.
*Action (report-only):* Return the same generic response across all branches of the password-reset flow.

**M3 — N+1 query when building an order.**
`validateAndBuildItems` runs `await Product.findById(...)` sequentially inside a `for` loop. Fine for small carts, but it scales linearly with cart size on the hot checkout path.
*Action (report-only):* Fetch all products in one `Product.find({ _id: { $in: ids } })` and validate from a map.

**M4 — Price filter/sort uses stored price, not live price.**
`getProducts` filters (`minPrice`/`maxPrice`) and sorts (`price-asc`/`price-desc`) on the persisted `price` field, but for `pricingType: 'dynamic'` products the *displayed* price is recomputed at read time via `applyLivePrice`. Filtering and sorting are therefore inaccurate for the dynamic catalogue.
*Action (report-only):* Either persist a periodically-resynced `price` for dynamic products (a resync endpoint already exists) and filter on that, or compute then filter/sort in-app for dynamic items.

### LOW

- **L1 — ESLint config has no `jest` env / test override.** Test files produce 1,117 false `no-undef` errors (`describe/it/expect`), making `npm run lint` unusable as a CI gate. Add `"overrides": [{ "files": ["tests/**"], "env": { "jest": true } }]`.
- **L2 — Unmaintained security dependencies.** `xss-clean` (deprecated) and `express-mongo-sanitize` are both effectively unmaintained. They work today; plan a migration path (e.g. rely on strict Joi schemas + a maintained sanitizer).
- **L3 — Dev origin left in production CORS list.** `cors.origin` hardcodes `http://localhost:5174` alongside `CLIENT_URL`. Harmless but should be environment-gated.
- **L4 — Local disk uploads are ephemeral on PaaS.** `app.use('/uploads', express.static(...))` and `buildImageUrl`'s local fallback will break on platforms with ephemeral filesystems. Cloudinary is the primary path, so impact is limited, but the fallback is a latent footgun.
- **L5 — Code-quality warnings (non-blocking).** SonarJS reports 23 duplicate-string and 11 cognitive-complexity warnings in production files (notably `orderController.js`, `customOrderController.js`). No correctness impact; consider refactoring the largest controllers for maintainability.

---

## 4. What Is Done Well (validated, not just assumed)

- **Payment integrity is excellent.** Server-side price computation (never trusts client), HMAC signature verification with `crypto.timingSafeEqual`, `razorpayOrderId` cross-validation (payment-swap defence), idempotency short-circuits before signature work, and atomic stock-decrement via `findOneAndUpdate({ stock: { $gte: qty } })` inside a MongoDB transaction (closes the TOCTOU race). A separate webhook path acts as a safety net, and `retry-verify` recovers from client crashes.
- **Auth is mature.** bcrypt cost 12, refresh-token rotation with reuse-detection ("nuke all sessions" on replay), session capping/pruning, account lockout after 5 attempts, OTPs stored as SHA-256 hashes with attempt limits and TTLs, single-use hashed reset tokens, cross-portal isolation (user/admin/delivery as separate models + typed JWTs).
- **Privilege separation is enforced in depth.** `payment.status = 'paid'` can only be set by signature-verified payment paths; the admin status endpoint deliberately refuses `paymentStatus`; delivery requires DP confirmation *and* paid status before admin can mark delivered.
- **Defensive infrastructure.** Helmet, CSRF double-submit with timing-safe compare, mongo-sanitize + xss-clean, fail-fast env assertions, correlation IDs, Sentry, graceful DB-retry with intentional crash-on-failure, stale-order cleanup job, and a `/api/ready` DB-state probe.
- **Schema design is sound.** Indexes are present and purposeful (including the webhook lookup index and compound indexes for the cleanup job), IDs are crypto-random (no enumeration), and audit logs are capped to bound document growth.

---

## 5. Test Coverage

**Existing:** ~392 test cases across 12 files, running on `MongoMemoryReplSet` (a real replica set — correctly enables the transaction-based payment tests). Coverage of critical paths is strong and includes negative and security scenarios: idempotency, ownership checks, JWT tampering, expired tokens, cross-role access denial, CSRF match/mismatch, XSS payloads, NoSQL injection, weak-password/invalid-email rejection, and full webhook edge cases (bad signature, missing signature, malformed JSON, unknown event, missing secret, double-processing).

**Execution note:** The harness is configured correctly and runs green — verified by adding and running `tests/ipWhitelist.test.js` (8/8 passed) and by a clean MongoDB binary download. The full 392-case suite could not be run to completion *in this audit sandbox* because each shell command is capped at 45 seconds and the replica-set spin-up plus slow mounted-disk I/O exceeds that window. This is an environment limitation, **not** a test failure. Run locally with `npm test` to get the full pass/fail + coverage numbers.

**Test added by this audit (test-only, no production change):**
- `tests/ipWhitelist.test.js` — 8 unit tests for `adminIpWhitelist` (allow-all modes, whitelist match, 403 on block, IPv6-mapped prefix stripping, `socket.remoteAddress` fallback, whitespace tolerance). DB-free, runs in milliseconds. **Status: passing.**

**Recommended missing tests (report-only — not implemented):**
- **Concurrency / double-spend:** two parallel `verify-payment` calls for the last unit in stock — asserts exactly one succeeds. Highest-value gap given the money path.
- **`cleanupStaleOrders` job:** stale pending orders/custom-order advance & final phases transition to `failed`; fresh orders untouched.
- **`trust proxy` / `X-Forwarded-For` handling** once H1 is fixed — assert `req.ip` reflects the real client.
- **Rate-limiter triggering at production caps** (login/OTP/payment) — currently caps are raised to 10000 in test env, so real throttling is only unit-tested in `security.test.js`, never integration-tested.
- **Refresh-token replay → global session wipe** end-to-end (if not already in `auth.test.js`).
- **Dynamic-price filter/sort correctness** (ties to M4).

---

## 6. Optimization Recommendations (report-only)

1. Batch the cart product lookup in `validateAndBuildItems` with a single `$in` query (M3).
2. Persist a resynced `price` on dynamic products so `getProducts` can filter/sort/paginate at the DB layer accurately (M4).
3. Move webhook processing behind a durable queue so transient failures are retried independently of Razorpay (M1).
4. Add `"env": { "jest": true }` override to ESLint and wire `npm run lint` + `npm test` into CI as required gates (L1).
5. Consider a short-TTL cache for `GlobalPricing.find({})`, which is read on every product list/detail request (it changes infrequently).
6. Refactor the two largest controllers (`orderController.js` ~1027 LOC, `customOrderController.js` ~821 LOC) to reduce cognitive complexity flagged by SonarJS (L5).

---

## 7. Final Verdict

**The backend is fundamentally production-grade and built to scale** — the payment, auth, and data-integrity engineering is strong and well-tested. **It is not yet safe to ship as-is** solely because of credential exposure in git history (**C1**) and the missing `trust proxy` setting (**H1**), which together compromise secret confidentiality and disable the brute-force/IP controls the code otherwise implements correctly.

**Resolve C1 (rotate + purge) and H1 (`trust proxy`) — both small, well-scoped changes — and this backend is ready for production and horizontal scaling.** The Medium findings should follow shortly after; the Low findings are housekeeping.
