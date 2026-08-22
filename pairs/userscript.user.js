// ==UserScript==
// @name         Pairs AI Copilot & Local Sync
// @namespace    https://github.com/pithud/userscripts
// @version      3.4.0
// @description  Pairs(Web版)コパイロット（👤プロフ取得(プロフ画面) / 🔄履歴再取得 ➔ 🚀文章生成 ➔ 手動送信）
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
            <button id="copilot-fetch-profile-btn" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; padding:8px 6px; font-weight:bold; font-size:12px; border-radius:6px; cursor:pointer;" title="プロフ画面で押すと、ペアーズクエスチョン・マイタグ・年収・全スペックを自動解析">
              👤 プロフ取得(プロフ画面)
            </button>
            <button id="copilot-fetch-chat-btn" style="background:#f8fafc; color:#334155; border:1px solid #cbd5e1; padding:8px 6px; font-weight:bold; font-size:12px; border-radius:6px; cursor:pointer;" title="最新のチャット履歴を再取得して差分を防止">
              🔄 履歴再取得
            </button>
          </div>

          <div id="copilot-extracted-preview" style="white-space: pre-wrap; max-height: 220px; overflow-y: auto; background: #fff; padding: 10px; border-radius: 6px; font-size: 12px; line-height: 1.5; border: 1px solid #e2e8f0;">お相手のプロフィール画面で「👤 プロフ取得(プロフ画面)」を押してください</div>
          <button id="copilot-paste-btn" style="width:100%; margin-top:6px; background:#f1f5f9; border:1px dashed #cbd5e1; padding:5px; font-size:11px; color:#475569; border-radius:4px; cursor:pointer;">📋 コピーしたテキストを直接貼り付けて解析</button>
        </div>

        <div>
          <div style="font-size:12px; font-weight:bold; color:#1e293b; margin-bottom:6px;">🎯 返信方針</div>
          <div class="copilot-presets">
            <button class="copilot-preset-btn" data-preset="first_message">🐣 初回メッセージ</button>
            <button class="copilot-preset-btn active" data-preset="sympathy_question">💬 共感 ＋ 質問</button>
            <button class="copilot-preset-btn" data-preset="deep_dive">🔍 趣味の深掘り</button>
            <button class="copilot-preset-btn" data-preset="date_invite">☕ デート打診</button>
          </div>
          <textarea id="copilot-custom-instruction" class="copilot-textarea" placeholder="追加の要望があれば入力（例: 連絡頻度について触れる、など）"></textarea>
        </div>

        <div>
          <button id="copilot-start-ai-btn" style="width:100%; background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 12px; font-size: 14px; font-weight: bold; border-radius: 8px; color: #fff; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
            🚀 文章生成
          </button>
        </div>

        <div id="copilot-results-container"></div>

        <div style="margin-top: 4px; border-top: 1px solid #f1f5f9; padding-top: 8px; display:flex; justify-content:space-between; align-items:center;">
          <button id="copilot-copy-md-btn" style="background:none; border:none; color:#64748b; font-size:11px; cursor:pointer; padding:0;">📋 相談用Markdownコピー（全項目）</button>
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
  const pasteBtn = document.getElementById('copilot-paste-btn');
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
    loginStatus: '',
    likes: '',
    details: {},
    rawProfile: '',
    profileText: '',
    tags: [],
    question: '',
    questions: [],
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

  // 1. プロフ取得(プロフ画面)
  fetchProfileBtn.addEventListener('click', () => {
    fetchProfileBtn.textContent = '⏳ 解析中...';
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
      fetchProfileBtn.textContent = '👤 プロフ取得(プロフ画面)';
      fetchProfileBtn.disabled = false;
      showToast('✅ クエスチョン・マイタグ・全スペックを保存しました！');
    }, 150);
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
    }, 150);
  });

  // 3. クリップボード貼り付け
  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim().length > 10) {
        parseProfileTextContent(text.trim());
        extractChatMessages();
        updatePreview();
        autoSyncToLocal();
        showToast('✅ 貼り付けテキストから全項目を保存しました！');
      } else {
        const input = prompt('プロフィールのテキストをここに貼り付けてください:');
        if (input && input.trim()) {
          parseProfileTextContent(input.trim());
          extractChatMessages();
          updatePreview();
          autoSyncToLocal();
          showToast('✅ 全項目解析・保存しました！');
        }
      }
    } catch (e) {
      const input = prompt('プロフィールのテキストをここに貼り付けてください:');
      if (input && input.trim()) {
        parseProfileTextContent(input.trim());
        extractChatMessages();
        updatePreview();
        autoSyncToLocal();
        showToast('✅ 全項目解析・保存しました！');
      }
    }
  });

  function parseProfileTextContent(text) {
    if (!text) return;
    cachedData.rawProfile = text;

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const l = lines[i];
      const ageLoc = l.match(/^(\d{2}歳)\s*([^\s\d]+)?/);
      if (ageLoc) {
        cachedData.age = ageLoc[1];
        if (ageLoc[2]) cachedData.location = ageLoc[2];
        if (i > 0 && lines[i - 1].length <= 20 && !lines[i - 1].includes('Pairs') && !lines[i - 1].includes('戻る')) {
          cachedData.name = lines[i - 1];
        }
      }
      if (l.includes('以内') || l.includes('オンライン') || l.includes('日前')) {
        cachedData.loginStatus = l;
      }
      if (l.includes('いいね')) {
        cachedData.likes = l;
      }
    }

    const qIdx = lines.findIndex(l => l.includes('ペアーズクエスチョン') || l.includes('Pairsクエスチョン'));
    if (qIdx !== -1) {
      const qItems = [];
      for (let i = qIdx + 1; i < lines.length; i++) {
        const l = lines[i];
        if (l.startsWith('マイタグ') || l.startsWith('自己紹介') || l.startsWith('プロフィール') || l === '基本情報') break;
        if (!l.includes('ペアーズクエスチョン') && !l.includes('共通点')) {
          qItems.push(l);
        }
      }
      if (qItems.length > 0) {
        cachedData.questions = qItems;
        cachedData.question = qItems.join(' / ');
      }
    }

    const tagIdx = lines.findIndex(l => l.startsWith('マイタグ'));
    if (tagIdx !== -1) {
      const tags = [];
      for (let i = tagIdx + 1; i < lines.length; i++) {
        const l = lines[i];
        if (l.startsWith('自己紹介') || l.startsWith('プロフィール') || l === '基本情報') break;
        if (l.includes('すべて見る')) continue;
        
        let cleanTag = l;
        const mdMatch = l.match(/\[(.*?)\]/);
        if (mdMatch) cleanTag = mdMatch[1];
        
        cleanTag = cleanTag.replace(/(心と身体|美容・健康|恋愛・結婚|生活|趣味|仕事|その他)$/, '').trim();
        if (!cleanTag) cleanTag = l.replace(/\[(.*?)\]/, '$1').trim();
        
        if (cleanTag && cleanTag.length >= 2) {
          tags.push(cleanTag);
        }
      }
      if (tags.length > 0) cachedData.tags = tags;
    }

    const bioIdx = lines.findIndex(l => l.startsWith('自己紹介'));
    if (bioIdx !== -1) {
      const bioLines = [];
      for (let i = bioIdx + 1; i < lines.length; i++) {
        const l = lines[i];
        if (l.startsWith('プロフィール') || l === '基本情報' || l === '学歴・職種・外見' || l === '恋愛・結婚について' || l === '性格・趣味・生活') break;
        bioLines.push(l);
      }
      cachedData.profileText = bioLines.join('\n').trim();
    }

    const knownKeys = [
      'ニックネーム', '年齢', '血液型', '兄弟姉妹', '話せる言語', '居住地', '出身地',
      '学歴', '職種', '年収', '身長', '体型', '結婚歴', '子供の有無', '結婚に対する意思',
      '出会うまでの希望', 'デート費用', '初回デート費用', '性格・タイプ', '性格', '社交性',
      '同居人', '飼っているペット', 'ペット', '休日', 'タバコ', 'お酒', '好きなこと・趣味', '趣味',
      '職業', '勤務地', 'チャームポイント'
    ];

    const sectionHeaders = ['基本情報', '学歴・職種・外見', '恋愛・結婚について', '性格・趣味・生活', 'プロフィール', '自己紹介'];

    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i];
      if (knownKeys.includes(line)) {
        const nextLine = lines[i + 1];
        if (nextLine && !knownKeys.includes(nextLine) && !sectionHeaders.includes(nextLine)) {
          cachedData.details[line] = nextLine;
          if (line === 'ニックネーム' && nextLine) cachedData.name = nextLine;
          if (line === '年齢' && nextLine) cachedData.age = nextLine;
          if (line === '居住地' && nextLine) cachedData.location = nextLine;
        }
      }
    }
  }

  function extractFullProfile() {
    try {
      const container = document.querySelector('[class*="partnerId"], [class*="PartnerView"], [role="dialog"], main') || document.body;
      let fullText = container.innerText || document.body.innerText || '';

      const copilotRoot = document.getElementById('pairs-copilot-root');
      if (copilotRoot && copilotRoot.innerText && fullText.includes(copilotRoot.innerText.trim())) {
        fullText = fullText.replace(copilotRoot.innerText.trim(), '').trim();
      }

      parseProfileTextContent(fullText);

      // ペアーズクエスチョンのDOM直接抽出
      let foundQuestions = [];
      const promptBoards = document.querySelectorAll('[class*="PromptBoard"], [class*="prompt"], [class*="Question"], [class*="promptBoard"]');
      promptBoards.forEach(pb => {
        if (pb.closest('#pairs-copilot-root')) return;
        const txt = pb.innerText?.trim() || '';
        if (txt.includes('ペアーズクエスチョン') || txt.includes('許容感覚') || txt.length > 5) {
          const lines = txt.split('\n').map(s => s.trim()).filter(Boolean);
          const filtered = lines.filter(s => !s.includes('ペアーズクエスチョン') && !s.includes('共通点'));
          if (filtered.length > 0) {
            foundQuestions = [...foundQuestions, ...filtered];
          }
        }
      });

      document.querySelectorAll('h1, h2, h3, div, span').forEach(el => {
        if (el.closest('#pairs-copilot-root')) return;
        const txt = el.innerText?.trim() || '';
        if (txt === 'ペアーズクエスチョン' || txt === 'Pairsクエスチョン') {
          const parent = el.closest('div') || el.parentElement;
          if (parent) {
            const lines = parent.innerText.split('\n').map(s => s.trim()).filter(Boolean);
            const filtered = lines.filter(s => !s.includes('ペアーズクエスチョン') && !s.includes('共通点'));
            if (filtered.length > 0) {
              foundQuestions = [...new Set([...foundQuestions, ...filtered])];
            }
          }
        }
      });

      if (foundQuestions.length > 0) {
        cachedData.questions = [...new Set([...(cachedData.questions || []), ...foundQuestions])];
        cachedData.question = cachedData.questions.join(' / ');
      }

      document.querySelectorAll('dl[class*="evaluatedRows"], dl').forEach(dl => {
        if (dl.closest('#pairs-copilot-root')) return;
        const dts = dl.querySelectorAll('dt');
        const dds = dl.querySelectorAll('dd');
        if (dts.length > 0 && dds.length === dts.length) {
          for (let i = 0; i < dts.length; i++) {
            const k = dts[i].innerText.trim();
            const v = dds[i].innerText.trim();
            if (k && v && k.length <= 15) {
              cachedData.details[k] = v;
              if (k === 'ニックネーム') cachedData.name = v;
              if (k === '年齢') cachedData.age = v;
              if (k === '居住地') cachedData.location = v;
            }
          }
        }
      });

      if (cachedData.tags.length === 0) {
        const domTags = [];
        document.querySelectorAll('a[href*="/mytag/view/"], [class*="tag"], [class*="Tag"], [class*="mytag"]').forEach(el => {
          if (el.closest('#pairs-copilot-root')) return;
          const txt = (el.innerText || el.textContent || '').trim().replace(/^#/, '');
          if (txt && txt.length >= 3 && !txt.includes('すべて見る') && !txt.match(/^(写真|本人確認|オンライン|ログイン|メッセージ|VIP)$/)) {
            const clean = txt.replace(/\n/g, ' ').replace(/(心と身体|美容・健康|恋愛・結婚|生活|趣味|仕事|その他)$/, '').trim();
            if (clean) domTags.push(clean);
          }
        });
        if (domTags.length > 0) {
          cachedData.tags = [...new Set(domTags)].slice(0, 15);
        }
      }

      if (!cachedData.profileText) {
        const paragraphs = Array.from(document.querySelectorAll('p, div[style*="white-space"]'))
          .filter(p => !p.closest('#pairs-copilot-root'))
          .map(p => p.innerText.trim())
          .filter(t => t.length >= 35 && !t.includes('Pairs') && !t.includes('規約'));
        if (paragraphs.length > 0) {
          cachedData.profileText = paragraphs.reduce((a, b) => a.length > b.length ? a : b, '');
        }
      }

    } catch (e) {
      console.error('Full extraction error:', e);
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
    
    const allSpecLines = Object.entries(d.details)
      .map(([k, v]) => `  • ${k}: ${v}`)
      .join('\n');

    const specSummary = allSpecLines || '  （未取得）';

    const bioStatus = d.profileText 
      ? `✅ 取得完了:\n${d.profileText.slice(0, 150)}${d.profileText.length > 150 ? '...' : ''}` 
      : '⚠️ 未取得';

    const tagStatus = d.tags.length > 0 
      ? d.tags.map((t, idx) => `  ${idx + 1}. ${t}`).join('\n')
      : '  ⚠️ 未取得';

    const questionLines = d.questions && d.questions.length > 0
      ? d.questions.map(q => `  • ${q}`).join('\n')
      : (d.question ? `  • ${d.question}` : '  （未取得）');

    const previewLines = [
      `👤 お相手: ${d.name} (${d.age || '年齢不明'} / ${d.location || '居住地不明'})${d.likes ? ` [${d.likes}]` : ''}`,
      d.loginStatus ? `🕒 ログイン: ${d.loginStatus}` : null,
      `❓ ペアーズクエスチョン:\n${questionLines}`,
      `🏷️ マイタグ（コメント含む ${d.tags.length}件）:\n${tagStatus}`,
      `📋 基本スペック (${Object.keys(d.details).length}項目):\n${specSummary}`,
      `📝 自己紹介文:\n${bioStatus}`
    ].filter(Boolean);

    previewBox.textContent = previewLines.join('\n\n');
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

    startAiBtn.textContent = '🚀 文章生成';
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
    const specLines = Object.entries(d.details).map(([k, v]) => `- **${k}**: ${v}`).join('\n') || '- （スペック未取得）';
    const tagLines = d.tags.map(t => `- ${t}`).join('\n') || '- （マイタグなし）';
    const qLines = d.questions && d.questions.length > 0 ? d.questions.map(q => `- ${q}`).join('\n') : `- ${d.question || 'なし'}`;

    const md = `# お相手: ${d.name} (${d.age || '不明'} / ${d.location || '不明'})
- **ログイン/いいね**: ${d.loginStatus || '不明'} / ${d.likes || '不明'}
- **状態**: ${d.isFirstMessage ? '🐣 初回メッセージ（はじめまして）' : '💬 やり取り中'}

## ペアーズクエスチョン
${qLines}

## マイタグ（コメント含む）
${tagLines}

## 基本スペック（全項目）
${specLines}

## 自己紹介文
\`\`\`
${d.profileText || '（自己紹介文未取得）'}
\`\`\`

## 直近の会話（差分）
${diffMessages.length > 0 ? diffMessages.map(m => `- ${m}`).join('\n') : '- （初回メッセージ・会話履歴なし）'}
`;
    navigator.clipboard.writeText(md).then(() => {
      showToast('📋 相談用Markdown（全項目）をコピーしました');
    });
  });

  panel.classList.add('open');

  modeBadge.textContent = '待機中';
  modeBadge.style.background = '#f1f5f9';
  modeBadge.style.color = '#64748b';

  window.addEventListener('hashchange', () => { 
    panel.classList.add('open');
    previewBox.textContent = 'お相手を切り替えました。「👤 プロフ取得(プロフ画面)」を押してください。';
    modeBadge.textContent = '待機中';
    modeBadge.style.background = '#f1f5f9';
    modeBadge.style.color = '#64748b';
  });
})();
