// The injected script may be reinjected multiple times.
// This script wraps the whole file in a try/catch() to scope it
// and prevent script errors from breaking out into the page.
// It attempts to preserve source maps as it works.
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
