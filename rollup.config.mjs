// import path from 'path';
//
// import resolve from '@rollup/plugin-node-resolve';
// import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import ts from 'typescript';

import copy from 'rollup-plugin-copy';

import {emptyDir} from 'rollup-plugin-empty-dir';
// import zip from 'rollup-plugin-zip';

import rollupPluginTryCatch from './scripts/rollup-plugin-try-catch-block.mjs';

const dist = `dist/videomaximizer`;
const isProd = process.env.NODE_ENV === 'production';
const isWatch = !isProd; // copy only once?

export default [
  {
    // these can have tree shaking
    input: [
      'src/background.ts',
      'src/common.ts',
      'src/injectCheckPermissions.ts',
      'src/injectCssHeader.ts',
      'src/injectCssHeaderRemove.ts',
      'src/injectGetPlaypackSpeed.ts',
      'src/injectIsCssHeaderIsBlocked.ts',
      'src/injectVideoSkip.ts',
      'src/injectVideoSpeedAdjust.ts',
      'src/options.ts',
      'src/popup.ts',
    ],
    output: {
      dir: `${dist}`,
      format: 'esm',
      sourcemap: !isProd,
    },
    treeshake: {
      preset: 'smallest',
      manualPureFunctions: ['styled', 'local'],
      annotations: !isProd,
    },
    plugins: [
      ...(isProd ? [emptyDir()] : []),
      typescript({
        typescript: ts,
        tsconfig: isProd ? './tsconfig.prod.json' : './tsconfig.dev.json',
      }),
    ],
  },
  {
    input: [
      'src/injectVideomaxMain.ts',
    ],
    output: {
      dir: `${dist}`,
      format: 'esm', // 'iife' | 'cjs' | 'esm'
      sourcemap: !isProd,
      generatedCode: {
        constBindings: false,
      }, // global consts prevent re-injection
    },
    treeshake: {
      preset: 'smallest',
      annotations: !isProd,
    },
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
