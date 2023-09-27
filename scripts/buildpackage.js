const {
  spawn,
  execSync,
} = require("child_process");
const fs = require("fs");
const path = require("path");

const exec = commands => {
  execSync(commands, {
    stdio: "inherit",
    shell: true,
  });
};
const spawnProcess = commands => {
  spawn(commands, {
    stdio: "inherit",
    shell: true,
  });
};
const readline = require("readline");
const { is } = require("uvu/assert");

const rl = readline.createInterface({
                                      input:  process.stdin,
                                      output: process.stdout,
                                    });

// const walk = (dir) => {
//   try {
//     let results = [];
//     const list = fs.readdirSync(dir);
//     list.forEach(file => {
//       file = path.join(dir, file);
//       const stat = fs.statSync(file);
//       if (stat && stat.isDirectory()) {
//         // Recurse into subdir
//         results = [...results, ...walk(file)];
//       } else {
//         // Is a file
//         results.push(file);
//       }
//     });
//     return results;
//   } catch (error) {
//     console.error(`Error when walking dir ${dir}`, error);
//   }
// };

// this is how the code should be for release, if not bail!
// filename: string if not found bails.
const PREFLIGHT = [
  {
    file:  "common.js",
    value: `
const FULL_DEBUG = false;
const DEBUG_ENABLED = FULL_DEBUG;
const TRACE_ENABLED = FULL_DEBUG;
const ERR_BREAK_ENABLED = FULL_DEBUG;
`,
  },

  {
    file:  "videomax_main_inject.js",
    value: `
  const FULL_DEBUG = false;
  const DEBUG_ENABLED = FULL_DEBUG;
  const TRACE_ENABLED = FULL_DEBUG;
  const ERR_BREAK_ENABLED = FULL_DEBUG;
  const BREAK_ON_BEST_MATCH = false;`,
  },

  {
    file:  "videomax_main_inject.js",
    value: `
  const EMBED_SCORES = false;
  const COMMON_PARENT_SCORES = false;
  const DEBUG_HIDENODE = false;
  const DEBUG_MUTATION_OBSERVER = false;`,
  },

  {
    file:  "background_executescripts.js",
    value: `const FULL_DEBUG = false;`,
  },
  {
    file:  "manifest.json",
    value: `"name": "Video Maximizer"`,
  }];

const checkPreflights = () => {
  for (const {
    file,
    value
  } of PREFLIGHT) {
    const fullFilePath = path.resolve(__dirname, `../src/${file}`);
    const content = fs.readFileSync(fullFilePath, { encoding: "utf8" });
    if (!content?.match(value)) {
      console.error(`Preflight check failed.
      File: "../src/${file}"
      Missing String:
${value}
      `);
      return false;
    }
  }
  return true; // success
};


const doEdits = (filePath, from, to) => {
  const fullFilePath = path.resolve(__dirname, filePath);
  const oldContent = fs.readFileSync(fullFilePath, { encoding: "utf8" });
  // <space>BUILD_TYPE_STR is intentional
  const newContent = oldContent.replace(from, to);
  if (oldContent.localeCompare(newContent) !== 0) {
    fs.writeFileSync(fullFilePath, newContent, { encoding: "utf-8" });
    console.log(`Edited file: ${fullFilePath}`);
  }
};

let versStr = "";
let isBeta = false;

rl.question("What version? ", (vers) => {

  versStr = vers;
  if (!versStr?.length) {
    return;
  }
  // todo: verify type is number.

  rl.question("Beta (Y)? ", (isbetaStr) => {
    isBeta = (isbetaStr?.toLowerCase() === "y");
    rl.close();

// specifically look for variables that should be false for release
    if (!checkPreflights()) {
      return;
    }

    // run the linter todo: fail if there are any errors!
    exec(`eslint --fix 'src/**/*.{js,ts,jsx,tsx}'`);

    // do edits to
    {
      doEdits(`../src/manifest.json`,
              /"version": "3\.0.(\d+)"/gi,
              `"version": "3.0.${vers}"`);
    }

    doEdits(`../src/help.html`,
            /\(Version 3.0.(d+)\)/gi,
            `(Version 3.0.${vers})`);

// remove existing build target directory
    const buildTargetDir = path.resolve(__dirname, `../build/videomaximizer`);
    fs.rmSync(buildTargetDir, {
      recursive: true,
      force:     true,
    });

    debugger;

// copy over all files.
    const buildSrcDir = path.resolve(__dirname, `../src`);
    fs.cpSync(buildSrcDir, buildTargetDir, { recursive: true });


    if (isBeta) {
      // done in the /build directory (and not /src) because we don't want to check it into the
      // project.
      doEdits(`../build/videomaximizer/manifest.json`,
              /"name": "Video Maximizer"/gi,
              `"name": "Video Maximizer BETA"`);
    }

// now search/replace for VERSION_STR and BUILD_TYPE_STR in destination
// zip it up.
    const buildDir = path.resolve(__dirname, `../build`);
    exec(
      `zip -r "${buildDir}/videomax-ext-v${vers}.zip" "${buildTargetDir}/" -x '**/.*' -x '**/__MACOSX'`);
  });
});

