const SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
  "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly",
  "https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
].join(" ");

const WEB_OAUTH_CLIENT_ID =
  "233618178732-1266ebv74h0laguqt0ia1b7br3lgghfg.apps.googleusercontent.com";

const COURSE_STATES = ["ACTIVE", "PROVISIONED", "DECLINED", "SUSPENDED"];
const COURSE_STATES_WITH_ARCHIVED = [...COURSE_STATES, "ARCHIVED"];

const GOOGLE_DOC_EXPORTS = {
  "application/vnd.google-apps.document": {
    pdf: ["application/pdf", ".pdf"],
    office: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".docx",
    ],
  },
  "application/vnd.google-apps.spreadsheet": {
    pdf: ["application/pdf", ".pdf"],
    office: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".xlsx",
    ],
  },
  "application/vnd.google-apps.presentation": {
    pdf: ["application/pdf", ".pdf"],
    office: [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ".pptx",
    ],
  },
  "application/vnd.google-apps.drawing": {
    pdf: ["application/pdf", ".pdf"],
    office: ["image/png", ".png"],
  },
};

const elements = {
  form: document.querySelector("#download-form"),
  authorize: document.querySelector("#authorize-button"),
  clearToken: document.querySelector("#clear-token-button"),
  loadCourses: document.querySelector("#load-courses-button"),
  includeArchived: document.querySelector("#include-archived"),
  courseSelect: document.querySelector("#course-select"),
  zipName: document.querySelector("#zip-name"),
  startDate: document.querySelector("#start-date"),
  endDate: document.querySelector("#end-date"),
  includeExt: document.querySelector("#include-ext"),
  excludeExt: document.querySelector("#exclude-ext"),
  statusStrip: document.querySelector("#status-strip"),
  statusText: document.querySelector("#status-text"),
  progressBar: document.querySelector("#progress-bar"),
  progressText: document.querySelector("#progress-text"),
  logList: document.querySelector("#log-list"),
  clearLog: document.querySelector("#clear-log-button"),
  courseCount: document.querySelector("#course-count"),
  fileCount: document.querySelector("#file-count"),
  filteredCount: document.querySelector("#filtered-count"),
  skippedCount: document.querySelector("#skipped-count"),
};

const state = {
  busy: false,
  tokenExpiresAt: 0,
  tokenClient: null,
  accessToken: "",
  courses: [],
  stats: {
    saved: 0,
    filtered: 0,
    skipped: 0,
  },
};

function selectedValue(name) {
  return new FormData(elements.form).get(name);
}

function setBusy(isBusy) {
  state.busy = isBusy;
  document.body.classList.toggle("is-busy", isBusy);
  elements.form.setAttribute("aria-busy", String(isBusy));
  for (const control of elements.form.querySelectorAll("button, input, select")) {
    control.disabled = isBusy;
  }
  elements.clearLog.disabled = isBusy;
  updateControls();
}

function setStatus(message, mode = "ready") {
  elements.statusText.textContent = message;
  elements.statusStrip.dataset.mode = mode;
}

function setProgress(done, total, label) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  setProgressPercent(percent);
  elements.progressText.textContent = total > 0 ? `${label} (${done}/${total})` : label;
}

function log(message, level = "info") {
  const item = document.createElement("li");
  item.dataset.level = level;
  item.textContent = message;
  elements.logList.prepend(item);
}

function updateMetrics() {
  elements.courseCount.textContent = String(state.courses.length);
  elements.fileCount.textContent = String(state.stats.saved);
  elements.filteredCount.textContent = String(state.stats.filtered);
  elements.skippedCount.textContent = String(state.stats.skipped);
}

function resetStats() {
  state.stats = { saved: 0, filtered: 0, skipped: 0 };
  updateMetrics();
}

function normalizeExtensions(value) {
  return value
    .split(",")
    .map((part) => part.trim().replace(/^\./, "").toLowerCase())
    .filter(Boolean);
}

function validateSettings() {
  const includeExtensions = normalizeExtensions(elements.includeExt.value);
  const excludeExtensions = normalizeExtensions(elements.excludeExt.value);
  const duplicates = includeExtensions.filter((extension) =>
    excludeExtensions.includes(extension),
  );

  if (!state.accessToken) {
    return "Google で認証してください。";
  }
  if (!elements.courseSelect.value) {
    return "対象コースを選択してください。";
  }
  if (elements.startDate.value && elements.endDate.value && elements.startDate.value > elements.endDate.value) {
    return "開始日は終了日以前にしてください。";
  }
  if (duplicates.length > 0) {
    return `同じ拡張子を両方に入れないでください: ${[...new Set(duplicates)].join(", ")}`;
  }

  return "";
}

function getFilters() {
  return {
    exportFormat: "pdf",
    dateField: selectedValue("date-field"),
    startDate: elements.startDate.value,
    endDate: elements.endDate.value,
    includeExtensions: normalizeExtensions(elements.includeExt.value),
    excludeExtensions: normalizeExtensions(elements.excludeExt.value),
  };
}

function initializeTokenClient() {
  if (!window.google?.accounts?.oauth2) {
    throw new Error("Google Identity Services を読み込めませんでした。");
  }

  state.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: WEB_OAUTH_CLIENT_ID,
    scope: SCOPES,
    callback: (response) => {
      if (response.error) {
        setStatus(`認証に失敗しました: ${response.error}`, "error");
        log(`認証に失敗しました: ${response.error}`, "error");
        return;
      }
      state.accessToken = response.access_token;
      state.tokenExpiresAt = Date.now() + Number(response.expires_in || 3600) * 1000;
      updateControls();
      setStatus("認証済みです。コースを読み込めます。", "ready");
      log("Google 認証が完了しました。", "success");
    },
  });
}

function authorize() {
  try {
    initializeTokenClient();
    state.tokenClient.requestAccessToken({ prompt: state.accessToken ? "" : "consent" });
  } catch (error) {
    setStatus(error.message, "error");
    log(error.message, "error");
  }
}

function clearToken() {
  if (state.accessToken && window.google?.accounts?.oauth2) {
    google.accounts.oauth2.revoke(state.accessToken);
  }
  state.accessToken = "";
  state.tokenExpiresAt = 0;
  state.tokenClient = null;
  resetStats();
  setProgress(0, 0, "ダウンロードを開始すると、進捗が表示されます。");
  document.querySelector("#result-state").textContent = "未実行";
  state.courses = [];
  renderCourses();
  setStatus("認証を解除しました。", "ready");
  log("認証を解除しました。");
}

async function apiFetch(url, options = {}) {
  if (!state.accessToken || Date.now() >= state.tokenExpiresAt) {
    throw new Error("Google に再接続してから、もう一度実行してください。");
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${state.accessToken}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      state.accessToken = "";
      updateControls();
      throw new Error("接続の有効期限が切れました。Google に再接続してください。");
    }
    let detail = response.statusText;
    try {
      const payload = await response.json();
      detail = payload.error?.message || detail;
    } catch {
      // Keep status text.
    }
    throw new Error(`Google API error ${response.status}: ${detail}`);
  }

  return response;
}

async function listAll(url, key) {
  const results = [];
  let pageToken = "";

  do {
    const separator = url.includes("?") ? "&" : "?";
    const pageUrl = pageToken ? `${url}${separator}pageToken=${encodeURIComponent(pageToken)}` : url;
    const response = await apiFetch(pageUrl);
    const payload = await response.json();
    results.push(...(payload[key] || []));
    pageToken = payload.nextPageToken || "";
  } while (pageToken);

  return results;
}

async function loadCourses() {
  try {
    setBusy(true);
    setStatus("コースを読み込んでいます。", "working");
    const courseStates = elements.includeArchived.checked ? COURSE_STATES_WITH_ARCHIVED : COURSE_STATES;
    const query = new URLSearchParams();
    for (const courseState of courseStates) {
      query.append("courseStates", courseState);
    }
    query.set("pageSize", "100");

    state.courses = await listAll(
      `https://classroom.googleapis.com/v1/courses?${query.toString()}`,
      "courses",
    );
    state.courses.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja"));
    renderCourses();
    setStatus(`${state.courses.length} 件のコースを読み込みました。`, "ready");
    log(`${state.courses.length} 件のコースを読み込みました。`, "success");
  } catch (error) {
    setStatus(error.message, "error");
    log(error.message, "error");
  } finally {
    setBusy(false);
  }
}

function renderCourses() {
  elements.courseSelect.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = state.courses.length ? "授業を選択してください" : state.accessToken ? "授業を読み込んでください" : "Google に接続して授業を読み込んでください";
  elements.courseSelect.append(placeholder);

  for (const course of state.courses) {
    const option = document.createElement("option");
    option.value = course.id;
    const suffix = course.section ? ` [${course.section}]` : "";
    option.textContent = `${course.name || "(無題)"}${suffix}${course.courseState === "ARCHIVED" ? "（アーカイブ済み）" : ""}`;
    elements.courseSelect.append(option);
  }
  updateMetrics();
  updateControls();
  updateManifest();
}

async function collectCourseItems(courseId) {
  const courseWork = await listAll(
    `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/courseWork?pageSize=100`,
    "courseWork",
  );
  const materials = await listAll(
    `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/courseWorkMaterials?pageSize=100`,
    "courseWorkMaterial",
  );

  return [
    ...courseWork.map((item) => ({ type: "courseWork", item })),
    ...materials.map((item) => ({ type: "courseWorkMaterials", item })),
  ];
}

function collectDriveAttachments(items, courseId) {
  const attachments = [];
  for (const { type, item } of items) {
    const sourceTitle = item.title || item.name || item.id || "untitled";
    for (const material of item.materials || []) {
      const driveFile = material.driveFile?.driveFile || material.driveFile?.file;
      if (!driveFile?.id) {
        continue;
      }
      attachments.push({
        courseId,
        sourceType: type,
        sourceId: item.id || "",
        sourceTitle,
        fileId: driveFile.id,
        attachmentTitle: driveFile.title || driveFile.id,
      });
    }
  }
  return attachments;
}

async function getFileMetadata(fileId) {
  const fields = [
    "id",
    "name",
    "mimeType",
    "capabilities/canDownload",
    "fileExtension",
    "createdTime",
    "modifiedTime",
  ].join(",");
  const response = await apiFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent(fields)}&supportsAllDrives=true`,
  );
  return response.json();
}

function getOutputExtension(metadata, exportFormat) {
  if (GOOGLE_DOC_EXPORTS[metadata.mimeType]) {
    return normalizeExtension(GOOGLE_DOC_EXPORTS[metadata.mimeType][exportFormat][1]);
  }
  if (metadata.fileExtension) {
    return normalizeExtension(metadata.fileExtension);
  }
  const name = metadata.name || "";
  const lastDot = name.lastIndexOf(".");
  return lastDot >= 0 ? normalizeExtension(name.slice(lastDot + 1)) : "";
}

function normalizeExtension(value) {
  return String(value || "").trim().replace(/^\./, "").toLowerCase();
}

function getFilterReason(metadata, filters) {
  const extension = getOutputExtension(metadata, filters.exportFormat);
  const extensionLabel = extension || "(拡張子なし)";

  if (filters.includeExtensions.length > 0 && !filters.includeExtensions.includes(extension)) {
    return `拡張子 ${extensionLabel} はダウンロード対象外です`;
  }
  if (filters.excludeExtensions.includes(extension)) {
    return `拡張子 ${extensionLabel} は除外対象です`;
  }

  if (filters.startDate || filters.endDate) {
    const key = filters.dateField === "created" ? "createdTime" : "modifiedTime";
    const value = metadata[key] ? metadata[key].slice(0, 10) : "";
    if (!value) {
      return `${key} が取得できません`;
    }
    if (filters.startDate && value < filters.startDate) {
      return `${value} は開始日より前です`;
    }
    if (filters.endDate && value > filters.endDate) {
      return `${value} は終了日より後です`;
    }
  }

  return "";
}

async function downloadDriveFile(metadata, exportFormat) {
  if (GOOGLE_DOC_EXPORTS[metadata.mimeType]) {
    const [mimeType] = GOOGLE_DOC_EXPORTS[metadata.mimeType][exportFormat];
    const response = await apiFetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(metadata.id)}/export?mimeType=${encodeURIComponent(mimeType)}`,
    );
    return response.blob();
  }

  if (metadata.mimeType?.startsWith("application/vnd.google-apps.")) {
    throw new Error(`未対応の Google Workspace ファイルです: ${metadata.mimeType}`);
  }
  if (metadata.capabilities?.canDownload === false) {
    throw new Error("Drive がダウンロード不可と返しました。");
  }

  const response = await apiFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(metadata.id)}?alt=media&supportsAllDrives=true`,
  );
  return response.blob();
}

function getOutputFilename(metadata, exportFormat) {
  const baseName = safeName(metadata.name || metadata.id || "untitled");
  if (GOOGLE_DOC_EXPORTS[metadata.mimeType]) {
    const extension = GOOGLE_DOC_EXPORTS[metadata.mimeType][exportFormat][1];
    return `${baseName}${extension}`;
  }
  return baseName;
}

function safeName(value) {
  return String(value || "untitled")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, 120) || "untitled";
}

function uniquePath(path, usedPaths) {
  if (!usedPaths.has(path)) {
    usedPaths.add(path);
    return path;
  }

  const slashIndex = path.lastIndexOf("/");
  const directory = slashIndex >= 0 ? `${path.slice(0, slashIndex + 1)}` : "";
  const filename = slashIndex >= 0 ? path.slice(slashIndex + 1) : path;
  const dotIndex = filename.lastIndexOf(".");
  const stem = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  const extension = dotIndex > 0 ? filename.slice(dotIndex) : "";
  let counter = 1;

  while (true) {
    const candidate = `${directory}${stem} (${counter})${extension}`;
    if (!usedPaths.has(candidate)) {
      usedPaths.add(candidate);
      return candidate;
    }
    counter += 1;
  }
}

function downloadBlob(blob, filename) {
  const downloadName = filename.toLowerCase().endsWith(".zip") ? filename : `${filename}.zip`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = downloadName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function runDownload(event) {
  event.preventDefault();
  const validationMessage = validateSettings();
  if (validationMessage) {
    setStatus(validationMessage, "error");
    log(validationMessage, "error");
    return;
  }
  if (!window.JSZip) {
    setStatus("ZIP ライブラリを読み込めませんでした。", "error");
    log("ZIP ライブラリを読み込めませんでした。", "error");
    return;
  }

  const courseId = elements.courseSelect.value;
  const course = state.courses.find((item) => item.id === courseId);
  const courseName = safeName(course?.name || courseId);
  const filters = getFilters();
  const usedPaths = new Set();
  const zip = new JSZip();
  let completed = false;
  resetStats();
  document.querySelector("#result-state").textContent = "処理中";

  try {
    setBusy(true);
    setStatus("Classroom の添付ファイルを調べています。", "working");
    setProgress(0, 0, "課題と資料を取得中");
    log(`${course?.name || courseId} の取得を開始しました。`);

    const items = await collectCourseItems(courseId);
    const attachments = collectDriveAttachments(items, courseId);
    log(`${attachments.length} 件の Drive 添付ファイルを見つけました。`);

    for (const [index, attachment] of attachments.entries()) {
      setProgress(index, attachments.length, "ファイルを処理中");
      try {
        const metadata = await getFileMetadata(attachment.fileId);
        const filterReason = getFilterReason(metadata, filters);
        if (filterReason) {
          state.stats.filtered += 1;
          log(`除外: ${metadata.name || attachment.attachmentTitle} - ${filterReason}`);
          updateMetrics();
          continue;
        }

        const blob = await downloadDriveFile(metadata, filters.exportFormat);
        const outputPath = uniquePath(
          `${courseName}/${safeName(attachment.sourceTitle)}/${getOutputFilename(metadata, filters.exportFormat)}`,
          usedPaths,
        );
        zip.file(outputPath, blob);
        state.stats.saved += 1;
        log(`保存: ${outputPath}`, "success");
        updateMetrics();
      } catch (error) {
        state.stats.skipped += 1;
        log(`失敗: ${attachment.attachmentTitle} - ${error.message}`, "error");
        updateMetrics();
      }
    }

    setProgress(attachments.length, attachments.length, "ZIP を作成中");
    if (state.stats.saved === 0) {
      setStatus("保存対象のファイルがありませんでした。", "error");
      log("保存対象のファイルがありませんでした。", "error");
      return;
    }

    const zipBlob = await zip.generateAsync({ type: "blob" }, (metadata) => {
      setProgressPercent(Math.round(metadata.percent));
      elements.progressText.textContent = `ZIP を作成中 (${Math.round(metadata.percent)}%)`;
    });
    downloadBlob(zipBlob, safeName(elements.zipName.value || "classroom-downloads.zip"));
    completed = true;
    setStatus("ZIP の作成とダウンロードを開始しました。", "ready");
    log("ZIP の作成が完了しました。", "success");
  } catch (error) {
    setStatus(error.message, "error");
    log(error.message, "error");
  } finally {
    document.querySelector("#result-state").textContent = completed ? (state.stats.skipped ? "一部失敗" : "完了") : (state.stats.saved ? "ZIP 作成失敗" : "保存なし");
    setBusy(false);
  }
}

function setProgressPercent(percent) {
  elements.progressBar.style.width = `${percent}%`;
  elements.progressBar.parentElement.setAttribute("aria-valuenow", String(percent));
}

function updateControls() {
  elements.authorize.disabled = state.busy;
  elements.clearToken.disabled = state.busy || !state.accessToken;
  elements.loadCourses.disabled = state.busy || !state.accessToken;
  elements.courseSelect.disabled = state.busy || !state.courses.length;
  document.querySelector("#download-button").disabled = state.busy || !state.accessToken || !elements.courseSelect.value;
  document.querySelector("#account-state").textContent = state.accessToken ? "接続済み" : "未接続";
  elements.authorize.textContent = state.accessToken ? "Google に再接続" : "Google で接続";
}

function updateManifest() {
  const course = state.courses.find((item) => item.id === elements.courseSelect.value);
  let name = safeName(elements.zipName.value || "classroom-downloads.zip");
  if (!name.toLowerCase().endsWith(".zip")) name += ".zip";
  document.querySelector("#manifest-zip").textContent = name;
  document.querySelector("#manifest-course").textContent = course?.name || "選択した授業";
  const start = elements.startDate.value;
  const end = elements.endDate.value;
  const kind = selectedValue("date-field") === "created" ? "作成日" : "更新日";
  document.querySelector("#manifest-date").textContent = start || end ? `${kind}: ${start || "指定なし"} 〜 ${end || "指定なし"}` : "すべての期間";
  const include = normalizeExtensions(elements.includeExt.value);
  const exclude = normalizeExtensions(elements.excludeExt.value);
  document.querySelector("#manifest-ext").textContent = `${include.length ? include.join(", ") : "すべての形式"}${exclude.length ? `（${exclude.join(", ")} を除外）` : ""}`;
  updateControls();
}

elements.form.addEventListener("input", updateManifest);
elements.form.addEventListener("change", updateManifest);
elements.includeArchived.addEventListener("change", () => {
  if (state.accessToken) loadCourses();
});
document.querySelector("#reset-filters-button").addEventListener("click", () => {
  for (const input of [elements.startDate, elements.endDate, elements.includeExt, elements.excludeExt]) input.value = "";
  elements.form.querySelector('input[name="date-field"][value="modified"]').checked = true;
  updateManifest();
});

elements.authorize.addEventListener("click", authorize);
elements.clearToken.addEventListener("click", clearToken);
elements.loadCourses.addEventListener("click", loadCourses);
elements.form.addEventListener("submit", runDownload);
elements.clearLog.addEventListener("click", () => elements.logList.replaceChildren());

renderCourses();
updateMetrics();
