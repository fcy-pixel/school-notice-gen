"""
範本管理路由
POST /templates/upload — 上傳 .docx 範本
GET  /templates/        — 列出所有範本
GET  /templates/{id}/placeholders — 查看佔位符清單
POST /templates/create-default   — 建立預設範本
DELETE /templates/{id}           — 刪除範本
"""

import os
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException

from services.docx_service import (
    list_templates,
    extract_placeholders,
    get_template_path,
    TEMPLATES_DIR,
    ensure_templates_dir,
    create_default_template,
)

router = APIRouter()


@router.get("/")
def get_templates():
    """列出所有已上傳範本"""
    return {"templates": list_templates()}


@router.post("/upload")
async def upload_template(file: UploadFile = File(...)):
    """上傳 .docx 範本"""
    if not file.filename.endswith(".docx"):
        raise HTTPException(status_code=400, detail="只接受 .docx 格式")

    ensure_templates_dir()
    save_path = os.path.join(TEMPLATES_DIR, file.filename)
    with open(save_path, "wb") as f:
        content = await file.read()
        f.write(content)

    placeholders = extract_placeholders(file.filename)
    return {
        "message": "範本上傳成功",
        "id": file.filename,
        "name": file.filename.replace(".docx", ""),
        "placeholders": placeholders,
    }


@router.get("/{template_id}/placeholders")
def get_placeholders(template_id: str):
    """取得範本中的所有佔位符"""
    try:
        placeholders = extract_placeholders(template_id)
        return {"template_id": template_id, "placeholders": placeholders}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="範本不存在")


@router.post("/create-default")
def create_default():
    """建立預設示範範本"""
    filename = create_default_template()
    placeholders = extract_placeholders(filename)
    return {
        "message": "預設範本建立成功",
        "id": filename,
        "placeholders": placeholders,
    }


@router.delete("/{template_id}")
def delete_template(template_id: str):
    """刪除範本"""
    try:
        path = get_template_path(template_id)
        os.remove(path)
        return {"message": f"範本 {template_id} 已刪除"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="範本不存在")
