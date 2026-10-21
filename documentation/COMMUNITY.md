# Google accounts, announcements and usage

Google & Privacy appears in the launcher and Account Center. A verified Google
identity can create a local profile or link the current profile. Local files and
settings remain in that browser: Google sign-in is not cloud synchronization.

The Developer Panel appears only after the server verifies the Google account
`gamergeek1107@gmail.com`. Both reading usage and publishing announcements require
that verified server session. Editing local storage or importing a `.hub` file
cannot grant developer privileges. Announcements use plain text, expire after
1–168 hours, and reach visible desktops within approximately 60 seconds.

## Deployment configuration

1. In Google Auth Platform configure a consent screen and create a **Web application**
   OAuth client. Use only `openid email profile`. For testing, add your Google
   account as a test user. Public access requires an appropriate published audience.
2. Set the authorized origin to `https://nebulahub-shinobiscripter.netlify.app`.
3. Add this exact authorized redirect URI:
   `https://nebulahub-shinobiscripter.netlify.app/api/community?action=callback`.
4. Set Netlify environment variables `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   and `NEBULA_SITE_ORIGIN` (the origin above), scoped to Functions when your plan
   supports scope selection. On the free plan use all scopes in the production
   context; the client secret is read only by server code. Never commit
   secrets or put them in the static build. Redeploy the functions after changes.
5. Deploy `static` **and** `netlify/functions`. The shared Netlify Blobs store
   `nebula-community-v1` is initialized on use. The daily scheduled cleanup runs
   on the production deployment. Hosting usage and provider limits still apply.
6. Test a real Google sign-in, your developer account, a different Google account,
   sign-out, and importing a `.hub` in another browser. Automated UI tests use
   simulated API responses and do not replace this provider integration check.

Privacy information is served at `/privacy/`. Without the OAuth variables, sign-in
is explicitly unavailable; local accounts continue to work. A standalone static
host without the functions cannot provide shared announcements or Google login.

## Security and data handling

- Authorization code flow uses PKCE, a random nonce, a matching HttpOnly state
  cookie, and server verification of Google's signature, issuer, audience,
  expiry and verified email. Only basic profile information is requested.
- Google access/refresh tokens are not retained. The server stores a random
  session reference and verified profile for a 24-hour session. Session cookies
  are Secure, HttpOnly and SameSite=Lax. Logout revokes the server session.
- API writes require the exact configured Origin. API routes bypass Anura's
  service-worker file cache and return `Cache-Control: no-store`.
- `.hub` version 2 adds a sanitized Google profile reference. It excludes tokens,
  cookies and permissions. Import requires a fresh Google login to establish
  identity; it never transfers an authenticated session.
- Activity is off by default. Opt-in records visits and known app/game IDs only.
  No private files, messages, searches, keystrokes or email addresses are included
  in activity records. A random daily session identifier supports approximate
  counts. These client-reported statistics are not an audit log or proof of use.
- The dashboard shows the last 24 hours, reads at most 500 batches and labels
  truncated results. Activity expires through daily cleanup within eight days;
  expired session/consent records are cleaned within three days of creation.
- Turning sharing off prevents new collection; prior records expire normally.
  Announcements retain only the latest message until replaced.

Implementation: `netlify/lib/community.mjs`, two Netlify function wrappers,
`public/nebula/google-auth.js`, `community.js` and `community.css`. Profile linking
integrates with `accounts.js`; export/import integrates with `account-center.js`.

Validation: `npm test` and
`npx playwright test tests/browser/community.spec.mjs`.
