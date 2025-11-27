"""
Reports API endpoints for ADB Framework
"""
from datetime import datetime, timedelta, timezone
import json
from typing import Dict, List, Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from core.database import get_db
from models.execution import Execution, ExecutionStatus
from models.execution_device import ExecutionDevice

router = APIRouter()

class ReportFilter(BaseModel):
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    device_id: Optional[str] = None
    workflow_id: Optional[str] = None
    report_type: Optional[str] = None

# Mock reports data
reports_db = [
    {
        "id": "report_001",
        "name": "Daily Test Summary - Jan 20, 2024",
        "type": "daily_summary",
        "created_at": "2024-01-20T23:59:00Z",
        "file_size": "2.5 MB",
        "format": "PDF",
        "status": "completed",
        "download_url": "/api/reports/report_001/download",
        "summary": {
            "total_executions": 15,
            "success_rate": 94.5,
            "devices_tested": 2,
            "workflows_run": 8
        }
    },
    {
        "id": "report_002",
        "name": "Voice Call Test Analysis",
        "type": "module_analysis",
        "created_at": "2024-01-20T18:30:00Z",
        "file_size": "1.8 MB",
        "format": "JSON",
        "status": "completed",
        "download_url": "/api/reports/report_002/download",
        "summary": {
            "module": "voice_call_test",
            "total_runs": 45,
            "success_rate": 95.5,
            "avg_duration": "42s"
        }
    },
    {
        "id": "report_003",
        "name": "Device Performance Report",
        "type": "device_analysis",
        "created_at": "2024-01-20T16:15:00Z",
        "file_size": "3.2 MB",
        "format": "HTML",
        "status": "generating",
        "progress": 75,
        "summary": {
            "device": "Samsung Galaxy A42 5G",
            "tests_run": 23,
            "performance_score": 8.7
        }
    }
]

# ---------------------------------------------------------------------------
# Summary reporting
# ---------------------------------------------------------------------------


class StatusBreakdown(BaseModel):
    pending: int = 0
    running: int = 0
    completed: int = 0
    failed: int = 0
    cancelled: int = 0


class ReportSummary(BaseModel):
    total_executions: int
    success_rate: float
    average_duration_seconds: Optional[float]
    device_coverage: int
    executions_last_7_days: int
    last_execution_at: Optional[datetime]
    status_breakdown: StatusBreakdown


def _parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if value is None:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid datetime format: {value}. Use ISO 8601 format.",
        ) from None


@router.get("/reports/summary", response_model=ReportSummary)
def get_report_summary(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Return aggregated execution metrics for reporting dashboards."""
    start_dt = _parse_iso_datetime(date_from)
    end_dt = _parse_iso_datetime(date_to)

    query = db.query(Execution)
    if start_dt is not None:
        query = query.filter(Execution.start_time >= start_dt)
    if end_dt is not None:
        query = query.filter(Execution.start_time <= end_dt)

    executions = query.all()
    total_executions = len(executions)

    status_counts = {
        ExecutionStatus.PENDING.value: 0,
        ExecutionStatus.RUNNING.value: 0,
        ExecutionStatus.COMPLETED.value: 0,
        ExecutionStatus.FAILED.value: 0,
        ExecutionStatus.CANCELLED.value: 0,
    }

    durations: List[float] = []
    for execution in executions:
        status_counts[execution.status.value] = status_counts.get(execution.status.value, 0) + 1
        if execution.start_time and execution.end_time:
            durations.append((execution.end_time - execution.start_time).total_seconds())

    completed_executions = status_counts.get(ExecutionStatus.COMPLETED.value, 0)
    failed_executions = status_counts.get(ExecutionStatus.FAILED.value, 0)
    success_rate = round((completed_executions / total_executions) * 100, 2) if total_executions else 0.0
    average_duration = round(sum(durations) / len(durations), 2) if durations else None

    # Device coverage: count distinct device IDs across execution devices for filtered executions
    execution_ids = [execution.id for execution in executions]
    if execution_ids:
        device_coverage = (
            db.query(func.count(func.distinct(ExecutionDevice.device_id)))
            .filter(ExecutionDevice.execution_id.in_(execution_ids))
            .scalar()
            or 0
        )
    else:
        device_coverage = 0

    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    executions_last_7_days = sum(
        1
        for execution in executions
        if execution.start_time and execution.start_time >= seven_days_ago
    )

    last_execution_at = None
    if executions:
        last_execution = max(
            executions,
            key=lambda execution: (
                execution.end_time
                or execution.start_time
                or datetime.min
            ),
        )
        last_execution_at = last_execution.end_time or last_execution.start_time

    return ReportSummary(
        total_executions=total_executions,
        success_rate=success_rate,
        average_duration_seconds=average_duration,
        device_coverage=device_coverage,
        executions_last_7_days=executions_last_7_days,
        last_execution_at=last_execution_at,
        status_breakdown=StatusBreakdown(
            pending=status_counts.get(ExecutionStatus.PENDING.value, 0),
            running=status_counts.get(ExecutionStatus.RUNNING.value, 0),
            completed=completed_executions,
            failed=failed_executions,
            cancelled=status_counts.get(ExecutionStatus.CANCELLED.value, 0),
        ),
    )


# ---------------------------------------------------------------------------
# Mock report catalogue routes (legacy)
# ---------------------------------------------------------------------------


@router.get("/reports")
async def get_reports(
    report_type: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0
):
    """Get available reports"""
    filtered_reports = reports_db
    
    if report_type:
        filtered_reports = [r for r in filtered_reports if r["type"] == report_type]
    
    if status:
        filtered_reports = [r for r in filtered_reports if r["status"] == status]
    
    # Sort by created_at descending
    filtered_reports.sort(key=lambda x: x["created_at"], reverse=True)
    
    return {
        "reports": filtered_reports[offset:offset + limit],
        "total": len(filtered_reports),
        "limit": limit,
        "offset": offset
    }

@router.get("/reports/{report_id}")
async def get_report(report_id: str):
    """Get specific report details"""
    report = next((r for r in reports_db if r["id"] == report_id), None)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report

@router.post("/reports/generate")
async def generate_report(
    report_type: str,
    name: str,
    filters: Optional[ReportFilter] = None,
    format: str = "PDF"
):
    """Generate a new report"""
    new_report = {
        "id": f"report_{len(reports_db) + 1:03d}",
        "name": name,
        "type": report_type,
        "created_at": datetime.now().isoformat(),
        "file_size": "0 KB",
        "format": format.upper(),
        "status": "generating",
        "progress": 0,
        "filters": filters.dict() if filters else {},
        "summary": {}
    }
    
    reports_db.append(new_report)
    
    return {
        "success": True,
        "message": "Report generation started",
        "report_id": new_report["id"],
        "estimated_time": "2-5 minutes"
    }

@router.get("/reports/{report_id}/download")
async def download_report(report_id: str):
    """Download report file"""
    report = next((r for r in reports_db if r["id"] == report_id), None)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    if report["status"] != "completed":
        raise HTTPException(status_code=400, detail="Report is not ready for download")
    
    # Mock file content based on format
    if report["format"] == "JSON":
        content = json.dumps({
            "report_id": report_id,
            "generated_at": report["created_at"],
            "data": {"sample": "data"}
        }, indent=2)
        media_type = "application/json"
    elif report["format"] == "HTML":
        content = f"<html><body><h1>{report['name']}</h1><p>Report content here</p></body></html>"
        media_type = "text/html"
    else:  # PDF
        content = f"PDF Report: {report['name']}\nGenerated: {report['created_at']}"
        media_type = "application/pdf"
    
    return {
        "filename": f"{report['name'].replace(' ', '_').lower()}.{report['format'].lower()}",
        "content": content,
        "media_type": media_type
    }

@router.delete("/reports/{report_id}")
async def delete_report(report_id: str):
    """Delete report"""
    global reports_db
    original_count = len(reports_db)
    reports_db = [r for r in reports_db if r["id"] != report_id]
    
    if len(reports_db) == original_count:
        raise HTTPException(status_code=404, detail="Report not found")
    
    return {"success": True, "message": "Report deleted"}

@router.get("/reports/types")
async def get_report_types():
    """Get available report types"""
    return {
        "types": [
            {
                "id": "daily_summary",
                "name": "Daily Summary",
                "description": "Daily test execution summary with statistics",
                "formats": ["PDF", "HTML", "JSON"]
            },
            {
                "id": "module_analysis", 
                "name": "Module Analysis",
                "description": "Detailed analysis of specific test module performance",
                "formats": ["PDF", "JSON", "CSV"]
            },
            {
                "id": "device_analysis",
                "name": "Device Performance",
                "description": "Device-specific performance and compatibility report",
                "formats": ["PDF", "HTML"]
            },
            {
                "id": "workflow_analysis",
                "name": "Workflow Analysis", 
                "description": "Workflow execution patterns and success rates",
                "formats": ["PDF", "JSON", "CSV"]
            },
            {
                "id": "custom",
                "name": "Custom Report",
                "description": "Custom report with user-defined filters and metrics",
                "formats": ["PDF", "HTML", "JSON", "CSV"]
            }
        ]
    }

@router.get("/reports/templates")
async def get_report_templates():
    """Get report templates"""
    return {
        "templates": [
            {
                "id": "executive_summary",
                "name": "Executive Summary",
                "description": "High-level overview for management",
                "type": "daily_summary"
            },
            {
                "id": "technical_details",
                "name": "Technical Details",
                "description": "Detailed technical analysis for engineers",
                "type": "module_analysis"
            },
            {
                "id": "compliance_report",
                "name": "Compliance Report",
                "description": "Compliance and quality assurance report",
                "type": "custom"
            }
        ]
    }

@router.post("/reports/schedule")
async def schedule_report(
    report_type: str,
    name: str,
    schedule: str,  # cron expression
    filters: Optional[ReportFilter] = None,
    format: str = "PDF",
    email_recipients: Optional[List[str]] = None
):
    """Schedule automatic report generation"""
    schedule_id = f"schedule_{len(reports_db) + 100}"
    
    return {
        "success": True,
        "schedule_id": schedule_id,
        "message": f"Report '{name}' scheduled successfully",
        "next_run": "2024-01-21T00:00:00Z",
        "schedule": schedule
    }

@router.get("/reports/schedules")
async def get_scheduled_reports():
    """Get scheduled reports"""
    return {
        "schedules": [
            {
                "id": "schedule_101",
                "name": "Daily Summary Report",
                "type": "daily_summary",
                "schedule": "0 0 * * *",  # Daily at midnight
                "next_run": "2024-01-21T00:00:00Z",
                "status": "active",
                "email_recipients": ["admin@company.com"]
            }
        ]
    }
