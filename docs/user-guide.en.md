# MailCue User Guide

[繁體中文使用說明](使用說明.md) · [繁體中文 README](../README.zh-TW.md) · [English README](../README.md)

MailCue is an Outlook task pane add-in. It processes the open email or text you paste only when you click **Translate**, **Suggest Reply**, or **Ask**. It does not scan your mailbox automatically or send replies.

## First-time setup

If MailCue is not installed yet, start with the [first-time setup in the README](../README.md#setup). The repository currently provides source code and a manual build workflow, not a general one-click installer. Initial setup requires a Mac, Node.js, a locally trusted localhost certificate, an allowed Outlook account, and sideloading `manifest.xml` into Outlook. The build command also depends on a shared Python environment in the project workspace, so a fresh clone is not yet a one-click build for other users.

After the app and Outlook add-in are installed, open **Settings** in the task pane:

1. Confirm **Outlook account** matches the mailbox currently open in Outlook; enter it and click **Save** if needed.
2. Click **Connect ChatGPT**, then sign in and authorize in the browser.
3. Choose a **ChatGPT model**. The first listed model is used by default.
4. Review **Translate to**. It defaults to **Traditional Chinese (Taiwan)**; save any change.

Keep the MailCue menu bar service on (**Turn Off** is shown in its menu) while using the Outlook task pane.

## Daily use

1. Open the MailCue menu from the macOS menu bar and choose **Turn On**. The menu changes to **Turn Off** when the local service is running.
2. Open an email in Outlook and open the **MailCue** task pane.
3. Choose **Email** to process the open message. To process only an excerpt, choose **Selected text** and paste the text you want to use.
4. Click **Translate** or **Suggest Reply**. The translation or concise English reply suggestion streams into the pane. Replies are displayed only; MailCue does not send them.
5. Enter a question below the result to ask for an explanation or revision. Press **Enter** to submit or **Shift+Enter** to insert a newline.
6. Click **New request** to clear the current result, conversation, follow-up input, and Selected text input.

## Settings

Click the gear icon in the task pane to open **Settings**:

- **Connect ChatGPT**: Sign in and authorize plan usage the first time you use MailCue. Sign-in credentials stay on this Mac.
- **Outlook account**: Enter the Outlook address MailCue is allowed to use and click **Save**. The open Outlook account must match this address.
- **ChatGPT model**: Choose a model. The selection is saved and applied immediately.
- **Translate to**: Choose a suggested language or enter another language name, then click **Save**. The default is **Traditional Chinese (Taiwan)**.

Settings and sign-in data are stored in `~/Library/Application Support/MailCue`. Do not upload `config.json`, certificates, or sign-in credentials to GitHub.

## Starting and stopping MailCue

- **Turn On** starts the local service required by the Outlook add-in. Keep it running while using MailCue.
- **Turn Off** stops the service. The Outlook task pane cannot load or call MailCue while the service is stopped.
- **Launch at Login** starts the menu bar app automatically when you next log in to macOS. Keep `MailCue.app` at the same location after enabling this option.
- **Quit MailCue** stops the service and exits the menu bar app.

You can start the service manually with `npm_start.command`. Do not run it at the same time as **Turn On** in the menu bar app; both use the same local ports.

## After changing the source code

Rebuild `dist/MailCue.app` on your Mac with `commands/build-menubar-app.command`, then launch the new app. If the add-in manifest URL has not changed, you do not need to sideload the Outlook add-in again. The new translation-language setting appears in Outlook only after the rebuilt app is running.

## Troubleshooting

- **The task pane cannot load**: Make sure MailCue is running from the menu bar and the menu shows **Turn Off**. If the service is stopped, choose **Turn On**.
- **This mailbox is not enabled**: In Settings, set **Outlook account** to the account currently open in Outlook and click **Save**.
- **Address already in use**: Make sure the menu bar app and `npm_start.command` are not running at the same time.
- **The translation language did not change**: Click **Save** in Settings, then start a new Translate request.
- **A model returns an error**: Select another available model in Settings and retry.
