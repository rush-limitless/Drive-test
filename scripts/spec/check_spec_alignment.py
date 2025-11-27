#!/usr/bin/env python3
"""
Spec alignment checker.

Ensures every spec folder under `specs/` contains the expected artefacts (spec.md,
plan.md, tasks.md) and that required headings exist. Designed to fail CI when the
Spec-Driven Development workflow is incomplete.
"""
from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional

ROOT = Path(__file__).resolve().parents[2]
SPEC_ROOT = ROOT / "specs"

REQUIRED_FILES = ("spec.md", "plan.md", "tasks.md")
REQUIRED_HEADINGS = {
    "spec.md": (
        r"^## 1\. Background & Context$",
        r"^## 2\. Problem Statement$",
        r"^## 8\. Acceptance Criteria$",
    ),
    "plan.md": (r"^# Plan",),
    "tasks.md": (r"^# Tasks",),
}


@dataclass
class SpecIssue:
    spec_id: str
    file: str
    message: str


def find_spec_dirs() -> Iterable[Path]:
    if not SPEC_ROOT.exists():
        raise SystemExit(f"[error] Spec root missing: {SPEC_ROOT}")
    for path in sorted(SPEC_ROOT.iterdir()):
        if path.is_dir():
            yield path


def spec_version(spec_dir: Path) -> Optional[int]:
    match = re.match(r"^(\d+)", spec_dir.name)
    if match:
        return int(match.group(1))
    return None


def check_required_files(spec_dir: Path) -> List[SpecIssue]:
    issues: List[SpecIssue] = []
    spec_id = spec_dir.name
    version = spec_version(spec_dir)
    legacy_mode = version is not None and version < 3
    if legacy_mode:
        # Legacy specs are reported but do not fail the check.
        return []
    for filename in REQUIRED_FILES:
        if not (spec_dir / filename).exists():
            issues.append(SpecIssue(spec_id, filename, "missing required artefact"))
    return issues


def check_headings(spec_dir: Path) -> List[SpecIssue]:
    issues: List[SpecIssue] = []
    spec_id = spec_dir.name
    version = spec_version(spec_dir)
    legacy_mode = version is not None and version < 3
    for filename, patterns in REQUIRED_HEADINGS.items():
        file_path = spec_dir / filename
        if not file_path.exists():
            continue
        if legacy_mode:
            continue
        content = file_path.read_text(encoding="utf-8").splitlines()
        for pattern in patterns:
            if not any(re.search(pattern, line) for line in content):
                issues.append(
                    SpecIssue(
                        spec_id,
                        filename,
                        f"missing heading matching pattern: {pattern!r}",
                    )
                )
    return issues


def main() -> int:
    issues: List[SpecIssue] = []
    legacy_specs: List[str] = []
    for spec_dir in find_spec_dirs():
        version = spec_version(spec_dir)
        if version is not None and version < 3:
            legacy_specs.append(spec_dir.name)
        issues.extend(check_required_files(spec_dir))
        issues.extend(check_headings(spec_dir))

    if issues:
        print("Spec alignment failed:\n")
        for issue in issues:
            print(f"- [{issue.spec_id}] {issue.file}: {issue.message}")
        print("\nRefer to templates/spec-template.md for required sections.")
        return 1

    print("All specs aligned with Spec Kit requirements.")
    if legacy_specs:
        specs_display = ", ".join(legacy_specs)
        print(f"(info) Legacy specs skipped from strict checks: {specs_display}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
