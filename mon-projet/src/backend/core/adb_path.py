"""
ADB path resolution for standalone builds.
Prefer the bundled binary (PyInstaller/Electron), then the repo copy,
and finally fall back to the system adb.
"""
import sys
import os
from pathlib import Path


def get_adb_path() -> str:
    exe_names = ["adb.exe", "adb"]
    candidates = []

    # PyInstaller bundle
    if getattr(sys, "frozen", False):
        bundle_dir = Path(sys._MEIPASS)
        for name in exe_names:
            candidates.append(bundle_dir / "adb" / name)
            candidates.append(bundle_dir / "platform-tools" / name)

    # Repo/development paths
    here = Path(__file__).resolve()
    # core -> backend -> src -> repo root
    search_roots = [
        here.parent,
        here.parent.parent,
        here.parent.parent.parent,
        here.parent.parent.parent.parent if len(here.parents) >= 4 else None,
        Path.cwd(),
    ]
    for root in filter(None, search_roots):
        candidates.extend(
            [
                root / "electron" / "resources" / "adb" / name
                for name in exe_names
            ]
        )
        candidates.extend(
            [
                root / "platform-tools" / name
                for name in exe_names
            ]
        )
        candidates.extend(
            [
                root / "resources" / "adb" / name
                for name in exe_names
            ]
        )

    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
# Fallback to system adb
    return "adb"


ADB_EXECUTABLE_OVERRIDE = os.environ.get("SPECIFY_ADB_EXECUTABLE")
ADB_EXECUTABLE = ADB_EXECUTABLE_OVERRIDE or get_adb_path()
