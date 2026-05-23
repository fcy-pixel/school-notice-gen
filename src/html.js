export function getHTML() {
  return /* html */ `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>學校通告生成器 · 基慈小學</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --blue: #1a56db; --blue-light: #e8f0fe; --blue-dark: #1240a8;
    --green: #0f766e; --green-light: #ccfbf1;
    --gray: #6b7280; --border: #e5e7eb; --bg: #f9fafb;
    --radius: 8px; --shadow: 0 1px 3px rgba(0,0,0,.1);
  }
  body { font-family: "Microsoft JhengHei","Noto Sans TC",system-ui,sans-serif;
         background: var(--bg); color: #111827; min-height: 100vh; }

  /* ── header ── */
  header { background: var(--blue); color: #fff; padding: 18px 24px;
           display: flex; align-items: center; gap: 14px; }
  header h1 { font-size: 1.2rem; font-weight: 700; }
  header p  { font-size: .85rem; opacity: .85; margin-top: 2px; }
  .logo { width: 44px; height: 44px; background: rgba(255,255,255,.2);
          border-radius: 10px; display: flex; align-items: center;
          justify-content: center; font-size: 1.4rem; flex-shrink: 0; }

  /* ── layout ── */
  .container { max-width: 800px; margin: 0 auto; padding: 24px 16px 60px; }

  /* ── card / section ── */
  .card { background: #fff; border: 1px solid var(--border); border-radius: var(--radius);
          padding: 20px 24px; margin-bottom: 16px; box-shadow: var(--shadow); }
  .card-title { font-size: .8rem; font-weight: 700; color: var(--blue);
                text-transform: uppercase; letter-spacing: .06em;
                margin-bottom: 16px; padding-bottom: 8px;
                border-bottom: 2px solid var(--blue-light); }

  /* ── form grid ── */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .grid-1 { display: grid; grid-template-columns: 1fr; gap: 14px; }
  @media(max-width:520px){ .grid-2 { grid-template-columns: 1fr; } }

  .field { display: flex; flex-direction: column; gap: 5px; }
  label  { font-size: .82rem; font-weight: 600; color: #374151; }
  label span.req { color: #ef4444; margin-left: 2px; }
  input, textarea, select {
    border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px;
    font-size: .93rem; font-family: inherit; color: #111827;
    transition: border-color .15s, box-shadow .15s; background: #fff; width: 100%;
  }
  input:focus, textarea:focus { outline: none; border-color: var(--blue);
    box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
  textarea { resize: vertical; min-height: 90px; }
  .hint { font-size: .75rem; color: var(--gray); }

  /* ── AI banner ── */
  .ai-banner { background: var(--blue-light); border: 1px solid #bfdbfe;
               border-radius: var(--radius); padding: 14px 18px;
               display: flex; align-items: center; justify-content: space-between;
               gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
  .ai-banner p { font-size: .88rem; color: #1e3a8a; }
  .ai-banner strong { display: block; font-size: .95rem; }

  /* ── buttons ── */
  .btn { display: inline-flex; align-items: center; gap: 7px; border: none;
         border-radius: 6px; padding: 10px 20px; font-size: .92rem;
         font-weight: 600; cursor: pointer; transition: background .15s, transform .1s;
         font-family: inherit; }
  .btn:active { transform: scale(.97); }
  .btn-primary { background: var(--blue); color: #fff; }
  .btn-primary:hover { background: var(--blue-dark); }
  .btn-ai { background: #7c3aed; color: #fff; }
  .btn-ai:hover { background: #6d28d9; }
  .btn-ai:disabled { background: #a78bfa; cursor: not-allowed; }
  .btn-dl { background: var(--green); color: #fff; font-size: 1rem; padding: 12px 28px; }
  .btn-dl:hover { background: #0d6460; }
  .btn-dl:disabled { background: #6ee7b7; cursor: not-allowed; }

  /* ── action bar ── */
  .action-bar { display: flex; gap: 12px; align-items: center;
                justify-content: flex-end; flex-wrap: wrap; margin-top: 8px; }

  /* ── toast ── */
  #toast { position: fixed; bottom: 24px; right: 24px; background: #1f2937;
           color: #fff; padding: 12px 20px; border-radius: 8px; font-size: .9rem;
           opacity: 0; pointer-events: none; transition: opacity .3s;
           max-width: 320px; z-index: 999; }
  #toast.show { opacity: 1; }
  #toast.error { background: #dc2626; }
  #toast.success { background: var(--green); }

  /* ── spinner ── */
  .spin { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.4);
          border-top-color: #fff; border-radius: 50%;
          animation: spin .7s linear infinite; flex-shrink: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>

<header>
  <div class="logo">📋</div>
  <div>
    <h1>學校通告生成器</h1>
    <p>中華基督教會基慈小學 · 填寫欄位後下載 Word 通告</p>
  </div>
</header>

<div class="container">

  <!-- AI banner -->
  <div class="ai-banner">
    <p>
      <strong>✨ AI 智能優化</strong>
      輸入草稿資料，AI 自動以正式通告用語重新表達「活動簡介」及「備註」欄位
    </p>
    <button class="btn btn-ai" id="btnAI" onclick="aiEnhance()">
      <span>🤖</span> AI 優化語句
    </button>
  </div>

  <form id="form">

    <!-- 基本資料 -->
    <div class="card">
      <div class="card-title">基本資料</div>
      <div class="grid-2">
        <div class="field">
          <label for="學年">學年<span class="req">*</span></label>
          <input id="學年" name="學年" placeholder="例：2025/26" required>
        </div>
        <div class="field">
          <label for="通告編號">通告編號<span class="req">*</span></label>
          <input id="通告編號" name="通告編號" placeholder="例：102A">
        </div>
        <div class="field">
          <label for="活動名稱">活動名稱<span class="req">*</span></label>
          <input id="活動名稱" name="活動名稱" placeholder="例：2026 機械人比賽">
        </div>
        <div class="field">
          <label for="發出日期">發出日期</label>
          <input id="發出日期" name="發出日期" placeholder="例：10-5-2026">
        </div>
      </div>
    </div>

    <!-- 活動詳情 -->
    <div class="card">
      <div class="card-title">活動詳情</div>
      <div class="grid-2">
        <div class="field">
          <label for="活動日期">活動日期</label>
          <input id="活動日期" name="活動日期" placeholder="例：25/6/2026 (星期四)">
        </div>
        <div class="field">
          <label for="活動時間">活動時間</label>
          <input id="活動時間" name="活動時間" placeholder="例：上午9:00至下午1:00">
        </div>
        <div class="field" style="grid-column:1/-1">
          <label for="活動地點">活動地點</label>
          <input id="活動地點" name="活動地點" placeholder="例：香港科學館（尖沙咀東翼）">
        </div>
        <div class="field">
          <label for="集合時間">集合時間</label>
          <input id="集合時間" name="集合時間" placeholder="例：上午8:30">
        </div>
        <div class="field">
          <label for="集合地點">集合地點</label>
          <input id="集合地點" name="集合地點" placeholder="例：學校正門">
        </div>
        <div class="field" style="grid-column:1/-1">
          <label for="解散時間及地點">解散時間及地點</label>
          <input id="解散時間及地點" name="解散時間及地點" placeholder="例：約下午1:00於學校正門解散">
        </div>
        <div class="field">
          <label for="領隊老師">領隊老師</label>
          <input id="領隊老師" name="領隊老師" placeholder="例：陳大文老師">
        </div>
        <div class="field">
          <label for="聯絡電話">聯絡電話</label>
          <input id="聯絡電話" name="聯絡電話" placeholder="例：2322 5122">
        </div>
      </div>
    </div>

    <!-- 活動簡介 -->
    <div class="card">
      <div class="card-title">活動簡介</div>
      <div class="grid-1">
        <div class="field">
          <label for="活動簡介">活動簡介（AI 可自動生成）</label>
          <textarea id="活動簡介" name="活動簡介" rows="3"
            placeholder="例：為了培育同學對科學的興趣及探究精神，本校現誠邀相關同學參加「STEM博覽2026」"></textarea>
          <span class="hint">模板已在結尾加上「，詳情如下：」，此處不需再填寫</span>
        </div>
      </div>
    </div>

    <!-- 備註 -->
    <div class="card">
      <div class="card-title">備註</div>
      <div class="grid-1">
        <div class="field">
          <label for="備註">備註（每行一項，AI 可自動格式化）</label>
          <textarea id="備註" name="備註" rows="5"
            placeholder="例：&#10;整齊學校文化校服&#10;需自備文具&#10;如有身體不適，請即通知領隊老師"></textarea>
        </div>
      </div>
    </div>

    <!-- 回條資料 -->
    <div class="card">
      <div class="card-title">回條資料</div>
      <div class="grid-2">
        <div class="field">
          <label for="回條截止日期">回條截止日期（表格用）</label>
          <input id="回條截止日期" name="回條截止日期" placeholder="例：15-5-2026">
        </div>
        <div class="field">
          <label for="回條截止（文字）">回條截止（文字說明）</label>
          <input id="回條截止（文字）" name="回條截止（文字）" placeholder="例：15/5(星期五)">
        </div>
      </div>
    </div>

    <!-- 下載按鈕 -->
    <div class="action-bar">
      <button type="button" class="btn btn-dl" id="btnDL" onclick="generate()">
        <span>📄</span> 下載通告 .docx
      </button>
    </div>

  </form>
</div>

<div id="toast"></div>

<script>
const form = document.getElementById('form');

function getFields() {
  const data = {};
  form.querySelectorAll('input,textarea').forEach(el => {
    if (el.name) data[el.name] = el.value.trim();
  });
  return data;
}

function setFields(obj) {
  for (const [k, v] of Object.entries(obj)) {
    const el = form.querySelector('[name="' + k + '"]');
    if (el && v) el.value = v;
  }
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show ' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = ''; }, 3500);
}

async function aiEnhance() {
  const btn = document.getElementById('btnAI');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> AI 處理中…';
  try {
    const fields = getFields();
    if (!fields['活動名稱']) { showToast('請先填寫活動名稱', 'error'); return; }
    const res = await fetch('/api/ai-enhance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'AI 錯誤');
    setFields(json);
    showToast('✓ AI 優化完成，請檢查各欄位', 'success');
  } catch (e) {
    showToast('❌ ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>🤖</span> AI 優化語句';
  }
}

async function generate() {
  const fields = getFields();
  if (!fields['活動名稱'] || !fields['學年']) {
    showToast('請至少填寫「學年」及「活動名稱」', 'error');
    return;
  }
  const btn = document.getElementById('btnDL');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> 生成中…';
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || '伺服器錯誤');
    }
    const blob = await res.blob();
    const name = (fields['活動名稱'] || '學校通告') + '.docx';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    showToast('✓ 通告已下載：' + name, 'success');
  } catch (e) {
    showToast('❌ ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>📄</span> 下載通告 .docx';
  }
}
</script>
</body>
</html>`;
}
