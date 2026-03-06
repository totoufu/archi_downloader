const HEADER_RULE_ID = 1;

const clearHeaderRewriteRule = async () => {
    if (!chrome.declarativeNetRequest) return;
    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [HEADER_RULE_ID]
    });
};

window.addEventListener('beforeunload', () => {
    clearHeaderRewriteRule().catch(() => {});
});
document.addEventListener('DOMContentLoaded', async () => {
    const statusDiv = document.getElementById('status');
    const progressBar = document.getElementById('progress-bar');
    const folderDisplay = document.getElementById('folderDisplay');
    const actionBtn = document.getElementById('actionBtn');

    const data = await chrome.storage.local.get(['downloadUrls', 'sourceTabUrl', 'sourceTabTitle']);
    const topUrls = data.downloadUrls;
    const sourceTitle = data.sourceTabTitle || "ArchiImages";

    if (!topUrls || topUrls.length === 0) {
        await clearHeaderRewriteRule();
        statusDiv.innerText = "\u30a8\u30e9\u30fc: \u30c0\u30a6\u30f3\u30ed\u30fc\u30c9\u3059\u308b\u753b\u50cf\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3002";
        actionBtn.disabled = true;
        return;
    }

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
        const p = (n) => n.toString().padStart(2, '0');
        return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}_${p(now.getHours())}${p(now.getMinutes())}`;
    };

    const cleanTitle = getSanitizedTitle(sourceTitle);
    const timestamp = getTimestamp();
    const folderName = `${cleanTitle}_${timestamp}`;

    // --- IndexedDB 鬯ｯ・ｩ隰ｳ・ｾ繝ｻ・ｽ繝ｻ・ｵ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｺ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｧ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ陟托ｽｱ郢晢ｽｻ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｼ鬮ｫ・ｴ郢晢ｽｻ隰ｳ・ｨ郢晢ｽｻ繝ｻ・ｰ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｫ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｰ繝ｻ・ｨ鬯ｲ謇假ｽｽ・ｴ繝ｻ縺､ﾂ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ闕ｵ蜉ｱ繝ｻ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｸ鬯ｮ・｣騾搾ｽｲ繝ｻ・ｩ繝ｻ・ｸ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｦ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ陷ｿ髢・ｾ蜉ｱ繝ｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｳ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｨ驛｢譎｢・ｽ・ｻ髯ｷ・ｿ鬮｢ﾂ隴鯉ｽｭ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｹ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｧ鬯ｮ・ｯ繝ｻ・ｷ郢晢ｽｻ繝ｻ・ｻ鬯ｮ・｣鬲・ｼ夲ｽｽ・ｽ繝ｻ・ｨ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｰ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｸ鬯ｯ・ｯ繝ｻ・ｩ髫ｰ・ｳ繝ｻ・ｾ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｯ鬯ｮ・ｯ隶厄ｽｸ繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｼ鬯ｮ・ｯ隲幄肩・ｽ・ｻ郢ｧ謇假ｽｽ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｧ ---
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

    // --- 鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｰ繝ｻ・ｨ鬯ｲ謇假ｽｽ・ｴ繝ｻ縺､ﾂ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｧ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｦ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｳ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｭ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｼ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ隰・ｹ昴・髫ｶ螟ｲ・ｽ・ｨ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｮ鬯ｮ・ｮ闕ｵ譏ｴ繝ｻ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｯ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｡鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ---
    const runDownload = async (rootHandle) => {
        try {
            actionBtn.style.display = 'none';

            const folderHandle = await rootHandle.getDirectoryHandle(folderName, { create: true });
            folderDisplay.textContent = `\u4fdd\u5b58\u5148: ${rootHandle.name} / ${folderName}`;

            for (let i = 0; i < topUrls.length; i++) {
                statusDiv.innerText = `\u753b\u50cf\u3092\u4fdd\u5b58\u4e2d (${i + 1}/${topUrls.length})...`;
                statusDiv.style.color = "black";
                progressBar.style.width = `${(i / topUrls.length) * 100}%`;

                try {
                    const res = await fetch(topUrls[i], { credentials: 'omit' });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const blob = await res.blob();

                    const mime = blob.type || 'image/jpeg';
                    const ext = mime.includes('png') ? 'png'
                              : mime.includes('webp') ? 'webp'
                              : mime.includes('gif') ? 'gif'
                              : 'jpg';

                    const fileName = `${cleanTitle}_${timestamp}_${(i + 1).toString().padStart(2, '0')}.${ext}`;
                    const fileHandle = await folderHandle.getFileHandle(fileName, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                } catch (e) {
                    console.warn(`\u753b\u50cf ${i + 1} \u306e\u4fdd\u5b58\u306b\u5931\u6557`, e);
                }
            }

            progressBar.style.width = '100%';
            statusDiv.innerText = `\u30c0\u30a6\u30f3\u30ed\u30fc\u30c9\u5b8c\u4e86: ${folderName}\n(${topUrls.length}\u679a)`;
            statusDiv.style.color = "green";

            await chrome.storage.local.remove(['downloadUrls', 'sourceTabUrl', 'sourceTabTitle']);
            setTimeout(() => window.close(), 3000);
        } finally {
            await clearHeaderRewriteRule();
        }
    };

    // --- 鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ陟托ｽｱ郢晢ｽｻ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｼ鬮ｫ・ｴ郢晢ｽｻ隰ｳ・ｨ郢晢ｽｻ繝ｻ・ｰ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｫ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｰ繝ｻ・ｨ鬯ｲ謇假ｽｽ・ｴ繝ｻ縺､ﾂ鬯ｯ・ｯ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｩ鬮ｯ蜈ｷ・ｽ・ｹ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｸ鬯ｯ・ｮ繝ｻ・ｫ郢晢ｽｻ繝ｻ・ｰ鬮ｯ讖ｸ・ｽ・｢郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｧ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｭ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｴ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ隰ｫ・ｾ繝ｻ・ｽ繝ｻ・ｴ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬯ｩ謳ｾ・ｽ・ｵ郢晢ｽｻ繝ｻ・ｺ鬮ｯ・ｷ繝ｻ・･郢晢ｽｻ繝ｻ・ｲ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｹ鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｼ ---
    const pickFolder = async () => {
        try {
            const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
            await saveHandle(handle);
            return handle;
        } catch (e) {
            if (e.name !== 'AbortError') throw e;
            return null;
        }
    };

    // --- 鬯ｯ・ｮ繝ｻ・ｫ髣厄ｽｫ繝ｻ・ｶ鬮ｫ・ｱ髦ｮ蜷ｶ繝ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｷ鬯ｯ・ｮ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｷ鬮ｫ・ｶ闕ｳ・ｻ繝ｻ・･郢晢ｽｻ繝ｻ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬮ｴ髮｣・ｽ・｣髯区ｻゑｽｽ・･驛｢譎｢・ｽ・ｻ: 鬯ｯ・ｮ繝ｻ・｣髯ｷ・ｴ郢晢ｽｻ繝ｻ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｫ鬯ｮ・ｫ繝ｻ・ｴ髯ｷ・ｿ鬮｢ﾂ繝ｻ・ｾ陷会ｽｱ郢晢ｽｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｭ鬯ｮ・｣陷ｴ繝ｻ・ｽ・ｽ繝ｻ・ｫ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｶ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｸ鬯ｮ・ｯ陷茨ｽｷ繝ｻ・ｽ繝ｻ・ｹ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蛹・ｽｽ・ｶ髫ｰ・ｫ繝ｻ・ｾ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｩ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ闕ｵ蜉ｱ繝ｻ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｸ鬯ｮ・｣騾搾ｽｲ繝ｻ・ｩ繝ｻ・ｸ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｦ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ陷ｿ髢・ｾ蜉ｱ繝ｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｳ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｨ驛｢譎｢・ｽ・ｻ髯ｷ・ｿ鬮｢ﾂ隴鯉ｽｭ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｸ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｺ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｧ鬯ｯ・ｯ繝ｻ・ｮ郢晢ｽｻ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｾ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｪ鬯ｯ・ｮ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｷ鬮ｯ譎｢・｣・ｰ鬮ｮ諛ｶ・ｽ・｣郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｼ鬮ｫ・ｴ遶擾ｽｫ繝ｻ・ｵ繝ｻ・ｶ鬯ｮ・ｮ繝ｻ・ｷ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｧ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｿ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｼ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ隰ｫ・ｾ繝ｻ・ｽ繝ｻ・ｴ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ---
    let savedHandle = null;
    try { savedHandle = await loadHandle(); } catch (e) {}

    if (savedHandle) {
        folderDisplay.textContent = `\u4fdd\u5b58\u5148: ${savedHandle.name}`;
        statusDiv.innerText = `\u753b\u50cf ${topUrls.length} \u679a\u3092\u4fdd\u5b58\u3057\u307e\u3059...`;
        await runDownload(savedHandle);
    } else {
        // 鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ陟托ｽｱ郢晢ｽｻ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｼ鬮ｫ・ｴ郢晢ｽｻ隰ｳ・ｨ郢晢ｽｻ繝ｻ・ｰ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｼ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｫ鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢鬮ｫ・ｴ陝・ｅ繝ｻ驛｢譎｢・ｽ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｣鬯ｯ・ｩ陝ｷ・｢繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｧ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｯ: popup 鬯ｯ・ｩ隰ｳ・ｾ繝ｻ・ｽ繝ｻ・ｵ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｺ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｧ鬯ｯ・ｯ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｩ鬮ｯ蜈ｷ・ｽ・ｹ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｸ鬯ｯ・ｮ繝ｻ・ｫ郢晢ｽｻ繝ｻ・ｰ鬮ｯ讖ｸ・ｽ・｢郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｧ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｭ鬯ｩ謳ｾ・ｽ・ｵ郢晢ｽｻ繝ｻ・ｲ鬮ｯ諛ｶ・ｽ・｣郢晢ｽｻ繝ｻ・､驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｸ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｺ鬯ｯ・ｯ繝ｻ・ｮ郢晢ｽｻ繝ｻ・ｦ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｪ鬯ｩ蛹・ｽｽ・ｶ髣費ｽｨ遶丞｣ｹ繝ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｸ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｺ鬯ｮ・｣陋ｹ繝ｻ・ｽ・ｽ繝ｻ・ｵ鬮ｫ・ｴ隰ｫ・ｾ繝ｻ・ｽ繝ｻ・ｶ鬮ｯ讓奇ｽｻ繧托ｽｽ・ｽ繝ｻ・｢鬯ｯ・ｩ隰ｳ・ｾ繝ｻ・ｽ繝ｻ・ｵ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｺ鬯ｮ・ｮ闕ｵ譏ｴ繝ｻ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｷ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｰ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｴ鬯ｯ・ｮ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｷ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｷ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ
        statusDiv.innerText = `\u4fdd\u5b58\u5148\u30d5\u30a9\u30eb\u30c0\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044`;
        actionBtn.style.display = 'inline-block';
        actionBtn.addEventListener('click', async () => {
            actionBtn.disabled = true;
            const handle = await pickFolder();
            if (handle) {
                folderDisplay.textContent = `\u4fdd\u5b58\u5148: ${handle.name}`;
                await runDownload(handle);
            } else {
                actionBtn.disabled = false;
            }
        });
    }
});


