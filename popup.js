document.getElementById('dlBtn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('status');
  statusDiv.innerText = "画像を抽出中...";

  try {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // --- 【超重要】サーバーの画像の直リンク防止（Refererチェック）を騙すための強力なルール ---
    // これにより、Chrome拡張機能から直接アクセスしても、通常のサイト閲覧時と同じようにサーバーに認識させます
    if (chrome.declarativeNetRequest) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1],
        addRules: [{
          id: 1,
          priority: 1,
          action: {
            type: "modifyHeaders",
            requestHeaders: [
              { header: "referer", operation: "set", value: new URL(tab.url).origin + "/" },
              { header: "origin", operation: "set", value: new URL(tab.url).origin }
            ]
          },
          condition: {
            urlFilter: "*",
            resourceTypes: ["xmlhttprequest"] // fetch等で取得の時のみ
          }
        }]
      });
    }

    let injectionResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractImages
    });

    if (!injectionResults || !injectionResults[0]) {
      statusDiv.innerText = "エラー: ページを読み込めません";
      return;
    }

    const topUrls = injectionResults[0].result;
    if (!topUrls || topUrls.length === 0) {
      statusDiv.innerText = "保存できる大きな画像が見つかりません";
      return;
    }

    statusDiv.innerText = `画像を抽出しました。別タブでダウンロードを開始します...`;

    // 抽出したURLと元タブのURL/タイトルをストレージに保存し、進捗ウィンドウを開く
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
    statusDiv.innerText = "エラーが発生しました";
    console.error(error);
  }
});

// ------------------------------------------------------------------
// ページ内部に注入されて実行される関数（URLとサイズの抽出のみ行う）
// ------------------------------------------------------------------
function extractImages() {
  let imgElements = Array.from(document.querySelectorAll('img'));
  let validUrls = new Map(); // src -> area （重複排除）

  // 通常のimgタグを検索
  for (let img of imgElements) {
    let src = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original');

    // pictureタグ内にある場合、sourceのsrcsetを優先
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

    // img自身のsrcsetをチェック
    if (!src && img.srcset) {
      let srcsetUrls = img.srcset.split(',').map(s => s.trim().split(' ')[0]).filter(s => s && !s.startsWith('data:'));
      if (srcsetUrls.length > 0) src = srcsetUrls[srcsetUrls.length - 1];
    }

    // まだ見つからなければsrcを使う
    if (!src) src = img.getAttribute('src') || img.src;
    if (!src || src.startsWith('data:')) continue; // 既に文字データのものは除外

    // 相対URLを絶対URLに変換
    let a = document.createElement('a');
    a.href = src;
    src = a.href;

    if (src.startsWith('http')) {
      // サイズを取得（html/cssの実数値を優先）
      let width = img.naturalWidth || img.clientWidth || parseInt(img.getAttribute('width')) || 0;
      let height = img.naturalHeight || img.clientHeight || parseInt(img.getAttribute('height')) || 0;

      // 遅延読み込みの属性がついているかをチェック
      let isLazy = img.hasAttribute('data-src') || img.hasAttribute('data-lazy-src') || img.hasAttribute('data-original');

      // 小さい画像 (800px未満) を完全に除外する
      // （※「見えないけどLazyLoadの画像（width=0）」は本命の巨大写真の可能性が高いので特別に救済する）
      if (width >= 800 || height >= 800 || (isLazy && width === 0)) {
        let area = (width && height) ? (width * height) : (isLazy ? 1000000 : 0);
        if (area > 0) {
          if (!validUrls.has(src) || validUrls.get(src) < area) {
            validUrls.set(src, area);
          }
        }
      }
    }
  }

  // 背景画像を検索 (div等に設定されている場合)
  let allElements = Array.from(document.querySelectorAll('*'));
  for (let el of allElements) {
    let bg = window.getComputedStyle(el).backgroundImage;
    if (bg && bg !== 'none' && bg.startsWith('url(')) {
      let src = bg.slice(4, -1).replace(/["']/g, ''); // url("...") の中身を取り出す
      if (!src || src.startsWith('data:')) continue;

      let a = document.createElement('a');
      a.href = src;
      src = a.href;

      if (src.startsWith('http')) {
        let width = el.clientWidth || 0;
        let height = el.clientHeight || 0;
        // 小さい背景画像 (800px未満) を完全に除外
        if (width >= 800 || height >= 800) {
          let area = width * height;
          if (!validUrls.has(src) || validUrls.get(src) < area) {
            validUrls.set(src, area);
          }
        }
      }
    }
  }

  // 面積が大きい順（メイン画像順）に並び替え、上位15枚のURLだけを返す
  let sortedUrls = Array.from(validUrls.entries()).sort((a, b) => b[1] - a[1]);
  return sortedUrls.slice(0, 15).map(v => v[0]);
}
