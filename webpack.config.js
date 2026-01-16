import MiniCssExtractPlugin from 'mini-css-extract-plugin'
import path from 'path'

export default {
  mode: 'production',
  entry: './src/lib/js/index.js',
  output: {
    path: path.resolve(new URL('.', import.meta.url).pathname, 'dist'),
    filename: 'formeo.js',
    library: {
      name: 'Formeo',
      type: 'umd',
    },
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.scss$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader'],
      },
      {
        test: /\.svg$/,
        resourceQuery: /raw/,
        type: 'asset/source',
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'formeo.css',
    }),
  ],
  resolve: {
    extensions: ['.js'],
  },
}
