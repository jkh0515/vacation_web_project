from fastapi import FastAPI

app = FastAPI(
    title="Judge Platform API",
    description="API for the AI-based algorithm judge platform",
    version="1.0.0",
)

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "Backend API is running properly."}

# TODO: Add more routes here later (e.g., /submit, /status, /sse)
