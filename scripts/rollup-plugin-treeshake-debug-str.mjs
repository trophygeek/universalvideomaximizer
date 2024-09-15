/*
  Video Maximizer

 Copyright (c) 2024. trophygeek@gmail.com
 www.videomaximizer.com

  Removes the clutter. Maximizes videos to view in full-page theater mode on most sites.

  Creative Commons Share Alike 4.0
  To view a copy of this license, visit https://creativecommons.org/licenses/by-sa/4.0/


  Treeshaking to remove strings for custom logging functions is tricky.

  This plugin replaces a set of function names with (void*) so the rollup
  treeshaking can remove the strings.
 */
// @ts-check
/**
 * @typedef {import('rollup').TransformHook} TransformHook
 */
import MagicString from 'magic-string';

/**
 * @return FunctionPluginHooks
 */
export default function rollupPluginTreeshakeDebugStr () {
  return {
    name: 'rollup-plugin-treeshake-debug-str',
    /** @type {TransformHook} */
    transform(hook, // TransformPluginContext
    code, // string,
    id, // string
    ) {
      debugger;
      const s = new MagicString(code);
      s.replaceAll(
        /\blogerr\(|\blogwarn\(|\blogtrace\(/g, "(void*)("
      );
      return {
        code: s.toString(),
        map: s.generateMap()
      }
    },
  }
};

