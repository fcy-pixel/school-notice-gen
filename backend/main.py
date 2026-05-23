import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import templates, generate, export, chat

load_dotenv()

app = FastAPI(title="學校通告生成系統", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(templates.router, prefix="/templates", tags=["範本管理"])
app.include_router(generate.router, prefix="/generate", tags=["AI 生成"])
app.include_router(export.router, prefix="/export", tags=["輸出 Word"])
app.include_router(chat.router, prefix="/chat", tags=["Chatbot 通告助手"])


@app.get("/")
def root():
    return {"message": "學校通告生成系統 API 正常運行"}
