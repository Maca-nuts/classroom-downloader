from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable


SCOPES = [
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
    "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly",
    "https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]

GOOGLE_DOC_EXPORTS = {
    "application/vnd.google-apps.document": {
        "pdf": ("application/pdf", ".pdf"),
        "office": (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".docx",
        ),
    },
    "application/vnd.google-apps.spreadsheet": {
        "pdf": ("application/pdf", ".pdf"),
        "office": (
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".xlsx",
        ),
    },
    "application/vnd.google-apps.presentation": {
        "pdf": ("application/pdf", ".pdf"),
        "office": (
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            ".pptx",
        ),
    },
    "application/vnd.google-apps.drawing": {
        "pdf": ("application/pdf", ".pdf"),
        "office": ("image/png", ".png"),
    },
}

INVALID_PATH_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
MAX_PATH_PART_LENGTH = 120


@dataclass(frozen=True)
class DriveAttachment:
    file_id: str
    title: str
    source_type: str
    source_id: str
    course_id: str


@dataclass(frozen=True)
class DownloadFilters:
    start_date: date | None
    end_date: date | None
    date_field: str
    include_extensions: frozenset[str]
    exclude_extensions: frozenset[str]


class MissingGoogleDependency(RuntimeError):
    pass


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        if args.command == "download":
            args.download_filters = build_download_filters(args)

        credentials = authorize(Path(args.credentials), Path(args.token))
        classroom = build_google_service("classroom", "v1", credentials)
        drive = build_google_service("drive", "v3", credentials)

        if args.command == "list-courses":
            return list_courses(classroom)
        if args.command == "download":
            return download_course_files(classroom, drive, args)

        parser.print_help()
        return 2
    except KeyboardInterrupt:
        print("Interrupted.", file=sys.stderr)
        return 130
    except FileNotFoundError as exc:
        print(f"Missing file: {exc}", file=sys.stderr)
        return 1
    except MissingGoogleDependency as exc:
        print(str(exc), file=sys.stderr)
        return 1
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    except Exception as exc:
        if is_google_http_error(exc):
            print(format_http_error(exc), file=sys.stderr)
            return 1
        raise


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="classroom-drive-downloader",
        description="Download Google Drive files attached to Google Classroom coursework and materials.",
    )
    parser.add_argument(
        "--credentials",
        default="credentials.json",
        help="OAuth client JSON downloaded from Google Cloud Console. Default: credentials.json",
    )
    parser.add_argument(
        "--token",
        default="token.json",
        help="OAuth token cache path. Default: token.json",
    )

    subparsers = parser.add_subparsers(dest="command")

    subparsers.add_parser("list-courses", help="Show courses visible to the authenticated user.")

    download = subparsers.add_parser(
        "download",
        help="Download Drive files attached to a course's courseWork and courseWorkMaterials.",
    )
    download.add_argument("course_id", help="Classroom course ID.")
    download.add_argument(
        "--output-dir",
        default="downloads",
        help="Base output directory. Default: downloads",
    )
    download.add_argument(
        "--export-format",
        choices=("pdf", "office"),
        default="pdf",
        help="Export Google Docs/Sheets/Slides as PDF or Office files. Default: pdf",
    )
    download.add_argument(
        "--include-archived",
        action="store_true",
        help="Allow downloading from archived courses when the API returns them.",
    )
    download.add_argument(
        "--start-date",
        type=parse_date_arg,
        help="Only download files whose selected Drive date is on or after YYYY-MM-DD.",
    )
    download.add_argument(
        "--end-date",
        type=parse_date_arg,
        help="Only download files whose selected Drive date is on or before YYYY-MM-DD.",
    )
    download.add_argument(
        "--date-field",
        choices=("created", "modified"),
        default="modified",
        help="Drive file date used by --start-date/--end-date. Default: modified.",
    )
    download.add_argument(
        "--include-ext",
        help="Comma-separated extension whitelist, for example: pdf,docx,png",
    )
    download.add_argument(
        "--exclude-ext",
        help="Comma-separated extension blacklist, for example: zip,exe",
    )
    return parser


def authorize(credentials_path: Path, token_path: Path) -> Any:
    os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"

    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ModuleNotFoundError as exc:
        raise MissingGoogleDependency(
            "Google client libraries are not installed. Run: python -m pip install -r requirements.txt"
        ) from exc

    credentials: Any = None

    if token_path.exists():
        credentials = Credentials.from_authorized_user_file(str(token_path), SCOPES)

    if credentials and credentials.expired and credentials.refresh_token:
        credentials.refresh(Request())

    if not credentials or not credentials.valid:
        if not credentials_path.exists():
            raise FileNotFoundError(credentials_path)
        flow = InstalledAppFlow.from_client_secrets_file(str(credentials_path), SCOPES)
        credentials = flow.run_local_server(port=0)

    token_path.write_text(credentials.to_json(), encoding="utf-8")
    return credentials


def build_google_service(api_name: str, version: str, credentials: Any) -> Any:
    try:
        from googleapiclient.discovery import build
    except ModuleNotFoundError as exc:
        raise MissingGoogleDependency(
            "Google client libraries are not installed. Run: python -m pip install -r requirements.txt"
        ) from exc

    return build(api_name, version, credentials=credentials)


def list_courses(classroom: Any) -> int:
    courses_resource = classroom.courses()
    courses = list_all(
        courses_resource,
        courses_resource.list(
            courseStates=["ACTIVE", "ARCHIVED", "PROVISIONED", "DECLINED", "SUSPENDED"]
        ),
        "courses",
    )
    if not courses:
        print("No courses found.")
        return 0

    for course in sorted(courses, key=lambda item: item.get("name", "").lower()):
        course_id = course.get("id", "")
        name = course.get("name", "(untitled)")
        section = course.get("section")
        state = course.get("courseState")
        suffix = f" [{section}]" if section else ""
        print(f"{course_id}\t{name}{suffix}\t{state}")
    return 0


def download_course_files(classroom: Any, drive: Any, args: argparse.Namespace) -> int:
    filters = args.download_filters

    course = classroom.courses().get(id=args.course_id).execute()
    if course.get("courseState") == "ARCHIVED" and not args.include_archived:
        print(
            "Course is archived. Re-run with --include-archived to download it.",
            file=sys.stderr,
        )
        return 1

    course_name = course.get("name") or args.course_id
    course_dir = Path(args.output_dir) / safe_path_part(course_name)
    course_dir.mkdir(parents=True, exist_ok=True)

    skipped: list[dict[str, Any]] = []
    downloaded_count = 0
    filtered_count = 0

    items = list(iter_course_items(classroom, args.course_id))
    if not items:
        print("No courseWork or courseWorkMaterials found.")

    for item_type, item in items:
        item_id = item.get("id", "")
        item_title = item.get("title") or item.get("name") or item_id or "untitled"
        item_dir = course_dir / safe_path_part(item_title)
        item_dir.mkdir(parents=True, exist_ok=True)

        attachments = collect_drive_attachments(item, item_type, item_id, args.course_id)
        if not attachments:
            continue

        item_skipped: list[dict[str, Any]] = []
        for attachment in attachments:
            try:
                metadata = get_drive_file_metadata(drive, attachment.file_id)
                filter_reason = get_filter_skip_reason(
                    metadata,
                    args.export_format,
                    filters,
                )
                if filter_reason:
                    filtered_count += 1
                    print(f"filtered\t{attachment.file_id}\t{filter_reason}")
                    continue

                saved_path = save_drive_file(
                    drive,
                    metadata,
                    item_dir,
                    args.export_format,
                )
                downloaded_count += 1
                print(f"saved\t{saved_path}")
            except Exception as exc:  # The skip log should survive individual failures.
                reason = describe_exception(exc)
                record = {
                    "courseId": args.course_id,
                    "courseName": course_name,
                    "sourceType": attachment.source_type,
                    "sourceId": attachment.source_id,
                    "sourceTitle": item_title,
                    "fileId": attachment.file_id,
                    "attachmentTitle": attachment.title,
                    "reason": reason,
                }
                skipped.append(record)
                item_skipped.append(record)
                print(f"skipped\t{attachment.file_id}\t{reason}", file=sys.stderr)

        if item_skipped:
            write_json(item_dir / "skipped.json", item_skipped)

    if skipped:
        write_json(course_dir / "skipped.json", skipped)

    print(
        f"Downloaded {downloaded_count} file(s). "
        f"Filtered {filtered_count} file(s). "
        f"Skipped {len(skipped)} file(s)."
    )
    return 0 if downloaded_count or not skipped else 1


def iter_course_items(classroom: Any, course_id: str) -> Iterable[tuple[str, dict[str, Any]]]:
    course_work_resource = classroom.courses().courseWork()
    course_work = list_all(
        course_work_resource,
        course_work_resource.list(courseId=course_id),
        "courseWork",
    )
    for item in course_work:
        yield "courseWork", item

    materials_resource = classroom.courses().courseWorkMaterials()
    materials = list_all(
        materials_resource,
        materials_resource.list(courseId=course_id),
        "courseWorkMaterial",
    )
    for item in materials:
        yield "courseWorkMaterials", item


def collect_drive_attachments(
    item: dict[str, Any],
    source_type: str,
    source_id: str,
    course_id: str,
) -> list[DriveAttachment]:
    attachments: list[DriveAttachment] = []
    for material in item.get("materials", []):
        drive_file = material.get("driveFile", {}).get("driveFile")
        if not drive_file:
            drive_file = material.get("driveFile", {}).get("file")
        if not drive_file:
            continue
        file_id = drive_file.get("id")
        if not file_id:
            continue
        attachments.append(
            DriveAttachment(
                file_id=file_id,
                title=drive_file.get("title") or file_id,
                source_type=source_type,
                source_id=source_id,
                course_id=course_id,
            )
        )
    return attachments


def get_drive_file_metadata(drive: Any, file_id: str) -> dict[str, Any]:
    return (
        drive.files()
        .get(
            fileId=file_id,
            fields=(
                "id,name,mimeType,capabilities/canDownload,fileExtension,"
                "createdTime,modifiedTime"
            ),
            supportsAllDrives=True,
        )
        .execute()
    )


def save_drive_file(
    drive: Any,
    metadata: dict[str, Any],
    output_dir: Path,
    export_format: str,
) -> Path:
    file_id = metadata.get("id")
    name = metadata.get("name") or file_id
    mime_type = metadata.get("mimeType") or "application/octet-stream"
    can_download = metadata.get("capabilities", {}).get("canDownload")

    if mime_type in GOOGLE_DOC_EXPORTS:
        export_mime_type, extension = GOOGLE_DOC_EXPORTS[mime_type][export_format]
        destination = unique_path(output_dir / f"{safe_filename(name)}{extension}")
        request = drive.files().export_media(fileId=file_id, mimeType=export_mime_type)
        download_request_to_file(request, destination)
        return destination

    if mime_type.startswith("application/vnd.google-apps."):
        raise RuntimeError(f"Unsupported Google Workspace file type: {mime_type}")

    if can_download is False:
        raise RuntimeError("Drive reports canDownload=false")

    destination = unique_path(output_dir / safe_filename(name))
    request = drive.files().get_media(fileId=file_id, supportsAllDrives=True)
    download_request_to_file(request, destination)
    return destination


def build_download_filters(args: argparse.Namespace) -> DownloadFilters:
    if args.start_date and args.end_date and args.start_date > args.end_date:
        raise ValueError("--start-date must be on or before --end-date")

    include_extensions = parse_extension_filter(args.include_ext)
    exclude_extensions = parse_extension_filter(args.exclude_ext)
    overlap = include_extensions & exclude_extensions
    if overlap:
        values = ", ".join(sorted(overlap))
        raise ValueError(f"Extensions cannot be both included and excluded: {values}")

    return DownloadFilters(
        start_date=args.start_date,
        end_date=args.end_date,
        date_field=args.date_field,
        include_extensions=frozenset(include_extensions),
        exclude_extensions=frozenset(exclude_extensions),
    )


def get_filter_skip_reason(
    metadata: dict[str, Any],
    export_format: str,
    filters: DownloadFilters,
) -> str | None:
    extension = get_output_extension(metadata, export_format)
    extension_label = extension or "(no extension)"

    if filters.include_extensions and extension not in filters.include_extensions:
        return f"extension {extension_label} is not in include list"

    if extension in filters.exclude_extensions:
        return f"extension {extension_label} is in exclude list"

    if filters.start_date or filters.end_date:
        metadata_key = "createdTime" if filters.date_field == "created" else "modifiedTime"
        file_date = parse_google_datetime(metadata.get(metadata_key))
        if file_date is None:
            return f"missing Drive {metadata_key}"
        if filters.start_date and file_date < filters.start_date:
            return f"{filters.date_field} date {file_date.isoformat()} is before start date"
        if filters.end_date and file_date > filters.end_date:
            return f"{filters.date_field} date {file_date.isoformat()} is after end date"

    return None


def get_output_extension(metadata: dict[str, Any], export_format: str) -> str:
    name = metadata.get("name") or metadata.get("id") or ""
    mime_type = metadata.get("mimeType") or "application/octet-stream"

    if mime_type in GOOGLE_DOC_EXPORTS:
        _export_mime_type, extension = GOOGLE_DOC_EXPORTS[mime_type][export_format]
        return normalize_extension(extension)

    file_extension = metadata.get("fileExtension")
    if file_extension:
        return normalize_extension(file_extension)

    return normalize_extension(Path(name).suffix)


def parse_date_arg(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("expected YYYY-MM-DD") from exc


def parse_extension_filter(value: str | None) -> set[str]:
    if not value:
        return set()

    extensions: set[str] = set()
    for raw_part in value.split(","):
        extension = normalize_extension(raw_part)
        if extension:
            extensions.add(extension)
    return extensions


def normalize_extension(value: str) -> str:
    extension = value.strip().lower()
    if not extension:
        return ""
    if extension.startswith("."):
        extension = extension[1:]
    return extension


def parse_google_datetime(value: str | None) -> date | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).date()


def download_request_to_file(request: Any, destination: Path) -> None:
    try:
        from googleapiclient.http import MediaIoBaseDownload
    except ModuleNotFoundError as exc:
        raise MissingGoogleDependency(
            "Google client libraries are not installed. Run: python -m pip install -r requirements.txt"
        ) from exc

    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as output:
        downloader = MediaIoBaseDownload(output, request)
        done = False
        while not done:
            _status, done = downloader.next_chunk()


def list_all(resource: Any, request: Any, key: str) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    while request is not None:
        response = request.execute()
        results.extend(response.get(key, []))
        request = resource.list_next(request, response)
    return results


def unique_path(path: Path) -> Path:
    if not path.exists():
        return path

    stem = path.stem
    suffix = path.suffix
    parent = path.parent
    counter = 1
    while True:
        candidate = parent / f"{stem} ({counter}){suffix}"
        if not candidate.exists():
            return candidate
        counter += 1


def safe_filename(value: str) -> str:
    sanitized = safe_path_part(value).rstrip(". ")
    return sanitized or "untitled"


def safe_path_part(value: str) -> str:
    sanitized = INVALID_PATH_CHARS.sub("_", value).strip()
    sanitized = re.sub(r"\s+", " ", sanitized)
    sanitized = sanitized.rstrip(". ")
    if len(sanitized) > MAX_PATH_PART_LENGTH:
        sanitized = sanitized[:MAX_PATH_PART_LENGTH].rstrip(". ")
    return sanitized or "untitled"


def write_json(path: Path, data: Any) -> None:
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def describe_exception(exc: Exception) -> str:
    if is_google_http_error(exc):
        return format_http_error(exc)
    return str(exc) or exc.__class__.__name__


def is_google_http_error(exc: BaseException) -> bool:
    return (
        exc.__class__.__name__ == "HttpError"
        and exc.__class__.__module__ == "googleapiclient.errors"
    )


def format_http_error(exc: Any) -> str:
    try:
        payload = json.loads(exc.content.decode("utf-8"))
        message = payload.get("error", {}).get("message")
        status = payload.get("error", {}).get("status")
        if message and status:
            return f"Google API error {exc.resp.status} {status}: {message}"
        if message:
            return f"Google API error {exc.resp.status}: {message}"
    except Exception:
        pass
    return f"Google API error {exc.resp.status}: {exc.reason}"


if __name__ == "__main__":
    raise SystemExit(main())
