// ==UserScript==
// @name         Pairs AI Copilot & Local Sync
// @namespace    https://github.com/pithud/userscripts
// @version      2.0.0
// @description  Pairs(Web版)の全自動コパイロット（画面開く → プロフィール自動展開 → 文章生成ボタン押下 → ローカルAI連携入力完了 → 手動送信）
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

  const SERVER_URLS = ['http://127.0.0.1:9999', 'http://127.0.0.1:3000', 'http://127.0.0.1:3214'];

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
      max-height: 84vh;
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
      max-height: 180px;
      overflow-y: auto;
      background: #fff;
      padding: 8px;
      border-radius: 4px;
      margin-top: 4px;
      white-space: pre-wrap;
      line-height: 1.45;
      border: 1px solid #e2e8f0;
    }
    .copilot-presets {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }
    .copilot-preset-btn {
      padding: 6px 8px;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 11px;
      cursor: pointer;
      text-align: center;
    }
    .copilot-preset-btn.active {
      background: #e0f2fe;
      border-color: #0284c7;
      color: #0369a1;
      font-weight: bold;
    }
    .copilot-btn {
      width: 100%;
      padding: 12px;
      background: #2563eb;
      color: #fff;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: bold;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(37,99,235,0.3);
    }
    .copilot-pill-btn {
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      cursor: pointer;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
    }
  `;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'pairs-copilot-root';
  root.innerHTML = `
    <button id="pairs-copilot-trigger" title="Pairs AI Copilot">✨</button>
    <div id="pairs-copilot-panel">
      <div class="copilot-header">
        <span>✨ Pairs AI 返信アシスト（ローカル連携）</span>
        <button id="copilot-close" style="background:none;border:none;font-size:20px;cursor:pointer;">×</button>
      </div>
      <div class="copilot-body">
        <div class="copilot-card">
          <div style="font-weight:bold;display:flex;justify-content:space-between;align-items:center;">
            <span>👤 相手プロフィール</span>
            <div style="display:flex; gap:6px; align-items:center;">
              <button id="copilot-rescan" class="copilot-pill-btn" style="padding:2px 6px; font-size:10px;">🔄 再取得</button>
              <span id="copilot-mode" style="font-size: 11px; font-weight: normal; padding: 2px 6px; border-radius: 4px; background: #e0f2fe; color: #0369a1;">取得中</span>
            </div>
          </div>
          <div class="copilot-preview" id="copilot-preview-text">取得中...</div>
        </div>

        <div>
          <div style="font-weight:bold; font-size:12px; margin-bottom:4px;">🎯 返信方針</div>
          <div class="copilot-presets">
            <button class="copilot-preset-btn" data-preset="first_message">🐣 初回メッセージ</button>
            <button class="copilot-preset-btn active" data-preset="sympathy_question">💬 共感 ＋ 質問</button>
            <button class="copilot-preset-btn" data-preset="deep_dive">🔍 趣味の深掘り</button>
            <button class="copilot-preset-btn" data-preset="date_invite">☕ デート打診</button>
          </div>
        </div>

        <!-- メイン文章生成ボタン（ローカルサーバー連携） -->
        <button id="copilot-generate-main" class="copilot-btn" style="background: linear-gradient(135deg, #2563eb, #1d4ed8);">
          🚀 文章生成（入力完了）
        </button>

        <div id="copilot-result-box" style="font-size:12px;"></div>

        <div style="margin-top: 6px; border-top: 1px solid #f1f5f9; padding-top: 6px; display:flex; justify-content:space-between; align-items:center;">
          <button id="copilot-copy-md" style="background:none; border:none; color:#64748b; font-size:11px; cursor:pointer; padding:0;">📋 相談用Markdownコピー（差分のみ）</button>
          <span id="copilot-status-text" style="font-size: 11px; color: #94a3b8;"></span>
        </div>
      </div>
    </div>
    <div id="copilot-user-toast" style="display:none; position:fixed; top:20px; right:20px; z-index:10000000; background:#1e293b; color:#fff; padding:12px 18px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.3); font-size:13px; font-weight:500;"></div>
  `;
  document.body.appendChild(root);

  const trigger = document.getElementById('pairs-copilot-trigger');
  const panel = document.getElementById('pairs-copilot-panel');
  const closeBtn = document.getElementById('copilot-close');
  const rescanBtn = document.getElementById('copilot-rescan');
  const preview = document.getElementById('copilot-preview-text');
  const modeBadge = document.getElementById('copilot-mode');
  const generateMainBtn = document.getElementById('copilot-generate-main');
  const copyMdBtn = document.getElementById('copilot-copy-md');
  const resultBox = document.getElementById('copilot-result-box');
  const statusText = document.getElementById('copilot-status-text');
  const toast = document.getElementById('copilot-user-toast');
  const presetBtns = document.querySelectorAll('.copilot-preset-btn');

  let currentPreset = 'first_message';
  let cached = null;

  function showToast(msg, duration = 3500) {
    if (!toast) return;
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, duration);
  }

  function setPreset(p) {
    currentPreset = p;
    presetBtns.forEach(btn => {
      if (btn.getAttribute('data-preset') === p) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => setPreset(btn.getAttribute('data-preset')));
  });

  function triggerAutoOpen() {
    try {
      const partnerLink = document.querySelector(
        '[data-test="header-title"] a, header a[href*="/partner/"], [class*="handleClickInvitationAssistance"], [class*="chatHeader"] a, header [class*="previousSrcset"]'
      );
      if (partnerLink) partnerLink.click();
    } catch(e){}
  }

  trigger.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
      triggerAutoOpen();
      extract();
      sync();
    }
  });
  closeBtn.addEventListener('click', () => panel.classList.remove('open'));
  rescanBtn.addEventListener('click', () => { 
    triggerAutoOpen(); 
    setTimeout(() => { extract(); sync(true); }, 600);
  });

  // -------------------------------------------------------------
  // 自己紹介文・タグのピンポイント抽出
  // -------------------------------------------------------------
  function extract() {
    try {
      document.querySelectorAll('button, a, span, div').forEach(btn => {
        const text = btn.innerText?.trim();
        if (text && (text === 'もっと見る' || text === '続きを読む' || text === 'すべて見る' || text === 'さらに表示' || text === 'プロフィールを見る')) {
          try { btn.click(); } catch(e){}
        }
      });

      let name = 'お相手';
      let userId = '';
      let profile = '';
      let tweet = '';
      let age = '';
      let location = '';
      let details = {};
      let tags = [];
      let msgs = [];

      const hash = window.location.hash || '';
      const path = window.location.pathname || '';
      const idMatch = hash.match(/\/(?:chat|user|matching|profile|detail|partner)\/([a-zA-Z0-9_-]+)/) || 
                      path.match(/\/(?:chat|user|matching|profile|detail|partner)\/([a-zA-Z0-9_-]+)/) ||
                      window.location.href.match(/[?&]user_id=([a-zA-Z0-9_-]+)/);
      if (idMatch) userId = idMatch[1];

      // 相手名（ヘッダーのニックネーム要素）
      const headerTitle = document.querySelector('[data-test="header-title"], [class*="chatHeader"], header h1');
      if (headerTitle) {
        const nameSpans = headerTitle.querySelectorAll('span');
        for (let i = nameSpans.length - 1; i >= 0; i--) {
          const t = nameSpans[i].textContent.trim();
          if (t && t.length < 20 && !t.includes('Pairs') && !t.includes('メッセージ')) {
            name = t;
            break;
          }
        }
        if (name === 'お相手') {
          const raw = headerTitle.textContent.trim().split('\n')[0].replace(/さん$/, '').trim();
          if (raw && raw.length < 20) name = raw;
        }
      }

      // チャット領域除外
      const chatSet = new Set();
      const inputArea = document.querySelector('textarea, [class*="messageInput"], [class*="ChatInput"], [data-testid*="input"]');
      if (inputArea) {
        let p = inputArea.parentElement;
        for (let i = 0; i < 6 && p; i++) { chatSet.add(p); p = p.parentElement; }
      }

      const msgNodes = document.querySelectorAll('[class*="message"], [class*="Message"], [class*="bubble"], [class*="talkItem"]');
      msgNodes.forEach(n => {
        chatSet.add(n);
        let p = n.parentElement;
        for (let i = 0; i < 4 && p; i++) { chatSet.add(p); p = p.parentElement; }
        const t = (n.innerText || '').trim();
        if (t && t.length < 500) {
          const isMine = n.className?.includes('mine') || n.className?.includes('self') || n.className?.includes('right');
          const cleanText = t.replace(/^(既読|未読|\d{1,2}:\d{2})\s*/, '').trim();
          if (cleanText) msgs.push(`${isMine ? '自分' : name}: ${cleanText}`);
        }
      });
      msgs = [...new Set(msgs)];

      // 🎯 自己紹介文のピンポイント抽出（画像構造: h2"自己紹介" + p）
      const allHeadings = Array.from(document.querySelectorAll('h1, h2, h3, h4, div, span, p'));
      for (const hd of allHeadings) {
        if (chatSet.has(hd) || hd.closest('#pairs-copilot-root')) continue;
        const hText = hd.innerText?.trim();
        if (hText === '自己紹介' || hText === '自己紹介文') {
          const parent = hd.parentElement;
          const targetP = parent?.querySelector('p') || hd.nextElementSibling?.querySelector('p') || hd.nextElementSibling;
          if (targetP) {
            const pText = (targetP.innerText || targetP.textContent || '').trim();
            if (pText && pText.length >= 10 && pText !== '自己紹介') {
              profile = pText;
              break;
            }
          }
        }
      }

      if (!profile) {
        const partnerContainers = document.querySelectorAll('[class*="partnerId"], [class*="PromptBoard"], div[class*="-component"]');
        for (const container of partnerContainers) {
          if (chatSet.has(container) || container.closest('#pairs-copilot-root')) continue;
          const p = container.querySelector('p');
          if (p) {
            const pText = (p.innerText || p.textContent || '').trim();
            if (pText && pText.length >= 25) {
              profile = pText;
              break;
            }
          }
        }
      }

      // 🏷️ タグ抽出
      document.querySelectorAll('img[src*="community"], img[src*="tag"], img[src*="mytag"], img[alt*="コミュニティ"], img[alt*="タグ"]').forEach(img => {
        const label = img.alt || img.getAttribute('title') || img.parentElement?.innerText?.trim();
        if (label && label.length >= 2 && label.length <= 25 && !label.includes('http')) {
          tags.push(label);
        }
      });

      const tagSelectors = '[class*="mytag"], [class*="MyTag"], [class*="tag"], [class*="Tag"], [class*="community"], [class*="Community"], [class*="badge"], [data-testid*="tag"]';
      document.querySelectorAll(tagSelectors).forEach(t => {
        if (t.closest('#pairs-copilot-root') || chatSet.has(t)) return;
        const txt = (t.innerText || t.textContent || '').trim().replace(/^#/, '');
        if (txt && txt.length >= 2 && txt.length <= 25 && !txt.match(/^(写真|サブ写真|本人確認|オンライン|ログイン|いいね|スキップ|メッセージ|VIP|プレミアム|もっと見る|閉じる)$/)) {
          tags.push(txt);
        }
      });

      const tweetElem = document.querySelector('[class*="tweet"], [class*="Tweet"], [class*="catchphrase"], [class*="oneWord"], [data-testid*="tweet"]');
      if (tweetElem && !chatSet.has(tweetElem)) tweet = tweetElem.textContent.trim().replace(/^["「『]|["」』]$/g, '');

      const fullBodyText = document.body.innerText;
      const ageMatch = fullBodyText.match(/(\d{2}歳)/);
      if (ageMatch) age = ageMatch[1];
      const locMatch = fullBodyText.match(/(東京|神奈川|埼玉|千葉|大阪|愛知|福岡|北海道|京都|兵庫|宮城|広島|[^\s\n\(\)0-9]{2,3}[都道府県])/);
      if (locMatch) location = locMatch[1];

      document.querySelectorAll('dl, tr, [class*="item"], [class*="row"]').forEach(row => {
        if (row.closest('#pairs-copilot-root') || chatSet.has(row)) return;
        const lines = (row.innerText || '').trim().split(/[\n\t:]+/).map(s => s.trim()).filter(Boolean);
        if (lines.length >= 2) {
          const k = lines[0];
          const v = lines.slice(1).join(' ');
          if (k.match(/職種|仕事|職業|身長|体型|年収|学歴|休日|出身|血液型|同居|タバコ|お酒|結婚|子供/) && k.length <= 12 && v.length <= 40) {
            if (!details[k]) details[k] = v;
          }
        }
      });

      const hasMyMessage = msgs.some(m => m.startsWith('自分:'));
      const isFirstMessage = (msgs.length === 0 || !hasMyMessage);

      if (isFirstMessage) {
        setPreset('first_message');
        modeBadge.textContent = '🐣 初回（はじめまして）';
        modeBadge.style.background = '#fef3c7';
        modeBadge.style.color = '#92400e';
      } else {
        setPreset('sympathy_question');
        modeBadge.textContent = `💬 やり取り中 (${msgs.length}件)`;
        modeBadge.style.background = '#dcfce7';
        modeBadge.style.color = '#166534';
      }

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
        profileText: profile.slice(0, 3000),
        tags: [...new Set(tags)],
        messages: msgs,
        isFirstMessage,
        rawUrl: window.location.href
      };

      const specStr = Object.entries(details).slice(0, 3).map(([k, v]) => `${k}:${v}`).join(' / ');
      const bioStatus = profile ? `✅ 取得完了:\n${profile.slice(0, 120)}...` : '⚠️ プロフィール未展開（上部アイコンをクリックまたは「🔄 再取得」）';
      const tagStatus = cached.tags.length > 0 ? `✅ ${cached.tags.slice(0, 5).join(', ')}` : '⚠️ タグ未検出';

      preview.textContent = `👤 お相手: ${name} (${age || '年齢不明'} / ${location || '居住地不明'})\n${tweet ? `💬 ひとこと: "${tweet}"\n` : ''}${specStr ? `📋 スペック: ${specStr}\n` : ''}🏷️ タグ: ${tagStatus}\n📝 自己紹介文:\n${bioStatus}`;
    } catch (e) {
      preview.textContent = '取得エラー';
    }
  }

  function sync(manual = false) {
    if (!cached) return;
    statusText.textContent = '🔄 同期中...';

    function trySync(urlIndex = 0) {
      if (urlIndex >= SERVER_URLS.length) {
        statusText.textContent = '';
        return;
      }
      const sUrl = SERVER_URLS[urlIndex];
      GM_xmlhttpRequest({
        method: 'POST',
        url: `${sUrl}/api/dating/sync`,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify(cached),
        onload: function(res) {
          try {
            const json = JSON.parse(res.responseText);
            statusText.innerHTML = `✅ 保存済: <code>${json.folderName}</code>`;
            if (manual) showToast(`📂 保存完了: ${json.folderName}`);
          } catch (e) {
            trySync(urlIndex + 1);
          }
        },
        onerror: function() {
          trySync(urlIndex + 1);
        }
      });
    }

    trySync(0);
  }

  // 入力欄流し込み
  function insertToInput(text) {
    const input = document.querySelector('textarea, [contenteditable="true"], [class*="messageInput"], [class*="ChatInput"], input[type="text"]');
    if (input) {
      if (input.tagName.toLowerCase() === 'textarea' || input.tagName.toLowerCase() === 'input') {
        const proto = input.tagName.toLowerCase() === 'textarea' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (nativeSetter) {
          nativeSetter.call(input, text);
        } else {
          input.value = text;
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.focus();
      } else if (input.isContentEditable) {
        input.innerText = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.focus();
      }
      showToast('✨ 入力完了！内容を確認して送信してください。', 4000);
    }
  }

  // 🚀 文章生成（入力完了）: ローカルサーバー（ポート9999）連携
  generateMainBtn.addEventListener('click', () => {
    extract();
    generateMainBtn.textContent = '⏳ ローカルAI生成中...';
    generateMainBtn.disabled = true;

    const payload = {
      ...cached,
      preset: currentPreset
    };

    function tryGenerate(urlIndex = 0) {
      if (urlIndex >= SERVER_URLS.length) {
        generateMainBtn.textContent = '🚀 文章生成（入力完了）';
        generateMainBtn.disabled = false;
        showToast('❌ ローカルサーバー(ポート9999)に接続できませんでした');
        return;
      }

      const sUrl = SERVER_URLS[urlIndex];
      GM_xmlhttpRequest({
        method: 'POST',
        url: `${sUrl}/api/dating/generate`,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify(payload),
        onload: function(res) {
          generateMainBtn.textContent = '🚀 文章生成（入力完了）';
          generateMainBtn.disabled = false;
          try {
            const json = JSON.parse(res.responseText);
            if (json.draft) {
              insertToInput(json.draft);
              resultBox.innerHTML = `<div style="background:#f1f5f9;padding:8px;border-radius:6px;margin-top:6px;"><strong>セットした文案:</strong><br>${json.draft}</div>`;
            } else {
              showToast('❌ 文案の生成に失敗しました');
            }
          } catch(e) {
            tryGenerate(urlIndex + 1);
          }
        },
        onerror: function() {
          tryGenerate(urlIndex + 1);
        }
      });
    }

    tryGenerate(0);
  });

  copyMdBtn.addEventListener('click', () => {
    if (!cached) extract();
    const d = cached;
    const diffMessages = d.messages.slice(-3);

    const md = `# お相手: ${d.name} (${d.age || '不明'} / ${d.location || '不明'})
- **ひとこと**: ${d.tweet ? `「${d.tweet}」` : 'なし'}
- **タグ**: ${d.tags.slice(0, 6).join(', ') || 'なし'}
- **状態**: ${d.isFirstMessage ? '🐣 初回メッセージ（はじめまして）' : '💬 やり取り中'}

## 自己紹介文
\`\`\`
${d.profileText || '（自己紹介文未取得）'}
\`\`\`

## 直近の会話（差分）
${diffMessages.length > 0 ? diffMessages.map(m => `- ${m}`).join('\n') : '- （初回メッセージ・会話履歴なし）'}
`;
    navigator.clipboard.writeText(md).then(() => {
      showToast('📋 相談用Markdown（差分）をコピーしました');
    });
  });

  panel.classList.add('open');

  // 初期ロード時・ハッシュ変化時にプロフィール自動展開
  setTimeout(() => { 
    triggerAutoOpen(); 
    setTimeout(() => { extract(); sync(); }, 600);
  }, 1000);

  window.addEventListener('hashchange', () => { 
    panel.classList.add('open');
    setTimeout(() => { 
      triggerAutoOpen(); 
      setTimeout(() => { extract(); sync(); }, 600);
    }, 500); 
  });
})();
