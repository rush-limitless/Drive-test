"""Simple FastAPI server without MongoDB dependencies."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Import the modules router from the spec-kit api directory
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'api'))

try:
    from modules import router as modules_router
except ImportError:
    # Fallback if import fails
    from fastapi import APIRouter
    modules_router = APIRouter()
    
    @modules_router.get("/modules")
    async def get_modules():
        return [
            {"id": "call_test", "name": "Call Test", "description": "Test voice call"},
            {"id": "airplane_mode_on", "name": "Airplane Mode", "description": "Toggle airplane mode"}
        ]

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

if __name__ == "__main__":
    uvicorn.run(
        "simple_main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
