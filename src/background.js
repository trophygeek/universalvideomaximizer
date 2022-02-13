const DEBUG_ENABLED = false;
const ERR_BREAK_ENABLED = false;
// feature flags
const FEATURE_SHOW_SPEED_POPUP = true;

const UNZOOM_CMD = 'UNZOOM';
const SET_SPEED_CMD = 'SET_SPEED';
const GET_SPEED_CMD = 'GET_SPEED';
const VAL_SPEED_RESPONSE = 'SPEED';

const DEAULT_SPEED = "1.0";

const CSS_FILE = 'inject.css';
const STYLE_ID = 'maximizier-css-inject';

const BADGE_TEXT = '←  →';
const REFRESH_TEXT = '⟳';
const WARNING_TEXT = '⚠';
// todo: move to localize
const REFRESH_NEEDED_TEXT = 'Permissions check complete. Try again.';
const SECURITY_CHECK_FAILED = 'Permission denied by user';
const NOT_HTTPS_URL = 'Extension only works on https sites';

// this is ok if it's purged
const globals = {
  speedMapByTab: {},
};

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
 * @param newspeed {string}
 */
function injectVideoSpeedAdjust(newspeed) {
  const speadNumber = parseFloat(newspeed);
  if (window?._VideoMaxExt?.matchedVideo) {
    const vidElem = window._VideoMaxExt.matchedVideo;
    vidElem.defaultPlaybackRate = newspeed;
    vidElem.playbackRate = newspeed;
    window._VideoMaxExt.playbackSpeed = newspeed;
  }

  // fallback.
  for (const eachVideo of document.querySelectorAll('video')) {
    eachVideo.defaultPlaybackRate = newspeed;
    eachVideo.playbackRate = newspeed;
  }
}


function injectCssHeader(cssHRef, styleId) {
  try {
    if (document.getElementById(styleId)) {
      return;
    }

    let styleLink = document.createElement('link');
    styleLink.id = styleId;
    styleLink.href = cssHRef;
    styleLink.type = 'text/css';
    styleLink.rel = 'stylesheet';
    styleLink.media = 'all';
    document.getElementsByTagName('head')[0].appendChild(styleLink);
  } catch (err) {
    console.error(err);
  }
}

function uninjectCssHeader(styleId) {
  // warning run inside context of page
  const cssHeaderNode = document.getElementById(styleId);
  cssHeaderNode?.parentNode?.removeChild(cssHeaderNode);
}

/**
 *
 * @param tabId {number}
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
      allFrames: true,
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
  } catch (e) {
    logerr(e);
  }
}

/**
 *
 * @param tabId {number}
 * @return {Promise<void>}
 */
async function unZoom(tabId) {
  await resetUI(tabId);
  await UndoInjectCSS(tabId);
  await chrome?.scripting?.executeScript({
    target: {
      tabId: tabId,
      allFrames: true,
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

      // "all frames" feature in v3 manifest doesn't REALLY work.
      // https://bugs.chromium.org/p/chromium/issues/detail?id=826433

      // {
      //   let frames = await chrome?.webNavigation?.getAllFrames({ tabId }) || [];
      //   const getDomain = (url) => (new URL(url)).host;
      //   const tld = getDomain(tab?.url);
      //
      //   filtered = frames.filter(
      //       eachframe => (tld === getDomain(eachframe.url)))
      //     .map(eachframe => eachframe.frameId);
      //
      //   lame_global_test.frameIds = filtered;
      // }

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
            allFrames: true,
          },
          files: ['inject.js'],
        });

        await DoInjectCSS(tabId);

        if (FEATURE_SHOW_SPEED_POPUP) {
          await chrome?.action?.setPopup({
            tabId,
            popup: `popup.html#tabId=${tabId}`,
          });
          return;
        }

        if (!FEATURE_SHOW_SPEED_POPUP) {
          await unZoom(tabId);
        }
      } // tabText !== BADGE_TEXT
    });
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (tabId && changeInfo?.status === 'loading' && changeInfo?.url) {
    const tabText = await chrome?.action?.getBadgeText({ tabId }) || '';
    if (tabText === BADGE_TEXT) {
      // some SPA won't do a clean refetch, we need to uninstall.
      await unZoom(tabId);
    }

    // the changeInfo will include a url if it's a navigation.
    // we don't need to know the url, just that it's changed. Would be nice to have a
    // urlSha256 or something for better privacy.
    // await resetUI(tabId);
  }
});

// handle popup messages
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    const cmd = request?.message?.cmd || '';
    if (sendResponse && cmd === UNZOOM_CMD) {
      sendResponse({});  // closes the popup to avoid chrome cpu bug.
    }
    const tabId = parseFloat(request?.message?.tabId || '0');
    if (!tabId) {
      logerr('something wrong with message', request);
      return;
    }

    if (cmd === GET_SPEED_CMD) {
      const currentSpeed = globals?.speedMapByTab[tabId] || DEAULT_SPEED;
      sendResponse({
        cmd: VAL_SPEED_RESPONSE,
        speed: currentSpeed,
      });  // closes the popup to avoid chrome cpu bug.
      return;
    }

    const speed = (cmd === SET_SPEED_CMD) ? request?.message?.value : DEAULT_SPEED;
    globals.speedMapByTab[tabId] = speed; // save for next time, ok if it's purged.

    // "allFrames" is broken unless manifest requests permissions to EVERYTHING. From 2018
    // see https://bugs.chromium.org/p/chromium/issues/detail?id=826433
    await chrome?.scripting?.executeScript({
      target: {
        tabId,
        allFrames: true,
      },
      func: injectVideoSpeedAdjust,
      args: [speed],
    });

    if (cmd === UNZOOM_CMD) {
      await unZoom(tabId);
    }
  },
);
