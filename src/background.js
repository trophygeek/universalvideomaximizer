const DEBUG_ENABLED = false;
const ERR_BREAK_ENABLED = false;
// feature flags
const FEATURE_SHOW_SPEED_POPUP = true;

const UNZOOM_CMD = 'UNZOOM';
const SET_SPEED_CMD = 'SET_SPEED';
const GET_SPEED_CMD = 'GET_SPEED';
const VAL_SPEED_RESPONSE = 'SPEED';

const DEAULT_SPEED = '1.0';
const MAX_AGE_TICKS = (12 * 60 * 60 * 1000);
const SPEED_DATA_KEY = 'SPEED_DATA_KEY';

const CSS_FILE = 'inject.css';
const STYLE_ID = 'maximizier-css-inject';

const BADGE_TEXT = '←  →';
const REFRESH_TEXT = '⟳';
const WARNING_TEXT = '⚠';

// todo: move to localize
const REFRESH_NEEDED_TEXT = 'Permissions check complete. Try again.';
const SECURITY_CHECK_FAILED = 'Permission denied by user';
const NOT_HTTPS_URL = 'Extension only works on https sites';
// todo: display these
const ZOOMED = 'Video Maximized: click to change speed or undo';
const UNZOOMED = 'Click to maximize video'
// todo: ads can reset speed. detect video playing via url and reset speed when it changes?

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
    vidElem.defaultPlaybackRate = speadNumber;
    vidElem.playbackRate = speadNumber;
    window._VideoMaxExt.playbackSpeed = speadNumber;
  }

  // fallback.
  for (const eachVideo of document.querySelectorAll('video')) {
    eachVideo.defaultPlaybackRate = speadNumber;
    eachVideo.playbackRate = speadNumber;
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


let globalDataLoaded = false;
let globalData = {};

async function loadGlobalsIfNeeded(){
  if (globalDataLoaded) {
    return;
  }
  const result = await chrome?.storage?.local?.get(SPEED_DATA_KEY) || {};
  globalData = {...result[SPEED_DATA_KEY]} || {};
  globalDataLoaded = true;
}

async function saveGlobals() {
  const dataOut = {};
  const now = new Date().getTime();
  // remove outdated entries so they don't grow forever
  for (const [key, value] of Object.entries(globalData)) {
    if (value.speed !== DEAULT_SPEED && ((now - value?.timestamp) < MAX_AGE_TICKS)) {
      dataOut[key] = value.speed; // keep entry, update value.
    }
  }

  // save it out
  await chrome?.storage?.local?.set({SPEED_DATA_KEY: dataOut});
  globalData = dataOut;
}

async function setTabSpeed(tabId, speed) {
  const timestamp = new Date().getTime();
  globalData[tabId] = { timestamp, speed }
  await saveGlobals();
}

function getTabSpeed(tabId) {
  return globalData[tabId] || DEAULT_SPEED;
}

chrome?.action?.onClicked.addListener(async (tab) => {
  const tabId = tab.id;
  chrome.permissions.request(
    { permissions: ['activeTab', 'scripting', 'storage'] },
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
    const tabId = parseFloat(request?.message?.tabId || '0');
    if (!tabId) {
      logerr('something wrong with message', request);
      return;
    }

    if (sendResponse && cmd === GET_SPEED_CMD) {
      const currentSpeed = getTabSpeed(tabId);
      sendResponse({
        cmd: VAL_SPEED_RESPONSE,
        speed: currentSpeed,
      });  // closes the popup to avoid chrome cpu bug.
      return;
    }
    if (sendResponse && cmd === UNZOOM_CMD) {
      sendResponse({});  // closes the popup to avoid chrome cpu bug.
    }

    const speed = (cmd === SET_SPEED_CMD) ? request?.message?.value : DEAULT_SPEED;
    // forced to save because the extension can be unloaded at any time.
    await setTabSpeed(tabId, speed);

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

chrome.runtime.onStartup.addListener(async (details) => {
  await loadGlobalsIfNeeded();
});

loadGlobalsIfNeeded();

// in theory, it would be nice to save globals on unload, but saving is async and
// unload doesn't like async operations... the extensions api are such a hot mess.
// chrome.runtime.onSuspend.addListener(async (details) => {
//   await saveGlobals();
// });
