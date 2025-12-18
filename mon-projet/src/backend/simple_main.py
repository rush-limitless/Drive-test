"""Simple FastAPI server without MongoDB dependencies."""

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

try:
    from src.backend.api.modules import router as modules_router
except Exception as exc:  # pragma: no cover - ensure local dev fallback
    fallback_router = APIRouter()

    @fallback_router.get("/modules")
    async def _unavailable_modules():
        return {"error": "modules API unavailable", "detail": str(exc)}

    modules_router = fallback_router

app = FastAPI(
    title="Telco ADB Automation API",
    description="Simple API for Telco ADB Automation",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include modules router
app.include_router(modules_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "Telco ADB Automation API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}

DEFAULT_PORT = 8007

if __name__ == "__main__":
    uvicorn.run(
        "src.backend.simple_main:app",
        host="0.0.0.0",
        port=DEFAULT_PORT,
        reload=True
    )
