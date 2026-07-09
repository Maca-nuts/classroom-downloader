const form = document.querySelector("#command-form");
const courseIdInput = document.querySelector("#course-id");
const outputDirInput = document.querySelector("#output-dir");
const startDateInput = document.querySelector("#start-date");
const endDateInput = document.querySelector("#end-date");
const includeExtInput = document.querySelector("#include-ext");
const excludeExtInput = document.querySelector("#exclude-ext");
const includeArchivedInput = document.querySelector("#include-archived");
const commandOutput = document.querySelector("#command-output");
const statusCard = document.querySelector("#status-card");
const statusText = document.querySelector("#status-text");
const copyButton = document.querySelector("#copy-command");

function selectedValue(name) {
  return new FormData(form).get(name);
}

function shellQuote(value) {
  if (!value) {
    return '""';
  }
  if (/^[A-Za-z0-9_./:=+-]+$/.test(value)) {
    return value;
  }
  return `"${value.replaceAll('"', '\\"')}"`;
}

function normalizeExtensions(value) {
  return value
    .split(",")
    .map((item) => item.trim().replace(/^\./, "").toLowerCase())
    .filter(Boolean);
}

function validateState(state) {
  if (!state.courseId) {
    return "Course ID を入力してください。";
  }
  if (state.startDate && state.endDate && state.startDate > state.endDate) {
    return "開始日は終了日以前にしてください。";
  }

  const duplicates = state.includeExtensions.filter((extension) =>
    state.excludeExtensions.includes(extension),
  );
  if (duplicates.length > 0) {
    return `同じ拡張子を両方に入れないでください: ${[...new Set(duplicates)].join(", ")}`;
  }

  return "";
}

function getState() {
  return {
    courseId: courseIdInput.value.trim(),
    outputDir: outputDirInput.value.trim() || "downloads",
    exportFormat: selectedValue("export-format"),
    dateField: selectedValue("date-field"),
    includeArchived: includeArchivedInput.checked,
    startDate: startDateInput.value,
    endDate: endDateInput.value,
    includeExtensions: normalizeExtensions(includeExtInput.value),
    excludeExtensions: normalizeExtensions(excludeExtInput.value),
  };
}

function buildCommand(state) {
  const parts = [
    "python",
    "-m",
    "classroom_drive_downloader.cli",
    "download",
    shellQuote(state.courseId || "COURSE_ID"),
  ];

  if (state.outputDir !== "downloads") {
    parts.push("--output-dir", shellQuote(state.outputDir));
  }
  if (state.exportFormat !== "pdf") {
    parts.push("--export-format", state.exportFormat);
  }
  if (state.includeArchived) {
    parts.push("--include-archived");
  }
  if (state.dateField !== "modified") {
    parts.push("--date-field", state.dateField);
  }
  if (state.startDate) {
    parts.push("--start-date", state.startDate);
  }
  if (state.endDate) {
    parts.push("--end-date", state.endDate);
  }
  if (state.includeExtensions.length > 0) {
    parts.push("--include-ext", state.includeExtensions.join(","));
  }
  if (state.excludeExtensions.length > 0) {
    parts.push("--exclude-ext", state.excludeExtensions.join(","));
  }

  return parts.join(" ");
}

function render() {
  const state = getState();
  const validationMessage = validateState(state);
  const command = buildCommand(state);

  commandOutput.textContent = command;
  statusCard.classList.toggle("error", Boolean(validationMessage));
  statusText.textContent = validationMessage || "この条件でコマンドを実行できます。";
  copyButton.disabled = Boolean(validationMessage);
}

async function copyCommand() {
  await navigator.clipboard.writeText(commandOutput.textContent);
  const previousText = copyButton.textContent;
  copyButton.textContent = "コピー済み";
  window.setTimeout(() => {
    copyButton.textContent = previousText;
  }, 1200);
}

form.addEventListener("input", render);
copyButton.addEventListener("click", copyCommand);
render();
