try { // scope and prevent errors from leaking out to page.
  const DEBUG_ENABLED = true;
  const ERR_BREAK_ENABLED = true;
  const BADGE_TEXT = '←  →';
  const REFRESH_TEXT = '⟳';
  const WARNING_TEXT = '⚠';
  // todo: move to localize
  const REFRESH_NEEDED_TEXT = 'Permissions check complete. Try again.';
  const SECURITY_CHECK_FAILED = 'Permission denied by user';
  const NOT_HTTPS_URL = 'Extension only works on https sites';

  const logerr = (...args) => {
    if (DEBUG_ENABLED === false) {
      return;
    }
    // eslint-disable-next-line no-console
    console.trace(
      '%c VideoMax ',
      'color: white; font-weight: bold; background-color: red',
      ...args,
    );
    if (ERR_BREAK_ENABLED) {
      // eslint-disable-next-line no-debugger
      debugger;
    }
  };

  // https://developer.chrome.com/blog/crx-scripting-api/

  /**
   *
   * @param newspeed
   */
  function injectVideoSpeedAdjust(newspeed) {
    const allVideoElems = document.querySelectorAll('video');
    for (const eachVideo of allVideoElems) {
      try {
        eachVideo.playbackRate = newspeed;
      } catch (err) {
        logerr('VideoMax', err);
      }
    }
  }

  chrome.action.onClicked.addListener(async (tab) => {
    const tabId = tab.id;
    chrome.permissions.request(
      { permissions: ['activeTab', 'scripting'] },
      async (granted) => {
        if (!granted) {
          await chrome.action.setBadgeText({ tabId, text: WARNING_TEXT });
          await chrome.action.setTitle({ tabId, title: SECURITY_CHECK_FAILED });
          logerr(
            'permissions to run were denied, so extension is not injecting',
          );
          return;
        }

        // tab?.url could be null, so we need to query to get the current tab
        if (!tab?.url) {
          // now we have to go back and get the url since it wasn't passed to us
          // simple thing is to ask the user to click the button again.
          await chrome.action.browserAction.setBadgeText({ tabId, text: REFRESH_TEXT });
          await chrome.action.setTitle({ tabId, title: REFRESH_NEEDED_TEXT });
          logerr('Need refresh to run');
          return;
        }

        if (!(tab?.url?.startsWith('https://')
              || tab?.url?.startsWith('http://'))) {
          // do not run on chrome: or about: urls.
          await chrome.action.setBadgeText({ tabId, text: WARNING_TEXT });
          await chrome.action.setTitle({ tabId, title: NOT_HTTPS_URL });
          return;
        }

        // instead of saving/restoring state we just use the badge icon
        // to save if we are running on this tab or not.
        const tabText = await chrome.action.getBadgeText({ tabId });
        if (tabText !== BADGE_TEXT) {
          // zoom
          await chrome.action.setBadgeText({ tabId, text: BADGE_TEXT });
          await chrome.scripting.insertCSS(
            {
              files: ['inject.css'],
              origin: 'USER',
              target: { tabId, frameIds: [0] },
            },
          );
          await chrome.scripting.executeScript({
            target: {
              tabId, frameIds: [0],
            },
            files: ['inject.js'],
          });
          return;
        }

        // unzoom
        await chrome.action.setBadgeText({ tabId, text: '' }); // remove
        // await chrome.scripting.removeCSS({tabId, files: ['inject.css']});
        await chrome.scripting.executeScript({
          target: {
            tabId,
            frameIds: [0],
          },
          files: ['inject_undo.js'],
        });
      },
    );
  });

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (tabId && changeInfo?.status === 'loading') {
      await chrome.action.setBadgeText({ tabId, text: '' }); // remove on any
      // nav
    }
  });
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('videomax extension error', err, err.stack);
}
