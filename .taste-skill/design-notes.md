# Classroom GUI redesign

Style: Achromatic ledger, seed 1527852541. No redraws.
Question: Which course and files will be saved, and did the save succeed?
Inventory: Classroom courses; course sections; archived courses; assignments; teaching materials; Drive attachments; creation and modification dates; extension inclusion and exclusion; PDF exports; course/assignment ZIP directories; saved/filtered/failed counts; browser-only access token.

Idea: Classroom's course / assignment / file hierarchy becomes a live archive manifest beside the save controls.
Face: a neutral sage ground (#f3f5f3), white (#ffffff) working surfaces, ink (#171d19), secondary ink (#606861), quiet borders (#e4e8e4), Classroom green (#247349) on progress and the small product mark. No chart or invented data.
Type: dealt Geist for Latin and figures, Noto Sans JP for Japanese; 24px title, 16px section, 14px body, 12px notes. All figures tabular.
Layout: left aligned. An account sidebar, a settings column and an archive/result column.

```
account  | title                         save action
         | course + filters | archive manifest
         | date + file type | saved / excluded / failed
         | ZIP name         | progress + activity
```

Review: a decorative course-card dashboard would invent information and add a navigation layer. Use the actual course selector and a live folder manifest instead. Preserve existing OAuth scopes and download pipeline; recover the GUI from origin/pages-command-builder because main contains only CLI sources. Keep the existing stack (static HTML/CSS/JS), no new build dependencies. Font delivery stays on Google Fonts as before.

Copy: 資料をまとめて保存 / 授業を選んで、必要な資料だけをZIPに。 / 対象の授業 / ファイルの条件 / 保存する内容 / 保存結果 / 処理ログ.
No sample course names, counts, testimonials, photographs or placeholder attachments.
