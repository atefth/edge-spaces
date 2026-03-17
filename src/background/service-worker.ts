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
    console.debug('Focus search command registered');
  }
});

void chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: unknown) => {
    console.warn('Unable to set side panel behavior', error);
  });