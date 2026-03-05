document.addEventListener('DOMContentLoaded', async () => {
    const statusDiv = document.getElementById('status');
    const progressBar = document.getElementById('progress-bar');

    try {
        const data = await chrome.storage.local.get(['downloadUrls', 'sourceTabUrl']);
        const topUrls = data.downloadUrls;

        if (!topUrls || topUrls.length === 0) {
            statusDiv.innerText = "エラー: ダウンロードする画像が見つかりません。";
            return;
        }

        statusDiv.innerText = `画像${topUrls.length}枚を変換・ダウンロード中...`;

        const convertToWebPAndDownload = async (url, index) => {
            let objectUrl = null;

            try {
                let res = await fetch(url, { credentials: 'omit' });
                if (!res.ok) throw new Error("HTTP error: " + res.status);
                let blob = await res.blob();
                objectUrl = URL.createObjectURL(blob);
            } catch (fetchError) {
                console.log("Fetch failed for " + url, fetchError);
            }

            try {
                await new Promise((resolve) => {
                    let img = new Image();
                    img.onload = () => {
                        try {
                            let canvas = document.createElement('canvas');
                            canvas.width = img.width;
                            canvas.height = img.height;
                            let ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0);

                            let webpUrl = canvas.toDataURL('image/webp', 0.9);

                            const timestamp = new Date().getTime();
                            const filename = `Archi_${timestamp}_${index + 1}.webp`;

                            chrome.downloads.download({
                                url: webpUrl,
                                filename: filename,
                                saveAs: false
                            }, () => resolve());
                        } catch (canvasError) {
                            console.error("Canvas error", canvasError);
                            resolve();
                        }
                    };
                    img.onerror = () => {
                        console.error("Image decoding failed for", url);
                        resolve();
                    };

                    if (objectUrl) {
                        img.src = objectUrl;
                    } else {
                        resolve();
                    }
                });
            } catch (e) {
                console.error("WebP conversion / Download failed for: ", url, e);
            } finally {
                if (objectUrl) URL.revokeObjectURL(objectUrl);
            }
        };

        for (let i = 0; i < topUrls.length; i++) {
            statusDiv.innerText = `画像 ${i + 1}/${topUrls.length} 枚を処理中...`;
            progressBar.style.width = `${((i) / topUrls.length) * 100}%`;
            await convertToWebPAndDownload(topUrls[i], i);
        }

        progressBar.style.width = `100%`;
        statusDiv.innerText = `✅ ダウンロード完了！(${topUrls.length}枚)\nこのタブは閉じて構いません。`;
        statusDiv.style.color = "green";

        await chrome.storage.local.remove(['downloadUrls', 'sourceTabUrl']);

    } catch (error) {
        statusDiv.innerText = "エラーが発生しました";
        console.error(error);
    }
});
