// ==UserScript==
// @name         Pairs AI Copilot & Local Sync
// @namespace    https://github.com/pithud/userscripts
// @version      1.3.0
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
      max-height: 140px;
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
  `;
  document.head.appendChild(style);

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
            <span>👤 相手プロフィール</span>
            <button id="copilot-rescan" style="border:none;background:none;color:#2563eb;font-size:11px;cursor:pointer;font-weight:bold;">🔄 再取得</button>
          </div>
          <div class="copilot-preview" id="copilot-preview-text">取得中...</div>
          <div id="copilot-status-text" style="font-size:11px;margin-top:4px;color:#64748b;"></div>
        </div>

        <button id="copilot-copy-md" class="copilot-btn" style="background:#475569;">📋 相談用Markdownコピー（差分のみ）</button>
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
  const copyMdBtn = document.getElementById('copilot-copy-md');
  const statusText = document.getElementById('copilot-status-text');
  const toast = document.getElementById('copilot-user-toast');

  let cached = null;

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
  rescanBtn.addEventListener('click', () => { extract(); sync(true); });

  function extract() {
    try {
      document.querySelectorAll('button, a, span, div').forEach(btn => {
        const text = btn.innerText?.trim();
        if (text && (text === 'もっと見る' || text === '続きを読む' || text === 'すべて見る')) {
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
      const idMatch = hash.match(/\/(?:chat|user|matching|profile)\/([a-zA-Z0-9_-]+)/) || 
                      path.match(/\/(?:chat|user|matching|profile)\/([a-zA-Z0-9_-]+)/) ||
                      window.location.href.match(/[?&]user_id=([a-zA-Z0-9_-]+)/);
      if (idMatch) userId = idMatch[1];

      const h = document.querySelector('[class*="chatHeader"], [class*="Header"], [class*="partner-name"], [class*="userName"], [class*="nickname"], [data-testid*="user-name"]');
      if (h) {
        const raw = h.textContent.trim().split('\n')[0].replace(/さん$/, '').trim();
        if (raw && !raw.includes('Pairs') && !raw.includes('メッセージ') && raw.length < 20) name = raw;
      }

      // チャット領域要素の除外セット
      const msgNodes = document.querySelectorAll('[class*="message"], [class*="Message"], [class*="bubble"], [class*="talkItem"]');
      const chatSet = new Set();
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

      // 自己紹介文スコアリング（チャット外）
      const excludeKeywords = ['規約', '通報', '違反報告', 'ブロック', 'いいね', 'スキップ', 'オンライン', '本人確認済', 'メッセージを入力', '写真を送信'];
      const bioIntroKeywords = ['はじめまして', 'よろしくお願いします', '見ていただき', '休日は', '仕事は', '趣味は', '都内在住', 'カフェ', '映画', 'アニメ', '旅行', '音楽'];

      const candidateElements = document.querySelectorAll('p, div, section, article, [dir="auto"], span, pre');
      let bestBioText = '';
      let bestBioScore = -1;

      candidateElements.forEach(el => {
        if (el.closest('#pairs-copilot-root') || chatSet.has(el)) return;
        if (el.children.length > 6) return;
        const text = (el.innerText || el.textContent || '').trim();
        if (!text || text.length < 20 || text.length > 4000) return;
        if (excludeKeywords.some(kw => text.includes(kw))) return;

        let score = 0;
        if (text.length >= 35) score += 20;
        if (text.length >= 70) score += 30;
        if (text.length >= 120) score += 30;
        if (text.includes('\n')) score += 25;
        if (text.includes('。') || text.includes('、')) score += 15;
        bioIntroKeywords.forEach(kw => { if (text.includes(kw)) score += 20; });
        if ((el.className || '').toString().match(/intro|bio|profile|about|text|detail/i)) score += 30;

        if (score > bestBioScore) {
          bestBioScore = score;
          bestBioText = text;
        }
      });
      profile = bestBioText;

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

      document.querySelectorAll('[class*="mytag"], [class*="tag"], [class*="community"], [class*="badge"]').forEach(n => {
        if (n.closest('#pairs-copilot-root') || chatSet.has(n)) return;
        const t = (n.innerText || '').trim().replace(/^#/, '');
        if (t && t.length < 25 && !t.match(/^(写真|サブ写真|本人確認|オンライン|ログイン|いいね|スキップ|メッセージ)$/)) {
          tags.push(t);
        }
      });

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
        profileText: profile.slice(0, 3000),
        tags: [...new Set(tags)],
        messages: msgs,
        isFirstMessage,
        rawUrl: window.location.href
      };

      const specStr = Object.entries(details).slice(0, 3).map(([k, v]) => `${k}:${v}`).join(' / ');
      const bioStatus = profile ? `✅ ${profile.slice(0, 80)}...` : '⚠️ 未取得（右パネルを開いて「🔄 再取得」）';

      preview.textContent = `👤 お相手: ${name} (${age || '年齢不明'} / ${location || '居住地不明'})\n${tweet ? `💬 ひとこと: "${tweet}"\n` : ''}${specStr ? `📋 スペック: ${specStr}\n` : ''}🏷️ タグ: ${cached.tags.slice(0, 4).join(', ') || 'なし'}\n📝 自己紹介文:\n${bioStatus}\n【フェーズ】: ${isFirstMessage ? '🐣 初回メッセージ' : `💬 やり取り中 (${msgs.length}件)`}`;
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

  setTimeout(() => { extract(); sync(); }, 1000);
  window.addEventListener('hashchange', () => { setTimeout(() => { extract(); sync(); }, 600); });
})();
