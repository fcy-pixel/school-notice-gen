/**
 * Qwen AI enhancement for school notice fields.
 * Calls the Qwen international API (OpenAI-compatible).
 */

const SYSTEM_PROMPT = `你是一位專業的香港小學通告撰寫助手，服務學校為「中華基督教會基慈小學」。

任務：根據用戶填入的草稿資料，以正式學校通告的書面中文（繁體）重新表達各欄位內容。

規則：
1. 活動簡介：格式固定為「為了[目的]，本校現誠邀相關同學參加「[活動名稱]」」（不包含「，詳情如下：」，那部分已在模板中）。
2. 備註：
   - 必須將輸入內容拆分成多個獨立項目，每項一行（用 \\n 分隔）。
   - 拆分依據：句號、頓號、分號、換行、編號（一、二、1.2.）或邏輯分段。
   - 每項直接寫内容，不加任何開頭符號（不要加・、•、-等），語氣正式簡潔，不超過 30 字。
   - 範例輸入：「整齊學校文化校服 需自備文具 如有身體不適請即通知領隊老師」
   - 範例輸出（JSON值）：「整齊學校文化校服\n需自備文具\n如有身體不適，請即通知領隊老師」
3. 活動名稱：保持原樣，只更正錯別字。
4. 日期、時間、地點、電話、教師姓名欄位：直接保留原值，不修改。
5. 其餘欄位：以正式書面中文表達，語氣與學校通告一致。
6. 只返回 JSON，不加任何說明文字。`;

const DATE_TIME_FIELDS = new Set([
  '學年', '通告編號', '發出日期', '活動日期', '活動時間',
  '集合時間', '回條截止日期', '回條截止（文字）', '聯絡電話'
]);

/**
 * @param {Record<string,string>} fields
 * @param {object} env - Cloudflare Worker env bindings
 * @returns {Promise<Record<string,string>>}
 */
export async function enhanceWithAI(fields, env) {
  const apiKey = env.QWEN_API_KEY;
  if (!apiKey) throw new Error('QWEN_API_KEY 未設定，請執行 wrangler secret put QWEN_API_KEY');

  const baseUrl = env.QWEN_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
  const model   = env.QWEN_MODEL   || 'qwen-plus';

  // Separate fields AI should process vs keep as-is
  const toEnhance = {}, passthrough = {};
  for (const [k, v] of Object.entries(fields)) {
    if (DATE_TIME_FIELDS.has(k) || !v.trim()) passthrough[k] = v;
    else toEnhance[k] = v;
  }

  const userPrompt = `請將以下學校通告欄位以正式通告用語重新表達，返回相同 key 的 JSON：\n${JSON.stringify(toEnhance, null, 2)}`;

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Qwen API 錯誤 ${resp.status}: ${err.slice(0, 300)}`);
  }

  const data = await resp.json();
  let enhanced;
  try {
    const raw = data.choices[0].message.content;
    // Strip markdown code fences if present
    const clean = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    enhanced = JSON.parse(clean);
  } catch {
    throw new Error('AI 回應格式錯誤，請重試');
  }

  return { ...passthrough, ...enhanced };
}
