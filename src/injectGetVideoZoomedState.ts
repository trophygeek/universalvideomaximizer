/*
  Video Maximizer

 Copyright (c) 2024. trophygeek@gmail.com
 www.videomaximizer.com

  Removes the clutter. Maximizes videos to view in full-page theater mode on most sites.

  Creative Commons Share Alike 4.0
  To view a copy of this license, visit https://creativecommons.org/licenses/by-sa/4.0/


 */
import { isVideoStillInDoc, logerr, VIDEO_MAX_INSTALLED_ATTR } from "./common";

export function injectGetVideoZoomedState(): CheckVideoZoomedState {
  try {
    // @ts-ignore
    if (!!window?._VideoMaxExtEscapeUnzoom) {
      return "UNZOOMED";
    }
    // @ts-ignore
    const videomaxext = window?._VideoMaxExt ?? document._VideomaxExt;
    if (!videomaxext) {
      //  || videomaxext.isMaximized == false || videomaxext.unzooming === true) {
      return "UNZOOMED";
    }

    const attr = document.body.getAttribute(VIDEO_MAX_INSTALLED_ATTR) ?? "";
    const thinksInstalled = attr?.length > 0;
    if (!thinksInstalled) {
      return "UNZOOMED";
    }
    if (isVideoStillInDoc(videomaxext)) {
      return "ZOOMED";
    }
    return "NEEDS_REZOOM";
  } catch (e) {
    logerr(e);
    return "UNZOOMED";
  }
}
