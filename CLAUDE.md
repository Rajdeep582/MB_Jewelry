Perform a complete, production-grade security audit of the existing authentication system.

IMPORTANT CONTEXT:
- Authentication system is ALREADY implemented.
- Your task is to ANALYZE the current implementation — NOT rebuild from scratch.
- Optimize the existing system by fixing bugs, removing flaws, and improving security.
- The project is NOT live yet.
- Payment/webhook flow is NOT to be touched or modified at all (no webhook is configured yet).

STRICT FOCUS:
- Work ONLY on authentication, sessions, users, and access control.
- Do NOT modify payment, Razorpay, or order-related logic.

CORE OBJECTIVE:
- Make the current authentication system stable, secure, and production-ready.
- Fix issues WITHOUT breaking existing logic or architecture.

SCOPE OF WORK:
Deeply analyze and improve:
- Existing signup/login flow
- Password handling
- JWT + refresh token system
- Session management and revocation
- Role-based access control
- Account verification logic (isVerified)
- Middleware (rate limiting, sanitization, etc.)

STRICT RULES:
- DO NOT rewrite the system.
- DO NOT change working flows unnecessarily.
- Only fix what is broken, insecure, or inefficient.
- If a change may affect existing behavior, highlight it instead of blindly modifying.

SECURITY REQUIREMENTS (MANDATORY):

1. Password Security
   - Ensure passwords are hashed using bcrypt (10–12 rounds).
   - Remove any possibility of plaintext storage.
   - Ensure password is never exposed in responses.

2. Authentication Flow
   - Verify login/signup correctness.
   - Ensure invalid, expired, or tampered tokens are rejected.
   - Validate refresh token rotation and replay protection.

3. Session Management
   - Fix broken session revocation logic.
   - Ensure each session has a unique identifier.
   - Ensure logout works properly (single device + all devices).

4. Input Validation
   - Add strict validation where missing:
     - Profile update
     - Address operations
   - Prevent invalid or excessive input.

5. Access Control
   - Verify admin routes are protected server-side.
   - Prevent privilege escalation via request manipulation.

6. Security Hardening
   - Ensure:
     - Rate limiting on auth endpoints
     - NoSQL injection protection
     - Replace deprecated security libraries if needed
     - Secure headers (helmet)
     - Proper CORS handling

7. Token Handling
   - Review access token storage (localStorage risk).
   - Suggest safer alternatives WITHOUT breaking current flow.
   - Ensure refresh tokens use httpOnly cookies.

8. Bug Fixing (CRITICAL)
   - Identify and FIX all authentication-related bugs.
   - Example areas to inspect:
     - Seed users unable to login due to isVerified=false
     - Broken session revocation
     - Missing validation flows
   - Fix cleanly without affecting business logic.

9. Existing Code Optimization
   - Remove redundant logic
   - Improve inefficient checks
   - Clean minor inconsistencies (duplicate fields, unused code)

10. Secrets & Configuration
   - Ensure no secrets are hardcoded.
   - Ensure environment variables are used correctly.
   - Do NOT modify payment-related secrets.

DELIVERABLE:
- List of issues found in authentication system
- Clean fixes (minimal and safe)
- Categorized into:
  - Critical issues
  - High priority fixes
  - Improvements

DO NOT:
- Touch payment or webhook logic
- Refactor unrelated modules
- Break existing working features

GOAL:
Make the CURRENT authentication system secure, optimized, bug-free, and production-ready — without rewriting it.