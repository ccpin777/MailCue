# MailCue

[繁體中文](README.zh-TW.md) · [User Guide](docs/user-guide.en.md)

MailCue is licensed under the MIT License. See [LICENSE](LICENSE).

A personal Outlook task pane with Email and Selected text modes. Translate email text into a configurable target language (Traditional Chinese (Taiwan) by default), draft a short English reply, and ask follow-up questions about the result. Responses appear progressively as they are generated. MailCue sends text to OpenAI only after you click and never sends email.

## Why I built this

MailCue is a personal vibe-coding project exploring how a ChatGPT subscription could work alongside Outlook to help translate emails and draft replies. I’d love to hear your experience, ideas, and thoughts on what else this kind of integration could do.

## Current status

The `package.json` version is canonical. The build command synchronizes the Outlook manifest, and this iteration has not yet been verified in Outlook. The OAuth flow follows OpenAI's documented Sign in with ChatGPT flow and public Responses API.

## Requirements

- macOS with Node.js 22+
- Outlook for Mac with custom Outlook add-ins enabled
- A ChatGPT plan eligible to authorize plan usage
- A locally trusted HTTPS certificate for `localhost` (see below)
- A Python environment with PySide6 and PyInstaller in the parent workspace; the current build command expects this shared environment and does not install it

## Setup

1. To synchronize the Outlook manifest version from `package.json` before sideloading, run:

   ```sh
   npm run sync-version
   ```

2. Prepare the private data folder:

   ```sh
   sh scripts/prepare-app-support.sh
   ```

   Project code, task pane files, and `manifest.xml` stay in your workspace. The mailbox setting, local HTTPS certificate, and protected ChatGPT credentials go under `~/Library/Application Support/MailCue`.

3. Set the one Outlook mailbox this tool is allowed to process:

   ```sh
   open -e "$HOME/Library/Application Support/MailCue/config.json"
   ```

   Replace the example address with your Outlook address and save the file.

4. Generate a localhost certificate:

   ```sh
   sh scripts/generate-cert.sh
   ```

   Trust `~/Library/Application Support/MailCue/certs/localhost.pem` in macOS Keychain for the current user, then restart Outlook. The certificate includes `localhost` and `127.0.0.1` in its subject alternative names.

5. To test the menu bar controller before packaging, quit any running MailCue app and double-click `Run.command`. It launches the Python source directly and keeps Terminal open for visible errors. When the source version works, double-click `commands/build-menubar-app.command` to build `dist/MailCue.app` with the same PySide6 and PyInstaller approach used by Coding Deck. The command expects the shared Python environment described above; a fresh clone outside that workspace cannot use it until the build environment is set up. After a successful build, it removes `build/`, `build-logs/`, and `dist/MailCue/`, keeping only `dist/MailCue.app`. Swift and Xcode are not used.

6. In Outlook for Mac, sideload the project folder's `manifest.xml` using **Tools → Get Add-ins → My Add-ins → Add a custom add-in → Add from File**.

7. Open a message in the allowed mailbox and open **MailCue**. In **Settings**, choose **Connect ChatGPT** once and approve plan usage in the browser. OAuth credentials are kept in `~/Library/Application Support/MailCue/Private` with owner-only permissions.

   Existing installations that used `~/Library/Application Support/Outlook Assistant` must quit MailCue and move that folder to `~/Library/Application Support/MailCue` before starting this version. This keeps the existing mailbox setting, certificate, and ChatGPT sign-in. If the destination folder already exists, back up both folders and merge carefully instead of replacing either one.
8. Open **Settings** to load the connected account's model list. Choose a model to save and apply it immediately; the first listed model is used until you choose another.
9. Choose **Email** to process the open message on demand, or **Selected text** to paste only the text you want to use. Translate and Suggest Reply display their output progressively. Enter submits a follow-up immediately: your question appears in the conversation and the input clears while MailCue generates its response. **New request** clears the result, conversation, follow-up input, and Selected text input.

## Menu bar controller

Use **Turn On** and **Turn Off** in the menu bar menu to start or stop the local service. **Launch at Login** saves a macOS LaunchAgent so the menu bar app starts automatically on later logins. **Quit MailCue** stops the local service and exits the menu bar app. Keep `dist/MailCue.app` in the same location after enabling Launch at Login.

The packaged app contains a copy of the Bridge and task pane files. Rebuild and relaunch `dist/MailCue.app` after changing project source; the Outlook add-in does not need to be reinstalled when its manifest URL has not changed. The build command checks that `bridge/server.mjs` is present in the app bundle. If a running app reports that the Bridge is missing, quit older MailCue instances and launch the newly built app rather than a separate older copy.

Use either the menu bar app or `npm_start.command` at a time. Both use local ports 1455 and 1456, so starting both will produce an address-in-use error.

## Local URLs

- Add-in and bridge API: `https://localhost:1455`
- OpenAI OAuth loopback callback: `http://127.0.0.1:1456/auth/callback`

The bridge binds only to loopback. It does not expose a network listener to other devices.

## Files

- `manifest.xml`: Outlook read-item add-in declaration.
- `taskpane.html`, `src/taskpane.js`, `src/taskpane.css`: mode selector, settings, progressively streamed translation/reply output, and follow-up conversation.
- `bridge/server.mjs`: HTTPS task pane server, local OAuth callback, credential handling, and Responses API requests.
- `scripts/`: local certificate and macOS LaunchAgent helpers.

## Limits and notes

- This prototype uses the documented public Responses API with the ChatGPT-plan OAuth token, not an API key or a private Codex endpoint.
- OpenAI can change preview behavior or eligibility. Account authorization, model availability, and usage limits must be verified with your own ChatGPT account.
- MailCue checks the selected Outlook address and protects its localhost API with a per-run token and Origin validation. This prevents ordinary cross-origin calls, but it cannot provide strict mailbox isolation against a determined process running as the same macOS user. That would require Outlook identity-token validation and Microsoft app registration.
- The model selector shows the connected account's current visible model list. A listed model may still reject a Responses request; MailCue shows that error so you can choose another listed model.
- OAuth, model listing, Responses streaming, and Outlook body reads have time limits. A slow or stalled operation returns an error instead of leaving the task pane busy indefinitely.
- The Add-in content URL is localhost, so the bridge must be running while you use the add-in. The menu bar app starts and stops it; `npm_start.command` remains available as a manual fallback.
- Do not commit `config.json`, certificates, or OAuth credentials.
