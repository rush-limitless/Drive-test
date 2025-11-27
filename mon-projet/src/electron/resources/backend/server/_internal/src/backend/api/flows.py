"""Flow management API endpoints."""

from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
from pydantic import BaseModel
import logging

from core.database import get_db
from models.flow import Flow, FlowVisibility
from models.flow_module import FlowModule

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/flows", tags=["flows"])


class FlowModuleCreate(BaseModel):
    module_id: str
    sequence_order: int
    input_parameters: Optional[Dict] = None
    continue_on_failure: bool = False
    retry_count: int = 0
    timeout_seconds: Optional[int] = None


class FlowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    visibility: str = "private"
    modules: List[FlowModuleCreate]
    estimated_duration_minutes: Optional[int] = None


class FlowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    visibility: Optional[str] = None
    modules: Optional[List[FlowModuleCreate]] = None
    estimated_duration_minutes: Optional[int] = None


@router.get("/", response_model=List[Dict])
async def list_flows(
    visibility: Optional[str] = Query(None, description="Filter by visibility"),
    created_by: Optional[str] = Query(None, description="Filter by creator"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of flows to return"),
    db: Session = Depends(get_db)
):
    """List flows with optional filtering."""
    try:
        query = db.query(Flow)
        
        if visibility:
            try:
                vis_enum = FlowVisibility(visibility)
                query = query.filter(Flow.visibility == vis_enum)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid visibility: {visibility}")
                
        if created_by:
            query = query.filter(Flow.created_by == created_by)
            
        flows = query.order_by(Flow.created_at.desc()).limit(limit).all()
        return [flow.to_dict() for flow in flows]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing flows: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve flows")


@router.post("/", response_model=Dict)
async def create_flow(flow_data: FlowCreate, db: Session = Depends(get_db)):
    """Create a new flow."""
    try:
        # Validate visibility
        try:
            visibility = FlowVisibility(flow_data.visibility)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid visibility: {flow_data.visibility}")
            
        # Create flow
        flow = Flow(
            name=flow_data.name,
            description=flow_data.description,
            visibility=visibility,
            estimated_duration_minutes=flow_data.estimated_duration_minutes
        )
        db.add(flow)
        db.flush()  # Get flow ID
        
        # Add modules
        for module_data in flow_data.modules:
            flow_module = FlowModule(
                flow_id=flow.id,
                module_id=module_data.module_id,
                sequence_order=module_data.sequence_order,
                input_parameters=module_data.input_parameters,
                continue_on_failure=module_data.continue_on_failure,
                retry_count=module_data.retry_count,
                timeout_seconds=module_data.timeout_seconds
            )
            db.add(flow_module)
            
        db.commit()
        
        # Return created flow
        db.refresh(flow)
        return flow.to_dict()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating flow: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create flow")


@router.get("/{flow_id}", response_model=Dict)
async def get_flow(flow_id: str, db: Session = Depends(get_db)):
    """Get specific flow details."""
    try:
        flow = db.query(Flow).filter(Flow.id == flow_id).first()
        if not flow:
            raise HTTPException(status_code=404, detail="Flow not found")
            
        return flow.to_dict()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting flow {flow_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve flow")


@router.put("/{flow_id}", response_model=Dict)
async def update_flow(flow_id: str, flow_data: FlowUpdate, db: Session = Depends(get_db)):
    """Update existing flow."""
    try:
        flow = db.query(Flow).filter(Flow.id == flow_id).first()
        if not flow:
            raise HTTPException(status_code=404, detail="Flow not found")
            
        # Update basic fields
        if flow_data.name is not None:
            flow.name = flow_data.name
        if flow_data.description is not None:
            flow.description = flow_data.description
        if flow_data.visibility is not None:
            try:
                flow.visibility = FlowVisibility(flow_data.visibility)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid visibility: {flow_data.visibility}")
        if flow_data.estimated_duration_minutes is not None:
            flow.estimated_duration_minutes = flow_data.estimated_duration_minutes
            
        # Update modules if provided
        if flow_data.modules is not None:
            # Remove existing modules
            db.query(FlowModule).filter(FlowModule.flow_id == flow.id).delete()
            
            # Add new modules
            for module_data in flow_data.modules:
                flow_module = FlowModule(
                    flow_id=flow.id,
                    module_id=module_data.module_id,
                    sequence_order=module_data.sequence_order,
                    input_parameters=module_data.input_parameters,
                    continue_on_failure=module_data.continue_on_failure,
                    retry_count=module_data.retry_count,
                    timeout_seconds=module_data.timeout_seconds
                )
                db.add(flow_module)
                
        db.commit()
        db.refresh(flow)
        return flow.to_dict()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating flow {flow_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update flow")


@router.delete("/{flow_id}")
async def delete_flow(flow_id: str, db: Session = Depends(get_db)):
    """Delete flow."""
    try:
        flow = db.query(Flow).filter(Flow.id == flow_id).first()
        if not flow:
            raise HTTPException(status_code=404, detail="Flow not found")
            
        # Check if flow has active executions
        from models.execution import Execution, ExecutionStatus
        active_executions = db.query(Execution).filter(
            Execution.flow_id == flow.id,
            Execution.status.in_([ExecutionStatus.PENDING, ExecutionStatus.RUNNING])
        ).count()
        
        if active_executions > 0:
            raise HTTPException(
                status_code=400, 
                detail="Cannot delete flow with active executions"
            )
            
        db.delete(flow)
        db.commit()
        
        return {"success": True, "message": "Flow deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting flow {flow_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete flow")


@router.post("/{flow_id}/duplicate", response_model=Dict)
async def duplicate_flow(flow_id: str, name: Optional[str] = None, db: Session = Depends(get_db)):
    """Duplicate existing flow."""
    try:
        original_flow = db.query(Flow).filter(Flow.id == flow_id).first()
        if not original_flow:
            raise HTTPException(status_code=404, detail="Flow not found")
            
        # Create duplicate flow
        duplicate_name = name or f"{original_flow.name} (Copy)"
        duplicate_flow = Flow(
            name=duplicate_name,
            description=original_flow.description,
            visibility=original_flow.visibility,
            estimated_duration_minutes=original_flow.estimated_duration_minutes
        )
        db.add(duplicate_flow)
        db.flush()
        
        # Duplicate modules
        for original_module in original_flow.modules:
            duplicate_module = FlowModule(
                flow_id=duplicate_flow.id,
                module_id=original_module.module_id,
                sequence_order=original_module.sequence_order,
                input_parameters=original_module.input_parameters,
                continue_on_failure=original_module.continue_on_failure,
                retry_count=original_module.retry_count,
                timeout_seconds=original_module.timeout_seconds
            )
            db.add(duplicate_module)
            
        db.commit()
        db.refresh(duplicate_flow)
        return duplicate_flow.to_dict()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error duplicating flow {flow_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to duplicate flow")