const {
    spawn,
    execSync,
} = require("child_process");
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

const walk = (dir) => {
    try {
        let results = [];
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            file = path.join(dir, file);
            const stat = fs.statSync(file);
            if (stat && stat.isDirectory()) {
                // Recurse into subdir
                results = [...results, ...walk(file)];
            } else {
                // Is a file
                results.push(file);
            }
        });
        return results;
    } catch (error) {
        console.error(`Error when walking dir ${dir}`, error);
    }
};

const doEdits = (filePath, versionStr, betaStr) => {
    const oldContent = fs.readFileSync(filePath, {encoding: 'utf8'});
    // <space>BUILD_TYPE_STR is intentional
    const newContent = oldContent.replace(/VERSION_STR/, versionStr).replace(/ BUILD_TYPE_STR/, betaStr);
    if (oldContent !== newContent) {
        fs.writeFileSync(filePath, newContent, { encoding: 'utf-8' });
        console.log(`Edited file: ${filePath}`);
    }
};

rl.question("What version? ", (vers) => {
    debugger;
    if (vers?.length) {
        rl.question("Beta (Y)? ", (isbetaStr) => {
            const isBeta = isbetaStr.toLowercase() === "y";
            const fs = require("fs");
            // remove existing build target directory
            // fs.removeSync(`../build/videomaximizer`);
            // fs.rmSync(dir, {
            //     recursive: true,
            //     force:     true,
            // });

            fs.cpSync(`../src`,`../build/videomaximizer`, {recursive: true});
            doEdits(`../build/videomaximizer/`, vers, isBeta ? "BETA" : "");
            // now search/replace for VERSION_STR and BUILD_TYPE_STR in destination
            // zip it up.
            exec(`zip -r ../build/videomax-ext-v${vers}.zip ../build/videomaximizer/ -x '**/.*' -x '**/__MACOSX'`);
        });
    }
    rl.close();
});



