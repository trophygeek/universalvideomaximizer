try { // scope and prevent errors from leaking out to page.
  const DEBUG_ENABLED = false;
  const ERR_BREAK_ENABLED = false;
  // feature flags
  const FEATURE_SHOW_SPEED_POPUP = true;

  const UNZOOM_CMD = 'UNZOOM';
  const SPEED_CMD = 'SPEED';

  const CSS_FILE = 'inject.css';
  const STYLE_ID = 'maximizier-css-inject';

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

  /**
   *
   * @param newspeed {number}
   */
  function injectVideoSpeedAdjust(newspeed) {
    // warning run inside context of page
    for (const eachVideo of document.querySelectorAll('video')) {
      eachVideo.playbackRate = newspeed;
    }
  }


  function injectCssHeader(cssHRef, styleId) {
    // warning run inside context of page
    try {
      if (document.getElementById(styleId)) {
        return;
      }

      let link = document.createElement('link');
      link.href = cssHRef;
      link.id = styleId;
      link.type = 'text/css';
      link.rel = 'stylesheet';
      link.media = 'all';
      document.getElementsByTagName('head')[0].appendChild(link);
    } catch(e) {
      console.trace(e);
    }
  }

  function uninjectCssHeader(styleId) {
    // warning run inside context of page
    const cssHeaderNode = document.getElementById(styleId);
    cssHeaderNode?.parentNode?.removeChild(cssHeaderNode);
  }


  /**
   *
   * @param tabId {string}
   * @return {Promise<void>}
   */
  async function resetUI(tabId) {
    await chrome?.action?.setBadgeText({
      tabId: tabId,
      text: '',
    }); // remove
    await chrome?.action?.setPopup({
      tabId: tabId,
      popup: '',
    }); // clear
  }

  async function DoInjectCSS(tabId) {
    const cssFilePath = chrome?.runtime?.getURL(CSS_FILE);
    // we inject this way because we can undo it by deleting the element.
    await chrome?.scripting?.executeScript({
      target: {
        tabId,
        frameIds: [0],
      },
      func: injectCssHeader,
      args: [cssFilePath, STYLE_ID],
      world: 'MAIN',
    });
  }

  async function UndoInjectCSS(tabId) {
    try {
      await chrome?.scripting?.executeScript({
        target: {
          tabId,
          frameIds: [0],
        },
        func: uninjectCssHeader,
        args: [STYLE_ID],
        world: 'MAIN',
      });
    } catch(e) {
      logerr(e);
    }
  }


  /**
   *
   * @param tabId {string}
   * @return {Promise<void>}
   */
  async function unZoom(tabId) {
    await resetUI(tabId);
    await UndoInjectCSS(tabId);
    await chrome?.scripting?.executeScript({
      target: {
        tabId: tabId,
        frameIds: [0],
      },
      files: ['inject_undo.js'],
    });
  }


  chrome?.action?.onClicked.addListener(async (tab) => {
    const tabId = tab.id;
    chrome.permissions.request(
      { permissions: ['activeTab', 'scripting'] },
      async (granted) => {
        if (!granted) {
          await chrome?.action?.setBadgeText({
            tabId,
            text: WARNING_TEXT,
          });
          await chrome?.action?.setTitle({
            tabId,
            title: SECURITY_CHECK_FAILED,
          });
          logerr(
            'permissions to run were denied, so extension is not injecting',
          );
          return;
        }

        // tab?.url could be null, so we need to query to get the current tab
        if (!tab?.url) {
          // now we have to go back and get the url since it wasn't passed to us
          // simple thing is to ask the user to click the button again.
          await chrome?.action?.setBadgeText({
            tabId,
            text: REFRESH_TEXT,
          });
          await chrome?.action?.setTitle({
            tabId,
            title: REFRESH_NEEDED_TEXT,
          });
          logerr('Need refresh to run');
          return;
        }

        if (!(tab?.url?.startsWith('https://')
              || tab?.url?.startsWith('http://'))) {
          // do not run on chrome: or about: urls.
          await chrome?.action?.setBadgeText({
            tabId,
            text: WARNING_TEXT,
          });
          await chrome?.action?.setTitle({
            tabId,
            title: NOT_HTTPS_URL,
          });
          return;
        }

        // instead of saving/restoring state we just use the badge icon
        // to save if we are running on this tab or not.
        const tabText = await chrome?.action?.getBadgeText({ tabId });
        if (tabText !== BADGE_TEXT) {
          // zoom
          await chrome?.action?.setBadgeText({
            tabId,
            text: BADGE_TEXT,
          });
          await chrome?.scripting?.executeScript({
            target: {
              tabId,
              frameIds: [0],
            },
            files: ['inject.js'],
          });
          await DoInjectCSS(tabId);
          if (FEATURE_SHOW_SPEED_POPUP) {
            await chrome?.action?.setPopup({
              tabId,
              popup: `popup.html#tabId=${tabId}`,
            });
          }
          return;
        }

        if (!FEATURE_SHOW_SPEED_POPUP) {
          await unZoom(tabId);
        }
      },
    );
  });

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (tabId && changeInfo?.status === 'loading') {
      await resetUI(tabId);
    }
  });

  // handle popup messages
  chrome.runtime.onMessage.addListener(async (message, sender) => {
      const speed = message?.message?.value || 1.0;
      const tabId = parseFloat(message?.message?.tabId || '0');
      const cmd = message?.message?.cmd || '';
      if (!tabId) {
        logerr('something wrong with message', message);
        return;
      }

      if (cmd === UNZOOM_CMD) {
        await unZoom(tabId);
        return;
      }

      await chrome?.scripting?.executeScript({
        target: {
          tabId,
          allFrames: true,
        },
        func: injectVideoSpeedAdjust,
        args: [speed],
      });
    },
  );
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('videomax extension error', err, err.stack);
}
