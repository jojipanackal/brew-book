# A quieter daily drink order

The visual and interaction reference is [WhereTo.food](https://whereto.food/): an editable sentence, serif typography, underlined choices, thin rules, and generous space. BrewBook keeps its own identity, drink choices, and office ordering rules.

## Decisions

- Start with “I’m having coffee today, with sugar.” The drink opens a keyboard-accessible selector; with/without toggles directly. No drink removes the sugar control.
- Show one round at a time. Morning and evening remain visible, with the next open round selected on entry. Deadlines are explicitly labelled in IST.
- Keep In office / Working from home / On leave visible as a native radio group. Attendance is set separately for each round, including half days, and that scope is explicit. Away users see their attendance instead of editable drink controls. A direct View responses action opens the existing team response dialog.
- Move preferences, history, statistics, administration, and sign-out to a labelled menu. Guests get only the navigation appropriate to their session, including a way to leave.
- Remove the sidebar, bottom navigation, repeated poll cards, per-choice counts, and surprise logo/name/avatar interactions from the primary flow. Compact default selectors replace repeated drink-option grids.
- Use real serif type with system sans-serif labels, a warm neutral surface, and one brown accent. Keep saved theme preferences and system dark-mode support. No font downloads or new dependencies.
- Add quiet, generated ink-and-watercolor artwork that follows the saved drink. Five transparent WebP assets cover coffee, tea, green tea, milk, and a neutral pause; black variants reuse their drink family. Each file is 22–35 KB and only the current illustration is requested. On desktop, artwork sits beside attendance; on phones, below the controls. See [asset provenance and exact prompts](artwork.md).
- Save choices immediately, with an announced saving/saved/error state. Wait for server confirmation before changing the displayed value. Serialize daily writes and discard stale background poll results to prevent older reads overwriting a change.

## Accessibility

Primary controls are at least 44px tall. Underlines and text identify the editable values without relying only on color. Radix selectors provide keyboard navigation, typeahead, and Escape; the menu and response dialog trap focus and return it on dismissal. Navigation moves focus into the new main region. There is a skip link, visible keyboard focus, a labelled native attendance radio group with arrow-key navigation, and reduced-motion support. Decorative artwork uses an empty alt attribute, is excluded from the accessibility tree, reserves its layout space, and disappears gracefully if loading fails. Its brief entrance animation is disabled for reduced motion.

Light-mode body text and accent text exceed 4.5:1 contrast against the page. Small accent links use a lighter color in dark mode. Closed rounds disable edits and explain the deadline; away states explain why no order will be placed.

## Research

[Nielsen Norman Group’s progressive-disclosure guidance](https://www.nngroup.com/articles/progressive-disclosure/) supports keeping frequently used actions visible and putting less-used settings behind a menu. This is why attendance moved out of More details, while profile/history/admin remain in Menu. [W3C’s decorative-image guidance](https://www.w3.org/WAI/tutorials/images/decorative/) informs the artwork’s empty alt text: the sentence already communicates the choice.

## Verification

- Production `pnpm build`: passed.
- Biome check of all eight changed TSX files: passed.
- `git diff --check`: passed.
- TypeScript: the same nine pre-existing errors occur on the unchanged base commit and this branch. They are in `scripts/send-push.ts`, `src/components/ui/switch-field.tsx`, `src/lib/drinks.ts`, `src/routes/api/admin.ts`, and `src/routes/api/cooks.ts`; no additional application diagnostics were introduced.
- Browser checks at 1280px, 390px, and 320px: sentence layout, selector keyboard/typeahead behavior, sugar changes, persisted mock values after reload, no-drink state, all five artwork mappings, visible attendance, failed attendance saves, closed rounds, guest navigation, menu focus trapping, response-dialog Escape/focus return, compact preferences, sign-in, and failed-save feedback. No horizontal overflow at 320px.

Browser checks used the real application components with a fixed clock and local mocked auth/API responses. Screenshots below contain fictional test data. Live OAuth, PostgreSQL persistence, and production guest approval were not exercised. No production orders or guest requests were created.

## Screenshots

![Desktop daily order](desktop.png)

![Mobile daily order](mobile.png)
