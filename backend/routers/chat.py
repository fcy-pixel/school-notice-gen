"""
Chatbot 通告收集路由
POST /chat/  — 多輪對話式收集資料，完成後生成通告
"""

import json
import re
import os
from datetime import date

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.ai_service import _build_client, _get_provider_config, generate_notice

router = APIRouter()

CHAT_SYSTEM_PROMPT = """你係「通告小幫手」，一個協助香港學校生成通告的對話機器人。

你的工作流程：
1. 友善地問候用戶，了解佢今次要出乜類型的通告
2. 根據通告類型，有序地收集必要資料
3. 收集到足夠資料後，生成完整通告

支援的通告類型（如有其他需求可靈活處理）：
- 家長通告：主旨、對象年級、日期、重要事項、回條截止日期（如有）、聯絡老師
- 活動通告：活動名稱、對象年級、活動日期及時間、地點、費用（如有）、截止報名（如有）、注意事項
- 考試測驗通知：科目、考試日期及時間、考試形式（筆試/口試等）、考試範圍、注意事項
- 繳費通知：繳費項目、金額、截止日期、繳費方式、查詢聯絡
- 緊急通告：事由、即時安排、家長須知、聯絡方法
- 其他通告：通告主旨、詳細內容、注意事項

語言規範：
- 用廣東話口語同用戶溝通（輕鬆、友善、專業）
- 通告內容必須係正式繁體中文書面語

收集資料時的原則：
- 每次最多問 2-3 個相關問題，唔好一次問晒
- 用戶話「不需要」或「跳過」某項資料，就略過
- 如果回答不夠清楚，可以追問
- 用 emoji 令對話更生動（😊📋✅ 等）

當你收集到足夠資料，可以生成通告時：
1. 先講「好，我已收集到所需資料，正在為你生成通告⋯⋯」
2. 喺回覆嘅最後加入以下 JSON 標記：

<<<GENERATE>>>
{
  "notice_type": "...",
  "fields": {
    "欄位1": "內容",
    "欄位2": "內容"
  }
}
<<<END>>>

重要提示：
- <<<GENERATE>>> 同 <<<END>>> 之間只放 JSON，不放其他文字
- 用戶如果要求修改已生成的通告，重新收集需要修改的資料，然後再次觸發 <<<GENERATE>>>
"""


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    school_name: str = "香港示範學校"
    template_id: str = ""


class ChatResponse(BaseModel):
    reply: str
    status: str  # "collecting" | "generated" | "error"
    notice: dict | None = None
    suggested_replies: list[str] = []


def _extract_generate_block(text: str) -> dict | None:
    """從 AI 回覆中提取 <<<GENERATE>>> 區塊的 JSON"""
    pattern = r"<<<GENERATE>>>\s*(.*?)\s*<<<END>>>"
    match = re.search(pattern, text, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError:
        return None


def _strip_generate_block(text: str) -> str:
    """移除回覆中的 <<<GENERATE>>> 標記區塊"""
    return re.sub(r"\s*<<<GENERATE>>>.*?<<<END>>>", "", text, flags=re.DOTALL).strip()


def _get_suggested_replies(reply: str, messages: list[ChatMessage]) -> list[str]:
    """根據對話內容返回快速回覆選項"""
    # 第一條訊息：提示通告類型
    if len(messages) <= 1:
        return ["活動通告", "家長通告", "考試測驗通知", "繳費通知", "緊急通告", "其他通告"]

    # 如果問到費用/回條等是否有
    lower = reply.lower()
    if any(kw in reply for kw in ["有冇", "是否", "需要", "要加"]):
        return ["有", "冇", "跳過"]

    return []


@router.post("/", response_model=ChatResponse)
def chat(req: ChatRequest):
    """多輪對話式收集通告資料，完成後生成通告"""
    qwen_key = (os.getenv("QWEN_API_KEY") or "").strip()
    openai_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    has_qwen = qwen_key and not qwen_key.startswith("qwen-your")
    has_openai = openai_key and not openai_key.startswith("sk-your")

    if not has_qwen and not has_openai:
        raise HTTPException(
            status_code=503,
            detail="請先在 backend/.env 設定有效的 QWEN_API_KEY（或 OPENAI_API_KEY）",
        )

    today = date.today().strftime("%Y年%m月%d日")
    system = CHAT_SYSTEM_PROMPT + f"\n\n今日日期：{today}\n學校名稱：{req.school_name}"

    _, _, model = _get_provider_config()
    client = _build_client()

    messages_payload = [{"role": "system", "content": system}]
    for m in req.messages:
        messages_payload.append({"role": m.role, "content": m.content})

    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages_payload,
            temperature=0.7,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 服務失敗：{str(e)}")

    raw_reply = response.choices[0].message.content or ""

    generate_data = _extract_generate_block(raw_reply)
    clean_reply = _strip_generate_block(raw_reply)

    if generate_data:
        try:
            notice = generate_notice(
                notice_type=generate_data.get("notice_type", "其他通告"),
                school_name=req.school_name,
                fields=generate_data.get("fields", {}),
                extra_instructions=generate_data.get("extra_instructions", ""),
            )
            return ChatResponse(
                reply=clean_reply,
                status="generated",
                notice=notice,
                suggested_replies=["我想修改通告", "重新開始"],
            )
        except Exception as e:
            return ChatResponse(
                reply=clean_reply + f"\n\n（通告生成時出錯：{str(e)}，請稍後再試）",
                status="error",
                suggested_replies=["重試", "重新開始"],
            )

    suggested = _get_suggested_replies(clean_reply, req.messages)
    return ChatResponse(
        reply=clean_reply,
        status="collecting",
        notice=None,
        suggested_replies=suggested,
    )
