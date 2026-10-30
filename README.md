# Google Classroom Drive Downloader

### おすすめのWEBアプリVer
まずはお試しを[URL](https://maca-nuts.github.io/classroom-downloader/)


**GoogleClassroomの授業に参加しているアカウントでログインしてください**


**警告が出ますが、詳細のところから突破できます**


### これは何ぞ？

-- Goole Classroomのファイルダウンローダー
-- 拡張子や投稿日で絞り込んでダウンロードできます

-- CLIバージョンはより機能があるけど上級者むけ


--------

## 新しいGUIをローカルで起動

`docs/` に、認証・授業選択・日付／拡張子による絞り込み・ZIP保存に対応した静的WEBアプリがあります。

```bash
python -m http.server 8000 --directory docs
```

`http://localhost:8000` を開いてください。追加のビルドやnpmのインストールは不要です。
Googleへの接続には、`docs/app.js` の `WEB_OAUTH_CLIENT_ID` に設定したWeb用OAuthクライアントで、利用するオリジン（ローカルなら `http://localhost:8000`）の登録が必要です。既存のクライアントIDを引き継いでいます。自分のGoogle Cloudプロジェクトを使う場合は、このIDを置き換えてください。
Google Identity Services・JSZip・フォントの読み込みにはインターネット接続が必要です。

保存前にZIP名・授業フォルダ・対象期間・拡張子を確認できます。ダウンロード中は、保存・条件による除外・失敗の件数と処理ログを表示します。アクセストークンはメモリ上でのみ保持します。

## CLIの解説(見なくてもいい)


### 必要環境

- Python 3.11+
- Google アカウント
- Google Cloud プロジェクト

### セットアップ

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

パッケージとしてインストールする場合:

```powershell
python -m pip install -e .
```

### Google Cloud Console の設定

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

### 使い方

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

### 必要な OAuth スコープ

この CLI は次の読み取り専用スコープを要求します。

- `https://www.googleapis.com/auth/classroom.courses.readonly`
- `https://www.googleapis.com/auth/classroom.coursework.me.readonly`
- `https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly`
- `https://www.googleapis.com/auth/drive.readonly`

スコープを変更した場合や認証エラーが続く場合は、`token.json` を削除して再認証してください。

### 出力

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

### 注意

- Classroom や Drive 側の権限で見えないファイルはダウンロードできません。
- `canDownload=false` の通常ファイルはスキップされます。
- Google Forms など、この CLI が export 形式を定義していない Google Workspace ファイルはスキップされます。
- Google Workspace ファイルの PDF export は Drive API の変換結果に依存します。
