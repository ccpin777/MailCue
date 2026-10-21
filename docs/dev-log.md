# MailCue development log

## 2026-10-21 — Project root organization

- Moved the manual Bridge launcher into `commands/`; kept `Run.command` at the project root and its path resolution intact.
- Removed the Outlook screenshot at the user's request and kept the sideloading URL and steps in `docs/outlook-sideloading.md`.
- Updated README and user-guide references to the new command paths. No code changes were made to the Outlook task pane; the blue rounded focus border in the screenshot belongs to Outlook's host UI, outside the add-in page's CSS.
- Checked launcher shell syntax, command-path references, and `git diff --check`. Outlook focus rendering remains unverified on the target Mac.

## 2026-10-21 — Optional OpenAI API key connection

- Added an OpenAI API key option alongside ChatGPT sign-in. The key is verified against the API model list before it is saved in MailCue's private data folder with owner-only permissions.
- Added provider-specific model selections and updated Settings to show which connection method is active. Documentation clarifies that API usage is billed separately from a ChatGPT plan.
- No API key, local config, certificate, or packaged app was included in the project changes.

## 2026-10-21 — Outlook icon contrast and task pane interaction polish

- Changed the Outlook ribbon icon from near-black to a fixed blue that remains visible on light and dark Outlook surfaces. Regenerated each 16, 20, 24, 32, 40, 48, 64, and 80 px PNG directly from the SVG source with 4× supersampling; no small raster icon is enlarged to make another size.
- Bumped manifest icon asset URLs to `v=6` to avoid Outlook's cached `v=5` images. The menu bar icon source and stroke were left unchanged.
- Added dark-mode hover colors for the Email mode selector, New request, Settings, and Email/Selected text menu items; brightened the Settings glyph in dark mode.
- The mode menu now closes when clicking elsewhere in the task pane.
- Follow-up generation now exposes a square Stop response button while streaming. It aborts the task pane request, which closes the stream so the Bridge can abort upstream work. Partial output is retained and marked stopped; an empty partial answer is removed while the user's question remains.
- Removed the repeated You label from user bubbles; right alignment and bubble color distinguish user turns, while MailCue replies retain their label.
- JavaScript syntax, `git diff --check`, and all eight PNG dimensions passed. The regenerated icons were visually inspected on light and dark backgrounds. Manifest XML parsing and live Outlook/Retina rendering were not available in this workspace.

## 2026-10-20 — Configurable translation language

- Added a **Translate to** field in Settings with common language suggestions and a default of **Traditional Chinese (Taiwan)**. Users can enter another language name and save it locally.
- The Bridge persists the selected language in the existing private config file and uses it for Translate requests. Existing config files without this setting continue to default to Traditional Chinese (Taiwan).
- No Outlook manifest change is needed. The packaged menu bar app must be rebuilt to include the updated task pane and Bridge; the existing sideloaded add-in can keep its manifest.
- Static source review only; no tests, packaging, or target-Mac verification were run.

## 2026-10-20 — Version 0.3 menu bar controller

- Added a macOS menu bar app with the English menu items **Turn On**, **Turn Off**, **Launch at Login**, and **Quit MailCue**, using the same PySide6 and PyInstaller approach as Coding Deck.
- The menu bar app starts and stops the local Node bridge without opening Terminal. It checks common Homebrew, Volta, asdf, mise, nvm, and fnm Node locations, plus the user's PATH.
- **Launch at Login** writes a per-user LaunchAgent plist. On later logins, the menu bar app starts the bridge automatically. **Quit MailCue** stops the bridge before exiting.
- Added `native/mailcue_menubar.py`, `native/MailCue.spec`, and an updated `scripts/build-menubar-app.command`. It bundles the task pane and bridge and signs the app locally. Private config, certificates, and OAuth credentials stay in Application Support.
- Replaced the Swift compiler build after the target Mac reported that its Command Line Tools compiler and SDK versions do not match. The Python/PyInstaller route avoids Swift compilation and follows the working Coding Deck build pattern.
- Improved **Turn On** feedback: the menu now shows **Starting…**, waits for the local HTTPS port to open before reporting **On**, and keeps startup errors visible in the menu. Bridge startup output is written to `~/Library/Logs/MailCue.log` so missing certificates, Node errors, and occupied ports can be diagnosed.
- Added `Run.command` to launch the menu bar source directly with the shared workspace Python environment, following Coding Deck's clean Qt launch setup. This lets startup behavior be debugged before building the `.app`.
- Fixed the source-run menu actions by keeping the tray controller alive for the full Qt event loop, and corrected source-mode asset paths to resolve from the project root.
- The successful app build now removes its generated `build/`, `build-logs/`, and `dist/MailCue/` temporary folders while retaining `dist/MailCue.app`. Failed builds keep their logs for diagnosis.
- Made bundled resource lookup check PyInstaller's runtime directory and the usual macOS app `Contents/Resources` and `Contents/Frameworks` locations, because the first packaged launch reported that `bridge/server.mjs` was missing.
- Updated README setup steps and ignored the generated `dist/` folder.

### Build and verification notes

- The development workspace is Linux, so the macOS PyInstaller bundle could not be built or launched here. Run `commands/build-menubar-app.command` on the target Mac to build and inspect the menu bar app.
- The `Launch at Login` behavior and menu icon rendering still need confirmation on that Mac. Keep `dist/MailCue.app` in place after enabling login launch.

## 2026-10-20 — Static audit

- Audited the Outlook manifest, task pane, local bridge/OAuth flow, menu bar controller, startup helpers, PyInstaller spec, README, and references to legacy files.
- Fixed **Launch at Login** when running `Run.command` from source: its LaunchAgent now includes the controller script path instead of launching a bare Python interpreter. Packaged mode continues to launch the app executable directly.
- Removed the unused Swift menu bar source, its old standalone `Info.plist`, and the legacy login-item installer. The current PySide6 build uses the `MailCue.spec` bundle metadata; the menu app manages its LaunchAgent directly. Kept the uninstaller because the build and manual startup scripts still call it.
- Static audit only. No tests, servers, dependency installs, or macOS packaging were run in this workspace; LaunchAgent behavior and the macOS bundle still need verification on the target Mac.
- Findings held for review: the configured mailbox check is a local-app guard, not mailbox-level authorization; the loopback API has no separate caller authentication; the menu app marks service startup successful based on a port connection, which can mistake another process on port 1455 for its own bridge; and bridge/network calls do not have explicit timeouts. These need a decision about desired security and lifecycle behavior before changing them.
- Other follow-up items: Node discovery runs synchronous subprocess checks on the menu UI thread; OAuth sign-in re-enables its button while browser authorization is still pending, so repeated clicks can replace the active state/nonce; and the version is repeated in `manifest.xml`, `package.json`, `README.md`, and `native/MailCue.spec`, so those values can drift. These are left unchanged pending priority and behavior decisions.
- Moved the clickable build launcher to `commands/build-menubar-app.command`; shell helpers remain under `scripts/`.
- Fixed packaged Bridge lookup to derive macOS `Contents/Resources` from PyInstaller's `_MEIPASS`, rather than relying only on the executable location. Missing-Bridge errors now list every searched path instead of only the first candidate. The source fix is complete; rebuilding and confirming the `.app` on the target Mac remains the final verification.
- Removed the redundant **Use current account** control. The Settings panel still shows the active Outlook account; users enter the allowed address and press **Save**.
- The follow-up question field now submits with **Enter**; **Shift+Enter** inserts a newline, and IME composition Enter is left alone.
- Bumped Outlook icon asset URLs from `v=3` to `v=4` to invalidate cached ribbon icons. Updating the packaged task pane requires rebuilding the menu bar app; updating the manifest icon URLs requires re-importing the custom add-in.
- Refined the Outlook icon from its own 1.1-stroke SVG source, regenerated PNG assets, added Office's supported 20/24/40/48/64-pixel variants alongside required 16/32/80-pixel images, added all variants to the packaged app, and bumped icon URLs to `v=5`. Kept the menu bar icon's original 1.4-stroke SVG unchanged. Rebuild the app and re-import the updated manifest to refresh Outlook's cached icons.
- Placed the Outlook account input and **Save** button on one row; the input can shrink within narrow task panes.

## 2026-10-20 — Bridge shutdown and bundle validation

- MailCue now keeps the Bridge attached to the menu app lifecycle instead of starting it in a detached session. **Turn Off**, **Quit MailCue**, normal Qt shutdown, and unexpected controller exit close the controller's stdin pipe; the Bridge treats EOF as shutdown and closes ports 1455 and 1456.
- Added graceful shutdown for terminal close and termination signals. If either port fails to bind, the Bridge closes any listener that did start instead of leaving a half-running Node process behind.
- The menu app allows five seconds for graceful shutdown, then terminates and finally kills the child if needed.
- The build command asks an already-running packaged MailCue app to quit before rebuilding, verifies that `server.mjs` exists under `Contents/Resources`, `Contents/Frameworks`, or `Contents/MacOS`, and launches the newly built app as a fresh instance.
- `node --check bridge/server.mjs` and `git diff --check` passed. This workspace has no shared Python interpreter, zsh, or macOS, so Python syntax, the build script, the app bundle, and live port shutdown still require verification on the target Mac.

## 2026-10-20 — Audit follow-up

- Updated `docs/audit.md` with the full static review, safe fixes completed, remaining security/product decisions, and target-Mac verification limits.
- Changed the Responses stream handler to report `response.incomplete` explicitly, including a shorter-excerpt suggestion when the output-token limit is reached.
- Removed a redundant task pane button-state branch and documented that the menu bar app and `npm_start.command` cannot run at the same time because they share ports.
- Confirmed the source keeps English identifiers and UI strings; user-facing discussion remains in Traditional Chinese.
- The earlier static-audit notes about repeated Connect clicks and false **On** status from another process are superseded by the fixes recorded above and in `docs/audit.md`.
- No tests, dependency installs, or macOS build were run as part of this documentation and audit pass.

## 2026-10-20 — Audit remediation

- Added per-run local API authentication and exact Host/Origin checks. The transient token is injected into the no-cache task pane HTML and is not stored on disk. This mitigates browser cross-origin calls; it does not defend against a determined process running as the same macOS user.
- Added bounded waits for OpenAI auth/model requests, Responses streaming (45-second idle and 180-second total), Office email body reads (10 seconds), and local task pane requests.
- Added a ChatGPT model selector populated from the signed-in account's visible model catalog. The first listed model remains the default; selected models are validated against the current catalog before inference.
- Changed sign-in concurrency to reject overlapping attempts and preserve a valid OAuth transaction when an invalid callback arrives.
- Moved Node version probes to asynchronous `QProcess` checks with a four-second timeout per candidate; Turn Off and Quit cancel an active probe.
- Made `package.json` the canonical version source. Added `npm run sync-version`, wired it into the macOS build, and made the PyInstaller spec read the package version.
- Serialized settings writes to avoid overlapping account/model changes overwriting each other. Updated the audit and README with the remaining identity-isolation boundary and runtime verification needs.
- JavaScript syntax checks, `git diff --check`, and the version synchronizer passed. Python checks and macOS/Outlook verification were unavailable because `/workspace/venv/bin/python` and a target Mac are not present. No tests or package installs were run.

## 2026-10-20 — Streaming task pane responses and interaction polish

- Forwarded Responses API text deltas from the Bridge to the Outlook task pane as newline-delimited JSON. Translate, Suggest Reply, and follow-up answers now render progressively instead of waiting for the complete response. The Bridge forwards completion and error events, honors response backpressure, and aborts upstream work when the task pane disconnects.
- Follow-up questions now appear in the conversation immediately after submission, and the input clears before the model responds. Partial answers remain visible and are marked incomplete if generation fails; an empty placeholder is removed while the submitted question remains.
- **New request** clears Selected text, the follow-up field, and the current conversation/result. Removed the model-list **Refresh** button; Settings loads the model list when opened, and choosing a model still saves and applies it immediately.
- Simplified the saved-model status to show only the model name and clarified the privacy notice to say that clicked text is sent to OpenAI. No version bump was made.
- Updated README setup and troubleshooting notes for progressive output, immediate follow-up display, clearing Selected text, rebuilding the packaged app after source changes, and stale app copies that can report a missing Bridge.
- `node --check` passed for `bridge/server.mjs` and `src/taskpane.js`; `git diff --check` passed. The packaged app and streaming display have not yet been verified in Outlook on the target Mac. No tests, dependency installs, or macOS build were run.
