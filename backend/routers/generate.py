"""
AI 通告生成路由
GET  /generate/types          — 取得所有通告類型
GET  /generate/fields/{type}  — 取得某類型的欄位清單
POST /generate/               — 生成通告內容
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.ai_service import (
    get_notice_types,
    get_fields_for_type,
    generate_notice,
)

router = APIRouter()


class GenerateRequest(BaseModel):
    notice_type: str
    school_name: str
    fields: dict[str, str]
    extra_instructions: str = ""


@router.get("/types")
def get_types():
    """取得所有支援的通告類型"""
    return {"types": get_notice_types()}


@router.get("/fields/{notice_type}")
def get_fields(notice_type: str):
    """取得某通告類型所需的欄位"""
    fields = get_fields_for_type(notice_type)
    if not fields:
        raise HTTPException(status_code=404, detail="不支援的通告類型")
    return {"notice_type": notice_type, "fields": fields}


@router.post("/")
def generate(req: GenerateRequest):
    """呼叫 AI 生成通告內容"""
    import os
    qwen_key = (os.getenv("QWEN_API_KEY") or "").strip()
    openai_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    has_qwen = qwen_key and not qwen_key.startswith("qwen-your")
    has_openai = openai_key and not openai_key.startswith("sk-your")

    if not has_qwen and not has_openai:
        raise HTTPException(
            status_code=503,
            detail="請先在 backend/.env 設定有效的 QWEN_API_KEY（或 OPENAI_API_KEY）",
        )
    try:
        result = generate_notice(
            notice_type=req.notice_type,
            school_name=req.school_name,
            fields=req.fields,
            extra_instructions=req.extra_instructions,
        )
        return {"success": True, "notice": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 生成失敗：{str(e)}")
