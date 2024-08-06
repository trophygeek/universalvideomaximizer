/*
  Video Maximizer

 Copyright (c) 2023. trophygeek@gmail.com
 www.videomaximizer.com

  Removes the clutter. Maximizes videos to view in full-page theater mode on most sites.

  Creative Commons Share Alike 4.0
  To view a copy of this license, visit https://creativecommons.org/licenses/by-sa/4.0/


 */

export function injectCssHeader(cssHRef: string, styleId: string): boolean {
  const MIN_IFRAME_WIDTH = 320;
  const MIN_IFRAME_HEIGHT = 240;

  try {
    if (document.getElementById(styleId)) {
      // eslint-disable-next-line no-console
      // console.log(`VideoMax Native Inject. Style header already injected "${styleId}"`);
      return true;
    }
    if (window.innerWidth < MIN_IFRAME_WIDTH || window.innerHeight < MIN_IFRAME_HEIGHT) {
      // eslint-disable-next-line no-console
      // console.log(`VideoMax Native Inject. Style header already injected "${styleId}"`);
      return true;
    }
    const styleLink = document.createElement("link");
    styleLink.id = styleId;
    styleLink.href = cssHRef;
    styleLink.type = "text/css";
    styleLink.rel = "stylesheet";
    styleLink.media = "all";
    document.getElementsByTagName("head")[0]?.appendChild(styleLink);
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `
      ****** VideoMax ERROR Native Inject
      Injecting style header failed. CSP?
      ******`,
      err,
    );
    return false;
  }
}
