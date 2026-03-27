"""
Word 輸出路由
POST /export/ — 將通告內容套入範本，回傳 .docx 檔案
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.docx_service import fill_template, list_templates

router = APIRouter()


class ExportRequest(BaseModel):
    template_id: str
    title: str
    recipient: str
    body: str
    closing: str
    school_name: str = ""
    date: str = ""


@router.post("/")
def export_notice(req: ExportRequest):
    """將通告內容填入範本，回傳 .docx"""
    templates = [t["id"] for t in list_templates()]
    if req.template_id not in templates:
        raise HTTPException(status_code=404, detail="範本不存在")

    replacements = {
        "通告標題": req.title,
        "收件人": req.recipient,
        "正文": req.body,
        "落款": req.closing,
        "學校名稱": req.school_name,
        "日期": req.date,
        # 英文佔位符別名
        "TITLE": req.title,
        "RECIPIENT": req.recipient,
        "BODY": req.body,
        "CLOSING": req.closing,
        "SCHOOL": req.school_name,
        "DATE": req.date,
    }

    try:
        output = fill_template(req.template_id, replacements)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="範本檔案不存在")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Word 生成失敗：{str(e)}")

    safe_title = "".join(c for c in req.title if c.isalnum() or c in "（）()_ -") or "通告"
    filename = f"{safe_title}.docx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
