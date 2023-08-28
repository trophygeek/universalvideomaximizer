import { getSettings, logerr, saveSettings } from "./common.js";

try {
  const url = new URL(document.location.href);
  const params = new URLSearchParams(url.hash.replace("#", ""));
  const tabId = params.get("tabId");
  const speed = params.get("speed");
  const domain = params.get("domain"); // needed because Netflix errs on skip
  const badge = params.get("badge");

  const showTutorial = () => {
    document.getElementById("intro")
      .classList
      .add("is-hidden");
    document.getElementById("tutorial")
      .classList
      .remove("is-hidden");
    document.getElementById(
      "tryitframe").src = `popup.html#tabId=${tabId}&speed=${speed}&domain=${domain}&badge=${badge}`;
  };

  const updateCurrentTabState = async () => {
    return chrome.runtime.sendMessage({
                                        message: {
                                          cmd: "FIRST_USE_REFRESH_POPUP_URL_CMD",
                                          tabId,
                                          domain,
                                          speed,
                                        },
                                      }, (_response) => {
      window.setTimeout(() => window.close(), 50);
    });
  };

  const unzoom = async () => {
    return chrome.runtime.sendMessage({
                                        message: {
                                          cmd: "UNZOOM_CMD",
                                          tabId,
                                          domain,
                                          speed,
                                        },
                                      }, () => {
    });
  };

  /**
   *
   * @param newUseAdvancedFeatures {boolean}
   * @param firstUseShown {boolean}
   * @param firstUseOn2ndScreen {boolean}
   * @return {Promise<void>}
   */
  const updateSettings = async (newUseAdvancedFeatures, firstUseShown, firstUseOn2ndScreen) => {
    const settings = await getSettings();
    settings.useAdvancedFeatures = newUseAdvancedFeatures;
    settings.firstUseShown = firstUseShown;
    settings.firstUseOn2ndScreen = firstUseOn2ndScreen;
    return saveSettings(settings);
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const settings = await getSettings();
    // this is if user is trying out the feature but hasn't finally decided
    if (settings.firstUseOn2ndScreen) {
      await showTutorial();
    }
    document.getElementById("useSimpleFeatures")
      .addEventListener("click", async (_evt) => {
        await unzoom();
        await updateSettings(false, true, false);
        await updateCurrentTabState(true);
      });

    document.getElementById("useSimpleFeatures2")
      .addEventListener("click", async (_evt) => {
        await unzoom();
        await updateSettings(false, true, true);
        await updateCurrentTabState(true);
      });

    document.getElementById("tryAdvancedFeatures")
      .addEventListener("click", async (_evt) => {
        await showTutorial();
        await updateSettings(true, false, true);
      });

    document.getElementById("useAdvancedFeatures")
      .addEventListener("click", async (_evt) => {
        await updateSettings(true, true, true);
        // we now need to change the popup url so it shows the regular popup
        await updateCurrentTabState();
      });
  });
} catch (e) {
  logerr(e);
}
