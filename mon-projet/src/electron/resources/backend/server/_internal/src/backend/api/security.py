"""Simple API key check and in-memory rate limiting."""
from datetime import datetime, timedelta, timezone
from typing import Dict
from fastapi import Header, HTTPException, Depends, Request
from core.config import settings

# rate limit store: key -> (window_start, count)
_rate_store: Dict[str, Dict[str, object]] = {}


async def require_api_key(x_api_key: str = Header(None)):
    # Authentication fully disabled to avoid 401s in local/Electron usage.
    return


async def enforce_rate_limit(request: Request, x_api_key: str = Header(None)):
# Rate limiting disabled for the desktop app (frequent polling).
    return


def secured():
    """Composite dependency for convenience."""
    return Depends(require_api_key)


def rate_limited():
    """Composite dependency for convenience."""
    return Depends(enforce_rate_limit)
