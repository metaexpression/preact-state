/* eslint-disable import/no-extraneous-dependencies */

const path = require('path')
const webpack = require('webpack')
const MiniCssExtractPlugin = require("mini-css-extract-plugin")
const HtmlWebpackPlugin = require('html-webpack-plugin')
const TerserPlugin = require("terser-webpack-plugin")
const devMode = process.env.NODE_ENV !== "production";

const babelOpts = {
  test: /\.js?$/,
  exclude: /node_modules/,
  use: [
    'babel-loader',
  ],
}

const cssOpts = {
  test: /\.css$/,
  use : [
    MiniCssExtractPlugin.loader,
    'css-loader',
  ]
}

const svgOpts = {
  test: /\.svg$/,
  exclude: /node_modules/,
  use: [
    'raw-loader',
  ],
}

const pluginList = [
  new MiniCssExtractPlugin({
    filename: devMode ? "[name].css" : "[name].[contenthash].css",
    chunkFilename: devMode ? "[id].css" : "[id].[contenthash].css",
  }),
  new HtmlWebpackPlugin({
    template: 'src/index.ejs',
    inject: false,
    title: 'title',
    appMountId: '',
    devServer: '',
  })
]

const stats = {
  chunks: false,
  modules: false,
  children: false,
  colors: true,
}

const mangleProperyList = [
  "openEnded", "valueQuery", "functions", "editedObjects", "writeContext",
  "subscription", "component", "lastDeps", "hookMode", "selectors", "lastValue"
]

module.exports = {
  entry: './src/index',
  resolve: {
    extensions: ['.js'],
    alias:
    {
      'react': 'preact/compat',
      'react-dom': 'preact/compat',
    },
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'public'),
  },
  mode: 'production',
  module: {
    rules: [
      babelOpts,
      cssOpts,
      svgOpts,
    ],
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin({
      terserOptions: {
        mangle: {
          properties: {
            regex: new RegExp(mangleProperyList.map(x => '(' + x + ')').join('|'))
          }
        }
      }
    })],
  },
  plugins: pluginList,
  devServer: {
    static: {
      directory: path.join(__dirname, 'public'),
    },
    port: 8080,
  },
  // devtool: "source-map",
  stats,
}
