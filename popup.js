// --- IndexedDB 邵ｺ・ｧ郢晁ｼ斐°郢晢ｽｫ郢敖郢昜ｸ莞ｦ郢晏ｳｨﾎ晉ｹｧ蜻茨ｽｰ・ｸ驍ｯ螢ｼ蝟ｧ繝ｻ繝ｻrogress.js 邵ｺ・ｨ陷茨ｽｱ隴帑ｼ夲ｽｼ繝ｻ--
const openDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.open('archi-downloader', 1);
  req.onupgradeneeded = (e) => e.target.result.createObjectStore('handles');
  req.onsuccess = (e) => resolve(e.target.result);
  req.onerror = reject;
});

const saveHandle = async (handle) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').put(handle, 'saveDir');
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
};

const loadHandle = async () => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readonly');
    const req = tx.objectStore('handles').get('saveDir');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = reject;
  });
};

const HEADER_RULE_ID = 1;

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

const folderNameSpan = document.getElementById('folderName');
const changeBtn = document.getElementById('changeBtn');

// 郢晄亢繝｣郢晏干縺・ｹ昴・繝ｻ髯ｦ・ｨ驕会ｽｺ隴弱ｅ竊楢将譎擾ｽｭ菫ｶ・ｸ蛹ｻ竏ｩ郢晁ｼ斐°郢晢ｽｫ郢敖陷ｷ髦ｪ・帝勗・ｨ驕会ｽｺ
(async () => {
  try {
    const handle = await loadHandle();
    if (handle) {
      folderNameSpan.textContent = `\u4fdd\u5b58\u5148: ${handle.name}`;
      changeBtn.style.display = 'inline';
    }
  } catch (e) {}
})();

// 陞溽判蟲ｩ郢晄㈱縺｡郢晢ｽｳ
changeBtn.addEventListener('click', async () => {
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await saveHandle(handle);
    folderNameSpan.textContent = `\u4fdd\u5b58\u5148: ${handle.name}`;
  } catch (e) {}
});

// 郢敖郢ｧ・ｦ郢晢ｽｳ郢晢ｽｭ郢晢ｽｼ郢晏ｳｨ繝ｻ郢ｧ・ｿ郢晢ｽｳ
document.getElementById('dlBtn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('status');
  const dlBtn = document.getElementById('dlBtn');
  dlBtn.disabled = true;
  statusDiv.innerText = "\u753b\u50cf\u3092\u62bd\u51fa\u4e2d...";

  try {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const sourceOrigin = new URL(tab.url).origin;
    await clearHeaderRewriteRule();

    let injectionResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractImages
    });

    if (!injectionResults || !injectionResults[0]) {
      statusDiv.innerText = "\u30a8\u30e9\u30fc: \u30da\u30fc\u30b8\u3092\u8aad\u307f\u8fbc\u3081\u307e\u305b\u3093";
      dlBtn.disabled = false;
      return;
    }

    const topUrls = injectionResults[0].result;
    if (!topUrls || topUrls.length === 0) {
      statusDiv.innerText = "\u4fdd\u5b58\u3067\u304d\u308b\u5927\u304d\u306a\u753b\u50cf\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093";
      dlBtn.disabled = false;
      return;
    }

    // --- 郢晁ｼ斐°郢晢ｽｫ郢敖郢昜ｸ莞ｦ郢晏ｳｨﾎ晉ｸｺ・ｮ驕抵ｽｺ髫ｱ髦ｪ繝ｻ陷ｿ髢・ｾ證ｦ・ｼ蛹ｻﾎ倡ｹ晢ｽｼ郢ｧ・ｶ郢晢ｽｼ郢ｧ・ｸ郢ｧ・ｧ郢ｧ・ｹ郢昶・ﾎ慕ｹ晢ｽｼ邵ｺ蠕娯旺郢ｧ蛟ｶ・ｻ鄙ｫ繝ｻ邵ｺ繝ｻ笆邵ｺ・ｫ繝ｻ繝ｻ--
    let handle = null;
    try { handle = await loadHandle(); } catch (e) {}

    if (!handle) {
      // 陋ｻ譎丞ｱ・ 郢晁ｼ斐°郢晢ｽｫ郢敖鬩包ｽｸ隰壹・
      statusDiv.innerText = "\u4fdd\u5b58\u5148\u30d5\u30a9\u30eb\u30c0\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044...";
      try {
        handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        await saveHandle(handle);
        folderNameSpan.textContent = `\u4fdd\u5b58\u5148: ${handle.name}`;
        changeBtn.style.display = 'inline';
      } catch (e) {
        if (e.name === 'AbortError') {
          statusDiv.innerText = "\u30ad\u30e3\u30f3\u30bb\u30eb\u3055\u308c\u307e\u3057\u305f";
        } else {
          statusDiv.innerText = "\u30a8\u30e9\u30fc\u304c\u767a\u751f\u3057\u307e\u3057\u305f";
          console.error(e);
        }
        dlBtn.disabled = false;
        return;
      }
    } else {
      // 闖ｫ譎擾ｽｭ菫ｶ・ｸ蛹ｻ竏ｩ: 隶難ｽｩ鬮ｯ闊鯉ｽ帝￡・ｺ髫ｱ髦ｪ繝ｻ陷閧ｴ萓｡髫ｱ繝ｻ
      let perm = await handle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        statusDiv.innerText = "\u4fdd\u5b58\u5148\u30d5\u30a9\u30eb\u30c0\u3078\u306e\u30a2\u30af\u30bb\u30b9\u3092\u8a31\u53ef\u3057\u3066\u304f\u3060\u3055\u3044...";
        perm = await handle.requestPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
          statusDiv.innerText = "\u30a2\u30af\u30bb\u30b9\u304c\u8a31\u53ef\u3055\u308c\u307e\u305b\u3093\u3067\u3057\u305f";
          dlBtn.disabled = false;
          return;
        }
      }
    }

    // URL邵ｺ・ｨ陷医・縺｡郢晏戟繝･陜｣・ｱ郢ｧ蛛ｵ縺帷ｹ晏現ﾎ樒ｹ晢ｽｼ郢ｧ・ｸ邵ｺ・ｫ闖ｫ譎擾ｽｭ蛟･・邵ｺ・ｦ鬨ｾ・ｲ隰仙干縺育ｹｧ・｣郢晢ｽｳ郢晏ｳｨ縺育ｹｧ蟶晏ｹ慕ｸｺ繝ｻ
    await applyHeaderRewriteRule(sourceOrigin);
    await chrome.storage.local.set({
      downloadUrls: topUrls,
      sourceTabUrl: tab.url,
      sourceTabTitle: tab.title
    });

    chrome.windows.create({
      url: 'progress.html',
      type: 'popup',
      width: 450,
      height: 500
    });

  } catch (error) {
    try { await clearHeaderRewriteRule(); } catch (cleanupError) {}
    statusDiv.innerText = "\u30a8\u30e9\u30fc\u304c\u767a\u751f\u3057\u307e\u3057\u305f";
    console.error(error);
    document.getElementById('dlBtn').disabled = false;
  }
});

// ------------------------------------------------------------------
// 郢晏｣ｹ繝ｻ郢ｧ・ｸ陷繝ｻﾎ夂ｸｺ・ｫ雎包ｽｨ陷茨ｽ･邵ｺ霈費ｽ檎ｸｺ・ｦ陞ｳ貅ｯ・｡蠕鯉ｼ・ｹｧ蠕鯉ｽ矩ｫ｢・｢隰ｨ・ｰ繝ｻ繝ｻRL邵ｺ・ｨ郢ｧ・ｵ郢ｧ・､郢ｧ・ｺ邵ｺ・ｮ隰夲ｽｽ陷・ｽｺ邵ｺ・ｮ邵ｺ・ｿ髯ｦ蠕娯鴬繝ｻ繝ｻ
// ------------------------------------------------------------------
function extractImages() {
  let imgElements = Array.from(document.querySelectorAll('img'));
  let validUrls = new Map(); // src -> area 繝ｻ逎ｯ纃ｾ髫阪・雉憺ｫｯ・､繝ｻ繝ｻ

  // 鬨ｾ螢ｼ・ｸ・ｸ邵ｺ・ｮimg郢ｧ・ｿ郢ｧ・ｰ郢ｧ蜻茨ｽ､諛・ｽｴ・｢
  for (let img of imgElements) {
    let src = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original');

    // picture郢ｧ・ｿ郢ｧ・ｰ陷繝ｻ竊鍋ｸｺ繧・ｽ玖撻・ｴ陷ｷ蛹ｻﾂ縲覚urce邵ｺ・ｮsrcset郢ｧ雋樞煤陷医・
    let picture = img.closest('picture');
    if (!src && picture) {
      let sources = Array.from(picture.querySelectorAll('source'));
      for (let source of sources) {
        if (source.srcset) {
          let srcsetUrls = source.srcset.split(',').map(s => s.trim().split(' ')[0]).filter(s => s && !s.startsWith('data:'));
          if (srcsetUrls.length > 0) {
            src = srcsetUrls[srcsetUrls.length - 1];
            break;
          }
        }
      }
    }

    // img髢ｾ・ｪ髴・ｽｫ邵ｺ・ｮsrcset郢ｧ蛛ｵ繝｡郢ｧ・ｧ郢昴・縺・
    if (!src && img.srcset) {
      let srcsetUrls = img.srcset.split(',').map(s => s.trim().split(' ')[0]).filter(s => s && !s.startsWith('data:'));
      if (srcsetUrls.length > 0) src = srcsetUrls[srcsetUrls.length - 1];
    }

    // 邵ｺ・ｾ邵ｺ・ｰ髫穂ｹ昶命邵ｺ荵晢ｽ臥ｸｺ・ｪ邵ｺ莉｣・檎ｸｺ・ｰsrc郢ｧ蜑・ｽｽ・ｿ邵ｺ繝ｻ
    if (!src) src = img.getAttribute('src') || img.src;
    if (!src || src.startsWith('data:')) continue; // 隴鯉ｽ｢邵ｺ・ｫ隴√・・ｭ蜉ｱ繝ｧ郢晢ｽｼ郢ｧ・ｿ邵ｺ・ｮ郢ｧ繧・・邵ｺ・ｯ鬮ｯ・､陞溘・

    // 騾ｶ・ｸ陝・ｽｾURL郢ｧ蝣､・ｵ・ｶ陝・ｽｾURL邵ｺ・ｫ陞溽判驪､
    let a = document.createElement('a');
    a.href = src;
    src = a.href;

    if (src.startsWith('http')) {
      // 郢ｧ・ｵ郢ｧ・､郢ｧ・ｺ郢ｧ雋槫徐陟墓圜・ｼ繝ｻtml/css邵ｺ・ｮ陞ｳ貊鍋・陋滂ｽ､郢ｧ雋樞煤陷郁肩・ｼ繝ｻ
      let width = img.naturalWidth || img.clientWidth || parseInt(img.getAttribute('width')) || 0;
      let height = img.naturalHeight || img.clientHeight || parseInt(img.getAttribute('height')) || 0;

      // 鬩輔・・ｻ・ｶ髫ｱ・ｭ邵ｺ・ｿ髴趣ｽｼ邵ｺ・ｿ邵ｺ・ｮ陞ｻ讓環・ｧ邵ｺ蠕娯命邵ｺ繝ｻ窶ｻ邵ｺ繝ｻ・狗ｸｺ荵晢ｽ堤ｹ昶・縺臥ｹ昴・縺・
      let isLazy = img.hasAttribute('data-src') || img.hasAttribute('data-lazy-src') || img.hasAttribute('data-original');

      // 陝・ｸ奇ｼ・ｸｺ繝ｻ蛻､陷偵・(3000px隴幢ｽｪ雋・) 郢ｧ雋橸ｽｮ謔溘・邵ｺ・ｫ鬮ｯ・､陞滓じ笘・ｹｧ繝ｻ
      // 繝ｻ驕ｺﾂ・ｻ邵ｲ迹夲ｽｦ荵昶斡邵ｺ・ｪ邵ｺ繝ｻ・邵ｺ・ｩLazyLoad邵ｺ・ｮ騾包ｽｻ陷呈得・ｼ繝ｻidth=0繝ｻ蟲ｨﾂ髦ｪ繝ｻ隴幢ｽｬ陷ｻ・ｽ邵ｺ・ｮ陝ｾ・ｨ陞滂ｽｧ陷蜥乗ｄ邵ｺ・ｮ陷ｿ・ｯ髢ｭ・ｽ隲､・ｧ邵ｺ遒・ｽｫ蛟･・樒ｸｺ・ｮ邵ｺ・ｧ霑夲ｽｹ陋ｻ・･邵ｺ・ｫ隰ｨ隨ｬ・ｸ蛹ｻ笘・ｹｧ蜈ｷ・ｼ繝ｻ
      if (width >= 3000 || height >= 3000 || (isLazy && width === 0)) {
        let area = (width && height) ? (width * height) : (isLazy ? 9000000 : 0);
        if (area > 0) {
          if (!validUrls.has(src) || validUrls.get(src) < area) {
            validUrls.set(src, area);
          }
        }
      }
    }
  }

  // 髢ｭ譴ｧ蜍ｹ騾包ｽｻ陷剃ｸ奇ｽ定ｮ諛・ｽｴ・｢ (div驕ｲ蟲ｨ竊馴坎・ｭ陞ｳ螢ｹ・・ｹｧ蠕娯ｻ邵ｺ繝ｻ・玖撻・ｴ陷ｷ繝ｻ
  let allElements = Array.from(document.querySelectorAll('*'));
  for (let el of allElements) {
    let bg = window.getComputedStyle(el).backgroundImage;
    if (bg && bg !== 'none' && bg.startsWith('url(')) {
      let src = bg.slice(4, -1).replace(/["']/g, ''); // url("...") 邵ｺ・ｮ闕ｳ・ｭ髴・ｽｫ郢ｧ雋槫徐郢ｧ髮√・邵ｺ繝ｻ
      if (!src || src.startsWith('data:')) continue;

      let a = document.createElement('a');
      a.href = src;
      src = a.href;

      if (src.startsWith('http')) {
        let width = el.clientWidth || 0;
        let height = el.clientHeight || 0;
        // 陝・ｸ奇ｼ・ｸｺ繝ｻ繝ｬ隴趣ｽｯ騾包ｽｻ陷偵・(3000px隴幢ｽｪ雋・) 郢ｧ雋橸ｽｮ謔溘・邵ｺ・ｫ鬮ｯ・､陞溘・
        if (width >= 3000 || height >= 3000) {
          let area = width * height;
          if (!validUrls.has(src) || validUrls.get(src) < area) {
            validUrls.set(src, area);
          }
        }
      }
    }
  }

  // 鬮ｱ・｢驕ｨ髦ｪ窶ｲ陞滂ｽｧ邵ｺ髦ｪ・樣ｬ・・・ｼ蛹ｻﾎ鍋ｹｧ・､郢晢ｽｳ騾包ｽｻ陷貞沁・ｰ繝ｻ・ｼ蟲ｨ竊楢叉・ｦ邵ｺ・ｳ隴厄ｽｿ邵ｺ蛹ｻﾂ竏ｽ・ｸ雍具ｽｽ繝ｻ5隴ｫ螢ｹ繝ｻURL邵ｺ・ｰ邵ｺ莉｣・帝恆譁絶・
  let sortedUrls = Array.from(validUrls.entries()).sort((a, b) => b[1] - a[1]);
  return sortedUrls.slice(0, 15).map(v => v[0]);
}



