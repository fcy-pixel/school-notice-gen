const SYSTEM_PROMPT = `你是一位香港小學通告資料提取助手。從學校通告的圖片或文字中，準確提取所有可識別的欄位。

JSON 的 key 必須完全對應以下欄位名稱（只回傳找到的，找不到的不要包含）：

欄位名稱        說明／格式
學年            例：2025/26
通告編號        例：101E
活動名稱        比賽/活動的正式名稱
發出日期        D-M-YYYY 格式，例：10-5-2026，不用前置零
活動簡介        以「為了…，本校現誠邀相關同學參加「活動名稱」」格式，不含「，詳情如下：」
活動日期        含星期，日期用 D-M-YYYY，例：25-5-2026 (星期一)
活動時間        例：上午10:00至下午1:00
活動地點        完整地址
集合時間        例：上午9:30
集合地點        
解散時間及地點  
領隊老師        姓名加職銜
聯絡電話        
聯絡老師        姓名加職銜
備註            通告中的備註事項，每個獨立項目之間用 \\n 分隔，不加開頭符號，保留原文
回條截止日期    D-M-YYYY 格式，例：7-5-2026，不用前置零
回條截止（文字） 例：7/5(星期四)

重要：
- 所有日期一律用 D-M-YYYY 格式（無前置零）
- 備註欄位的 key 必須是「備註」，值中每個項目用 \\n 分隔
- 只提取通告中明確出現的資料，絕對不可自行編造或推測任何欄位的內容
- 找不到的欄位一律不包含在 JSON 中，不要填入任何假設或範例內容
- 只返回 JSON，不加任何說明或 markdown 代碼框`;

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const apiKey = env.QWEN_API_KEY;
    if (!apiKey) return jsonError('QWEN_API_KEY 未設定');

    const baseUrl = env.QWEN_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';

    // Vision mode: receive array of base64 PNG images from PDF pages
    if (body.images && Array.isArray(body.images) && body.images.length > 0) {
      return await extractWithVision(body.images, apiKey, baseUrl);
    }

    // Text mode fallback
    if (body.text?.trim()) {
      return await extractWithText(body.text, apiKey, baseUrl, env.QWEN_MODEL || 'qwen-plus');
    }

    return jsonError('請提供 images 或 text');
  } catch (e) {
    return jsonError(e.message);
  }
}

async function extractWithVision(images, apiKey, baseUrl) {
  const content = [
    ...images.slice(0, 3).map(img => ({
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${img}` },
    })),
    { type: 'text', text: '這是學校通告的圖片，請按系統指示提取所有欄位，只返回 JSON。' },
  ];

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen-vl-max',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  });

  return parseQwenResponse(resp);
}

async function extractWithText(text, apiKey, baseUrl, model) {
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: `以下是學校通告的文字內容，請提取所有欄位：\n\n${text.slice(0, 8000)}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  });

  return parseQwenResponse(resp);
}

async function parseQwenResponse(resp) {
  if (!resp.ok) {
    const err = await resp.text();
    return jsonError(`Qwen API 錯誤 ${resp.status}: ${err.slice(0, 300)}`);
  }
  const data = await resp.json();
  try {
    const raw = data.choices[0].message.content;
    const clean = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const fields = JSON.parse(clean);
    return new Response(JSON.stringify(fields), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return jsonError('AI 回應格式錯誤，請重試');
  }
}

function jsonError(msg, status = 500) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
