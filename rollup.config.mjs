/**
 *
 Subtle behavior with file suffix to watch out for
 ```
 {
 input: ['src/injectVideoSkip.ts'],
 ...defaultIsolatedStep,
 },
 ```
 causes injectVideoSkip.js to use `import`

 ```
 {
 input: ['src/injectVideoSkip.ts'],
 ...defaultIsolatedStep,
 },
 ```
 causes injectVideoSkip.js to inline just functions used from common.js

 */
import typescript from '@rollup/plugin-typescript';
import ts from 'typescript';

import copy from 'rollup-plugin-copy';

// import zip from 'rollup-plugin-zip';

import rollupPluginTryCatch from './scripts/rollup-plugin-try-catch-block.mjs';
import rollupPluginInlinedImports
  from './scripts/rollup-plugin-inlined-imports.mjs';
import rollupReplace from '@rollup/plugin-replace';

const dist = `dist/videomaximizer`;
const isProd = process.env.NODE_ENV === 'production';
const isDev = !isProd;
const isWatch = !isProd; // copy only once?


const replace = opts => {
  if (isProd) {
    return rollupReplace({
      ...opts,
      exclude: ['**/common.*'],
      delimiters: ['', ''],
      preventAssignment: false,
      'logerr,': ' ',
      // the start quote matches are to prevent matching:
      // function logerr(...
      'logerr("': 'false && ("',
      'logerr(`': 'false && (`',
      'logerr(\'': 'false && (\'',
      'logtrace,': '',
      'logtrace("': 'false && ("',
      'logtrace(`': 'false && (`',
      'logtrace(\'': 'false && (\'',
      'logwarn,': '',
      'logwarn("': 'false && ("',
      'logwarn(`': 'false && (`',
      'logwarn(\'': 'false && (\''
    })
  }
};

const devMode  = opts => {
    return rollupReplace({
      ...opts,
      delimiters: ['', ''],
      preventAssignment: false,
      'import.meta.env.DEV': `${isDev}`
    })
};

/** everything but the input **/
const defaultStep = {
  output: {
    dir: `${dist}`,
    format: 'esm', // 'iife' | 'cjs' | 'esm'
    sourcemap: !isProd,
    // exports: 'named',
    generatedCode: {
      constBindings: true, // use const over var
    },
  },
  treeshake: {
    preset: isDev ? 'safest':'smallest',
    unknownGlobalSideEffects: false,
    moduleSideEffects: false,
    propertyReadSideEffects: false,
    tryCatchDeoptimization: false,
    manualPureFunctions: isDev ?  [] : [
      'printNode',
      'logerr',
      'logtrace',
      'logwarn',
      'isRunningInIFrame',
      'dbgStack'],
  },
  plugins: [
    replace(),
    devMode(),
    typescript({
      typescript: ts,
      tsconfig: isProd ? './tsconfig.prod.json' : './tsconfig.dev.json',
    }),

  ],
};

const defaultIsolatedStep = {
  ...defaultStep,
  output: {
    ...defaultStep.output,
    format: 'es',
  },
  plugins: [
    ...defaultStep.plugins,
    rollupPluginInlinedImports(),
  ],
};

export default [
  // these share common.js
  {
    input: [
      'src/background.ts',
      'src/options.ts',
      'src/popup.ts',
      // adding these here fixes imports in background.js
      'src/common.ts',
      'src/injectVideoSkip.ts',
      'src/injectCheckPermissions.ts',
      'src/injectCssHeader.ts',
      'src/injectCssHeaderRemove.ts',
      'src/injectIsCssHeaderIsBlocked.ts',
      'src/injectGetPlaybackSpeed.ts',
      'src/injectVideoSpeedAdjust.ts',
      'src/injectGetVideoZoomedState.ts',
    ],
    ...defaultStep,
  },
  {
    input: ['src/common.ts'],
    ...defaultIsolatedStep,
  },
  {
    input: ['src/injectCheckPermissions.ts'],
    ...defaultIsolatedStep,
  },
  {
    input: ['src/injectCssHeader.ts'],
    ...defaultIsolatedStep,
  },
  {
    input: ['src/injectCssHeaderRemove.ts'],
    ...defaultIsolatedStep,
  },
  {
    input: ['src/injectIsCssHeaderIsBlocked.ts'],
    ...defaultIsolatedStep,
  },
  {
    input: ['src/injectGetPlaybackSpeed.ts'],
    ...defaultIsolatedStep,
  },
  {
    input: ['src/injectVideoSpeedAdjust.ts'],
    ...defaultIsolatedStep,
  },
  {
    input: ['src/injectVideoSkip.ts'],
    ...defaultIsolatedStep,
  },
  {
    input: ['src/injectGetVideoZoomedState.ts'],
    ...defaultIsolatedStep,
  },
  // last one need to figure out merge files.
  {
    input: [
      'src/injectVideomaxMain.ts',
    ],
    ...defaultStep,
    plugins: [
      replace(),
      devMode(),
      typescript({
        typescript: ts,
        tsconfig: isProd ? './tsconfig.prod.json' : './tsconfig.dev.json',
      }),
      rollupPluginTryCatch(),
      copy({
        targets: [
          {src: ['public/**/*'], dest: `${dist}`},
        ],
        flatten: false,
        copyOnce: isWatch,
      }),
      // isProd && zip({dir: 'releases'}),
    ],
  },
];
