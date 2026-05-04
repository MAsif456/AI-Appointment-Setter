export const GHL_SIGNATURE_HEADER = "x-ghl-signature";

export const GHL_LEGACY_SIGNATURE_HEADER = "x-wh-signature";

// Ref: https://marketplace.gohighlevel.com/docs/webhook/WebhookIntegrationGuide/index.html
export const GHL_ED25519_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=
-----END PUBLIC KEY-----`;

export const HMAC_SIGNATURE_HEADER = "x-webhook-signature";

export const HMAC_TIMESTAMP_HEADER = "x-webhook-timestamp";

export const GHL_WEBHOOK_SECRET_ENV = "GHL_WEBHOOK_SECRET";

// Ref: https://webhooks.fyi/security/replay-prevention
export const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000;

// Ref: https://arpitbhayani.me/blogs/sliding-window-ratelimiter/
export const WEBHOOK_RATE_LIMIT = 50;
export const WEBHOOK_RATE_WINDOW_SECONDS = 60;
export const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// Ref: https://hookdeck.com/docs/deduplication
export const WEBHOOK_DEDUP_TTL_SECONDS = 86_400;
export const WEBHOOK_EVENT_TTL_SECONDS = 7 * 86_400;

// Ref: https://dev.to/digital_trubador/webhook-security-best-practices-for-production-2025-2026-384n
export const MAX_BODY_SIZE_BYTES = 1_048_576;
