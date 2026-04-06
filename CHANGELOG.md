# Changelog

## 2026-04-06

### Changed

- React migration issue `#39` cleanup removed directly superseded Vue admin pages for ACL, forum admin, and login-failure audit after their React replacements were merged.
- Repository policy documents and issue/MR templates were updated to tighten single-selection rules, add subagent usage recording, and expand policy source precedence.
- `docs/remaining-react-migration-plan.md` now defines a parallel wave-based execution order instead of a purely sequential five-track order.
- The remaining React migration plan now includes an umbrella issue plus child issue registration set for parallel delivery planning.

### Verification

- Confirmed the React router and page tree now cover the removed ACL/forum-admin/login-failure paths before deleting the legacy Vue files.
- Reviewed updated policy/template diffs for `AGENTS.md`, `AI_DEVELOPMENT_POLICY.md`, `CONTRIBUTING.md`, `.gitlab/issue_templates/default.md`, and `.gitlab/merge_request_templates/default.md`.
- Reviewed the updated migration plan structure against `AGENTS.md`, `AI_DEVELOPMENT_POLICY.md`, and `.gitlab/issue_templates/default.md`.

## 2026-04-03

### Changed

- React migration Phase 1 completed with issue `#4` (`PR #16`): bootstrap baseline established.
- React migration Phase 2 completed with issue `#5` (`PR #16`): routing shell and base layouts migrated.
- React migration Phase 3 completed with issue `#6` (`PR #16`): auth bootstrap gate and session flow migrated.
- React migration Phase 4 completed with issue `#7` (`PR #18`): shared feedback providers migrated.
- React migration Phase 4 completed with issue `#8` (`PR #17`): TanStack Query adapters and conventions migrated.
- React migration Phase 4 completed with issue `#9` (`PR #20`): shared AG Grid wrapper migrated.
- React migration Phase 5 completed with issue `#10` (`PR #19`): auth pages migrated to the React shell.
- React migration Phase 5 completed with issue `#11` (`PR #22`): dashboard migrated to React.
- React migration Phase 5 completed with issue `#12` (`PR #21`): public community pages migrated to React.
- React migration Phase 5 completed with issue `#13` (`PR #24`): admin and security pages migrated to React.
- React migration Phase 5 completed with issue `#14` (`PR #23`): editor and upload integration migrated to React.
- React migration Phase 6 completed with issue `#15` (`PR #25`): Vue runtime cleanup and dependency removal finished.

### Verification

- Migration tracker in `MIGRATION_2X.md` reflects issues `#4` through `#15` as complete.
