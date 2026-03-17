const CONTEXT_MENU_ID = 'edge-spaces-placeholder';

async function openSidePanel(tab?: chrome.tabs.Tab): Promise<void> {
  const windowId = tab?.windowId;

  if (windowId === undefined) {
    return;
  }

  await chrome.sidePanel.open({ windowId });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('Edge Spaces service worker started');

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: 'Edge Spaces',
      contexts: ['action'],
    });
  });
});

chrome.action.onClicked.addListener((tab) => {
  void openSidePanel(tab);
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'focus_search') {
    void chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(async ([activeTab]) => {
      await openSidePanel(activeTab);
      await new Promise((resolve) => setTimeout(resolve, 120));
      await chrome.runtime.sendMessage({ type: 'FOCUS_SEARCH' }).catch(() => undefined);
    });
  }
});

void chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: unknown) => {
    console.warn('Unable to set side panel behavior', error);
  });