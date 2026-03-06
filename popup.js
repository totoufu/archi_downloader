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

const HEADER_RULE_ID = 1;
const INGEST_ENDPOINT = "http://100.74.213.44/ingest";
const INGEST_TOKEN = "10dd8824c7ede8dab4eaaca459c98a36653b31820ba5e8e8d918ef932875576e";

const clearHeaderRewriteRule = async () => {
  if (!chrome.declarativeNetRequest) return;
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [HEADER_RULE_ID]
  });
};

const applyHeaderRewriteRule = async (sourceOrigin) => {
  if (!chrome.declarativeNetRequest) return;
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [HEADER_RULE_ID],
    addRules: [{
      id: HEADER_RULE_ID,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [
          { header: "referer", operation: "set", value: `${sourceOrigin}/` },
          { header: "origin", operation: "set", value: sourceOrigin }
        ]
      },
      condition: {
        urlFilter: "*",
        resourceTypes: ["xmlhttprequest"],
        initiatorDomains: [chrome.runtime.id]
      }
    }]
  });
};

(async () => {
  try {
    await clearHeaderRewriteRule();
  } catch (e) {}
})();

const folderNameSpan = document.getElementById("folderName");
const changeBtn = document.getElementById("changeBtn");
const dlBtn = document.getElementById("dlBtn");
const uploadBtn = document.getElementById("uploadBtn");
const statusDiv = document.getElementById("status");

const setStatus = (text) => {
  statusDiv.innerText = text;
};

const updateFolderLabel = (handle) => {
  if (!handle) {
    folderNameSpan.textContent = "";
    changeBtn.style.display = "none";
    return;
  }
  folderNameSpan.textContent = `保存先: ${handle.name}`;
  changeBtn.style.display = "inline";
};

(async () => {
  try {
    updateFolderLabel(await loadHandle());
  } catch (e) {}
})();

changeBtn.addEventListener("click", async () => {
  try {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    await saveHandle(handle);
    updateFolderLabel(handle);
  } catch (e) {}
});

const collectTopUrlsFromActiveTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id || !tab.url) {
    throw new Error("ページ情報を取得できません");
  }

  const sourceOrigin = new URL(tab.url).origin;
  await clearHeaderRewriteRule();

  const injectionResults = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractImages
  });

  if (!injectionResults || !injectionResults[0]) {
    throw new Error("ページを読み込めません");
  }

  const topUrls = injectionResults[0].result;
  if (!topUrls || topUrls.length === 0) {
    throw new Error("保存できる大きな画像が見つかりません");
  }

  return { tab, sourceOrigin, topUrls };
};

const ensureDownloadFolderReady = async () => {
  let handle = null;
  try {
    handle = await loadHandle();
  } catch (e) {}

  if (!handle) {
    setStatus("保存先フォルダを選択してください...");
    try {
      handle = await window.showDirectoryPicker({ mode: "readwrite" });
      await saveHandle(handle);
      updateFolderLabel(handle);
      return true;
    } catch (e) {
      if (e.name === "AbortError") {
        setStatus("キャンセルされました");
      } else {
        setStatus("エラーが発生しました");
        console.error(e);
      }
      return false;
    }
  }

  let perm = await handle.queryPermission({ mode: "readwrite" });
  if (perm !== "granted") {
    setStatus("保存先フォルダへのアクセスを許可してください...");
    perm = await handle.requestPermission({ mode: "readwrite" });
    if (perm !== "granted") {
      setStatus("アクセスが許可されませんでした");
      return false;
    }
  }
  return true;
};

const openProgressWindow = async (payload) => {
  await chrome.storage.local.set(payload);
  chrome.windows.create({
    url: "progress.html",
    type: "popup",
    width: 450,
    height: 560
  });
};

dlBtn.addEventListener("click", async () => {
  dlBtn.disabled = true;
  uploadBtn.disabled = true;
  setStatus("画像を抽出中...");

  try {
    const { tab, sourceOrigin, topUrls } = await collectTopUrlsFromActiveTab();

    const folderReady = await ensureDownloadFolderReady();
    if (!folderReady) return;

    await applyHeaderRewriteRule(sourceOrigin);
    await openProgressWindow({
      jobMode: "download",
      jobUrls: topUrls,
      // Backward-compatible key for existing data readers.
      downloadUrls: topUrls,
      sourceTabUrl: tab.url,
      sourceTabTitle: tab.title
    });
  } catch (error) {
    try {
      await clearHeaderRewriteRule();
    } catch (cleanupError) {}
    setStatus(`エラー: ${error.message || "処理に失敗しました"}`);
    console.error(error);
  } finally {
    dlBtn.disabled = false;
    uploadBtn.disabled = false;
  }
});

uploadBtn.addEventListener("click", async () => {
  dlBtn.disabled = true;
  uploadBtn.disabled = true;
  setStatus("画像を抽出中...");

  try {
    const { tab, sourceOrigin, topUrls } = await collectTopUrlsFromActiveTab();
    await applyHeaderRewriteRule(sourceOrigin);

    await openProgressWindow({
      jobMode: "upload",
      jobUrls: topUrls,
      sourceTabUrl: tab.url,
      sourceTabTitle: tab.title,
      uploadConfig: {
        endpoint: INGEST_ENDPOINT,
        token: INGEST_TOKEN,
        taskType: "article",
        options: {
          source: "chrome-extension"
        }
      }
    });

    setStatus("送信ウィンドウを開きました");
  } catch (error) {
    try {
      await clearHeaderRewriteRule();
    } catch (cleanupError) {}
    setStatus(`エラー: ${error.message || "処理に失敗しました"}`);
    console.error(error);
  } finally {
    dlBtn.disabled = false;
    uploadBtn.disabled = false;
  }
});

function extractImages() {
  const imgElements = Array.from(document.querySelectorAll("img"));
  const validUrls = new Map();

  for (const img of imgElements) {
    let src = img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || img.getAttribute("data-original");

    const picture = img.closest("picture");
    if (!src && picture) {
      const sources = Array.from(picture.querySelectorAll("source"));
      for (const source of sources) {
        if (source.srcset) {
          const srcsetUrls = source.srcset.split(",").map((s) => s.trim().split(" ")[0]).filter((s) => s && !s.startsWith("data:"));
          if (srcsetUrls.length > 0) {
            src = srcsetUrls[srcsetUrls.length - 1];
            break;
          }
        }
      }
    }

    if (!src && img.srcset) {
      const srcsetUrls = img.srcset.split(",").map((s) => s.trim().split(" ")[0]).filter((s) => s && !s.startsWith("data:"));
      if (srcsetUrls.length > 0) src = srcsetUrls[srcsetUrls.length - 1];
    }

    if (!src) src = img.getAttribute("src") || img.src;
    if (!src || src.startsWith("data:")) continue;

    const a = document.createElement("a");
    a.href = src;
    src = a.href;

    if (src.startsWith("http")) {
      const width = img.naturalWidth || img.clientWidth || parseInt(img.getAttribute("width"), 10) || 0;
      const height = img.naturalHeight || img.clientHeight || parseInt(img.getAttribute("height"), 10) || 0;
      const isLazy = img.hasAttribute("data-src") || img.hasAttribute("data-lazy-src") || img.hasAttribute("data-original");

      if (width >= 3000 || height >= 3000 || (isLazy && width === 0)) {
        const area = (width && height) ? (width * height) : (isLazy ? 9000000 : 0);
        if (area > 0 && (!validUrls.has(src) || validUrls.get(src) < area)) {
          validUrls.set(src, area);
        }
      }
    }
  }

  const allElements = Array.from(document.querySelectorAll("*"));
  for (const el of allElements) {
    const bg = window.getComputedStyle(el).backgroundImage;
    if (bg && bg !== "none" && bg.startsWith("url(")) {
      let src = bg.slice(4, -1).replace(/["']/g, "");
      if (!src || src.startsWith("data:")) continue;

      const a = document.createElement("a");
      a.href = src;
      src = a.href;

      if (src.startsWith("http")) {
        const width = el.clientWidth || 0;
        const height = el.clientHeight || 0;
        if (width >= 3000 || height >= 3000) {
          const area = width * height;
          if (!validUrls.has(src) || validUrls.get(src) < area) {
            validUrls.set(src, area);
          }
        }
      }
    }
  }

  const sortedUrls = Array.from(validUrls.entries()).sort((a, b) => b[1] - a[1]);
  return sortedUrls.slice(0, 15).map((v) => v[0]);
}
