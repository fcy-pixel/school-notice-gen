"""
Word 範本填充服務
使用 python-docx 將佔位符替換為通告內容
"""

import re
import os
from io import BytesIO
from docx import Document


TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "..", "templates")


def ensure_templates_dir():
    os.makedirs(TEMPLATES_DIR, exist_ok=True)


def list_templates() -> list[dict]:
    ensure_templates_dir()
    templates = []
    for filename in os.listdir(TEMPLATES_DIR):
        if filename.endswith(".docx"):
            templates.append({"id": filename, "name": filename.replace(".docx", "")})
    return templates


def get_template_path(template_id: str) -> str:
    path = os.path.join(TEMPLATES_DIR, template_id)
    if not os.path.exists(path):
        raise FileNotFoundError(f"範本不存在：{template_id}")
    return path


def extract_placeholders(template_id: str) -> list[str]:
    """提取範本中所有 {{佔位符}}"""
    path = get_template_path(template_id)
    doc = Document(path)
    text = ""
    for para in doc.paragraphs:
        text += para.text
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    text += para.text
    placeholders = re.findall(r"\{\{(.+?)\}\}", text)
    return list(set(placeholders))


def _replace_in_paragraph(para, replacements: dict[str, str]):
    """在段落中替換佔位符，保留格式"""
    for key, value in replacements.items():
        placeholder = f"{{{{{key}}}}}"
        if placeholder in para.text:
            # 逐個 run 替換
            for run in para.runs:
                if placeholder in run.text:
                    run.text = run.text.replace(placeholder, value)
            # 若佔位符跨多個 run，重新組合整段文字
            if placeholder in para.text:
                full_text = para.text
                new_text = full_text.replace(placeholder, value)
                # 清空所有 run 並把內容放到第一個
                if para.runs:
                    para.runs[0].text = new_text
                    for run in para.runs[1:]:
                        run.text = ""


def fill_template(template_id: str, replacements: dict[str, str]) -> BytesIO:
    """
    將佔位符替換後，回傳填好的 .docx 位元組流
    """
    path = get_template_path(template_id)
    doc = Document(path)

    # 處理正文段落
    for para in doc.paragraphs:
        _replace_in_paragraph(para, replacements)

    # 處理表格中的段落
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    _replace_in_paragraph(para, replacements)

    # 處理頁首頁尾
    for section in doc.sections:
        for para in section.header.paragraphs:
            _replace_in_paragraph(para, replacements)
        for para in section.footer.paragraphs:
            _replace_in_paragraph(para, replacements)

    output = BytesIO()
    doc.save(output)
    output.seek(0)
    return output


def create_default_template() -> str:
    """
    建立一個預設的測試範本（如果 templates/ 目錄為空）
    """
    from docx import Document
    from docx.shared import RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH

    doc = Document()

    # 標題
    title = doc.add_heading("{{通告標題}}", level=1)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in title.runs:
        run.font.color.rgb = RGBColor(0, 0, 0)

    # 收件人
    recipient_para = doc.add_paragraph()
    recipient_para.add_run("{{收件人}}")

    doc.add_paragraph()  # 空行

    # 正文
    doc.add_paragraph("{{正文}}")

    doc.add_paragraph()  # 空行

    # 落款
    closing_para = doc.add_paragraph()
    closing_para.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    closing_para.add_run("{{落款}}")

    path = os.path.join(TEMPLATES_DIR, "預設範本.docx")
    ensure_templates_dir()
    doc.save(path)
    return "預設範本.docx"
