const HEADER_RULE_ID = 1;

async function clearHeaderRewriteRule() {
  if (!chrome.declarativeNetRequest) return;

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [HEADER_RULE_ID]
    });
  } catch (error) {
    console.warn('Failed to clear stale header rewrite rule.', error);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  clearHeaderRewriteRule();
});

chrome.runtime.onStartup.addListener(() => {
  clearHeaderRewriteRule();
});
