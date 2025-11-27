"""MongoDB models for workflow management."""

from datetime import datetime
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict
from bson import ObjectId


class PyObjectId(ObjectId):
    """Custom ObjectId type for Pydantic."""
    
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, core_schema, handler):
        schema = handler(core_schema)
        schema.update(type="string")
        return schema


class WorkflowModel(BaseModel):
    """Workflow document model."""
    
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    name: str
    status: str = "draft"  # draft, active, archived
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None
    
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str},
    )


class WorkflowVersionModel(BaseModel):
    """Workflow version document model."""
    
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    workflow_id: PyObjectId
    version: int
    is_current: bool = False
    graph: Dict[str, Any]  # JSON graph structure
    input_schema: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str},
    )


class RunModel(BaseModel):
    """Workflow run document model."""
    
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    workflow_version_id: PyObjectId
    trigger: str  # manual, schedule, api
    status: str  # queued, running, success, failed, cancelled, partial
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    device_selector: Dict[str, Any]
    inputs: Dict[str, Any] = Field(default_factory=dict)
    summary: Dict[str, Any] = Field(default_factory=dict)
    
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str},
    )


class RunStepModel(BaseModel):
    """Workflow run step document model."""
    
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    run_id: PyObjectId
    node_id: str
    node_type: str
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    status: str  # running, success, failed, skipped, timeout, cancelled
    attempt: int = 1
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    metrics: Dict[str, Any] = Field(default_factory=dict)
    next_edge: Optional[str] = None
    
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str},
    )


class ScheduleModel(BaseModel):
    """Workflow schedule document model."""
    
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    workflow_id: PyObjectId
    cron: str
    timezone: str = "UTC"
    enabled: bool = True
    last_enqueued_at: Optional[datetime] = None
    
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str},
    )
