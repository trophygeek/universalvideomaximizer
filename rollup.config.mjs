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

// import {emptyDir} from 'rollup-plugin-empty-dir';
// import zip from 'rollup-plugin-zip';
// import commonjs from '@rollup/plugin-commonjs';

import inline from "rollup-plugin-inline-js";
import rollupPluginTryCatch from './scripts/rollup-plugin-try-catch-block.mjs';
import rollupPluginInlinedExport
  from './scripts/rollup-plugin-inlined-export.mjs';

const dist = `dist/videomaximizer`;
const isProd = process.env.NODE_ENV === 'production';
const isWatch = !isProd; // copy only once?

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
    preset: 'smallest',
    unknownGlobalSideEffects: false,
    moduleSideEffects: false,
    propertyReadSideEffects: false,
  },
  plugins: [
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
    rollupPluginInlinedExport(),
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
      'src/injectGetPlaypackSpeed.ts',
      'src/injectVideoSpeedAdjust.ts',
      'src/injectVideoSkip.ts',
      'src/injectGetVideoZoomed.ts',
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
    input: ['src/injectGetPlaypackSpeed.ts'],
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
    input: ['src/injectGetVideoZoomed.ts'],
    ...defaultIsolatedStep,
  },
  // last one need to figure out merge files.
  {
    input: [
      'src/injectVideomaxMain.ts',
    ],
    ...defaultStep,
    plugins: [
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
