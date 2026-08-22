// ==UserScript==
// @name         Pairs AI Copilot & Local Sync
// @namespace    https://github.com/pithud/userscripts
// @version      1.1.0
// @description  Pairs(Web版)のプロフィール詳細（自己紹介文・つぶやき・スペック）と会話履歴から相手別フォルダ自動作成・初回はじめましてメッセージ判定・返信文案自動挿入
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
      width: 380px;
      max-height: 82vh;
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
      max-height: 120px;
      overflow-y: auto;
      background: #fff;
      padding: 8px;
      border-radius: 4px;
      margin-top: 4px;
      white-space: pre-wrap;
      line-height: 1.4;
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
    .copilot-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: normal;
    }
  `;
  document.head.appendChild(style);

  // ルートDOM作成
  const root = document.createElement('div');
  root.id = 'pairs-copilot-root';
  root.innerHTML = `
    <button id="pairs-copilot-trigger" title="Pairs AI Copilot">✨</button>
    <div id="pairs-copilot-panel">
      <div class="copilot-header">
        <span>✨ Pairs AI & プロフィール同期</span>
        <button id="copilot-close" style="background:none;border:none;font-size:20px;cursor:pointer;">×</button>
      </div>
      <div class="copilot-body">
        <div class="copilot-card">
          <div style="font-weight:bold;display:flex;justify-content:space-between;align-items:center;">
            <span>👤 相手プロフィール & 会話</span>
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
      let tweet = '';
      let age = '';
      let location = '';
      let details = {};
      let tags = [];
      let msgs = [];

      // 1. URLからuserId抽出
      const hash = window.location.hash || '';
      const path = window.location.pathname || '';
      const idMatch = hash.match(/\/(?:chat|user|matching|profile)\/([a-zA-Z0-9_-]+)/) || 
                      path.match(/\/(?:chat|user|matching|profile)\/([a-zA-Z0-9_-]+)/) ||
                      window.location.href.match(/[?&]user_id=([a-zA-Z0-9_-]+)/);
      if (idMatch) userId = idMatch[1];

      // 2. 相手名
      const h = document.querySelector('[class*="chatHeader"], [class*="Header"], [class*="partner-name"], [class*="userName"], [class*="nickname"], [data-testid*="user-name"]');
      if (h) {
        const raw = h.textContent.trim().split('\n')[0].replace(/さん$/, '').trim();
        if (raw && !raw.includes('Pairs') && !raw.includes('メッセージ')) name = raw;
      }

      // 3. プロフィール領域
      const profileRoots = document.querySelectorAll('[class*="profile"], [class*="Profile"], [class*="sidebar"], [class*="Sidebar"], [class*="user-info"], [class*="detail"], [class*="modal"], [role="dialog"], aside, main');

      // つぶやき
      const tweetElem = document.querySelector('[class*="tweet"], [class*="Tweet"], [class*="catchphrase"], [class*="Catchphrase"], [class*="status-message"], [class*="oneWord"], [data-testid*="tweet"]');
      if (tweetElem) tweet = tweetElem.textContent.trim().replace(/^["「『]|["」』]$/g, '');

      // 自己紹介文
      const introElem = document.querySelector('[class*="introduction"], [class*="Introduction"], [class*="bio"], [class*="Bio"], [class*="selfIntroduction"], [class*="profile-text"], [data-testid*="introduction"]');
      if (introElem) {
        profile = introElem.innerText.trim();
      } else {
        for (const pRoot of profileRoots) {
          const paragraphs = pRoot.querySelectorAll('p, div, section');
          for (const p of paragraphs) {
            const t = p.innerText.trim();
            if (t.length > 40 && !t.includes('規約') && !t.includes('通報') && !t.includes('ブロック') && !t.includes('いいね')) {
              if (t.length > profile.length) profile = t;
            }
          }
        }
      }

      // 年齢・居住地
      const allText = Array.from(profileRoots).map(r => r.innerText).join('\n');
      const ageMatch = allText.match(/(\d{2}歳)/) || document.body.innerText.match(/(\d{2}歳)/);
      if (ageMatch) age = ageMatch[1];
      const locMatch = allText.match(/(東京|神奈川|埼玉|千葉|大阪|愛知|福岡|北海道|京都|兵庫|宮城|広島|[^\s\n\(\)]+[都道府県])/);
      if (locMatch) location = locMatch[1];

      // スペック
      document.querySelectorAll('dl, tr, [class*="item"], [class*="row"]').forEach(row => {
        const lines = row.innerText.trim().split(/[\n\t:]+/).map(s => s.trim()).filter(Boolean);
        if (lines.length >= 2) {
          const k = lines[0];
          const v = lines.slice(1).join(' ');
          if (k.match(/職種|仕事|職業|身長|体型|年収|学歴|休日|出身|血液型|同居|タバコ|お酒|結婚|子供/) && k.length <= 12 && v.length <= 40) {
            if (!details[k]) details[k] = v;
          }
        }
      });

      // タグ
      document.querySelectorAll('[class*="mytag"], [class*="tag"], [class*="community"], [class*="badge"]').forEach(n => {
        const t = n.innerText.trim().replace(/^#/, '');
        if (t && t.length < 25 && !t.match(/^(写真|サブ写真|本人確認|オンライン|ログイン|いいね|スキップ|メッセージ)$/)) {
          tags.push(t);
        }
      });

      // 会話履歴
      document.querySelectorAll('[class*="message"], [class*="Message"], [class*="bubble"], [class*="talkItem"]').forEach(n => {
        const t = n.innerText.trim();
        if (t && t.length < 500) {
          const isMine = n.className.includes('mine') || n.className.includes('self') || n.className.includes('right');
          const cleanText = t.replace(/^(既読|未読|\d{1,2}:\d{2})\s*/, '').trim();
          if (cleanText) {
            msgs.push(`${isMine ? '自分' : name}: ${cleanText}`);
          }
        }
      });

      msgs = [...new Set(msgs)].slice(-20);
      const hasMyMessage = msgs.some(m => m.startsWith('自分:'));
      const isFirstMessage = (msgs.length === 0 || !hasMyMessage);

      if (!userId) {
        userId = name.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 0).toString(16);
      }

      cached = {
        userId,
        name,
        age,
        location,
        tweet,
        details,
        profileText: profile.slice(0, 2000),
        tags: [...new Set(tags)],
        messages: msgs,
        isFirstMessage,
        rawUrl: window.location.href
      };

      const specStr = Object.entries(details).slice(0, 3).map(([k, v]) => `${k}:${v}`).join(' / ');
      preview.textContent = `【お相手】: ${name} (${age || '年齢不明'} / ${location || '居住地不明'})\n${tweet ? `【つぶやき】: "${tweet}"\n` : ''}${specStr ? `【スペック】: ${specStr}\n` : ''}【タグ】: ${cached.tags.slice(0, 4).join(', ') || 'なし'}\n【自己紹介】: ${profile ? profile.slice(0, 60) + '...' : '（未取得）'}\n【フェーズ】: ${isFirstMessage ? '🐣 初回メッセージ（はじめまして）' : `💬 やり取り中 (${msgs.length}件)`}`;
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
    const d = cached;
    const detailsBlock = Object.keys(d.details).length > 0
      ? Object.entries(d.details).map(([k, v]) => `- **${k}**: ${v}`).join('\n')
      : '- なし';

    const md = `# お相手情報: ${d.name} (${d.userId})
- **年齢・居住地**: ${d.age || '不明'} / ${d.location || '不明'}
- **つぶやき**: ${d.tweet ? `「${d.tweet}」` : 'なし'}
- **URL**: ${d.rawUrl}
- **マイタグ**: ${d.tags.join(', ') || 'なし'}
- **フェーズ**: ${d.isFirstMessage ? '🐣 初回メッセージ（はじめまして）' : '💬 やり取り中'}

## 基本スペック
${detailsBlock}

## 自己紹介文
\`\`\`
${d.profileText || '（自己紹介文未取得）'}
\`\`\`

## 会話履歴
${d.messages.length > 0 ? d.messages.map(m => `- ${m}`).join('\n') : '- （会話履歴なし・初回メッセージ）'}
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
