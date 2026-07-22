import os
import tempfile
import requests
import json
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from paddleocr import PaddleOCR

app = FastAPI(title="Judge AI Server")

# Allow CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize PaddleOCR (downloads models on first run)
# use_angle_cls=True to automatically rotate images if needed
# lang='korean' supports both Korean and English
ocr = PaddleOCR(use_angle_cls=True, lang='korean')

# Ollama Host (Docker service name)
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434/api/generate")
MODEL_NAME = "qwen2.5:7b" # Or llama3

class HintRequest(BaseModel):
    problem_text: str
    failed_code: str

def call_ollama(prompt: str) -> str:
    """Helper function to call local Ollama API."""
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False
    }
    try:
        response = requests.post(OLLAMA_URL, json=payload)
        response.raise_for_status()
        return response.json().get("response", "")
    except requests.exceptions.RequestException as e:
        print(f"Ollama API Error: {e}")
        return "Error connecting to local AI model. Ensure Ollama is running."

@app.post("/api/ai/process-problem")
async def process_problem(file: UploadFile = File(...)):
    """
    1. Runs OCR on uploaded image.
    2. Uses Ollama to format the problem and generate 10 test cases.
    """
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image.")

    # Save image to temp file for PaddleOCR
    with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as temp_img:
        content = await file.read()
        temp_img.write(content)
        temp_img_path = temp_img.name

    try:
        # 1. OCR Extraction
        result = ocr.ocr(temp_img_path, cls=True)
        raw_text = ""
        if result and result[0]:
            for line in result[0]:
                text = line[1][0]
                raw_text += text + "\n"
        
        if not raw_text.strip():
            return {"error": "No text detected in the image."}

        # 2. Problem Formatting & Test Case Generation via LLM
        prompt = f"""
다음은 알고리즘 문제지 이미지를 OCR로 스캔한 거친 텍스트입니다.
이 텍스트를 바탕으로 두 가지 작업을 수행해주세요:

1. [문제 정보 정리] 제목, 문제 내용, 입력 조건, 출력 조건, 제한 사항을 깔끔한 마크다운으로 정리해주세요.
2. [테스트 케이스 생성] 위 조건들을 만족하면서, 경계값(Edge Case)을 포함하여 가장 까다롭고 틀리기 쉬운 테스트 케이스 10개를 "입력"과 "기대 출력" 형태로 만들어주세요.

**[주의: 반드시 한국어(Korean)로만 대답하세요. 절대 중국어나 영어를 사용하지 마세요.]**

--- OCR 텍스트 ---
{raw_text}
"""
        llm_response = call_ollama(prompt)
        
        return {
            "raw_ocr_text": raw_text,
            "ai_processed_result": llm_response
        }

    finally:
        if os.path.exists(temp_img_path):
            os.remove(temp_img_path)

@app.post("/api/ai/hint")
async def get_hint(request: HintRequest):
    """
    Analyzes failed code and provides a hint based on time/space complexity.
    """
    prompt = f"""
당신은 최고의 알고리즘 코딩 테스트 선생님입니다.
학생이 아래 문제를 풀다가 코드가 틀렸거나 시간 초과가 발생했습니다.
정답 코드를 절대 직접 알려주지 말고, 시간 복잡도와 공간 복잡도를 분석하여 어떤 논리적 오류가 있는지 핵심적인 '힌트'만 마크다운으로 제공해주세요.

**[주의: 반드시 한국어(Korean)로만 대답하세요. 절대 중국어나 영어를 사용하지 마세요.]**

--- 문제 정보 ---
{request.problem_text}

--- 학생의 틀린 코드 ---
{request.failed_code}
"""
    hint = call_ollama(prompt)
    return {"hint": hint}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
