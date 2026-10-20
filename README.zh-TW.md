# MailCue

[English README](README.md) · [繁體中文使用說明](docs/使用說明.md) · [English User Guide](docs/user-guide.en.md)

MailCue 採用 MIT License，詳見 [LICENSE](LICENSE)。

MailCue 是 Outlook 側邊欄 Add-in，提供 **Email** 和 **Selected text** 兩種模式。你可以將郵件翻譯成指定語言（預設為繁體中文（台灣））、產生簡短自然的英文回覆建議，並針對結果繼續提問。回覆會逐步顯示。只有在你按下按鈕後，MailCue 才會將文字送到 OpenAI；它不會自動寄信。

## 專案起點

MailCue 是我透過 vibe coding 做出的個人實驗，想探索如何把 ChatGPT 訂閱和 Outlook 串在一起，協助翻譯郵件、草擬回覆。歡迎交流使用經驗、實作想法，或一起討論這類整合還能怎麼發展。

## 目前狀態

`package.json` 是版本號的唯一來源；建置指令會同步 Outlook manifest 版本。本版本使用 OpenAI 官方文件所述的 Sign in with ChatGPT 流程和公開 Responses API。程式碼變更仍需在目標 Mac 上重建並於 Outlook 確認。

## 需求

- macOS 和 Node.js 22 或更新版本
- 已啟用自訂 Outlook Add-in 的 Outlook for Mac
- 可授權 ChatGPT 方案用量的 ChatGPT 帳號
- 已在 macOS 信任的 localhost HTTPS 憑證（見下方設定）
- 專案 workspace 上層的共用 Python 環境，且已安裝 PySide6 和 PyInstaller；目前建置指令不會自動安裝這些工具

## 初次設定

1. 在安裝或 sideload manifest 前，同步版本號：

   ```sh
   npm run sync-version
   ```

2. 建立本機私有資料夾：

   ```sh
   sh scripts/prepare-app-support.sh
   ```

   專案程式碼、task pane 和 `manifest.xml` 留在 workspace。Outlook 帳號設定、localhost 憑證和受保護的 ChatGPT 登入資料放在 `~/Library/Application Support/MailCue`。

3. 設定允許使用 MailCue 的 Outlook 帳號：

   ```sh
   open -e "$HOME/Library/Application Support/MailCue/config.json"
   ```

   將範例地址改成你的 Outlook 地址並儲存。

4. 產生 localhost 憑證：

   ```sh
   sh scripts/generate-cert.sh
   ```

   將 `~/Library/Application Support/MailCue/certs/localhost.pem` 信任到 macOS 目前使用者的登入 Keychain，然後重新啟動 Outlook。憑證包含 `localhost` 和 `127.0.0.1`。

5. 建置選單列 App：在 Mac 上執行 `commands/build-menubar-app.command`，產生 `dist/MailCue.app`。若要先測試選單列控制器，可先結束已開啟的 MailCue App，再雙擊 `Run.command`；它會以前景方式執行並保留 Terminal 錯誤訊息。目前建置指令依賴上述共用 Python 環境；在其他位置全新 clone 的使用者，必須先自行準備建置環境，不能直接一鍵建置。成功建置後會刪除暫存的 `build/`、`build-logs/` 和 `dist/MailCue/`，保留 `dist/MailCue.app`。

6. 在 Outlook for Mac 使用 **Tools → Get Add-ins → My Add-ins → Add a custom add-in → Add from File**，選取專案中的 `manifest.xml`。

7. 從 macOS 選單列啟動 MailCue。於 Outlook 開啟郵件並開啟 **MailCue** 側邊欄，在 **Settings** 選 **Connect ChatGPT**，於瀏覽器登入並授權方案用量。OAuth 登入資料會存放在 `~/Library/Application Support/MailCue/Private`，權限僅限目前使用者。

   若舊版資料仍在 `~/Library/Application Support/Outlook Assistant`，請先結束 MailCue，再將資料搬到 `~/Library/Application Support/MailCue`。若目的地資料夾已存在，先備份兩邊，再小心合併；不要直接覆蓋。

8. 開啟 **Settings**，選擇 ChatGPT 模型。首次使用會採用清單中的第一個模型；改選其他模型後會立即儲存並套用。

## 日常使用

1. 從 macOS 選單列的 MailCue 選單選 **Turn On**。使用 Add-in 時，本機服務必須保持啟動。
2. 在 Outlook 開啟郵件，打開 MailCue 側邊欄。選 **Email** 處理目前開啟的郵件，或選 **Selected text** 貼上要處理的文字。
3. 按 **Translate** 翻譯，或按 **Suggest Reply** 產生簡短英文回覆建議。結果會逐步顯示；郵件不會自動寄出。
4. 在結果下方輸入問題以詢問或修改結果。按 **Enter** 送出，按 **Shift+Enter** 換行。
5. **New request** 會清除結果、對話、追問欄和 Selected text 輸入內容。

### 設定翻譯語言

在側邊欄按齒輪開啟 **Settings**，於 **Translate to** 選擇建議語言或輸入其他語言名稱，再按 **Save**。預設語言是 **Traditional Chinese (Taiwan)**。

## 選單列控制器

- **Turn On / Turn Off**：啟動或停止本機服務。
- **Launch at Login**：設定 MailCue 選單列 App 在下次登入 macOS 時自動啟動。啟用後不要移動 `dist/MailCue.app`。
- **Quit MailCue**：停止服務並結束選單列 App。

變更程式碼後，需在 Mac 上重建並重新啟動 `dist/MailCue.app`。只要 Add-in 的 manifest URL 沒有變更，通常不用重新安裝 Outlook Add-in。選單列 App 和 `npm_start.command` 都會使用本機連接埠 1455、1456，不要同時執行。

## 本機網址

- Add-in 和 Bridge API：`https://localhost:1455`
- OpenAI OAuth loopback callback：`http://127.0.0.1:1456/auth/callback`

Bridge 只綁定 loopback，不會在區域網路上開啟服務。

## 主要檔案

- `manifest.xml`：Outlook 郵件讀取 Add-in 宣告
- `taskpane.html`、`src/taskpane.js`、`src/taskpane.css`：模式、設定、逐步輸出和追問對話
- `bridge/server.mjs`：HTTPS task pane server、本機 OAuth callback、憑證處理和 Responses API 請求
- `scripts/`：本機憑證與 macOS LaunchAgent 工具
- `docs/使用說明.md`、`docs/user-guide.en.md`：中英文使用指南

## 限制與注意事項

- MailCue 使用官方文件所述的公開 Responses API 和 ChatGPT 方案 OAuth token，不使用 API key 或非公開 Codex endpoint。
- OpenAI 的預覽功能、帳號資格、模型清單和使用限制可能變動，需以你的 ChatGPT 帳號實際授權結果為準。
- MailCue 會檢查設定的 Outlook 帳號，並透過每次執行產生的 token 和 Origin 驗證保護 localhost API。這可防範一般跨來源呼叫，但無法對同一台 Mac、同一個使用者身分下的惡意程式提供嚴格信箱隔離。更嚴格的隔離需要驗證 Outlook 身分 token 和 Microsoft 應用程式註冊。
- 模型選擇器顯示目前帳號可見的模型；清單上的模型仍可能不接受 Responses 請求。遇到錯誤時，請在 Settings 改選其他模型。
- OAuth、模型清單、Responses 串流和 Outlook 郵件讀取都有逾時限制。若操作停滯，MailCue 會顯示錯誤而不是一直保持忙碌。
- Outlook Add-in 的內容頁面使用 localhost，因此使用時 Bridge 必須執行。選單列 App 會啟停 Bridge；`npm_start.command` 可作為手動替代方式。
- 不要將 `config.json`、憑證或 OAuth 登入資料 commit 到 Git。
