"""
AI 通告生成服務
使用 OpenAI GPT-4o 以香港中小學格式生成繁體中文通告
"""

import os
from openai import OpenAI


def _get_provider_config() -> tuple[str, str, str]:
    """
    取得 AI 供應商設定。
    優先使用 Qwen International；若未設定則回退 OpenAI。
    """
    qwen_key = os.getenv("QWEN_API_KEY", "").strip()
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()

    if qwen_key:
        base_url = os.getenv(
            "QWEN_BASE_URL",
            "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        ).strip()
        model = os.getenv("QWEN_MODEL", "qwen-plus").strip() or "qwen-plus"
        return qwen_key, base_url, model

    if openai_key:
        base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").strip()
        model = os.getenv("OPENAI_MODEL", "gpt-4o").strip() or "gpt-4o"
        return openai_key, base_url, model

    raise ValueError("請設定 QWEN_API_KEY 或 OPENAI_API_KEY")


def _build_client() -> OpenAI:
    api_key, base_url, _ = _get_provider_config()
    return OpenAI(api_key=api_key, base_url=base_url)

NOTICE_PROMPTS = {
    "家長通告": {
        "description": "致家長的通告/函件",
        "style": "敬啟者開頭，此致結尾，語氣正式有禮，適合香港中小學向家長發出的通告",
        "fields": ["主旨", "對象級別", "日期", "重要事項", "回條截止日期", "聯絡老師"],
    },
    "活動通告": {
        "description": "學校活動、旅行、比賽等通告",
        "style": "語氣積極正面，包含活動詳情，適合香港中小學活動通告",
        "fields": ["活動名稱", "對象級別", "活動日期及時間", "地點", "費用", "截止報名日期", "注意事項"],
    },
    "考試測驗通知": {
        "description": "考試或測驗的通知",
        "style": "語氣嚴謹清晰，列明考試安排，適合香港中小學考試通知",
        "fields": ["科目", "考試日期及時間", "考試形式", "考試範圍", "注意事項"],
    },
    "繳費通知": {
        "description": "繳交學費或其他費用的通知",
        "style": "語氣清晰，列明繳費詳情，適合香港中小學繳費通知",
        "fields": ["繳費項目", "金額", "截止日期", "繳費方式", "查詢聯絡"],
    },
    "緊急通告": {
        "description": "緊急事項通告",
        "style": "語氣簡明直接，重點突出，適合香港中小學緊急通知",
        "fields": ["事由", "即時安排", "家長須知", "聯絡方法"],
    },
    "其他通告": {
        "description": "一般學校通告",
        "style": "語氣正式有禮，適合香港中小學一般通告",
        "fields": ["通告主旨", "詳細內容", "注意事項"],
    },
}


def get_notice_types() -> list[str]:
    return list(NOTICE_PROMPTS.keys())


def get_fields_for_type(notice_type: str) -> list[str]:
    if notice_type not in NOTICE_PROMPTS:
        return []
    return NOTICE_PROMPTS[notice_type]["fields"]


def generate_notice(
    notice_type: str,
    school_name: str,
    fields: dict[str, str],
    extra_instructions: str = "",
) -> dict[str, str]:
    """
    呼叫 GPT-4o 生成通告內容
    返回 {"title": ..., "recipient": ..., "body": ..., "closing": ...}
    """
    if notice_type not in NOTICE_PROMPTS:
        raise ValueError(f"不支援的通告類型：{notice_type}")

    prompt_info = NOTICE_PROMPTS[notice_type]

    fields_text = "\n".join(
        f"- {k}：{v}" for k, v in fields.items() if v and v.strip()
    )

    system_prompt = f"""你是一位香港學校的資深行政文員，專門負責撰寫中英文通告。
你需要以正式的香港學校通告格式，用繁體中文（廣東話書面語）撰寫通告。

通告規範：
1. 標題簡潔明確（不超過20字）
2. 收件人稱謂：根據類型用「各位家長」、「各位同學」或「各位家長及同學」
3. 正文：「敬啟者：」開頭，內容清晰分段，重要資訊以條列方式列出
4. 結尾：「敬請  垂注，謝謝合作。」或適當結語
5. 落款：「{school_name}  謹啟」及日期
6. 語氣正式有禮，符合香港教育界慣用語
7. 不添加任何 markdown 格式符號（不用 **、##、- 等）

通告類型：{notice_type}
說明：{prompt_info["description"]}
格式風格：{prompt_info["style"]}"""

    user_prompt = f"""請根據以下資料撰寫一份完整的{notice_type}：

{fields_text}

{"額外要求：" + extra_instructions if extra_instructions else ""}

請以 JSON 格式回覆，包含以下欄位：
{{
  "title": "通告標題",
  "recipient": "收件人（例：各位家長）",
  "body": "通告正文（包含敬啟者開頭和結語，段落之間用\\n\\n分隔）",
  "closing": "落款（學校名稱及日期）"
}}"""

    _, _, model = _get_provider_config()
    client = _build_client()
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.7,
    )

    import json
    result = json.loads(response.choices[0].message.content)
    return result
