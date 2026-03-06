const HEADER_RULE_ID = 1;
const DEFAULT_TASK_TYPE = "article";
const STORAGE_KEYS_TO_CLEAR = [
  "jobMode",
  "jobUrls",
  "downloadUrls",
  "sourceTabUrl",
  "sourceTabTitle",
  "uploadConfig"
];

const clearHeaderRewriteRule = async () => {
  if (!chrome.declarativeNetRequest) return;
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [HEADER_RULE_ID]
  });
};

const openDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.open("archi-downloader", 1);
  req.onupgradeneeded = (e) => e.target.result.createObjectStore("handles");
  req.onsuccess = (e) => resolve(e.target.result);
  req.onerror = reject;
});

const saveHandle = async (handle) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("handles", "readwrite");
    tx.objectStore("handles").put(handle, "saveDir");
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
};

const loadHandle = async () => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("handles", "readonly");
    const req = tx.objectStore("handles").get("saveDir");
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = reject;
  });
};

const getSanitizedTitle = (title) => {
  let baseTitle = title || "";
  const dashIndex = baseTitle.indexOf("-");
  const pipeIndex = baseTitle.indexOf("|");
  const cutIndexCandidates = [dashIndex, pipeIndex].filter((idx) => idx >= 0);
  if (cutIndexCandidates.length > 0) {
    baseTitle = baseTitle.slice(0, Math.min(...cutIndexCandidates));
  }

  const clean = baseTitle
    .replace(/[\\/:*?"<>|-]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return clean.slice(0, 30) || "images";
};

const getTimestamp = () => {
  const now = new Date();
  const p = (n) => n.toString().padStart(2, "0");
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}_${p(now.getHours())}${p(now.getMinutes())}`;
};

const getFileExtFromBlob = (blob) => {
  const mime = blob.type || "image/jpeg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
};

window.addEventListener("beforeunload", () => {
  clearHeaderRewriteRule().catch(() => {});
});

document.addEventListener("DOMContentLoaded", async () => {
  const statusDiv = document.getElementById("status");
  const progressBar = document.getElementById("progress-bar");
  const folderDisplay = document.getElementById("folderDisplay");
  const actionBtn = document.getElementById("actionBtn");
  const resultLog = document.getElementById("resultLog");

  const setStatus = (text, color = "#0056b3") => {
    statusDiv.innerText = text;
    statusDiv.style.color = color;
  };

  const appendLog = (text, kind = "info") => {
    if (!resultLog) return;
    const line = document.createElement("div");
    line.className = `log-${kind}`;
    line.textContent = text;
    resultLog.appendChild(line);
    resultLog.scrollTop = resultLog.scrollHeight;
  };

  const data = await chrome.storage.local.get([
    "jobMode",
    "jobUrls",
    "downloadUrls",
    "sourceTabUrl",
    "sourceTabTitle",
    "uploadConfig"
  ]);

  const mode = data.jobMode || "download";
  const topUrls = data.jobUrls || data.downloadUrls || [];
  const sourceTabUrl = data.sourceTabUrl || "";
  const sourceTitle = data.sourceTabTitle || "ArchiImages";
  const uploadConfig = data.uploadConfig || {};

  if (!topUrls.length) {
    await clearHeaderRewriteRule();
    setStatus("エラー: 対象画像が見つかりません。", "#9c1c1c");
    actionBtn.disabled = true;
    return;
  }

  const cleanTitle = getSanitizedTitle(sourceTitle);
  const timestamp = getTimestamp();
  const folderName = `${cleanTitle}_${timestamp}`;

  const cleanupJobState = async () => {
    await chrome.storage.local.remove(STORAGE_KEYS_TO_CLEAR);
  };

  const runDownload = async (rootHandle) => {
    try {
      actionBtn.style.display = "none";
      if (resultLog) resultLog.style.display = "none";

      const folderHandle = await rootHandle.getDirectoryHandle(folderName, { create: true });
      folderDisplay.textContent = `保存先: ${rootHandle.name} / ${folderName}`;

      let successCount = 0;
      let failCount = 0;
      for (let i = 0; i < topUrls.length; i++) {
        setStatus(`画像を保存中 (${i + 1}/${topUrls.length})...`, "black");
        progressBar.style.width = `${(i / topUrls.length) * 100}%`;

        try {
          const res = await fetch(topUrls[i], { credentials: "omit" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          const ext = getFileExtFromBlob(blob);
          const fileName = `${cleanTitle}_${timestamp}_${String(i + 1).padStart(2, "0")}.${ext}`;

          const fileHandle = await folderHandle.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          successCount++;
        } catch (e) {
          failCount++;
          console.warn(`画像 ${i + 1} の保存に失敗`, e);
        }
      }

      progressBar.style.width = "100%";
      if (failCount === 0) {
        setStatus(`ダウンロード完了: ${folderName}\n(${successCount}枚)`, "green");
      } else {
        setStatus(`ダウンロード完了: 成功 ${successCount} / 失敗 ${failCount}`, "#9c1c1c");
      }

      await cleanupJobState();
      setTimeout(() => window.close(), 3000);
    } finally {
      await clearHeaderRewriteRule();
    }
  };

  const runUpload = async () => {
    try {
      folderDisplay.textContent = "";
      actionBtn.style.display = "none";
      if (resultLog) resultLog.style.display = "block";

      const endpoint = uploadConfig.endpoint || "";
      const token = uploadConfig.token || "";
      const taskType = uploadConfig.taskType || DEFAULT_TASK_TYPE;
      const optionsBase = uploadConfig.options || {};

      if (!endpoint || !token) {
        setStatus("エラー: 送信設定が不足しています。", "#9c1c1c");
        appendLog("送信先URLまたはトークンが未設定です。", "ng");
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < topUrls.length; i++) {
        const imageUrl = topUrls[i];
        setStatus(`VPSへ送信中 (${i + 1}/${topUrls.length})...`, "black");
        progressBar.style.width = `${(i / topUrls.length) * 100}%`;

        try {
          const imageRes = await fetch(imageUrl, { credentials: "omit" });
          if (!imageRes.ok) throw new Error(`画像取得失敗 HTTP ${imageRes.status}`);
          const blob = await imageRes.blob();
          const ext = getFileExtFromBlob(blob);
          const fileName = `${cleanTitle}_${timestamp}_${String(i + 1).padStart(2, "0")}.${ext}`;

          const fd = new FormData();
          fd.append("file", blob, fileName);
          fd.append("page_url", sourceTabUrl);
          fd.append("image_url", imageUrl);
          fd.append("task_type", taskType);
          fd.append("options", JSON.stringify({
            ...optionsBase,
            title: sourceTitle,
            source: "chrome-extension"
          }));

          const ingestRes = await fetch(endpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`
            },
            body: fd
          });

          const bodyText = (await ingestRes.text()).replace(/\s+/g, " ").trim();
          const bodySnippet = bodyText ? bodyText.slice(0, 160) : "(empty)";

          if (ingestRes.ok) {
            successCount++;
            appendLog(`[OK ${i + 1}] HTTP ${ingestRes.status} ${bodySnippet}`, "ok");
          } else {
            failCount++;
            appendLog(`[NG ${i + 1}] HTTP ${ingestRes.status} ${bodySnippet}`, "ng");
          }
        } catch (e) {
          failCount++;
          appendLog(`[NG ${i + 1}] ${e.message || "送信失敗"}`, "ng");
        }
      }

      progressBar.style.width = "100%";
      if (failCount === 0) {
        setStatus(`送信完了: 成功 ${successCount} / 失敗 0`, "green");
      } else {
        setStatus(`送信完了: 成功 ${successCount} / 失敗 ${failCount}`, "#9c1c1c");
      }

      await cleanupJobState();
    } finally {
      await clearHeaderRewriteRule();
    }
  };

  const pickFolder = async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      await saveHandle(handle);
      return handle;
    } catch (e) {
      if (e.name !== "AbortError") throw e;
      return null;
    }
  };

  if (mode === "upload") {
    appendLog(`送信先: ${uploadConfig.endpoint || "(unknown)"}`, "info");
    setStatus(`画像 ${topUrls.length} 枚をVPSへ送信します...`);
    await runUpload();
    return;
  }

  let savedHandle = null;
  try {
    savedHandle = await loadHandle();
  } catch (e) {}

  if (savedHandle) {
    folderDisplay.textContent = `保存先: ${savedHandle.name}`;
    setStatus(`画像 ${topUrls.length} 枚を保存します...`);
    await runDownload(savedHandle);
  } else {
    setStatus("保存先フォルダを選択してください");
    actionBtn.style.display = "inline-block";
    actionBtn.addEventListener("click", async () => {
      actionBtn.disabled = true;
      const handle = await pickFolder();
      if (handle) {
        folderDisplay.textContent = `保存先: ${handle.name}`;
        await runDownload(handle);
      } else {
        actionBtn.disabled = false;
      }
    });
  }
});
