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
                                          cmd: "FIRST_USE_SET", // setCurrentTabState(tabId, "",
                                                                // domain);
                                          tabId,
                                          domain,
                                          speed,
                                        },
                                      }, (_response) => {
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
   * @param firstUseShowTutorial {boolean}
   * @return {Promise<void>}
   */
  const updateSettings = async (newUseAdvancedFeatures, firstUseShown, firstUseShowTutorial) => {
    const settings = await getSettings();
    settings.useAdvancedFeatures = newUseAdvancedFeatures;
    settings.firstUseShown = firstUseShown;
    settings.firstUseShowTutorial = firstUseShowTutorial;
    return saveSettings(settings);
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const settings = await getSettings();
    document.getElementById("useSimpleFeatures")
      .addEventListener("click", async (_evt) => {
        await unzoom();
        await updateSettings(false, true, false);
        window.close();
      });

    document.getElementById("useSimpleFeatures2")
      .addEventListener("click", async (_evt) => {
        await unzoom();
        await updateSettings(false, true, false);
        window.close();
      });

    document.getElementById("tryAdvancedFeatures")
      .addEventListener("click", async (_evt) => {
        await showTutorial();
        await updateCurrentTabState();
        await updateSettings(false, true, true);
      });

    document.getElementById("useAdvancedFeatures")
      .addEventListener("click", async (_evt) => {
        await updateSettings(true, true, false);
        window.close();
      });

    // this is if user is trying out the feature but hasn't finally decided
    if (settings.firstUseShowTutorial) {
      await showTutorial();
    }
  });
} catch (e) {
  logerr(e);
}
