"""
Configuration du chemin ADB pour version autonome.
Privilégie le binaire bundlé (PyInstaller/electron), sinon celui du repo,
puis retombe sur l'adb système.
"""
import sys
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

    # Fallback vers adb système
    return "adb"


ADB_EXECUTABLE = get_adb_path()
