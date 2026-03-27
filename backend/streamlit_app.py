import datetime as dt
import os
from io import BytesIO

import streamlit as st
from dotenv import load_dotenv

from services.ai_service import generate_notice, get_fields_for_type, get_notice_types
from services.docx_service import (
    TEMPLATES_DIR,
    create_default_template,
    ensure_templates_dir,
    list_templates,
    fill_template,
)

load_dotenv()

# Streamlit Cloud deploy: map secrets to env vars expected by backend services.
try:
    for secret_key in [
        "QWEN_API_KEY",
        "QWEN_BASE_URL",
        "QWEN_MODEL",
        "OPENAI_API_KEY",
        "OPENAI_BASE_URL",
        "OPENAI_MODEL",
    ]:
        if secret_key in st.secrets and str(st.secrets[secret_key]).strip():
            os.environ[secret_key] = str(st.secrets[secret_key]).strip()
except Exception:
    # Local run without Streamlit secrets file.
    pass

st.set_page_config(page_title="學校自動出通告", page_icon="📝", layout="wide")

st.title("學校自動出通告系統（香港）")
st.caption("上傳學校 Word 範本，AI 生成通告內容，再下載 .docx")

ensure_templates_dir()

if "notice" not in st.session_state:
    st.session_state.notice = None


def save_uploaded_template(uploaded_file) -> str:
    template_name = uploaded_file.name
    save_path = os.path.join(TEMPLATES_DIR, template_name)
    with open(save_path, "wb") as output:
        output.write(uploaded_file.getbuffer())
    return template_name


def render_template_section() -> str:
    st.subheader("1) 範本管理")

    col_a, col_b = st.columns([2, 1])
    with col_a:
        uploaded = st.file_uploader("上傳 .docx 範本", type=["docx"], key="tpl_upload")
        if uploaded is not None:
            filename = save_uploaded_template(uploaded)
            st.success(f"已上傳：{filename}")

    with col_b:
        if st.button("建立預設範本", use_container_width=True):
            filename = create_default_template()
            st.success(f"已建立：{filename}")

    templates = list_templates()
    if not templates:
        st.warning("尚未有可用範本，請先上傳範本或建立預設範本。")
        return ""

    template_options = [item["id"] for item in templates]
    selected = st.selectbox("選擇輸出範本", template_options)
    return selected


def render_generate_section(selected_template: str):
    st.subheader("2) AI 生成通告")

    if not selected_template:
        st.info("請先準備範本。")
        return

    school_name = st.text_input("學校名稱", value="香港示範學校")

    notice_types = get_notice_types()
    notice_type = st.selectbox("通告類型", options=notice_types)
    required_fields = get_fields_for_type(notice_type)

    field_values: dict[str, str] = {}
    for field_name in required_fields:
        field_values[field_name] = st.text_input(field_name, key=f"f_{notice_type}_{field_name}")

    extra_instructions = st.text_area(
        "額外要求（可選）",
        value="",
        placeholder="例：語氣更簡潔、加入回條提醒、適用小四至小六",
    )

    if st.button("生成通告內容", type="primary", use_container_width=True):
        try:
            with st.spinner("AI 生成中..."):
                notice = generate_notice(
                    notice_type=notice_type,
                    school_name=school_name,
                    fields=field_values,
                    extra_instructions=extra_instructions,
                )
            st.session_state.notice = {
                "title": notice.get("title", ""),
                "recipient": notice.get("recipient", ""),
                "body": notice.get("body", ""),
                "closing": notice.get("closing", ""),
                "school_name": school_name,
                "template_id": selected_template,
            }
            st.success("已生成通告草稿，可編輯後下載。")
        except Exception as exc:
            st.error(f"生成失敗：{exc}")


def render_export_section():
    st.subheader("3) 校對與下載 Word")

    notice = st.session_state.notice
    if not notice:
        st.info("請先在上方生成通告內容。")
        return

    notice["title"] = st.text_input("通告標題", value=notice["title"])
    notice["recipient"] = st.text_input("收件人", value=notice["recipient"])
    notice["body"] = st.text_area("正文", value=notice["body"], height=280)
    notice["closing"] = st.text_area("落款", value=notice["closing"], height=120)

    date_value = st.date_input("日期", value=dt.date.today())

    if st.button("產生並下載 .docx", use_container_width=True):
        try:
            replacements = {
                "通告標題": notice["title"],
                "收件人": notice["recipient"],
                "正文": notice["body"],
                "落款": notice["closing"],
                "學校名稱": notice["school_name"],
                "日期": date_value.strftime("%Y-%m-%d"),
                "TITLE": notice["title"],
                "RECIPIENT": notice["recipient"],
                "BODY": notice["body"],
                "CLOSING": notice["closing"],
                "SCHOOL": notice["school_name"],
                "DATE": date_value.strftime("%Y-%m-%d"),
            }
            output = fill_template(notice["template_id"], replacements)
            file_name = f"{notice['title'] or '通告'}.docx"
            st.download_button(
                label="下載 Word 檔案",
                data=output.getvalue(),
                file_name=file_name,
                mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                use_container_width=True,
            )
            st.success("已完成 Word 檔案生成。")
        except Exception as exc:
            st.error(f"Word 生成失敗：{exc}")


selected_template_id = render_template_section()
st.divider()
render_generate_section(selected_template_id)
st.divider()
render_export_section()

with st.sidebar:
    st.header("系統設定")
    has_qwen = bool((os.getenv("QWEN_API_KEY") or "").strip())
    has_openai = bool((os.getenv("OPENAI_API_KEY") or "").strip())
    st.write(f"Qwen API Key：{'已設定' if has_qwen else '未設定'}")
    st.write(f"OpenAI API Key：{'已設定' if has_openai else '未設定'}")
    st.caption("建議優先設定 QWEN_API_KEY。")
