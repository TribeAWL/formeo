const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  mode: 'production',
  entry: './src/lib/js/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'formeo.js',
    library: {
      name: 'Formeo',
      type: 'umd',
    },
    globalObject: 'this',
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /node_modules/,
        use: 'babel-loader',
        resolve: {
          fullySpecified: false, // allow imports without .js
        },
      },
      {
        test: /\.scss$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader'],
      },
      {
      test: /\.svg$/i,
      resourceQuery: /raw/, // only for ?raw
      type: 'asset/source', // treat as raw string
    },
    ],
  },
  resolve: {
    extensions: ['.js', '.mjs', '.json'], // allows import without extension for these
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'formeo.css',
    }),
  ],
};
