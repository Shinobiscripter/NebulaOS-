# Nebula AI

Nebula AI is a native Anura application (`nebula.ai`) with a chat sidebar, per-local-profile history, streaming replies, Stop, deletion, and four themed roles. Parentheses identify each role and real model. Messages are rendered as text, including code; rich Markdown and attachments are not implemented.

The Netlify function in `netlify/functions/nebula-ai.mjs` keeps the OpenRouter key server-side. Configure `OPENROUTER_API_KEY` as a production environment variable, then deploy from this repository with `netlify deploy --dir=static --functions=netlify/functions --no-build --prod`. A static-only upload does not provide chat. The free Netlify plan requires all server-side scopes; granular scopes and secret-value controls require an upgrade. The key remains outside browser files and Git, and is accessible to authorized hosting administrators. The key was created with a zero-dollar credit limit. Do not increase that limit unless you intend to change this policy.

Every request uses a curated `:free` model checked against OpenRouter's current catalog (60-second cache), plus zero maximum prompt/completion prices. Paid or unverifiable pricing fails closed. No paid fallback, tools or plugins are enabled. Provider availability and shared account-wide free quotas can interrupt requests. Netlify applies 12 requests per minute per IP/domain; that includes catalog requests. This is a public, shared free service, not private authenticated inference.

Conversation text goes to OpenRouter and its selected providers. Their policies apply. Chat history is stored locally, separately for each Nebula local profile; deleting a chat removes this local copy, not provider records. Browser storage is not encrypted. No API key is delivered to the browser. The app does not integrate with account-center credentials.

Validation: free-price gate tests, browser stream/history/injection fixture, and actual free-provider requests. The full upstream Anura build remains the release process.
