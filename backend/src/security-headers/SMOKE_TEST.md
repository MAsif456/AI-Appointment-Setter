# Security Headers - Manual Smoke Test Checklist

This document records the static analysis of the frontend that was performed
before the manual browser smoke test, and lists the steps the smoke test
itself should cover. Keep it next to the implementation so future changes
to the CSP can re-run the same checks.

## 1. Static analysis (already done)

The frontend source tree was scanned for anything the current CSP would
block. Findings:

| Check | Result | CSP coverage |
|---|---|---|
| External `https://` URLs in `frontend/src/` | All resolve to `process.env.NEXT_PUBLIC_API_URL` (the backend) | `connect-src 'self' <api>` |
| `<script src="...">` tags | None | n/a |
| `dangerouslySetInnerHTML` | None | n/a |
| `eval(...)` / `new Function(...)` | None | n/a |
| `new Image()` / `new EventSource()` / `new WebSocket()` | None | n/a |
| Inline `data:` URIs in CSS | One inline SVG icon in `components/Conversations/ConversationList.module.css` (search icon) | `img-src 'self' data:` |
| Google Fonts at runtime | Not used. `next/font/google` self-hosts Inter at build time | `font-src 'self'` |
| Third-party analytics / Sentry / Vercel Analytics | None in `package.json` | n/a |
| Third-party assets in `public/` | Five Next.js demo SVGs only (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`) | `'self'` |

**Conclusion:** the CSP allowlist as defined in `frontend/src/lib/security-headers.ts`
is strict and complete for the codebase as it stands. No tuning required
before the smoke test.

## 2. Manual browser smoke test

Run the dashboard locally (`npm run dev` in both `backend/` and `frontend/`)
and walk through every core workflow with the browser DevTools Console open.
Watch for the strings `Refused to`, `Content Security Policy`, or
`Permissions-Policy` in the console output.

### Workflows to cover

- [ ] **Login** (`/login`) - submit credentials, land on dashboard
- [ ] **Clinics list** (`/clinics`) - load page, verify clinic cards render
- [ ] **Add clinic** - open form, submit a test clinic
- [ ] **Clinic settings** (`/clinics/[id]/settings`) - edit and save
- [ ] **Conversations list** (`/conversations`) - load, scroll, filter
- [ ] **Conversation detail** (`/conversations/[id]`) - view messages, lead panel
- [ ] **Live chat / booking chat** - send a test message
- [ ] **Analytics** (`/analytics`) - view security events
- [ ] **AI settings** (`/ai-settings`) - open and save changes
- [ ] **Logout**

### What to verify with DevTools open

- [ ] **Network tab > any document response** - confirm the response carries:
  - `Content-Security-Policy-Report-Only` (dev) or `Content-Security-Policy` (prod)
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
  - `Strict-Transport-Security` (prod only)
- [ ] **Network tab > any patient-data API response** (`/conversations`,
  `/conversations/:id`, `/analytics/security-events`, `/appointments/slots`,
  `/auth/me`) - confirm the response carries:
  - `Cache-Control: no-store, no-cache, must-revalidate, private`
  - `Pragma: no-cache`
- [ ] **Network tab > any non-sensitive API response** (`/health`) -
  confirm `Cache-Control` is NOT the strict no-store string.
- [ ] **Console** - zero `Refused to` or `Content Security Policy` messages.
- [ ] **Backend logs** - zero `[CspReportService] CSP violation:` warnings
  during normal usage. (The endpoint itself still works; you can prove that
  by intentionally violating the CSP, e.g. via DevTools console
  `document.body.appendChild(Object.assign(document.createElement('script'), { src: 'https://example.com/x.js' }))`,
  and confirming a warning lands in the backend logs.)

## 3. If you find a violation

1. Note the exact directive and blocked URI from the console message.
2. Decide whether the resource is legitimate (then add it to the allowlist
   in `frontend/src/lib/security-headers.ts`, with an inline comment
   explaining why) or accidental (then remove it from the frontend code).
3. Re-run the smoke test.
4. Commit with `fix(security-headers): tune CSP allowlist for <thing>`.

## 4. Production scanner verification

After deployment, run the production URL through:

- https://securityheaders.com - target grade: A
- https://observatory.mozilla.org - target grade: B+ or higher

Document the achieved grade in the PR description.
