/**
 * Chatbot service for collecting school notice information.
 * Runs as a Cloudflare Worker module.
 */

const CHAT_SYSTEM_PROMPT = `你係「通告小幫手」，協助香港學校生成各類通告的對話機器人，服務學校為「中華基督教會基慈小學」。

工作流程：
1. 友善問候，了解用戶今次想出邊種通告
2. 根據通告類型，分批問所需資料（每次最多2-3個問題）
3. 資料齊備後，生成完整通告

支援的通告類型：
- 活動通告：活動名稱、對象年級、日期時間、地點、費用（如有）、截止報名（如有）、注意事項
- 家長通告：主旨、對象年級、重要事項、回條截止（如有）、聯絡老師
- 考試測驗通知：科目、日期時間、考試形式、範圍、注意事項
- 繳費通知：項目、金額、截止日期、繳費方式
- 緊急通告：事由、即時安排、家長須知、聯絡方法
- 其他通告：主旨、詳細內容、注意事項

必須收集的基本資料（所有類型）：
- 學年（格式：2025/26）
- 通告編號（格式：XXXXX 或用戶提供，預設「XXXXX」）

語言規範：
- 與用戶溝通用廣東話口語
- 通告內文用正式繁體中文書面語
- 善用 emoji 令對話更生動 😊

收集完畢後：
1. 先講：「好，我已收集到所需資料，正在生成通告⋯⋯」
2. 喺回覆最後加入（必須完整，不可省略）：

<<<GENERATE>>>
{
  "noticeType": "...",
  "學年": "...",
  "通告編號": "...",
  "發出日期": "...",
  "recipient": "...",
  "fields": {
    "欄位名": "內容"
  }
}
<<<END>>>

重要：
- <<<GENERATE>>> 同 <<<END>>> 之間只放合法 JSON，不放其他文字
- fields 應包含所有通告內容（足夠讓 AI 生成完整通告）
- 日期格式統一為 D-M-YYYY
- 如用戶說「跳過」或「沒有」某資料，該欄位留空或不包含`;

/**
 * @param {Array<{role:string, content:string}>} messages
 * @param {string} schoolName
 * @param {object} env - Cloudflare Worker env bindings
 * @returns {Promise<{reply:string, status:string, notice?:object, suggestedReplies:string[]}>}
 */
export async function runChat(messages, schoolName, env, images = []) {
  const apiKey      = env.QWEN_API_KEY;
  const baseUrl     = env.QWEN_BASE_URL     || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
  const textModel   = env.QWEN_MODEL        || 'qwen-plus';
  const visionModel = env.QWEN_VISION_MODEL || 'qwen-vl-plus';

  if (!apiKey) throw new Error('QWEN_API_KEY 未設定');

  const today = new Date().toLocaleDateString('zh-HK', {
    year: 'numeric', month: 'numeric', day: 'numeric',
  });

  const systemContent = CHAT_SYSTEM_PROMPT
    + `\n\n今日日期：${today}\n學校名稱：${schoolName}`;

  const hasImages = Array.isArray(images) && images.length > 0;
  const model = hasImages ? visionModel : textModel;

  // For vision: wrap last user message as content array with image_url entries
  let apiChatMessages;
  if (hasImages) {
    const lastMsg = messages[messages.length - 1];
    apiChatMessages = [
      { role: 'system', content: systemContent },
      ...messages.slice(0, -1),
      {
        role: 'user',
        content: [
          ...images.map(url => ({ type: 'image_url', image_url: { url } })),
          { type: 'text', text: lastMsg.content },
        ],
      },
    ];
  } else {
    apiChatMessages = [
      { role: 'system', content: systemContent },
      ...messages,
    ];
  }

  const payload = {
    model,
    messages: apiChatMessages,
    temperature: 0.7,
  };

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`AI 服務錯誤 ${resp.status}: ${err.slice(0, 200)}`);
  }

  const data = await resp.json();
  const rawReply = data.choices[0].message.content || '';

  // Extract <<<GENERATE>>> block
  const genMatch = rawReply.match(/<<<GENERATE>>>\s*([\s\S]*?)\s*<<<END>>>/);
  const cleanReply = rawReply.replace(/\s*<<<GENERATE>>>[\s\S]*?<<<END>>>/g, '').trim();

  if (genMatch) {
    let genData;
    try {
      genData = JSON.parse(genMatch[1]);
    } catch {
      // JSON parse failed — treat as still collecting
      return { reply: cleanReply, status: 'collecting', suggestedReplies: [] };
    }

    // Call Qwen again to generate the formatted notice text
    const notice = await generateNoticeText(genData, schoolName, apiKey, baseUrl, textModel);
    return {
      reply: cleanReply,
      status: 'generated',
      notice: {
        ...notice,
        學年: genData['學年'] || '',
        通告編號: genData['通告編號'] || 'XXXXX',
        發出日期: genData['發出日期'] || today,
      },
      suggestedReplies: ['我想修改通告', '重新開始'],
    };
  }

  // Suggest quick replies based on context
  const suggestedReplies = getSuggestedReplies(rawReply, messages);
  return { reply: cleanReply, status: 'collecting', suggestedReplies };
}

/**
 * Call Qwen to generate formatted notice text from collected fields.
 */
async function generateNoticeText(genData, schoolName, apiKey, baseUrl, model) {
  const { noticeType = '其他通告', fields = {}, recipient = '各位家長' } = genData;

  const fieldsText = Object.entries(fields)
    .filter(([, v]) => v)
    .map(([k, v]) => `- ${k}：${v}`)
    .join('\n');

  const systemPrompt = `你係香港學校資深行政文員，專門撰寫正式學校通告。
規範：
1. 標題簡潔（不超過20字）
2. 收件人：「各位家長」、「各位同學」或「各位家長及同學」
3. 正文以「敬啟者：」開頭，內容清晰分段，重要事項以條列方式列出
4. 結語：「敬請  垂注，謝謝合作。」
5. 落款：「${schoolName}  謹啟」
6. 語氣正式有禮，符合香港教育界慣用語
7. 不用任何 markdown 符號（不用 **、##、-）`;

  const userPrompt = `請根據以下資料撰寫一份完整的${noticeType}，以 JSON 格式回覆：

${fieldsText}

回覆格式：
{
  "title": "通告標題",
  "recipient": "${recipient}",
  "body": "通告正文（段落之間用\\n\\n分隔）",
  "closing": "落款"
}`;

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    }),
  });

  if (!resp.ok) throw new Error('通告生成失敗，請重試');

  const data = await resp.json();
  const raw = data.choices[0].message.content || '{}';
  try {
    return JSON.parse(raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim());
  } catch {
    throw new Error('通告格式解析失敗');
  }
}

function getSuggestedReplies(reply, messages) {
  if (messages.length <= 1) {
    return ['活動通告', '家長通告', '考試測驗通知', '繳費通知', '緊急通告', '其他通告'];
  }
  if (/有冇|是否|需要|要唔要/.test(reply)) {
    return ['有', '沒有', '跳過'];
  }
  return [];
}
