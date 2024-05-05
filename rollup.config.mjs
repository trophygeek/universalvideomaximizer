// import path from 'path';
//
// import resolve from '@rollup/plugin-node-resolve';
// import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import ts from 'typescript';

import copy from 'rollup-plugin-copy';

import {emptyDir} from 'rollup-plugin-empty-dir';
import zip from 'rollup-plugin-zip';

import rollupPluginTryCatch from './scripts/rollup-plugin-try-catch-block.mjs';


const dist = `dist/videomaximizer`;
const isProd = process.env.NODE_ENV === 'production';
const isWatch = false; // fix

// const plugins = [
//   replace({
//     'process.env.NODE_ENV': isProd
//       ? JSON.stringify('production')
//       : JSON.stringify('development'),
//     preventAssignment: true,
//   }),
//   simpleReloader(),
//   resolve(),
//   commonjs(),
//   typescript({tsconfig: './tsconfig.json'}),
//   emptyDir(),
//   isProd && zip({dir: 'releases'}),
// ];

export default [
  {
    // these can have tree shaking
    input: [
      'src/background.ts',
      'src/options.ts',
      'src/popup.ts',
      'src/common.ts'],
    output: {
      dir: `${dist}`,
      format: 'esm',
      sourcemap: false,
    },
    treeshake: {
      preset: 'smallest',
      manualPureFunctions: ['styled', 'local']
    },
    plugins: [
      ...(isProd ? [emptyDir()] : []),
      typescript({
        typescript: ts,
        tsconfig: process.env.NODE_ENV === "development" ? "./tsconfig.dev.json" : "./tsconfig.prod.json"
      }),
    ]
  },
  {
    input: [
      'src/injectCssHeader.ts',
      'src/injectCssHeaderRemove.ts',
      'src/injectGetPlaypackSpeed.ts',
      'src/injectIsCssHeaderIsBlocked.ts',
      'src/injectVideomaxMain.ts',
      'src/injectVideoSkip.ts',
      'src/injectVideoSpeedAdjust.ts',
    ],
    output: {
      dir: `${dist}`,
      format: 'esm', // 'iife' | 'cjs' | 'esm'
      sourcemap: false,
      generatedCode: {
        constBindings: false
      }, // global consts prevent re-injection
    },
    treeshake: {
      preset: 'smallest',
      annotations: true,
    },
    plugins: [
      typescript({
        typescript: ts,
        tsconfig: process.env.NODE_ENV === "development" ? "./tsconfig.dev.json" : "./tsconfig.prod.json"
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
