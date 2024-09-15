/*
 Video Maximizer

 Copyright (c) 2024. trophygeek@gmail.com
 www.videomaximizer.com

 Removes the clutter. Maximizes videos to view in full-page theater mode on most sites.

 Creative Commons Share Alike 4.0
 To view a copy of this license, visit https://creativecommons.org/licenses/by-sa/4.0/


 This script wraps the whole file in a try/catch() to scope it
 and prevent script errors from breaking out into the page.
 It attempts to preserve source maps as it works.

 */
import fs from 'node:fs';
import MagicString from 'magic-string';

export default function rollupPluginTryCatch () {
  return {
    name: 'rollup-plugin-try-catch-block',
    writeBundle(opts, bundle) {
      for (const { fileName, code} of Object.values(bundle)) {
        if (!code?.length) {
          continue;
        }
        const filename = `${opts.dir}/${fileName}`;
        const filenamemap = `${filename}.map`;
        const s = new MagicString(code);

        s.indent();
        s.prepend(`try {\n`);
        s.append(`\n} catch (err) {\n  console.error("videomax extension error", err, err.stack);\n}`);

        const map = s.generateMap({
          source: filename,
          file: filenamemap,
          includeContent: true
        }); // generates a v3 sourcemap

        fs.writeFileSync(filename, s.toString());
        if (opts.sourcemap) {
          fs.writeFileSync(filenamemap, map.toString());
        }
      }
    },
  }
}
