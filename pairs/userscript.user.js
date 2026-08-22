// ==UserScript==
// @name         Pairs AI Copilot & Local Sync
// @namespace    https://github.com/pithud/userscripts
// @version      1.0.0
// @description  Pairs(Web版)のプロフィールと会話履歴から相手別フォルダ自動作成・返信文案自動挿入
// @author       i
// @match        https://pairs.lv/*
// @updateURL    https://raw.githubusercontent.com/pithud/userscripts/main/pairs/userscript.user.js
// @downloadURL  https://raw.githubusercontent.com/pithud/userscripts/main/pairs/userscript.user.js
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @connect      localhost
// ==/UserScript==

(function() {
  'use strict';
  if (document.getElementById('pairs-copilot-root')) return;

  const SERVER_URL = 'http://127.0.0.1:3214';

  // スタイル注入
  const style = document.createElement('style');
  style.textContent = `
    #pairs-copilot-root {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    #pairs-copilot-trigger {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: #2563eb;
      color: #fff;
      border: none;
      box-shadow: 0 4px 14px rgba(37,99,235,0.4);
      font-size: 22px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #pairs-copilot-panel {
      display: none;
      position: fixed;
      bottom: 80px;
      right: 20px;
      width: 360px;
      max-height: 80vh;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.25);
      border: 1px solid #cbd5e1;
      overflow: hidden;
      flex-direction: column;
    }
    #pairs-copilot-panel.open { display: flex; }
    .copilot-header {
      padding: 12px 16px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: bold;
      font-size: 14px;
    }
    .copilot-body {
      padding: 14px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      font-size: 13px;
    }
    .copilot-card {
      background: #f1f5f9;
      padding: 10px;
      border-radius: 8px;
      font-size: 12px;
    }
    .copilot-preview {
      max-height: 90px;
      overflow-y: auto;
      background: #fff;
      padding: 6px;
      border-radius: 4px;
      margin-top: 4px;
      white-space: pre-wrap;
    }
    .copilot-btn {
      width: 100%;
      padding: 8px 12px;
      background: #2563eb;
      color: #fff;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: bold;
      font-size: 12px;
    }
  `;
  document.head.appendChild(style);

  // ルートDOM作成
  const root = document.createElement('div');
  root.id = 'pairs-copilot-root';
  root.innerHTML = `
    <button id="pairs-copilot-trigger">✨</button>
    <div id="pairs-copilot-panel">
      <div class="copilot-header">
        <span>✨ Pairs AI & フォルダ同期</span>
        <button id="copilot-close" style="background:none;border:none;font-size:20px;cursor:pointer;">×</button>
      </div>
      <div class="copilot-body">
        <div class="copilot-card">
          <div style="font-weight:bold;display:flex;justify-content:space-between;">
            <span>👤 相手情報 & 会話</span>
            <button id="copilot-sync" style="border:none;background:none;color:#2563eb;font-size:11px;cursor:pointer;font-weight:bold;">📂 ローカル同期</button>
          </div>
          <div class="copilot-preview" id="copilot-preview-text">取得中...</div>
          <div id="copilot-status-text" style="font-size:11px;margin-top:4px;color:#64748b;"></div>
        </div>

        <button id="copilot-copy-md" class="copilot-btn" style="background:#475569;">📋 相談用Markdownコピー</button>
      </div>
    </div>
    <div id="copilot-user-toast" style="display:none; position:fixed; top:20px; right:20px; z-index:10000000; background:#1e293b; color:#fff; padding:12px 18px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.3); font-size:13px; font-weight:500;"></div>
  `;
  document.body.appendChild(root);

  const trigger = document.getElementById('pairs-copilot-trigger');
  const panel = document.getElementById('pairs-copilot-panel');
  const closeBtn = document.getElementById('copilot-close');
  const preview = document.getElementById('copilot-preview-text');
  const copyMdBtn = document.getElementById('copilot-copy-md');
  const syncBtn = document.getElementById('copilot-sync');
  const statusText = document.getElementById('copilot-status-text');
  const toast = document.getElementById('copilot-user-toast');

  let cached = null;
  let lastDraftId = null;

  function showToast(msg, duration = 3000) {
    if (!toast) return;
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, duration);
  }

  trigger.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
      extract();
      sync();
    }
  });
  closeBtn.addEventListener('click', () => panel.classList.remove('open'));
  syncBtn.addEventListener('click', () => { extract(); sync(true); });

  function extract() {
    try {
      let name = 'お相手';
      let userId = '';
      let profile = '';
      let age = '';
      let location = '';
      let tags = [];
      let msgs = [];

      const hash = window.location.hash || '';
      const path = window.location.pathname || '';
      const idMatch = hash.match(/\/chat\/([a-zA-Z0-9_-]+)/) || path.match(/\/chat\/([a-zA-Z0-9_-]+)/);
      if (idMatch) userId = idMatch[1];

      const h = document.querySelector('[class*="chatHeader"], [class*="Header"], [class*="partner-name"], [class*="userName"]');
      if (h) name = h.textContent.trim().split('\n')[0] || name;

      const pBox = document.querySelector('[class*="profile"], [class*="Profile"], [class*="sidebar"], [class*="user-info"]');
      if (pBox) {
        profile = pBox.innerText.trim().slice(0, 1500);
        const ageMatch = profile.match(/(\d{2}歳)/);
        if (ageMatch) age = ageMatch[1];
        const locMatch = profile.match(/(東京|神奈川|埼玉|千葉|大阪|愛知|福岡|北海道|京都|兵庫|宮城|広島|[^\s\n]+[都道府県])/);
        if (locMatch) location = locMatch[1];
      }

      document.querySelectorAll('[class*="message"], [class*="Message"], [class*="bubble"], [class*="talkItem"]').forEach(n => {
        const t = n.innerText.trim();
        if (t && t.length < 500) {
          const isMine = n.className.includes('mine') || n.className.includes('self') || n.className.includes('right');
          msgs.push(`${isMine ? '自分' : name}: ${t}`);
        }
      });

      msgs = [...new Set(msgs)].slice(-20);
      if (!userId) {
        userId = name.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 0).toString(16);
      }

      cached = {
        userId,
        name,
        age,
        location,
        profileText: profile,
        tags,
        messages: msgs,
        rawUrl: window.location.href
      };

      preview.textContent = `相手: ${name} (ID: ${userId})\n直近発言:\n${msgs.slice(-3).join('\n') || '（履歴なし）'}`;
    } catch (e) {
      preview.textContent = '取得エラー';
    }
  }

  function sync(manual = false) {
    if (!cached) return;
    statusText.textContent = '🔄 同期中...';
    GM_xmlhttpRequest({
      method: 'POST',
      url: `${SERVER_URL}/api/sync`,
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify(cached),
      onload: function(res) {
        try {
          const json = JSON.parse(res.responseText);
          statusText.innerHTML = `✅ 保存済: <code>${json.folderName}</code>`;
          if (manual) showToast(`📂 保存完了: ${json.folderName}`);
        } catch (e) {
          statusText.textContent = '⚠️ 応答パースエラー';
        }
      },
      onerror: function() {
        statusText.textContent = '⚠️ サーバー (3214) 停止中';
      }
    });
  }

  copyMdBtn.addEventListener('click', () => {
    if (!cached) extract();
    const md = `# お相手情報: ${cached.name} (${cached.userId})
- 年齢・居住地: ${cached.age || '不明'} / ${cached.location || '不明'}
- URL: ${cached.rawUrl}

## 自己紹介文
\`\`\`
${cached.profileText}
\`\`\`

## 会話履歴
${cached.messages.map(m => `- ${m}`).join('\n')}
`;
    navigator.clipboard.writeText(md).then(() => {
      showToast('📋 Markdownをコピーしました。Antigravityに貼り付けてください。');
    });
  });

  function insertToInput(text) {
    const input = document.querySelector('textarea, [contenteditable="true"], [class*="messageInput"], [class*="ChatInput"], input[type="text"]');
    if (input) {
      if (input.tagName.toLowerCase() === 'textarea' || input.tagName.toLowerCase() === 'input') {
        input.value = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.focus();
      } else if (input.isContentEditable) {
        input.innerText = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.focus();
      }
      showToast('✨ Antigravityの文案を入力欄にセットしました！', 4000);
    }
  }

  // ドラフト自動監視
  setInterval(() => {
    GM_xmlhttpRequest({
      method: 'GET',
      url: `${SERVER_URL}/api/draft`,
      onload: function(res) {
        try {
          const draft = JSON.parse(res.responseText);
          if (draft && draft.text && !draft.consumed && draft.id !== lastDraftId) {
            lastDraftId = draft.id;
            insertToInput(draft.text);
            GM_xmlhttpRequest({
              method: 'POST',
              url: `${SERVER_URL}/api/draft/consume`,
              headers: { 'Content-Type': 'application/json' },
              data: JSON.stringify({ id: draft.id })
            });
          }
        } catch (e) {}
      }
    });
  }, 1500);

  setTimeout(() => { extract(); sync(); }, 1500);
  window.addEventListener('hashchange', () => { setTimeout(() => { extract(); sync(); }, 1000); });
})();
