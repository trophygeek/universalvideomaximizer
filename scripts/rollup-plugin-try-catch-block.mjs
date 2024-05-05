import fs from 'node:fs';

export default function rollupPluginTryCatch () {
  return {
    name: 'rollup-plugin-try-catch-block',
    writeBundle(opts) {
      debugger;
      const filename = `${opts.dir}/injectVideomaxMain.js`;
      const code = fs.readFileSync(filename, 'utf8');
      fs.writeFileSync(filename, `
try {

${code}

} catch (err) {
  console.error("videomax extension error", err, err.stack);
}
`);
    },
    // transform(code, id) {
    //   // special case. we want imports INSIDE of the try catch.
    //   if (id.endsWith('injectVideomaxMain.ts')) {
    //     debugger;
    //     return `
    //       try {
    //         ${code}
    //       } catch (err) {
    //         console.error("videomax extension error", err, err.stack);
    //       }
    //     `;
    //   }
    //   return code;
    // },
  }
}
