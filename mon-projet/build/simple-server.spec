# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller specification for bundling the Telco ADB Automation server
into a Windows executable.
"""
from pathlib import Path

block_cipher = None

# PyInstaller executes this spec via exec(), so __file__ may be undefined.
# Use the current working directory (the project root when build-exe.ps1 runs).
project_dir = Path.cwd()
site_packages = project_dir / ".venv-build" / "Lib" / "site-packages"

# Conditionally add files/directories that exist
datas = [
    (str(project_dir / "src" / "backend"), "src/backend"),
]

# Add optional files if they exist
if (project_dir / "flux_exemples.yaml").exists():
    datas.append((str(project_dir / "flux_exemples.yaml"), "."))
if (project_dir / "specs").exists():
    datas.append((str(project_dir / "specs"), "specs"))

# Force include platform-tools (ADB)
platform_tools_path = project_dir / "platform-tools"
if platform_tools_path.exists():
    print(f"Including platform-tools from: {platform_tools_path}")
    datas.append((str(platform_tools_path), "platform-tools"))
else:
    print(f"WARNING: platform-tools not found at {platform_tools_path}")

hiddenimports = [
    "motor.motor_asyncio",
    "pydantic_settings",
    "asyncio_mqtt",
    "pymongo",
    "redis",
    "sqlalchemy.ext.declarative",
    "uvicorn",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "uvicorn.protocols",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.http",
    "fastapi.staticfiles",
    "fastapi.responses",
    "multipart",
    "python_multipart",
    "psutil",
    "yaml",
    "pyyaml",
    "alembic",
    "websockets",
]

a = Analysis(
    [str(project_dir / "simple-server.py")],
    pathex=[str(project_dir), str(site_packages)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="TelcoADBServer",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="TelcoADBServer",
)
