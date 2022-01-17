const DEBUG_ENABLED = false;
const ERR_BREAK_ENABLED = false;

const BADGE_TEXT = '←  →';
const REFRESH_TEXT = '⟳';
const WARNING_TEXT = '⚠';
const REFRESH_NEEDED_TEXT = 'Permissions check complete. Try again.';
const SECURITY_CHECK_FAILED = 'Permission denied by user';

const logerr = (...args) => {
  if (DEBUG_ENABLED === false) {
    return;
  }
  console.trace('%c VideoMax ',
      'color: white; font-weight: bold; background-color: blue', ...args);
  if (ERR_BREAK_ENABLED) {
    debugger;
  }
};

/**
 * make async
 * @param permissions {string[]}
 * @return {Promise<boolean>}
 */
function chromePermissionsRequestAsync(permissions) {
  return new Promise(function(resolve, reject) {
    try {
      chrome.permissions.request({permissions},
          function(granted) {
            if (chrome.runtime.lastError) {
              console.trace(chrome.runtime.lastError.message);
              reject(chrome.runtime.lastError.message);
            } else {
              resolve(granted);
            }
          });
    } catch (err) {
      logerr(err);
      reject(err.toString());
    }
  });
}

function getBadgeTextAsync(tabId) {
  return new Promise(function(resolve, reject) {
    chrome.browserAction.getBadgeText({tabId},
        function(result) {
          resolve(result);
        });
  });
}

chrome.browserAction.onClicked.addListener(async (tab) => {
  const tabId = tab.id;
  if (!tab?.url) {
    // until we get permissions, we won't get the tab url
    const granted = await chromePermissionsRequestAsync(['activeTab']);
    if (!granted) {
      await chrome.browserAction.setBadgeText({tabId, text: WARNING_TEXT});
      await chrome.browserAction.setTitle({tabId, title: SECURITY_CHECK_FAILED});
      logerr('permissions to run were denied, so extension is not injecting');
      return;
    }

    // now we have to go back and get the url since it wasn't passed to us
    // simple thing is to ask the user to click the button again.
    await chrome.browserAction.setBadgeText({tabId, text: REFRESH_TEXT});
    await chrome.browserAction.setTitle({tabId, title: REFRESH_NEEDED_TEXT});
    logerr('Need refresh to run');
    return;
  } else {
    if (!(tab?.url?.startsWith('https://') || tab?.url?.startsWith('http://'))) {
      // do not run on chrome: or about: urls.
      return;
    }
  }

  const tabText = await getBadgeTextAsync(tabId);
  if (tabText !== BADGE_TEXT) {
    // zoom
    await chrome.browserAction.setBadgeText({tabId, text: BADGE_TEXT});
    await chrome.tabs.executeScript(tabId, {
      'file': 'inject.js',
      'runAt': 'document_idle',
      frameId: 0,
    });
    return;
  }

  // unzoom
  await chrome.browserAction.setBadgeText({tabId});  // remove
  await chrome.tabs.executeScript(tabId, {
    'file': 'inject_undo.js',
    'runAt': 'document_idle',
    frameId: 0,
  });
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (tabId && changeInfo?.status === 'loading') {
    await chrome.browserAction.setBadgeText({tabId});  // remove on any nav
  }
});
