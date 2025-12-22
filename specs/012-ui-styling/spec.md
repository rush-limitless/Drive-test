# Feature Specification: Chakra UI + Tailwind Enablement

**Feature Branch**: `[012-ui-styling-upgrade]`
**Created**: 2025-11-05
**Status**: Draft  
**Input**: User description: "Add Chakra UI and Tailwind CSS so the dashboard looks better."

## 1. Background & Context

The UI needs a consistent styling system that supports both component-level and utility-based styling.

## 2. Problem Statement

Current styling lacks a unified approach, slowing down UI iteration and consistency.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Chakra Foundations (Priority: P1)

As a frontend developer, I want Chakra UI available in the React app so I can use its component library and design tokens to style pages consistently.

**Why this priority**: Chakra gives us an immediate, consistent design system on top of our existing React codebase; without it we cannot standardise new UI work.

**Independent Test**: After the change, the root component is wrapped with `ChakraProvider` and a sample Chakra component renders correctly without runtime errors.

**Acceptance Scenarios**:
1. **Given** the application renders, **When** I inspect React DevTools, **Then** I see `ChakraProvider` wrapping `App`.
2. **Given** a page uses a Chakra component (e.g. `Button`), **When** the app loads, **Then** the component inherits Chakra styling (padding, focus ring) with no console warnings.

---

### User Story 2 - Tailwind Utility Styling (Priority: P2)

As a designer, I want Tailwind utility classes available so I can iterate quickly on layout/spacing/typography without bespoke CSS files.

**Why this priority**: Tailwind accelerates rapid UI experiments while Chakra covers higher-level components; together they enable richer dashboard customization.

**Independent Test**: Add a Tailwind class like `bg-slate-900` to a container and confirm the style applies after the build.

**Acceptance Scenarios**:
1. **Given** Tailwind is configured, **When** I add `className="bg-slate-900"` to a div, **Then** the background updates immediately in dev mode.
2. **Given** `npm run build` runs, **When** inspecting the generated CSS, **Then** Tailwind utilities are purged to the classes referenced in the source.

---

### User Story 3 - Harmonised Tooling (Priority: P3)

As a build engineer, I want CRA builds (and Electron packaging) to continue working after integrating Chakra and Tailwind.

**Why this priority**: Styling upgrades must not break existing workflows or Electron builds.

**Independent Test**: Run `npm run build`; it completes successfully and assets include both Chakra styles and Tailwind-processed CSS; Electron bundling should remain unaffected.

**Acceptance Scenarios**:
1. **Given** the new dependencies, **When** running `npm run build`, **Then** the command exits 0 and the output includes Tailwind styles.
2. **Given** Electron relies on CRA build output, **When** launching `npm run electron`, **Then** the renderer loads without missing stylesheet errors.

---

### Edge Cases

- Ensure Chakra and MUI coexist (both rely on Emotion). ChakraProvider must not override the existing Emotion cache used by MUI.
- Tailwind must not conflict with existing global styles; ensure `index.css` still imports our custom styles alongside Tailwind directives.
- Purge config should include `.ts` and `.tsx` files in both `src` and sibling directories we import from (e.g. `../components` if any shared path).
- Confirm server-side themes (dark mode) default correctly and no flash of unstyled content occurs during initial render.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Add Chakra UI dependencies (`@chakra-ui/react`, `@chakra-ui/icons`, `@emotion/react`, `@emotion/styled`, `framer-motion`) and wrap the app with `ChakraProvider`.
- **FR-002**: Configure a shared theme file (`src/styles/theme.ts`) exporting Chakra theme tokens ready for future customization.
- **FR-003**: Install Tailwind CSS + PostCSS tooling, generate `tailwind.config.js` (scanning `./src/**/*.{js,jsx,ts,tsx}`) and `postcss.config.js`.
- **FR-004**: Inject Tailwind directives (`@tailwind base;`, `@tailwind components;`, `@tailwind utilities;`) into the global stylesheet and ensure existing custom styles remain functional.
- **FR-005**: Demonstrate Tailwind + Chakra by updating at least one dashboard surface (e.g. hero banner container) with utility classes plus a Chakra component.
- **FR-006**: Confirm `npm run build` succeeds and Electron renderer consumes the compiled assets without regression.

### Key Entities *(include if feature involves data)*

- **Chakra Theme**: Object describing color palette, typography, and component overrides.
- **Tailwind Config**: Content paths and theme extensions used for PurgeCSS.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Local dev server (`npm start`) boot time remains under 3 seconds after enabling Tailwind (baseline CRA performance).
- **SC-002**: Production build completes with no new warnings and CSS bundle size stays within +/-10% of baseline after Purge.
- **SC-003**: Dashboard renders at least one Chakra component and uses Tailwind utility classes without runtime warnings.
- **SC-004**: Lint/test commands (where available) continue to pass without additional configuration errors.

## 8. Acceptance Criteria

- Chakra and Tailwind are configured and usable in the UI.
- Production builds complete without styling regressions.
- Electron renders the frontend without missing styles.


