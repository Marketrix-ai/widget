# Marketrix Widget Modernization Master Plan

## Document Control

| Field | Value |
| --- | --- |
| Status | Draft for execution |
| Date | 2026-03-02 |
| Scope | `widget` package, `chrome-extension`, CI/CD, quality gates, docs |
| Primary Goal | Deliver an industry-leading embedded chat widget UI using Base UI in closed Shadow DOM |
| Directive | Pre-release product: no backward compatibility, legacy support, or rollback obligations |

## 1. Executive Summary

This plan replaces the current mixed styling/UI approach with a formal Base UI-driven design system and production-quality engineering controls.  
The outcome is a consistent, premium chat experience with strict visual quality, accessibility, performance, reliability, and release governance.

This plan addresses all previously identified issues:

1. Mixed and inconsistent UI patterns
2. Broad CSS selectors and excessive `!important`
3. Missing standardized primitive layer
4. Inconsistent interaction states and motion
5. Uncontrolled layering/z-index model
6. Weak UI quality gates (no automated UI regression tests)
7. CI/documentation drift and process mismatch

## 2. Current State Assessment

### 2.1 Confirmed architecture and tooling baseline

- React + Vite + TypeScript + Tailwind v4 (`src`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`)
- Closed Shadow DOM render model with CSS injection from `index.css?inline` (`src/utils/bootstrap.tsx`)
- UI implemented via custom components and utility classes (`src/components/*`, `src/constants/theme.ts`)
- Build/release pipeline exists but quality checks are incomplete (`.github/workflows/validate.yml`, `.github/workflows/deploy.yml`)

### 2.2 Issue Register and Mitigation Mapping

| ID | Current Issue | Impact | Mitigation in this Plan | Exit Condition |
| --- | --- | --- | --- | --- |
| UI-01 | No canonical design token system | Inconsistent look/feel | Create semantic token layer and governance | 100% UI primitives consume semantic tokens |
| UI-02 | Broad descendant selectors in `index.css` | Unintended style side effects | Replace with component-scoped styles | No global descendant selector for core behavior |
| UI-03 | Heavy `!important` usage | Fragile overrides and regressions | Refactor style architecture and remove non-essential overrides | `!important` reduced to documented exceptions only |
| UI-04 | No primitive contract (dialog/menu/popover/input/button) | Inconsistent UX/accessibility | Implement Base UI wrappers in `src/components/base` | Core interaction primitives fully migrated |
| UI-05 | Inconsistent states (hover/focus/disabled/loading/error) | Unpolished UX | Define interaction state matrix and apply universally | State matrix completed and validated visually |
| UI-06 | Layering/z-index near max int | Host conflicts and brittle overlay behavior | Standardized layer scale and overlay strategy | All layers use a documented tokenized scale |
| UI-07 | No visual regression testing | UI quality drift | Add screenshot tests for critical surfaces | PR gate enforces visual checks |
| UI-08 | CI lacks full UI quality gates | Regressions can ship | Add lint/prettier/tests/a11y/perf gates | Validate workflow blocks on full checks |
| UI-09 | Docs/PR template drift | Team confusion and process errors | Rewrite docs and templates to match actual scripts | No dead commands in docs/templates |
| UI-10 | Debug shortcuts/dev tooling exposed globally | Production noise/risk | Add environment guards and debug boundaries | Debug-only tooling disabled in production paths |

## 3. Product Vision and Standards

## 3.1 Product quality bar

The widget must be:

1. Visually premium and coherent across all widget states.
2. Accessible by keyboard/screen reader and compliant with WCAG 2.2 AA.
3. Fast and stable on low-resource host pages.
4. Predictable inside closed Shadow DOM across varied host sites.
5. Operationally safe with strict CI quality gates before merge/deploy.

### 3.2 Design standards

| Domain | Standard |
| --- | --- |
| Visual system | Semantic tokens for color, spacing, radius, elevation, typography, motion |
| Components | Base UI primitives wrapped by Marketrix contracts |
| Motion | Consistent durations/easing; reduced-motion support |
| Accessibility | Keyboard-first, visible focus, ARIA semantics, contrast compliance |
| Copy/voice | Consistent product tone, clear system messages, precise error states |
| Responsive behavior | Defined breakpoints and density rules for launcher, chat window, composer |

### 3.3 Engineering standards

| Domain | Standard |
| --- | --- |
| Type safety | Strict TypeScript, no unmanaged `any` growth |
| Styling | No broad global behavior selectors; scoped and token-driven |
| Testing | Unit + integration + visual regression for critical flows |
| CI quality gates | Type, lint, format, tests, visual checks, bundle checks |
| Observability | Structured logs/events for UI state transitions and errors |
| Documentation | Living docs for architecture, design system, release process |

## 4. Target Architecture

### 4.1 High-level architecture

1. Keep closed Shadow DOM mounting model.
2. Add Base UI primitive layer (`@base-ui/react`) for accessibility and behavior.
3. Build Marketrix wrapper components around Base UI primitives.
4. Migrate chat shell and feature components to wrappers/tokens.
5. Maintain existing service/data layer unless explicitly optimized.

### 4.2 Proposed directory architecture

```txt
src/
  design-system/
    tokens.css
    semantic-tokens.ts
    motion.ts
    layers.ts
    typography.ts
    themes/
      default.ts
      high-contrast.ts
  components/
    base/
      Button.tsx
      Input.tsx
      Textarea.tsx
      Dialog.tsx
      Popover.tsx
      Menu.tsx
      Tooltip.tsx
      Select.tsx
      Toast.tsx
    chat-shell/
      ShellHeader.tsx
      MessageBubble.tsx
      Composer.tsx
      ShellFooter.tsx
  styles/
    reset.css
    utilities.css
```

### 4.3 Styling model

1. Tokens define all design decisions.
2. Base components consume tokens, not ad-hoc utility combinations.
3. Feature components compose base components only.
4. Runtime integration settings map to semantic tokens through a controlled adapter.
5. No direct UI behavior logic in broad global CSS selectors.

### 4.4 Layering and portals strategy

1. Define layer tokens (`launcher`, `panel`, `overlay`, `modal`, `toast`, `debug`).
2. Ensure all popups/dialogs remain in widget-controlled rendering context.
3. Remove max-int z-index usage and replace with constrained tokenized values.
4. Validate all overlay interactions inside closed Shadow DOM.

## 5. Workstreams

| WS | Name | Scope | Deliverables | Exit Criteria |
| --- | --- | --- | --- | --- |
| WS-01 | Product UX specification | End-to-end interaction design | UX flows, state matrix, interaction rules | All key states documented and reviewed |
| WS-02 | Design tokens foundation | Visual language | Token files, semantic mapping, theming contract | 100% of core components consume semantic tokens |
| WS-03 | Base UI primitive platform | Reusable component foundation | `src/components/base/*` wrappers | Button/Input/Dialog/Menu/Popover/Tooltip/Select/Toast complete |
| WS-04 | Chat shell redesign | Primary user surfaces | Header, message list, bubbles, composer, footer | Shell fully migrated with no legacy styles |
| WS-05 | Feature component migration | Secondary surfaces | Modals, diagnostics, errors, loaders, chips | `src/components/ui/*` legacy replacements complete |
| WS-06 | Accessibility hardening | A11y compliance | Keyboard model, focus model, ARIA audit | WCAG AA checklist passes |
| WS-07 | Performance and reliability | Runtime quality | Rendering/perf profiling, event-driven state cleanup | Meets performance budgets and crash targets |
| WS-08 | Testing and quality automation | Regression prevention | Unit/integration/visual tests | CI blocks regressions on protected branches |
| WS-09 | CI/CD and release hardening | Delivery governance | Updated workflows, stricter gates, release checklist | Deploy only from validated artifacts |
| WS-10 | Extension and embed parity | Full product consistency | Extension compatibility validation | Widget behavior consistent across script and extension injection |
| WS-11 | Documentation and onboarding | Team execution clarity | Architecture docs, DS docs, contribution guides | Docs match real scripts/workflows |
| WS-12 | Analytics and observability | Operational insight | UI telemetry model and dashboards | Core UX metrics visible per build/release |

## 6. Phased Execution Plan

## Phase 0: Mobilization (Week 1)

1. Freeze new ad-hoc UI patterns.
2. Ratify this plan and assign owners.
3. Define quality gates and branch policy.
4. Create migration tracking board linked to WS-01..WS-12.

Deliverables:

- Approved architecture decision record for Base UI adoption.
- Signed token specification v1.
- Signed CI quality-gate contract.

## Phase 1: Foundation Build (Weeks 2-3)

1. Add Base UI dependency and wrapper architecture.
2. Implement token system and layer model.
3. Introduce base primitives and their tests.
4. Add visual regression harness and baseline snapshots.

Deliverables:

- `src/design-system/*` initial set.
- `src/components/base/*` initial set.
- Initial CI quality gates for type/lint/test/visual.

## Phase 2: Shell Migration (Weeks 4-5)

1. Rebuild launcher, shell header, chat body, composer, footer on new primitives.
2. Remove legacy style paths in migrated areas.
3. Implement motion/accessibility contracts.

Deliverables:

- New shell UI complete and feature-flagged for full replacement.
- Existing shell code paths removed after parity validation.

## Phase 3: Feature Surface Migration (Weeks 6-7)

1. Migrate diagnostics, error display, screen access modal, loaders, mode selector.
2. Unify message states and progress indicators.
3. Replace remaining legacy theme constants and utility drift.

Deliverables:

- `src/components/ui/*` decommissioned or rewritten to wrappers.
- Unified state and style behavior across all interactions.

## Phase 4: Hardening (Weeks 8-9)

1. A11y audit and fixes.
2. Performance profiling on representative host pages.
3. Stabilize CI/CD and release workflow quality thresholds.
4. Align README, PR template, and engineering docs.

Deliverables:

- Accessibility report with pass/fail evidence.
- Performance benchmark report.
- CI and docs consistency completed.

## Phase 5: Launch Readiness (Week 10)

1. Final QA sweep (manual + automated).
2. Cross-browser and extension parity sign-off.
3. Publish migration completion report.

Deliverables:

- Final release readiness checklist signed.
- Post-implementation scorecard against goals.

## 7. Detailed Backlog (Execution Checklist)

### 7.1 Design System Core

- [ ] Create semantic color scales and role mapping.
- [ ] Define typography scale and line-height rules.
- [ ] Define spacing/radius/elevation/motion tokens.
- [ ] Build token adapter from integration settings to semantic tokens.
- [ ] Add `prefers-reduced-motion` behavior.

### 7.2 Base UI Primitive Layer

- [ ] Implement `Button` wrapper with variants/sizes/states.
- [ ] Implement `Input`/`Textarea` wrappers with validation states.
- [ ] Implement `Dialog` wrapper and overlay contracts.
- [ ] Implement `Menu`/`Popover`/`Tooltip` wrappers.
- [ ] Implement `Select` and `Toast` wrappers.
- [ ] Add unit tests for each primitive wrapper.

### 7.3 Shell and Conversation UI

- [ ] Rebuild launcher and open/close transitions.
- [ ] Rebuild header with status and action patterns.
- [ ] Rebuild message bubbles and message grouping rules.
- [ ] Rebuild composer with robust action states.
- [ ] Rebuild footer/branding region.
- [ ] Standardize skeleton/loading/error/empty states.

### 7.4 Reliability and Runtime Behavior

- [ ] Remove polling where event-driven alternatives exist.
- [ ] Guard debug-only functionality by environment.
- [ ] Replace silent error fallback behavior with explicit recovery UI.
- [ ] Add controlled retry strategy for transient runtime failures.

### 7.5 Testing and Quality Automation

- [ ] Add unit tests for UI helpers and wrapper logic.
- [ ] Add integration tests for open/chat/send/error flows.
- [ ] Add visual regression snapshots for key states.
- [ ] Add accessibility automated checks.
- [ ] Add bundle-size budget checks.

### 7.6 CI/CD and Process Alignment

- [ ] Update `validate.yml` to run full quality suite.
- [ ] Enforce strict lint warning policy for changed UI files.
- [ ] Align README workflow sections with actual pipeline.
- [ ] Align PR template commands with real scripts.
- [ ] Add release checklist for UI quality sign-off.

### 7.7 Extension and Embed Surface

- [ ] Validate extension injection compatibility with updated widget.
- [ ] Validate script-tag embed behavior across sample host environments.
- [ ] Add extension-specific smoke tests.
- [ ] Document CSP and host constraints clearly.

## 8. Quality Gates and Definition of Done

### 8.1 Pull Request gates

A PR is mergeable only if all are true:

1. Type checks pass.
2. Lint checks pass.
3. Tests pass.
4. Visual snapshots approved.
5. Accessibility checks pass for impacted surfaces.
6. Bundle and performance budgets are within limits.
7. Required docs updates are included.

### 8.2 Epic completion gates

An epic is complete only if:

1. Legacy implementation for that surface is removed.
2. New implementation uses Base UI wrappers and semantic tokens.
3. Regression tests and snapshots cover the epic scope.
4. Cross-browser validation is complete.
5. Extension parity is verified when applicable.

## 9. Performance, Accessibility, and Reliability Targets

| Category | Target |
| --- | --- |
| Boot performance | Widget interactive within agreed budget on representative environments |
| Input responsiveness | No perceived lag in typing/composer interactions |
| Motion quality | Smooth open/close and message transitions with reduced-motion fallback |
| Accessibility | WCAG 2.2 AA compliance across keyboard and screen-reader critical paths |
| Error handling | No silent failure paths for user-visible surfaces |
| Stability | No unresolved critical UI defects at release gate |

## 10. Security and Privacy Considerations

1. Preserve current configuration validation rules.
2. Avoid exposing debug or internal diagnostics in production UI paths.
3. Sanitize any user-visible rich content consistently.
4. Ensure screen-share and session-recording states remain explicit and auditable.
5. Review extension injection behavior against CSP constraints and documented limitations.

## 11. Operating Model and Governance

### 11.1 Roles

| Role | Responsibility |
| --- | --- |
| Frontend Lead | Technical ownership of architecture and migration sequence |
| Product Designer | Token system, interaction specs, visual QA |
| QA Lead | Test strategy, regression gates, release sign-off |
| DevOps Engineer | CI/CD hardening and deployment quality gates |
| Extension Owner | Chrome extension parity and compatibility validation |

### 11.2 Cadence

1. Daily execution standup (migration board progress).
2. Weekly architecture and quality review.
3. Weekly design QA review with visual diffs.
4. End-of-phase readiness review with signed checklist.

## 12. Risk Register

| Risk | Probability | Impact | Mitigation |
| --- | --- | --- | --- |
| Migration breadth causes schedule slip | Medium | High | Strict phase gates and scope discipline |
| Incomplete visual parity during refactor | Medium | High | Snapshot baselines plus manual design QA |
| Hidden regressions in Shadow DOM overlays | Medium | High | Dedicated overlay test matrix and host-page smoke tests |
| CI runtime increases and slows delivery | Medium | Medium | Parallelize checks and optimize test selection |
| Team reintroduces ad-hoc styles | Medium | Medium | Enforce wrapper usage and lint rules |

## 13. Dependencies

1. Base UI adoption decision remains approved.
2. Token specification agreement before broad migration.
3. CI environment supports visual regression tooling.
4. Representative host-page test matrix is available.

## 14. Deliverables Summary

At plan completion, the project will have:

1. A complete Base UI-powered design system for the widget.
2. Fully migrated chat shell and feature UI surfaces.
3. Strict CI quality gates for UI changes.
4. Accessibility/performance/reliability evidence for release readiness.
5. Updated docs/templates/workflows with no process drift.
6. Extension parity validation for production behavior.

## 15. Final Acceptance Criteria

This plan is considered successfully implemented only when:

1. All issue IDs UI-01 through UI-10 are closed with evidence.
2. No remaining critical/major UI defects in release gate.
3. Quality gates are mandatory and green on protected branches.
4. Widget UX is visually and behaviorally consistent across key states.
5. Engineering and product stakeholders sign off on the release checklist.
