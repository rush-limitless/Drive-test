# Tasks — Spec 007 Packaging & Distribution

## Packaging Scripts
- [ ] Finalise Electron `electron-builder` config (icons, versioning, output directory).
- [ ] Implement backend packaging script (virtualenv bundle or PyInstaller).
- [ ] Bundle supplementary assets (ADB scripts, configs).

## Automation
- [ ] Create GitHub Actions workflow `package.yml` to build artefacts on release tags.
- [ ] Upload artefacts with checksums to GitHub Releases.
- [ ] Integrate smoke tests (Electron launch + backend health check).

## Documentation & Support
- [ ] Write installation/upgrade/uninstall guide.
- [ ] Document prerequisites (ADB, MongoDB, environment variables).
- [ ] Automate release notes referencing spec IDs.

## QA & Validation
- [ ] Test installers on Windows (and macOS if produced).
- [ ] Validate backend bundle on target environments.
- [ ] Capture known issues & troubleshooting tips.

