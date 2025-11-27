"""YAML-backed module registry with execution support."""

from __future__ import annotations

import importlib
import inspect
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml

logger = logging.getLogger(__name__)


class ModuleCatalogError(Exception):
    """Base exception for module catalog errors."""


class ModuleNotFoundError(ModuleCatalogError):
    """Raised when a module id does not exist."""


class ModuleExecutionError(ModuleCatalogError):
    """Raised when a module fails to execute."""


CATEGORY_LABELS = {
    "modules.device_actions": "Device Actions",
    "modules.call_test": "Voice & Call",
    "modules.sms_test": "Messaging",
    "modules.network_check": "Network Diagnostics",
    "modules.network_perf_test": "Network Diagnostics",
}


def _project_root() -> Path:
    return Path(__file__).resolve().parents[4]


@dataclass
class ModuleDefinition:
    id: str
    name: str
    description: str
    entry_point: str
    timeout_sec: int
    version: str
    inputs: Dict[str, Any] = field(default_factory=dict)
    outputs: List[Dict[str, Any]] = field(default_factory=list)
    artifacts: List[Dict[str, Any]] = field(default_factory=list)
    category: str = "General"
    yaml_path: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "entry_point": self.entry_point,
            "timeout_sec": self.timeout_sec,
            "version": self.version,
            "inputs": self.inputs,
            "outputs": self.outputs,
            "artifacts": self.artifacts,
            "category": self.category,
            "yaml_path": self.yaml_path,
        }


@dataclass
class ModuleExecutionResult:
    module_id: str
    module_name: str
    success: bool
    duration_ms: float
    entry_point: str
    result: Dict[str, Any] = field(default_factory=dict)
    device_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        payload = {
            "module_id": self.module_id,
            "module_name": self.module_name,
            "success": self.success,
            "duration_ms": self.duration_ms,
            "entry_point": self.entry_point,
            "result": self.result,
        }
        if self.device_id:
            payload["device_id"] = self.device_id
        if not self.success:
            payload.setdefault("error", self.result.get("error"))
        return payload


class ModuleCatalog:
    """Loads module metadata from YAML and executes their entry points."""

    def __init__(self, modules_dir: Optional[Path] = None):
        self.project_root = _project_root()
        self.modules_dir = modules_dir or (self.project_root / "specs" / "modules")
        self._modules: Dict[str, ModuleDefinition] = {}
        self.reload()

    def reload(self) -> None:
        if not self.modules_dir.exists():
            logger.warning("Modules directory %s does not exist", self.modules_dir)
            self._modules = {}
            return

        definitions: Dict[str, ModuleDefinition] = {}
        for path in sorted(self.modules_dir.glob("module.*.yaml")):
            definition = self._load_definition(path)
            if not definition:
                continue
            definitions[definition.id] = definition

        self._modules = definitions
        logger.info("Loaded %d automation modules from %s", len(definitions), self.modules_dir)

    def _load_definition(self, path: Path) -> Optional[ModuleDefinition]:
        try:
            data = yaml.safe_load(path.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.error("Failed to parse module yaml %s: %s", path, exc)
            return None

        required = ("id", "name", "entry_point")
        if not all(key in data for key in required):
            logger.error("Module yaml %s missing required keys %s", path, required)
            return None

        entry_point = data["entry_point"]
        module_path = entry_point.split(":")[0]
        category = CATEGORY_LABELS.get(module_path, "General")
        description = data.get("description") or f"{data['name']} module for Telco ADB automation."

        yaml_path = str(path.relative_to(self.project_root))

        definition = ModuleDefinition(
            id=data["id"],
            name=data["name"],
            description=description,
            entry_point=entry_point,
            timeout_sec=int(data.get("timeout_sec", 60)),
            version=str(data.get("version", "1.0.0")),
            inputs=data.get("inputs", {}) or {},
            outputs=data.get("outputs", []) or [],
            artifacts=data.get("artifacts", []) or [],
            category=category,
            yaml_path=yaml_path,
        )
        return definition

    def list_modules(self) -> List[ModuleDefinition]:
        return sorted(self._modules.values(), key=lambda item: item.name.lower())

    def search(self, query: str) -> List[ModuleDefinition]:
        lowered = query.lower()
        return [
            module
            for module in self.list_modules()
            if lowered in module.name.lower()
            or lowered in module.id.lower()
            or lowered in module.description.lower()
        ]

    def categories(self) -> Dict[str, int]:
        buckets: Dict[str, int] = {}
        for module in self._modules.values():
            buckets[module.category] = buckets.get(module.category, 0) + 1
        return buckets

    def get_module(self, module_id: str) -> ModuleDefinition:
        try:
            return self._modules[module_id]
        except KeyError as exc:
            raise ModuleNotFoundError(f"Module '{module_id}' not found") from exc

    def execute_module(
        self,
        module_id: str,
        *,
        device_id: Optional[str] = None,
        parameters: Optional[Dict[str, Any]] = None,
    ) -> ModuleExecutionResult:
        definition = self.get_module(module_id)
        func = self._resolve_entry_point(definition.entry_point)

        kwargs = dict(parameters or {})
        signature = inspect.signature(func)

        if device_id is not None and "device_id" in signature.parameters:
            kwargs.setdefault("device_id", device_id)

        required_parameters = [
            name
            for name, param in signature.parameters.items()
            if param.default is inspect._empty
            and param.kind in (inspect.Parameter.KEYWORD_ONLY, inspect.Parameter.POSITIONAL_OR_KEYWORD)
            and name not in kwargs
        ]
        if required_parameters:
            raise ModuleExecutionError(
                f"Missing required parameter(s) for {module_id}: {', '.join(required_parameters)}"
            )

        supported_names = {
            name
            for name, param in signature.parameters.items()
            if param.kind
            in (
                inspect.Parameter.KEYWORD_ONLY,
                inspect.Parameter.POSITIONAL_OR_KEYWORD,
                inspect.Parameter.VAR_KEYWORD,
            )
        }
        unexpected = [key for key in list(kwargs.keys()) if key not in supported_names]
        for key in unexpected:
            logger.debug("Dropping unexpected parameter '%s' for module %s", key, module_id)
            kwargs.pop(key)

        start = time.perf_counter()
        try:
            result = func(**kwargs)
        except Exception as exc:
            logger.exception("Module %s execution failed", module_id)
            raise ModuleExecutionError(str(exc)) from exc
        duration_ms = (time.perf_counter() - start) * 1000

        if not isinstance(result, dict):
            result = {"result": result}

        success = bool(result.get("success", True))

        execution = ModuleExecutionResult(
            module_id=definition.id,
            module_name=definition.name,
            success=success,
            duration_ms=duration_ms,
            entry_point=definition.entry_point,
            result=result,
            device_id=device_id,
        )
        return execution

    @staticmethod
    def _resolve_entry_point(entry_point: str):
        module_path, _, callable_name = entry_point.partition(":")
        if not callable_name:
            raise ModuleExecutionError(f"Invalid entry point '{entry_point}'")
        module = importlib.import_module(module_path)
        try:
            func = getattr(module, callable_name)
        except AttributeError as exc:
            raise ModuleExecutionError(f"Entry point '{entry_point}' not found") from exc
        return func


module_catalog = ModuleCatalog()
