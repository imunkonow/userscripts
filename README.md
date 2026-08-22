# UserScripts (`pithud/userscripts`)

ブラウザ（PC / iPhone / Android）で動作するユーザースクリプト集です。

---

## 📦 スクリプト一覧

| 対象サービス | ディレクトリ / スクリプト | インストールURL |
| :--- | :--- | :--- |
| **Pairs** | [`pairs/`](pairs/) | [インストール](https://raw.githubusercontent.com/pithud/userscripts/main/pairs/userscript.user.js) |

---

## 🚀 インストール方法

### iPhone (Safari)
1. App Store から **Userscripts**（無料）または **Tampermonkey** をインストール。
2. 上記の「インストールURL」をSafariで開いて追加。

### PC (Chrome / Edge)
1. **Tampermonkey** または **Violentmonkey** をインストール。
2. 上記の「インストールURL」を開いて「インストール」をクリック。

---

## 🛠️ 新規スクリプトの追加手順

1. `projects/userscripts/<サービス名>/userscript.user.js` を作成。
2. メタデータに以下を記述：
   ```javascript
   // @updateURL    https://raw.githubusercontent.com/pithud/userscripts/main/<サービス名>/userscript.user.js
   // @downloadURL  https://raw.githubusercontent.com/pithud/userscripts/main/<サービス名>/userscript.user.js
   ```
3. コミット＆プッシュで即時配信・自動同期。
