const webpack = require('webpack');
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const srcDir = path.join(__dirname, '..', 'src');

module.exports = {
  entry: {
    popup: path.join(srcDir, 'popup.ts'),
    options: path.join(srcDir, 'options.ts'),
    background: path.join(srcDir, 'background.ts'),
    videomax_main_inject: path.join(srcDir, 'videomax_main_inject.ts'),
  },
  output: {
    path: path.join(__dirname, '../build/videomaximizer'),
    filename: '[name].js',
  },
  optimization: {},
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  plugins: [
    new CopyPlugin({
      patterns: [{from: '.', to: '../videomaximizer', context: 'public'}],
      options: {},
    }),
  ],
};
