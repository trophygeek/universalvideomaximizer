// import path from 'path';
//
// import resolve from '@rollup/plugin-node-resolve';
// import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import ts, {ModuleResolutionKind} from 'typescript';

import copy from 'rollup-plugin-copy';

import {emptyDir} from 'rollup-plugin-empty-dir';
// import zip from 'rollup-plugin-zip';

import rollupPluginTryCatch from './scripts/rollup-plugin-try-catch-block.mjs';

const dist = `dist/videomaximizer`;
const isProd = process.env.NODE_ENV === 'production';
const isWatch = !isProd; // copy only once?

const generatedCode = {
  constBindings: true,
  arrowFunctions: true,
  objectShorthand: true,
  reservedNamesAsProps: true,
  symbols: false,
};

/** everything but the input **/
const defaultStep = {
  output: {
    dir: `${dist}`,
    format: 'esm', // 'iife' | 'cjs' | 'esm'
    sourcemap: !isProd,
    generatedCode: generatedCode,
  },
  treeshake: {
    preset: 'smallest',
    unknownGlobalSideEffects: false,
    manualPureFunctions: ['styled', 'local'],
  },
  plugins: [
    typescript({
      typescript: ts,
      tsconfig: isProd ? './tsconfig.prod.json' : './tsconfig.dev.json',
    }),
  ],
};

const defaultStepTryCatch = {
  ...defaultStep,
  plugins: [
    typescript({
      typescript: ts,
      tsconfig: isProd ? './tsconfig.prod.json' : './tsconfig.dev.json',
    }),
    rollupPluginTryCatch(),
  ],
}

export default [
  // these share common.js
  {
    input: [
      'src/background.ts',
      'src/options.ts',
      'src/popup.ts',
    ],

    ...defaultStep,
  },
  {
    input: ['src/injectCheckPermissions.ts'],
    ...defaultStepTryCatch,
  },
  {
    input: ['src/injectCssHeader.ts'],
    ...defaultStepTryCatch,
  },
  {
    input: ['src/injectCssHeaderRemove.ts'],
    ...defaultStepTryCatch,
  },
  {
    input: ['src/injectIsCssHeaderIsBlocked.ts'],
    ...defaultStepTryCatch,
  },
  {
    input: ['src/injectGetPlaypackSpeed.ts'],
    ...defaultStepTryCatch,
  },
  {
    input: ['src/injectGetPlaypackSpeed.ts'],
    ...defaultStepTryCatch,
  },
  {
    input: ['src/injectVideoSpeedAdjust.ts'],
    ...defaultStepTryCatch,
  },
  {
    input: ['src/injectVideoSpeedAdjust.ts'],
    ...defaultStepTryCatch,
  },
  {
    input: ['src/injectVideoSkip.ts'],
    ...defaultStepTryCatch,
  },
  // last one need to figure out merge files.
  {
    input: [
      'src/injectVideomaxMain.ts',
    ],
    ...defaultStepTryCatch,
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
