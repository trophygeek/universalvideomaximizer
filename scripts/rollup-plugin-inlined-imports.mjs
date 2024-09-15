/*
 Video Maximizer

 Copyright (c) 2024. trophygeek@gmail.com
 www.videomaximizer.com

 Removes the clutter. Maximizes videos to view in full-page theater mode on most sites.

 Creative Commons Share Alike 4.0
 To view a copy of this license, visit https://creativecommons.org/licenses/by-sa/4.0/


 */
import MagicString from 'magic-string';
import fs from 'node:fs';

/**
 * simple plugin to move the `export function` line to the top of the file.
 * The goal is to put all in inlined included declarations into the scope of
 * the exported function. This is required for `chrome.scripting.executeScript`
 *
 * **Example:**
 * typescript:
 * ```typescript
 * import {foo} from "./common.js";
 *
 * export function bar(param: string): string {
 *   return foo(param);
 * }
 * ```
 *
 * post rollup inlining and treeshaking:
 * ```javascript
 * function foo(param) {
 *   return "works";
 * }
 * export function bar(param) {
 *   return foo(param);
 * }
 * ```
 *
 * post this plugin:
 * ```javascript
 * export function bar(param) {
 * function foo(param) {
 *   return "works";
 * }
 *
 *   return foo(param);
 * }
 * ```
 *
 * Now everything that's needed for the function to work is scoped within it
 * and `chrome.scripting.executeScript()` works.
 *
 */
export default function rollupPluginInlinedImports() {
  return {
    name: 'rollup-plugin-inlined-export',
    writeBundle(opts, bundle) {
      for (const {fileName, code} of Object.values(bundle)) {
        if (!code?.length) {
          continue;
        }
        const filename = `${opts.dir}/${fileName}`;
        const filenamemap = `${filename}.map`;
        const s = new MagicString(code);

        // find the `export { functionname };`
        // This code only supports one, so if there are multiple error out.
        const exportmatches = [...code.matchAll(/\s+export\s*{\s*(\w+)\s*}/g)];
        if (exportmatches.length !== 1 ||
            !(exportmatches[0] instanceof Array) ||
            exportmatches[0].length !== 2) {
          continue;
        }
        const functionname = exportmatches[0][1];

        // find the offset of the function
        const function_startindex = code.indexOf(`function ${functionname}`,
          'g');
        if (function_startindex <= 0) {
          continue;
        }
        // start of what we need to move is the functionmatches?.index, scan
        // forward to find `{` this isn't that robust because there could be
        // comments or other syntaxes, but it works for my needs
        const function_endindex = s.toString().
                                    indexOf('{', function_startindex);
        if (function_endindex <= 0) {
          console.warn(
            `rollup-plugin-inlined-export: ${filenamemap} unable to find exported function "${functionname}" in code.`);
          continue;
        }

        const extraoffset = code[function_endindex + 1] === '\n' ?
          function_endindex + 2 :
          function_endindex + 1;
        s.move(function_startindex, extraoffset, 0);

        const map = s.generateMap({
          source: filename,
          file: filenamemap,
          includeContent: true,
        }); // generates a v3 sourcemap

        fs.writeFileSync(filename, s.toString());
        if (opts.sourcemap) {
          fs.writeFileSync(filenamemap, map.toString());
        }
      }
    },
  };
}
