# The Community Update

Google & Privacy appears in the launcher and Account Center. A verified Google
identity can create a local profile or link the current profile. Local files and
settings remain in that browser: Google sign-in is not cloud synchronization.
Google sign-in is now required for online access. A Netlify Edge Function protects
the desktop and direct assets, while OAuth and privacy/license pages remain public.
The desktop performs a fresh access check before boot and about once a minute while
visible. Local development on localhost can run without the hosted backend.

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
5. Deploy `static`, `netlify/functions` **and** `netlify/edge-functions`. The shared Netlify Blobs store
   `nebula-community-v1` is initialized on use. The daily scheduled cleanup runs
   on the production deployment. Hosting usage and provider limits still apply.
6. Test a real Google sign-in, your developer account, a different Google account,
   sign-out, and importing a `.hub` in another browser. Automated UI tests use
   simulated API responses and do not replace this provider integration check.

Privacy information is served at `/privacy/`. Without the OAuth variables, sign-in
is explicitly unavailable and production access fails closed. A standalone static
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
- Basic reporting defaults on for new profiles. Existing explicit opt-outs and
  Do Not Track / Global Privacy Control are respected. Reports record visits and known app/game IDs only.
  No private files, messages, searches, keystrokes or email addresses are included
  in activity records. A random daily session identifier supports approximate
  counts. These client-reported statistics are not an audit log or proof of use.
- The dashboard shows the last 24 hours, reads at most 500 batches and labels
  truncated results. Activity expires through daily cleanup within eight days;
  expired session/consent records are cleaned within three days of creation.
- Turning sharing off prevents new collection; prior records expire normally.
  If Cloudflare's script has loaded, turning reporting off reloads the desktop;
  the privacy settings explain that users should save their work first.
  Announcements retain only the latest message until replaced.

## Account moderation

The owner-only Developer Panel lists verified Google accounts, with search over
loaded pages, first-seen/last-sign-in metadata and 100-account pagination. Choose
a suspension (1–8,760 hours), an indefinite ban, or restoration, enter a reason,
and confirm the exact action. Reasons are visible to affected users. Restrictions
are stored separately from profiles to prevent sign-in overwriting a ban. The
owner account is protected from restriction. Every moderation change is recorded.
Member and moderation records remain until administratively removed; requests
can be sent to the owner at the contact on the privacy page.

The edge gate validates the server session and restriction on every online request,
including raw game and app assets. Expired sessions must sign in again. Shared HTTP
caching is disabled for protected responses. The updated service worker loads the
desktop shell and account modules from the network, avoiding stale cached gates.
An internet connection is required for a fresh launch. Local data is not deleted.
Already downloaded content, older deployments, third-party sites and a different
Google identity cannot be universally revoked. An already running desktop may take
up to a minute to show the restriction; server requests are rejected immediately.

## Free aggregate analytics

Cloudflare Web Analytics is configured for `nebulahub-shinobiscripter.netlify.app`.
The public beacon token in `community.js` is a site measurement identifier, not an
API credential. It loads only on the production hostname when reporting is enabled.
The Developer Panel links to the Cloudflare account dashboard. Cloudflare provides
aggregate visits/performance, not visitor identities or bans; the separate verified
member directory supplies account moderation. The beacon covers reporting-enabled
desktop visits, not visitors who leave at the sign-in page. Blockers can omit visits.

Cloudflare Web Analytics requires no paid subscription. Netlify Functions, Edge
Functions and Blobs remain subject to the site's existing free-plan quotas; this
update is not an unlimited hosting guarantee. Monitor usage before a large launch.

Implementation: `netlify/lib/community.mjs`, two Netlify function wrappers,
`public/nebula/google-auth.js`, `community.js` and `community.css`. Profile linking
integrates with `accounts.js`; export/import integrates with `account-center.js`.

Validation: `npm test` and
`npx playwright test tests/browser/community.spec.mjs`.
