"""Adapter exposing the YAML module catalog to legacy callers."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from services.module_catalog import (
    ModuleDefinition,
    ModuleNotFoundError,
    module_catalog,
)


class CatalogModule:
    """Shim providing the interface expected by the execution engine."""

    def __init__(self, definition: ModuleDefinition):
        self.metadata = definition

    async def execute(self, device_id: Optional[str], input_params: Dict[str, Any]) -> Dict[str, Any]:
        result = module_catalog.execute_module(
            self.metadata.id,
            device_id=device_id,
            parameters=input_params,
        )
        return result.result


class ModuleLoader:
    """Thin wrapper around the shared module catalog."""

    async def get_module(self, module_id: str) -> Optional[CatalogModule]:
        try:
            definition = module_catalog.get_module(module_id)
        except ModuleNotFoundError:
            return None
        return CatalogModule(definition)

    async def list_modules(self) -> List[Dict[str, Any]]:
        return [definition.to_dict() for definition in module_catalog.list_modules()]


module_loader = ModuleLoader()
