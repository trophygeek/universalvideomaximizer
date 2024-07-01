import fs from 'node:fs';

export default function rollupPluginTryCatch () {
  return {
    name: 'rollup-plugin-try-catch-block',
    writeBundle(opts, bundle) {
      debugger;
      for (const { fileName, code} of Object.values(bundle)) {
        if (!code?.length) {
          continue;
        }
        fs.writeFileSync(`${opts.dir}/${fileName}`, `
try {

${code}

} catch (err) {
  console.error("videomax extension error", err, err.stack);
}
`);
      }
    },
  }
}
