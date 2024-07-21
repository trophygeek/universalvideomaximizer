/*
  Video Maximizer

 Copyright (c) 2024. trophygeek@gmail.com
 www.videomaximizer.com

  Removes the clutter. Maximizes videos to view in full-page theater mode on most sites.

  Creative Commons Share Alike 4.0
  To view a copy of this license, visit https://creativecommons.org/licenses/by-sa/4.0/


 */
export function injectGetVideoZoomed(): boolean {
  try {
    // @ts-ignore
    if (!!window?._VideoMaxExtEscapeUnzoom) {
      return false;
    }
    // @ts-ignore
    return (!!window?._VideoMaxExt || !!document._VideomaxExt)
  } catch (e) {
    return false;
  }
}
