"""Device management API endpoints."""

from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import StreamingResponse
from typing import List, Dict, Optional
import asyncio
import logging
from datetime import datetime, timedelta, timezone
import io
import os

from fpdf import FPDF, XPos, YPos
from pydantic import BaseModel

from services.device_manager import device_manager
from services.adb_manager import adb_manager
from api.security import require_api_key, enforce_rate_limit

logger = logging.getLogger(__name__)

LIVE_INFO_CONCURRENCY = 5
LIVE_INFO_TIMEOUT_SEC = 3.0
OPERATOR_TIMEOUT_SEC = 1.0

router = APIRouter(
    prefix="/devices",
    tags=["devices"],
    dependencies=[Depends(require_api_key), Depends(enforce_rate_limit)],
)


@router.get("/", response_model=List[Dict])
async def list_devices(
    status: Optional[str] = Query(None, description="Filter by device status"),
    connected_only: bool = Query(False, description="Return only connected devices")
):
    """List all devices with optional filtering."""
    try:
        if connected_only:
            devices = await device_manager.get_connected_devices()
        else:
            devices = await device_manager.get_all_devices()

        async def enrich_device(device: Dict, semaphore: asyncio.Semaphore) -> None:
            status_value = (device.get("status") or "").lower()
            if status_value not in {"connected", "busy"}:
                return
            device_id = device.get("id")
            if not device_id:
                return

            async with semaphore:
                try:
                    live_info = await asyncio.wait_for(
                        adb_manager.get_device_info(device_id, force_refresh=True),
                        timeout=LIVE_INFO_TIMEOUT_SEC,
                    )
                except asyncio.TimeoutError:
                    live_info = None
                except Exception as exc:
                    logger.debug("Live device info failed for %s: %s", device_id, exc)
                    live_info = None

                if live_info:
                    for key in ("battery_level", "network_technology", "connection_type", "airplane_mode"):
                        value = live_info.get(key)
                        if value is not None:
                            device[key] = value

                try:
                    live_operator = await asyncio.wait_for(
                        adb_manager.get_network_operator_live(device_id),
                        timeout=OPERATOR_TIMEOUT_SEC,
                    )
                except asyncio.TimeoutError:
                    live_operator = None
                except Exception as exc:
                    logger.debug("Live operator lookup failed for %s: %s", device_id, exc)
                    live_operator = None

                if live_operator:
                    device["network_operator_live"] = live_operator

        if devices:
            semaphore = asyncio.Semaphore(LIVE_INFO_CONCURRENCY)
            await asyncio.gather(*(enrich_device(device, semaphore) for device in devices))

        # Filter by status if specified
        if status:
            devices = [d for d in devices if d['status'] == status]
            
        return devices
        
    except Exception as e:
        logger.error(f"Error listing devices: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve devices")


@router.get("/{device_id}", response_model=Dict)
async def get_device(device_id: str):
    """Get specific device details."""
    try:
        device = await device_manager.get_device(device_id)
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        return device
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting device {device_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve device")


@router.post("/{device_id}/refresh")
async def refresh_device(device_id: str):
    """Refresh device information from ADB."""
    try:
        # Force refresh device info from ADB
        device_info = await adb_manager.get_device_info(device_id, force_refresh=True)
        if not device_info:
            raise HTTPException(status_code=404, detail="Device not found or not connected")
            
        # Trigger device scan to update database
        await device_manager.scan_and_update_devices()
        
        # Return updated device info
        device = await device_manager.get_device(device_id)
        return device
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error refreshing device {device_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to refresh device")


@router.get("/{device_id}/logs", response_model=List[Dict])
async def get_device_logs(
    device_id: str,
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of logs to return"),
    offset: int = Query(0, ge=0, description="Number of logs to skip")
):
    """Get recent logs for a device."""
    try:
        logs = await device_manager.get_device_logs(device_id, limit, offset)
        return logs
        
    except Exception as e:
        logger.error(f"Error getting logs for device {device_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve device logs")


# ---------------------------------------------------------------------------
# History PDF export (client provides the events; backend renders PDF)
# ---------------------------------------------------------------------------
class HistoryEntry(BaseModel):
    timestamp: str
    type: str
    label: str
    referenceId: Optional[str] = None
    status: Optional[str] = None
    details: Optional[str] = None


class HistoryExportRequest(BaseModel):
    device_alias: Optional[str] = None
    device_tags: Optional[List[str]] = None
    start: Optional[str] = None
    end: Optional[str] = None
    entries: List[HistoryEntry]


@router.post("/{device_id}/history/export")
async def export_device_history_pdf(device_id: str, payload: HistoryExportRequest):
    """Render a PDF of device history (provided by the frontend) with a logo and summary stats."""
    if not payload.entries:
        raise HTTPException(status_code=400, detail="No history entries provided.")

    # Compute stats
    total = len(payload.entries)
    successes = sum(1 for e in payload.entries if (e.status or "").lower() == "success")
    failures = sum(1 for e in payload.entries if (e.status or "").lower() == "failure")
    success_rate = (successes / total * 100) if total else 0.0
    font_family = "Helvetica"

    def truncate(text: str, max_len: int = 64) -> str:
        if text is None:
            return ""
        clean = str(text)
        if len(clean) <= max_len:
            return clean
        suffix = "..."
        return clean[: max_len - len(suffix)] + suffix

    def safe_text(text: Optional[str]) -> str:
        """Ensure we don't crash on characters outside latin-1 when Helvetica is used."""
        if text is None:
            return ""
        value = str(text)
        if font_family != "Helvetica":
            return value
        try:
            value.encode("latin-1")
            return value
        except UnicodeEncodeError:
            return value.encode("latin-1", errors="replace").decode("latin-1")

    def load_unicode_font(pdf: FPDF) -> str:
        """Attach a Unicode-capable font if available on the host."""
        font_candidates = [
            ("DejaVu", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
            ("LiberationSans", "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"),
            ("Arial", "C:\\\\Windows\\\\Fonts\\\\arial.ttf", "C:\\\\Windows\\\\Fonts\\\\arialbd.ttf"),
        ]
        for name, regular, bold in font_candidates:
            if os.path.exists(regular):
                try:
                    pdf.add_font(name, "", regular, uni=True)
                    pdf.add_font(name, "B", bold if bold and os.path.exists(bold) else regular, uni=True)
                    return name
                except Exception as exc:
                    logger.debug("Failed to load font %s from %s: %s", name, regular, exc)
        return "Helvetica"

    def status_color(status: str) -> tuple[int, int, int]:
        s = (status or "").lower()
        if s == "success":
            return (46, 125, 50)  # green
        if s == "failure":
            return (198, 40, 40)  # red
        if s in {"pending", "running"}:
            return (33, 150, 243)  # blue
        return (90, 90, 90)  # neutral

    class HistoryPDF(FPDF):
        def __init__(self, *args, base_font: str = "Helvetica", **kwargs):
            super().__init__(*args, **kwargs)
            self.base_font = base_font

        def header(self):
            logo_path_candidates = [
                # User-provided logo
                os.path.join(os.path.expanduser("~"), "Pictures", "ADB Tool", "Logo", "logo.png"),
                os.path.join(os.path.expanduser("~"), "Pictures", "ADB Tool", "logo.png"),
                os.path.join(os.path.dirname(__file__), "..", "static", "logo.png"),
                # WSL absolute path fallback
                "/mnt/c/Users/rush/Pictures/ADB Tool/Logo/logo.png",
            ]
            for candidate in logo_path_candidates:
                if os.path.exists(candidate):
                    try:
                        self.image(candidate, 10, 8, h=12)
                        break
                    except Exception:
                        pass
            self.set_font(self.base_font, "B", 14)
            self.set_text_color(35, 44, 64)
            self.cell(0, 10, "Device History", new_x=XPos.RIGHT, new_y=YPos.TOP, align="R")
            self.ln(12)

        def footer(self):
            self.set_y(-12)
            self.set_font(self.base_font, "", 8)
            self.set_text_color(120, 120, 120)
            self.cell(0, 8, f"Page {self.page_no()}", align="R")

    pdf = HistoryPDF(orientation="P", unit="mm", format="A4", base_font=font_family)
    font_family = load_unicode_font(pdf)
    pdf.base_font = font_family
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.add_page()

    # Heading
    pdf.set_font(font_family, "B", 13)
    pdf.set_text_color(35, 44, 64)
    alias = payload.device_alias or device_id
    pdf.cell(0, 8, safe_text(f"Device: {alias}"), ln=1)
    if payload.device_tags:
        pdf.set_font(font_family, "", 10)
        pdf.cell(0, 6, safe_text(f"Tags: {', '.join(payload.device_tags)}"), ln=1)
    pdf.set_font(font_family, "", 10)
    pdf.cell(0, 6, safe_text(f"Interval: {payload.start or 'Any'} -> {payload.end or 'Any'}"), ln=1)
    pdf.set_fill_color(240, 244, 255)
    pdf.set_draw_color(208, 214, 230)
    pdf.set_line_width(0.2)
    pdf.cell(
        0,
        8,
        safe_text(f"Entries: {total} | Successes: {successes} | Failures: {failures} | Success rate: {success_rate:.1f}%"),
        ln=1,
        fill=True,
    )
    pdf.ln(4)

    # Table header
    pdf.set_fill_color(52, 71, 103)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font(font_family, "B", 9)
    headers = ["Date/Time", "Type", "Label", "Reference", "Status", "Details"]
    widths = [36, 22, 40, 28, 22, 42]
    for header, width in zip(headers, widths):
        pdf.cell(width, 7, header, border=1, fill=True)
    pdf.ln()

    # Rows
    pdf.set_font(font_family, "", 8)
    pdf.set_text_color(30, 30, 30)
    for entry in payload.entries:
        status_text = (entry.status or "").upper()
        r, g, b = status_color(status_text)
        pdf.set_fill_color(r, g, b, alpha=15) if hasattr(pdf, "set_alpha") else pdf.set_fill_color(245, 247, 250)
        for text, width in zip(
            [
                truncate(entry.timestamp, 32),
                truncate(entry.type, 18),
                truncate(entry.label, 32),
                truncate(entry.referenceId or "", 22),
                status_text,
                truncate(entry.details or "", 48),
            ],
            widths,
        ):
            pdf.cell(width, 6, safe_text(text), border=1, fill=True)
        pdf.ln()

    buffer = io.BytesIO()
    pdf.output(buffer)
    buffer.seek(0)
    filename = f"device_history_{device_id}.pdf"
    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={filename}"})


@router.post("/{device_id}/screenshot")
async def capture_screenshot(device_id: str):
    """Capture screenshot from device."""
    try:
        from datetime import datetime
        import os
        from core.config import settings
        
        # Ensure screenshots directory exists
        os.makedirs(settings.SCREENSHOTS_DIR, exist_ok=True)
        
        # Generate screenshot filename
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        filename = f"{device_id}_{timestamp}.png"
        output_path = os.path.join(settings.SCREENSHOTS_DIR, filename)
        
        # Capture screenshot
        success = await adb_manager.capture_screenshot(device_id, output_path)
        
        if not success:
            raise HTTPException(status_code=400, detail="Failed to capture screenshot")
            
        return {
            "success": True,
            "filename": filename,
            "path": output_path,
            "timestamp": timestamp
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error capturing screenshot for device {device_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to capture screenshot")


@router.post("/{device_id}/command")
async def execute_command(device_id: str, command: dict):
    """Execute ADB command on device."""
    try:
        if "command" not in command:
            raise HTTPException(status_code=400, detail="Command field is required")
            
        adb_command = command["command"]
        timeout = command.get("timeout", 30)
        
        # Execute command
        stdout, stderr, return_code = await adb_manager.execute_on_device(
            device_id, adb_command, timeout
        )
        
        return {
            "success": return_code == 0,
            "return_code": return_code,
            "stdout": stdout,
            "stderr": stderr,
            "command": adb_command
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing command on device {device_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to execute command")


@router.post("/scan")
async def scan_devices():
    """Trigger device scan and return updated device list."""
    try:
        devices = await device_manager.scan_and_update_devices()
        return {
            "success": True,
            "device_count": len(devices),
            "devices": devices
        }
        
    except Exception as e:
        logger.error(f"Error scanning devices: {e}")
        raise HTTPException(status_code=500, detail="Failed to scan devices")


@router.get("/{device_id}/status")
async def get_device_status(device_id: str):
    """Get current device status."""
    try:
        status = adb_manager.get_device_status(device_id)
        return {
            "device_id": device_id,
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting status for device {device_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get device status")


def _parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None


def _build_device_pdf(device: Dict, logs: List[Dict], start: datetime, end: datetime) -> bytes:
    """Generate a simple PDF report for a device."""
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=14, style="B")
    pdf.cell(0, 10, "Device Report", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.set_font("Helvetica", size=10)
    pdf.cell(0, 8, f"Device ID: {device.get('id', 'N/A')}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.cell(0, 8, f"Model: {device.get('model', 'N/A')}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.cell(0, 8, f"Operator: {device.get('network_operator', 'N/A')}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.cell(0, 8, f"Network: {device.get('network_technology', 'N/A')}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.cell(0, 8, f"Status: {device.get('status', 'N/A')}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.cell(0, 8, f"Period: {start.isoformat()} -> {end.isoformat()}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(4)

    pdf.set_font("Helvetica", size=12, style="B")
    pdf.cell(0, 8, "Recent Logs", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("Helvetica", size=9)

    truncated = False
    max_logs = 200
    total_logs = len(logs)
    if total_logs > max_logs:
        truncated = True
        logs = logs[:max_logs]

    pdf.set_font("Helvetica", size=10, style="B")
    pdf.cell(0, 8, f"Log count (filtered): {total_logs}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("Helvetica", size=9)

    if not logs:
        pdf.cell(0, 8, "No logs for the selected period.", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    else:
        for log in logs:
            ts = log.get("created_at") or log.get("timestamp") or ""
            msg = log.get("message") or log.get("event") or ""
            line = f"- {ts}: {msg}"
            pdf.multi_cell(0, 6, line)
    if truncated:
        pdf.set_font("Helvetica", size=8, style="I")
        pdf.cell(0, 6, f"(Logs truncated to first {max_logs} entries)", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    output = io.BytesIO()
    pdf.output(output)
    return output.getvalue()


@router.get("/{device_id}/report")
async def download_device_report(
    device_id: str,
    from_ts: Optional[str] = Query(None, description="Start datetime ISO8601"),
    to_ts: Optional[str] = Query(None, description="End datetime ISO8601"),
    format: str = Query("pdf", description="Report format: pdf or csv"),
):
    """Generate and download a report for a device within a time range (pdf/csv)."""
    default_end = datetime.now(timezone.utc)
    default_start = default_end - timedelta(days=1)

    start_dt = _parse_iso_datetime(from_ts) or default_start
    end_dt = _parse_iso_datetime(to_ts) or default_end

    if start_dt > end_dt:
        raise HTTPException(status_code=400, detail="from must be before to")
    if end_dt - start_dt > timedelta(days=90):
        raise HTTPException(status_code=400, detail="Maximum range is 90 days")

    device = await device_manager.get_device(device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    logs = await device_manager.get_device_logs_in_range(device_id, start_dt, end_dt, limit=1000)

    # Common metadata
    log_count = len(logs)
    meta = {
        "device_id": device_id,
        "from": start_dt.isoformat(),
        "to": end_dt.isoformat(),
        "log_count": log_count,
    }

    if format == "csv":
        output = io.StringIO()
        output.write("timestamp,message\n")
        for log in logs:
            ts = log.get("created_at") or log.get("timestamp") or ""
            msg = (log.get("message") or log.get("event") or "").replace("\n", " ").replace(",", " ")
            output.write(f"{ts},{msg}\n")
        payload = output.getvalue().encode("utf-8")
        filename = f"device_report_{device_id}_{start_dt.strftime('%Y%m%d')}_{end_dt.strftime('%Y%m%d')}.csv"
        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
        logger.info("device_report_generated_csv", extra=meta)
        return StreamingResponse(io.BytesIO(payload), media_type="text/csv", headers=headers)

    payload = _build_device_pdf(device, logs, start_dt, end_dt)
    filename = f"device_report_{device_id}_{start_dt.strftime('%Y%m%d')}_{end_dt.strftime('%Y%m%d')}.pdf"
    logger.info("device_report_generated", extra=meta)
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(io.BytesIO(payload), media_type="application/pdf", headers=headers)
