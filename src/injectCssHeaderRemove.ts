/**
 * Remove the style element from the header
 */
export function injectCssHeaderRemove (styleId: string) {
  // warning run inside context of page
  try {
    const cssHeaderNode = document.getElementById(styleId);
    cssHeaderNode?.parentNode?.removeChild(cssHeaderNode);
  } catch (_err) {}
}
