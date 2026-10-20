# MailCue audit

Last reviewed: 2026-10-20

This review covers the Outlook manifest, task pane, Bridge/OAuth flow, menu bar controller, startup scripts, packaging spec, and project documentation. JavaScript syntax checks and the version synchronizer were run. No tests, dependency installs, requests to MailCue/OpenAI, or macOS packaging were run. The shared workspace Python interpreter and target Mac/Outlook runtime were unavailable, so Python parsing and macOS/Outlook behavior remain unverified.

## Changes made

- **Mailbox misuse guard:** The configured Outlook account is still checked in the task pane and Bridge. The Bridge API now also requires an ephemeral per-process token, the expected `localhost:1455` host, and the MailCue task pane Origin for mutations. This protects normal browser use against cross-origin requests and casual local calls.
- **Security boundary:** The local token is injected only into the no-cache task pane HTML and is not written to disk. A process running as the same macOS user can still request that HTML and inspect the token. The Bridge still cannot cryptographically prove that a caller-supplied mailbox address came from Outlook. Strict mailbox authorization would require Microsoft identity/SSO validation and account/tenant configuration; this local add-in does not implement that architecture.
- **Request timeouts:** JWKS retrieval is limited to 15 seconds; OAuth exchange and refresh to 20 seconds; model listing to 15 seconds; Responses streaming to 45 seconds without stream activity and 180 seconds overall. Outlook `body.getAsync` waits at most 10 seconds. Bridge HTTP request headers/bodies have server limits, and the task pane has matching client-side request limits.
- **Model choice:** Settings now loads the signed-in account's visible model catalog in server order and offers a compact selector. The first model remains the default. The selected slug is checked against the current account catalog before use. This follows OpenAI's published SIWC model-list guidance; catalog visibility alone still cannot guarantee every listed model will accept every Responses request, so provider errors remain visible and the user can select another listed model.
- **OAuth concurrency:** Only one sign-in can be in progress. A second task pane receives HTTP 409 rather than replacing the first attempt's state and nonce. Invalid callbacks no longer clear a valid pending login.
- **Node startup:** Candidate Node executables are checked sequentially with asynchronous `QProcess` calls and a four-second per-candidate timeout, keeping the menu bar UI responsive. Quit/Turn Off stops an active version probe.
- **Version drift:** `package.json` is canonical. The PyInstaller spec reads its version; `npm run sync-version` synchronizes the Outlook manifest; the macOS build runs the synchronizer before packaging. The README heading no longer carries a separate version.
- **Other reliability fixes from the previous audit:** The menu bar app recognizes only its own Bridge readiness marker; static assets are allowlisted; configuration writes are serialized; request text decoding and size validation are handled; and Bridge shutdown follows its owning menu bar process. The Responses stream reports `response.incomplete` distinctly.

## Remaining limitations

### Strict Outlook account isolation needs Microsoft identity validation

The configured address check prevents ordinary accidental use in the UI, and the add-in reads only the open item after an explicit click. It does not read or scan the mailbox. However, `ReadItem` is not narrowed to the configured email by MailCue, and the local Bridge cannot prove that a request's mailbox field was supplied by Outlook. A same-user local process can also inspect the ephemeral local token. Do not treat the setting as a security boundary against a determined local caller.

A stronger design would need a supported Outlook SSO identity token verified by the Bridge, together with Microsoft app registration and account/tenant setup. Microsoft has turned off legacy Exchange identity tokens for Exchange Online and recommends MSAL with nested app authentication (NAA); its legacy Exchange token API is also unsupported for Outlook.com and Gmail mailboxes. The supported SSO route requires an Entra app registration and still needs validation against the user's account types and whether the token identifies the active mailbox when several accounts are connected. See Microsoft's [Outlook SSO guidance](https://learn.microsoft.com/en-us/outlook/add-ins/authenticate-a-user-with-an-sso-token) and [Office SSO guidance](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/use-sso-to-get-office-signed-in-user-token). This is a separate identity integration, not a local-only patch, and cannot be completed or verified without choosing and configuring the Microsoft app identity.

### Model availability is not a compatibility guarantee

MailCue uses the signed-in account's `/models` catalog, preserves its order, and lets the user choose a listed model. A model-list entry does not expose a definitive Responses-compatibility flag. If the selected model rejects a Responses request, MailCue shows the provider error; select another listed model in Settings.

### Runtime and build verification

The target Mac is required to verify Office WebView Origin behavior, the injected local token, certificate trust, model picker rendering, OAuth refresh, QProcess signals, LaunchAgent behavior, packaged resource lookup, and actual model eligibility. The shared workspace Python interpreter was missing, so the updated PySide6 controller could not be parsed or launched here. No version bump was made; all sources remain at 0.3.0.

## Operational note

The menu bar app and `npm_start.command` both use ports 1455 and 1456. Run only one at a time. The menu app owns and stops its Bridge child; the manual launcher runs in the foreground.
