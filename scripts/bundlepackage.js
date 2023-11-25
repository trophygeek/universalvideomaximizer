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

const readline = require("readline");

const rl = readline.createInterface({
                                      input:  process.stdin,
                                      output: process.stdout,
                                    });

const doEdits = (filePath, from, to) => {
  const fullFilePath = path.resolve(__dirname, filePath);
  const oldContent = fs.readFileSync(fullFilePath, { encoding: "utf8" });
  // <space>BUILD_TYPE_STR is intentional
  const newContent = oldContent.replace(from, to);
  if (oldContent.localeCompare(newContent) !== 0) {
    fs.writeFileSync(fullFilePath, newContent, { encoding: "utf-8" });
    console.log(`Edited file: ${fullFilePath}`);
  } else {
    console.warn(`Edited file: ${fullFilePath} did NOT change '${to}'?!?`);
  }
};

let versStr = "";
let isBeta = false;

rl.question("What version (e.g. 120)? ", (vers) => {

  versStr = vers;
  if (!versStr?.length) {
    return;
  }
  // todo: verify type is number.

  rl.question("Beta (y)? ", (isbetaStr) => {
    isBeta = (isbetaStr?.toLowerCase() === "y");
    rl.close();

    const buildTargetDir = path.resolve(__dirname, `../build/videomaximizer`);
    {
      doEdits(`${buildTargetDir}/manifest.json`,
              /"version": "3\.1.(\d+)"/gi,
              `"version": "3.1.${vers}"`);
    }

    doEdits(`${buildTargetDir}/help.html`,
            /\(Version 3.1.(d+)\)/gi,
            `(Version 3.1.${vers})`);


    if (isBeta) {
      // done in the /build directory (and not /src) because we don't want to check it into the
      // project.
      doEdits(`${buildTargetDir}/manifest.json`,
              /"name": "Video Maximizer"/gi,
              `"name": "Video Maximizer BETA"`);
      doEdits(`${buildTargetDir}/common.js`,
              "export const IS_BETA_CHANNEL = false;",
              "export const IS_BETA_CHANNEL = true;");
    }
    const buildDir = path.resolve(__dirname, `../build`);
    const betaStr = isBeta ? "-BETA" : "";
    // zip it up. use relative paths to prevent the zip file from containing full paths from the root.
    // params r=recursive q=quiet 0=compression level
    exec(`cd "${buildDir}" && zip -rq9 "./videomax-ext-v${vers}${betaStr}.zip" "./videomaximizer/" -x '**/.*' -x '**/__MACOSX'`);
    console.log(`Compressed file: videomax-ext-v${vers}${betaStr}.zip
    use 'unzip -vl ./build/videomax-ext-v${vers}${betaStr}.zip' to examine/verify contents. 
    `);
  });
});

