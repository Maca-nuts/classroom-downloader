ROUND 1
Seen in one second: A Classroom archive utility; account at left, save settings and output at right.
Idea (one sentence): Classroom's course / assignment / attachment hierarchy becomes a live ZIP manifest.
Live thing: ZIP filename, course, dates and extension scope update from the actual controls.
Layout words by section: account=quiet open plane / settings=compact form / manifest=folder hierarchy / results=divided counts / log=activity list.
Scores: design 7.4 · usability 7.5 · creativity 7.0 · content 8.0 → overall 7.4
Caps applied: None; app-screen rules apply, with no picture or motion floor.
Top three problems (most visible first), each with the screenshot it shows in and the fix:
1. desktop-fold: labels too small; increase field labels to 14px, action labels and count labels to 13px.
2. mobile-fold: primary button does not occupy the full content width; set the header grid to one explicit 1fr column.
3. desktop-page-01: ZIP-name block starts low; reduce panel padding to 20px and header spacing to 16px while keeping the 16px gutter.

ROUND 2
Seen in one second: A working Classroom downloader, with a clear account connection and a single ZIP action.
Idea (one sentence): Classroom's course / assignment / attachment hierarchy becomes a live ZIP manifest.
Live thing: Save manifest stays in sync with the course and filters. No fabricated course or file data.
Layout words by section: account=open plane / settings=three working panels / manifest=archive tree / results=counts and progress / log=compact activity.
Scores: design 7.6 · usability 7.9 · creativity 7.0 · content 8.0 → overall 7.6
Caps applied: None; no inspector FAILs. App-specific exceptions for quiet borders, forms and small notes are applicable.
Top three problems (most visible first), each with the screenshot it shows in and the fix:
1. tablet-page-01: settings and results columns end at different heights. Accepted: they are independent form/result flows, not peer objects. Artificially stretching the empty log would create an empty panel.
2. desktop-fold: tiny-text warning remains for secondary notes. Accepted: main labels are 13–14px, and the 12px text explains file rules, empty state, account scope and secondary facts, consistent with app-screen guidance.
3. mobile-page-01: the complete settings/results sequence requires scrolling. Accepted for the full utility; no sticky overlay obscures fields and the main action is at the top. A compact mobile result summary could improve a later iteration.

Before/after measurements:
- Inspector: 3 FAIL / 4 WARN -> 0 FAIL / 2 WARN.
- h1 desktop: 60px -> 24px. Phone: 32px -> 22px.
- Heading lines: 2 -> 1 at 1440 and 390; 1 -> 1 at 768.
- Source lint final: 0 FAIL / 0 WARN.
- Browser: 16 checks passed with mocked OAuth and Google API responses, real JSZip archive verification, zero runtime exceptions. Page opened directly via file URL in this check.
- Actual Google login/API download not tested: requires the account and registered OAuth origin.
- All 3 viewport fold screenshots and page contact sheets were opened. Final static files are the production deliverable; no bundler exists.
- No redraws, image credits or sample content to replace. Folder labels are structural descriptions, not fabricated files. Outline SVG mark/icons are authored for the utility.
