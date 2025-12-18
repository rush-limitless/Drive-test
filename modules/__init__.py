"""Compatibility package exposing device actions for Spec modules."""

from pathlib import Path

__all__ = ["device_actions"]

_CURRENT_DIR = Path(__file__).resolve().parent
_MON_PROJET_MODULES = _CURRENT_DIR.parent / "mon-projet" / "modules"

# Ensure Python can discover submodules that live inside mon-projet/modules
if _MON_PROJET_MODULES.exists():
    __path__ = [str(_CURRENT_DIR), str(_MON_PROJET_MODULES)]
else:  # pragma: no cover - fallback when used outside the repo layout
    __path__ = [str(_CURRENT_DIR)]
