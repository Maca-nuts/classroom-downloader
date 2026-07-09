# Google Classroom Drive Downloader

Google Classroom で自分が参加しているコースから、`courseWork` と `courseWorkMaterials` に添付された Google Drive ファイルをダウンロードする Python CLI です。

## 機能

- Google OAuth 2.0 のローカル認証
- Classroom API と Drive API を使用
- 参加コース一覧の表示
- 指定した `course_id` の `courseWork` と `courseWorkMaterials` を取得
- `materials[].driveFile` 内の Drive file ID を収集
- Drive API で `name`, `mimeType`, `capabilities.canDownload` を確認
- 通常ファイルは `files.get_media` で保存
- Google Docs / Sheets / Slides は PDF または Office 形式に export
- 保存先は `downloads/<course名>/<課題名>/`
- 同名ファイルは上書きせず `ファイル名 (1).ext` のように連番保存
- 失敗したファイルは `skipped.json` に理由付きで保存

## 必要環境

- Python 3.11+
- Google アカウント
- Google Cloud プロジェクト

## セットアップ

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

パッケージとしてインストールする場合:

```powershell
python -m pip install -e .
```

## Google Cloud Console の設定

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成または選択します。
2. 「API とサービス」から次の API を有効化します。
   - Google Classroom API
   - Google Drive API
3. 「OAuth 同意画面」を設定します。
   - User Type は個人利用なら通常 `External` を選びます。
   - アプリ名、サポートメール、デベロッパー連絡先を入力します。
   - テスト中の場合は、自分の Google アカウントをテストユーザーに追加します。
4. 「認証情報」から OAuth クライアント ID を作成します。
   - Application type は `Desktop app` を選びます。
5. クライアント JSON をダウンロードし、このディレクトリに `credentials.json` という名前で置きます。

`credentials.json` と `token.json` は認証情報なので `.gitignore` に含めています。

## 使い方

初回実行時にブラウザが開き、Google の認可画面が表示されます。認証が成功すると `token.json` が作成され、次回以降は再利用されます。

コース一覧を表示:

```powershell
python -m classroom_drive_downloader.cli list-courses
```

`pip install -e .` 済みの場合:

```powershell
classroom-drive-downloader list-courses
```

指定コースの添付 Drive ファイルをダウンロード:

```powershell
python -m classroom_drive_downloader.cli download COURSE_ID
```

Google Docs / Sheets / Slides を Office 形式で保存:

```powershell
python -m classroom_drive_downloader.cli download COURSE_ID --export-format office
```

保存先を変更:

```powershell
python -m classroom_drive_downloader.cli download COURSE_ID --output-dir D:\classroom-downloads
```

アーカイブ済みコースを対象にする:

```powershell
python -m classroom_drive_downloader.cli download COURSE_ID --include-archived
```

## 必要な OAuth スコープ

この CLI は次の読み取り専用スコープを要求します。

- `https://www.googleapis.com/auth/classroom.courses.readonly`
- `https://www.googleapis.com/auth/classroom.coursework.me.readonly`
- `https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly`
- `https://www.googleapis.com/auth/drive.readonly`

スコープを変更した場合や認証エラーが続く場合は、`token.json` を削除して再認証してください。

## 出力

標準の保存先は次の形式です。

```text
downloads/
  Course Name/
    Assignment Title/
      file.pdf
      file (1).pdf
      skipped.json
    skipped.json
```

各課題フォルダの `skipped.json` には、その課題で失敗したファイルが記録されます。コース直下の `skipped.json` には、コース全体の失敗がまとめて記録されます。

## 注意

- Classroom や Drive 側の権限で見えないファイルはダウンロードできません。
- `canDownload=false` の通常ファイルはスキップされます。
- Google Forms など、この CLI が export 形式を定義していない Google Workspace ファイルはスキップされます。
- Google Workspace ファイルの PDF export は Drive API の変換結果に依存します。
