/*
  Video Maximizer

 Copyright (c) 2023. trophygeek@gmail.com
 www.videomaximizer.com

  Removes the clutter. Maximizes videos to view in full-page theater mode on most sites.

  Creative Commons Share Alike 4.0
  To view a copy of this license, visit https://creativecommons.org/licenses/by-sa/4.0/


 */

export const injectGetPlaypackSpeed = (): string => {
  try {
    // we stash the current injected speed in the body as an attr.
    const attrValue = document?.body?.getAttribute(
        "data-videomax-playbackspeed"
    );
    if (attrValue?.length) {
      return attrValue;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    const isRunningInIFrame = window !== window?.parent;
    console.warn(
        `VideoMaxExt injectGetPlaypackSpeed (${
            isRunningInIFrame ? "IFRAME" : "MAIN"
        }): err`,
        err
    );
  }
  return "1.0";
};
