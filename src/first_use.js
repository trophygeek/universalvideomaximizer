import { getSettings, saveSettings } from "./common.js";

try {
  /**
   * @param newUseAdvancedFeatures {boolean}
   * @return {void}
   */
  const setUseAdvancedFeatures = (newUseAdvancedFeatures) => {
    setTimeout(async () => {
      const url    = new URL(document.location.href);
      const params = new URLSearchParams(url.hash.replace("#", ""));
      const tabId  = params.get("tabId");
      const speed  = params.get("speed");
      const domain = params.get("domain"); // needed because Netflix errs on skip
      const badge  = params.get("badge");

      const settings               = await getSettings();
      settings.useAdvancedFeatures = newUseAdvancedFeatures;
      settings.firstUseShown       = true;
      await saveSettings(settings);
      // we need this to remove the popup="first_use.js" or it's set and locked in.
      chrome.runtime.sendMessage({
        message: {
          cmd: "FIRST_USE_SET",
          tabId,
          domain,
          speed,
        },
      }, (_response) => {
        if (!newUseAdvancedFeatures) {
          chrome.runtime.sendMessage({
            message: {
              cmd: "UNZOOM_CMD",
              tabId,
              domain,
              speed,
            },
          }, () => {
            window.close();
          });
        } else {
          document.getElementById("intro").classList.add("is-hidden");
          document.getElementById("tutorial").classList.remove("is-hidden");
          document.getElementById("tryitframe").src = `popup.html#tabId=${tabId}&speed=${speed}&domain=${domain}&badge=${badge}`;
        }
      }); // FIRST_USE_SET
    }, 0);// timeout
  };
  document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("useSimpleFeatures")
      .addEventListener("click", (_evt) => {
        setUseAdvancedFeatures(false);
      });

    document.getElementById("useAdvancedFeatures")
      .addEventListener("click", async (_evt) => {
        setUseAdvancedFeatures(true);
      });

    document.getElementById("done")
      .addEventListener("click", async (_evt) => {
        window.close();
      });
  });
} catch (e) {
  console.error(e);
}
