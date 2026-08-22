// ==UserScript==
// @name         Pairs AI Copilot & Local Sync
// @namespace    https://github.com/pithud/userscripts
// @version      3.0.0
// @description  Pairs(Web版)コパイロット（👤プロフ全部取得 / 🔄履歴再取得 ➔ 🚀文章生成入力完了 ➔ 手動送信）
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

  const SERVER_URL = 'http://127.0.0.1:9999';

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
      align-items: center;
      justify-content: space-between;
    }
    .copilot-title { font-size: 14px; font-weight: bold; color: #0f172a; }
    .copilot-close-btn { background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b; }
    .copilot-body { padding: 14px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
    .copilot-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; font-size: 12px; }
    .copilot-presets { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .copilot-preset-btn {
      padding: 6px 4px;
      border: 1px solid #cbd5e1;
      background: #fff;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 500;
      color: #334155;
      cursor: pointer;
    }
    .copilot-preset-btn.active {
      background: #eff6ff;
      border-color: #3b82f6;
      color: #1d4ed8;
      font-weight: bold;
    }
    .copilot-textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 8px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 12px;
      resize: vertical;
      min-height: 48px;
      margin-top: 6px;
    }
  `;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'pairs-copilot-root';
  root.innerHTML = `
    <button id="pairs-copilot-trigger" title="Pairs AI アシストを開く">✨</button>
    <div id="pairs-copilot-panel">
      <div class="copilot-header">
        <div class="copilot-title">✨ Pairs AI 返信アシスト</div>
        <button class="copilot-close-btn" id="copilot-close-btn">×</button>
      </div>
      <div class="copilot-body">
        <div class="copilot-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-weight:bold; font-size:13px;">👤 相手プロフィール</span>
            <span id="copilot-mode-badge" style="font-size: 11px; padding: 2px 8px; border-radius: 12px; background: #f1f5f9; color: #64748b;">待機中</span>
          </div>

          <!-- アクションボタン（プロフ取得 / 再取得） -->
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; margin-bottom:8px;">
            <button id="copilot-fetch-profile-btn" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; padding:8px 6px; font-weight:bold; font-size:12px; border-radius:6px; cursor:pointer;" title="画面上のプロフィール（自己紹介・クエスチョン・タグ・スペック全内容）を丸ごと全部取得してローカル保存">
              👤 プロフ取得（全部取得）
            </button>
            <button id="copilot-fetch-chat-btn" style="background:#f8fafc; color:#334155; border:1px solid #cbd5e1; padding:8px 6px; font-weight:bold; font-size:12px; border-radius:6px; cursor:pointer;" title="最新のチャット履歴を再取得して差分を防止">
              🔄 履歴再取得
            </button>
          </div>

          <div id="copilot-extracted-preview" style="white-space: pre-wrap; max-height: 180px; overflow-y: auto; background: #fff; padding: 8px; border-radius: 6px; font-size: 12px; line-height: 1.45; border: 1px solid #e2e8f0;">お相手の画面で「👤 プロフ取得（全部取得）」を押してください</div>
        </div>

        <div>
          <div style="font-size:12px; font-weight:bold; color:#1e293b; margin-bottom:6px;">🎯 返信方針</div>
          <div class="copilot-presets">
            <button class="copilot-preset-btn" data-preset="first_message">🐣 初回メッセージ</button>
            <button class="copilot-preset-btn active" data-preset="sympathy_question">💬 共感 ＋ 質問</button>
            <button class="copilot-preset-btn" data-preset="deep_dive">🔍 趣味の深掘り</button>
            <button class="copilot-preset-btn" data-preset="date_invite">☕ デート打診</button>
          </div>
          <textarea id="copilot-custom-instruction" class="copilot-textarea" placeholder="追加の要望があれば入力（例: カフェの話題に触れる、など）"></textarea>
        </div>

        <div>
          <button id="copilot-start-ai-btn" style="width:100%; background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 12px; font-size: 14px; font-weight: bold; border-radius: 8px; color: #fff; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
            🚀 文章生成（入力完了）
          </button>
        </div>

        <div id="copilot-results-container"></div>

        <div style="margin-top: 4px; border-top: 1px solid #f1f5f9; padding-top: 8px; display:flex; justify-content:space-between; align-items:center;">
          <button id="copilot-copy-md-btn" style="background:none; border:none; color:#64748b; font-size:11px; cursor:pointer; padding:0;">📋 相談用Markdownコピー（全部）</button>
          <span id="copilot-sync-status" style="font-size: 11px; color: #059669; font-weight: 500;"></span>
        </div>
      </div>
    </div>
    <div id="copilot-toast" style="display:none; position:fixed; top:20px; right:20px; z-index:10000000; background:#1e293b; color:#fff; padding:12px 18px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.3); font-size:13px; font-weight:500; transition:all 0.3s ease;"></div>
  `;
  document.body.appendChild(root);

  const triggerBtn = document.getElementById('pairs-copilot-trigger');
  const panel = document.getElementById('pairs-copilot-panel');
  const closeBtn = document.getElementById('copilot-close-btn');
  const fetchProfileBtn = document.getElementById('copilot-fetch-profile-btn');
  const fetchChatBtn = document.getElementById('copilot-fetch-chat-btn');
  const syncStatus = document.getElementById('copilot-sync-status');
  const copyMdBtn = document.getElementById('copilot-copy-md-btn');
  const previewBox = document.getElementById('copilot-extracted-preview');
  const modeBadge = document.getElementById('copilot-mode-badge');
  const customInstructionInput = document.getElementById('copilot-custom-instruction');
  const startAiBtn = document.getElementById('copilot-start-ai-btn');
  const resultsContainer = document.getElementById('copilot-results-container');
  const presetBtns = document.querySelectorAll('.copilot-preset-btn');
  const toast = document.getElementById('copilot-toast');

  let currentPreset = 'first_message';
  let cachedData = {
    userId: '',
    name: 'お相手',
    age: '',
    location: '',
    tweet: '',
    details: {},
    rawProfile: '',
    profileText: '',
    tags: [],
    question: '',
    messages: [],
    isFirstMessage: true,
    rawUrl: window.location.href
  };

  function showToast(msg, duration = 3500) {
    if (!toast) return;
    toast.textContent = msg;
    toast.style.display = 'block';
    toast.style.opacity = '1';
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => { toast.style.display = 'none'; }, 300);
    }, duration);
  }

  function setPreset(presetName) {
    currentPreset = presetName;
    presetBtns.forEach(btn => {
      if (btn.getAttribute('data-preset') === presetName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      setPreset(btn.getAttribute('data-preset'));
    });
  });

  triggerBtn.addEventListener('click', () => { panel.classList.toggle('open'); });
  closeBtn.addEventListener('click', () => { panel.classList.remove('open'); });

  function triggerRealClick(el) {
    if (!el) return false;
    try {
      const opts = { bubbles: true, cancelable: true, view: window };
      el.dispatchEvent(new PointerEvent('pointerdown', opts));
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new PointerEvent('pointerup', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.dispatchEvent(new MouseEvent('click', opts));
      if (typeof el.click === 'function') el.click();
      return true;
    } catch (e) {
      return false;
    }
  }

  // 1. プロフ取得（全部取得）
  fetchProfileBtn.addEventListener('click', () => {
    fetchProfileBtn.textContent = '⏳ 全部取得中...';
    fetchProfileBtn.disabled = true;

    document.querySelectorAll('button, a, span, div').forEach(el => {
      if (el.closest('#pairs-copilot-root')) return;
      const t = (el.innerText || el.textContent || '').trim();
      if (t === 'もっと見る' || t === '続きを読む' || t === 'すべて見る' || t === 'さらに表示') {
        triggerRealClick(el);
      }
    });

    setTimeout(() => {
      extractFullProfile();
      extractChatMessages();
      updatePreview();
      autoSyncToLocal();
      fetchProfileBtn.textContent = '👤 プロフ取得（全部取得）';
      fetchProfileBtn.disabled = false;
      showToast('✅ プロフィール内容を丸ごと全部取得しました！');
    }, 200);
  });

  // 2. 履歴再取得
  fetchChatBtn.addEventListener('click', () => {
    fetchChatBtn.textContent = '⏳ 取得中...';
    fetchChatBtn.disabled = true;
    extractChatMessages();
    updatePreview();
    autoSyncToLocal();
    setTimeout(() => {
      fetchChatBtn.textContent = '🔄 履歴再取得';
      fetchChatBtn.disabled = false;
      showToast(`🔄 会話履歴を最新化しました（${cachedData.messages.length}件）`);
    }, 200);
  });

  function extractFullProfile() {
    try {
      let container = document.querySelector('[class*="partnerId"], [class*="PartnerView"], [role="dialog"], main, [class*="messageListRef"]') || document.body;
      
      let allText = '';
      if (container) {
        const clone = container.cloneNode(true);
        const panelInClone = clone.querySelector('#pairs-copilot-root');
        if (panelInClone) panelInClone.remove();
        allText = clone.innerText.trim();
      } else {
        allText = document.body.innerText.trim();
      }

      cachedData.rawProfile = allText;
      cachedData.profileText = allText;

      const lines = allText.split('\n').map(l => l.trim()).filter(Boolean);
      for (let i = 0; i < Math.min(lines.length, 12); i++) {
        const line = lines[i];
        const ageMatch = line.match(/(\d{2}歳)/);
        if (ageMatch) {
          cachedData.age = ageMatch[1];
          const locMatch = line.match(/(東京|神奈川|埼玉|千葉|大阪|愛知|福岡|北海道|京都|兵庫|宮城|広島|[^\s\n\(\)0-9]{2,3}[都道府県])/);
          if (locMatch) cachedData.location = locMatch[1];
          if (i > 0 && lines[i - 1].length <= 20 && !lines[i - 1].includes('Pairs') && !lines[i - 1].includes('戻る')) {
            cachedData.name = lines[i - 1];
          }
          break;
        }
      }

      for (let i = 0; i < lines.length - 1; i++) {
        if (lines[i] === 'ニックネーム' && lines[i + 1]) {
          cachedData.name = lines[i + 1];
        }
        if (lines[i] === '年齢' && lines[i + 1]) {
          cachedData.age = lines[i + 1];
        }
        if (lines[i] === '居住地' && lines[i + 1]) {
          cachedData.location = lines[i + 1];
        }
      }

      const heightMatch = allText.match(/(\d{3}\s*cm)/i) || allText.match(/身長\s*[\n\t:]*\s*(\d{3}\s*cm?)/i);
      if (heightMatch) {
        cachedData.details['身長'] = heightMatch[1].replace(/\s+/g, '');
      }

    } catch (e) {
      console.error('Full profile extraction error:', e);
    }
  }

  function extractChatMessages() {
    try {
      const messages = [];
      const msgNodes = document.querySelectorAll(
        '[class*="message"], [class*="Message"], [class*="bubble"], [class*="talkItem"], [class*="chat-item"], [data-testid*="message"]'
      );

      msgNodes.forEach(node => {
        if (node.closest('#pairs-copilot-root')) return;
        const text = node.innerText?.trim();
        if (!text || text.length > 600) return;
        const isMine = node.className?.includes('mine') || 
                       node.className?.includes('self') || 
                       node.className?.includes('sent') || 
                       node.className?.includes('right') ||
                       node.closest('[class*="mine"], [class*="self"], [class*="right"]');
        
        const sender = isMine ? '自分' : cachedData.name;
        const cleanText = text.replace(/^(既読|未読|\d{1,2}:\d{2})\s*/, '').trim();
        if (cleanText) {
          messages.push(`${sender}: ${cleanText}`);
        }
      });

      cachedData.messages = [...new Set(messages)];

      const hasMyMessage = cachedData.messages.some(m => m.startsWith('自分:'));
      cachedData.isFirstMessage = (cachedData.messages.length === 0 || !hasMyMessage);

      if (cachedData.isFirstMessage) {
        setPreset('first_message');
        modeBadge.textContent = '🐣 初回（はじめまして）';
        modeBadge.style.background = '#fef3c7';
        modeBadge.style.color = '#92400e';
      } else {
        setPreset('sympathy_question');
        modeBadge.textContent = `💬 やり取り中 (${cachedData.messages.length}件)`;
        modeBadge.style.background = '#dcfce7';
        modeBadge.style.color = '#166534';
      }

      const hash = window.location.hash || '';
      const path = window.location.pathname || '';
      const idMatch = hash.match(/\/(?:chat|user|matching|profile|detail|partner)\/([a-zA-Z0-9_-]+)/) || 
                      path.match(/\/(?:chat|user|matching|profile|detail|partner)\/([a-zA-Z0-9_-]+)/) ||
                      window.location.href.match(/[?&]user_id=([a-zA-Z0-9_-]+)/);
      if (idMatch) {
        cachedData.userId = idMatch[1];
      } else if (!cachedData.userId) {
        cachedData.userId = cachedData.name.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 0).toString(16);
      }
    } catch(e) {
      console.error('Chat extraction error:', e);
    }
  }

  function updatePreview() {
    const d = cachedData;
    const fullContent = d.rawProfile || d.profileText;
    
    if (fullContent) {
      previewBox.textContent = `👤 お相手: ${d.name} (${d.age || '年齢不明'} / ${d.location || '居住地不明'})\n\n【取得したプロフィール全文】\n${fullContent}`;
    } else {
      previewBox.textContent = '未取得（お相手の画面で「👤 プロフ取得（全部取得）」を押してください）';
    }
  }

  async function autoSyncToLocal() {
    if (!cachedData) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/dating/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cachedData)
      });
      if (res.ok) {
        syncStatus.textContent = '✅ ローカル保存済';
        return;
      }
    } catch (e) {}
    syncStatus.textContent = '';
  }

  function insertToPairsInput(text) {
    const inputElem = document.querySelector('textarea, [contenteditable="true"], [class*="messageInput"], [class*="ChatInput"], [data-testid*="input"], input[type="text"]');
    if (inputElem) {
      if (inputElem.tagName.toLowerCase() === 'textarea' || inputElem.tagName.toLowerCase() === 'input') {
        const proto = inputElem.tagName.toLowerCase() === 'textarea' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (nativeSetter) {
          nativeSetter.call(inputElem, text);
        } else {
          inputElem.value = text;
        }
        inputElem.dispatchEvent(new Event('input', { bubbles: true }));
        inputElem.dispatchEvent(new Event('change', { bubbles: true }));
        inputElem.focus();
      } else if (inputElem.isContentEditable) {
        inputElem.innerText = text;
        inputElem.dispatchEvent(new Event('input', { bubbles: true }));
        inputElem.dispatchEvent(new Event('change', { bubbles: true }));
        inputElem.focus();
      }
      showToast('✨ 入力完了！内容を確認して送信してください。', 4000);
    } else {
      navigator.clipboard.writeText(text);
      showToast('⚠️ 入力欄が見つからなかったためクリップボードにコピーしました。', 4000);
    }
  }

  startAiBtn.addEventListener('click', async () => {
    extractChatMessages();
    await autoSyncToLocal();

    startAiBtn.textContent = '⏳ 文章生成中...';
    startAiBtn.disabled = true;

    const payload = {
      ...cachedData,
      preset: currentPreset,
      instruction: customInstructionInput.value.trim()
    };

    let generatedText = '';
    try {
      const res = await fetch(`${SERVER_URL}/api/dating/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.draft) {
          generatedText = json.draft;
        }
      }
    } catch (e) {}

    startAiBtn.textContent = '🚀 文章生成（入力完了）';
    startAiBtn.disabled = false;

    if (generatedText) {
      insertToPairsInput(generatedText);
      resultsContainer.innerHTML = `
        <div style="background:#f1f5f9; padding:8px 10px; border-radius:6px; margin-top:8px; font-size:12px; border:1px solid #e2e8f0;">
          <strong style="color:#1e293b;">セットした文案:</strong>
          <div style="white-space:pre-wrap; margin-top:4px; color:#334155;">${generatedText}</div>
        </div>
      `;
    } else {
      showToast('❌ ローカルサーバー(ポート9999)に接続できませんでした');
    }
  });

  copyMdBtn.addEventListener('click', () => {
    extractChatMessages();
    const d = cachedData;
    const diffMessages = d.messages.slice(-4);

    const md = `# お相手: ${d.name} (${d.age || '不明'} / ${d.location || '不明'})
- **状態**: ${d.isFirstMessage ? '🐣 初回メッセージ（はじめまして）' : '💬 やり取り中'}

## プロフィール全文（自己紹介・クエスチョン・タグ・スペック）
\`\`\`
${d.rawProfile || d.profileText || '（未取得）'}
\`\`\`

## 直近の会話（差分）
${diffMessages.length > 0 ? diffMessages.map(m => `- ${m}`).join('\n') : '- （初回メッセージ・会話履歴なし）'}
`;
    navigator.clipboard.writeText(md).then(() => {
      showToast('📋 相談用Markdown（全文）をコピーしました');
    });
  });

  panel.classList.add('open');

  modeBadge.textContent = '待機中';
  modeBadge.style.background = '#f1f5f9';
  modeBadge.style.color = '#64748b';

  window.addEventListener('hashchange', () => { 
    panel.classList.add('open');
    previewBox.textContent = 'お相手を切り替えました。「👤 プロフ取得（全部取得）」を押してください。';
    modeBadge.textContent = '待機中';
    modeBadge.style.background = '#f1f5f9';
    modeBadge.style.color = '#64748b';
  });
})();
