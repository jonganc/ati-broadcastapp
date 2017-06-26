const webpack = require('webpack');
const path = require('path');

// we need babel to load config

module.exports = async () => {
  // basic configuration
  const webpackConfig = {
    entry: {
      app: ['./src/App.jsx'],
      vendor: ['react', 'react-dom', 'whatwg-fetch', 'react-router', 'moment'],
    },
    output: {
      path: path.resolve(__dirname, 'static'),
      filename: 'app.bundle.js',
    },
    plugins: [
      new webpack.optimize.CommonsChunkPlugin(
        { name: 'vendor', filename: 'vendor.bundle.js' }),
    ],
    module: {
      loaders: [
        {
          test: /\.jsx$/,
          loader: 'babel-loader',
          query: {
            presets: [
              ['env', {
                targets: ['> 4%'] },
              ],
              'react',
            ],
          },
        },
      ],
    },
    devtool: 'source-map',
  };

  //  If we are on the dev server, add appropriate section.
  //  We separate this out because we only want to load babel-register if
  //  we have to
  const isDevServer
        = process.argv.find(v => v.includes('webpack-dev-server'));
  if (isDevServer) {
    // eslint-disable-next-line global-require
    require('babel-register')({ only: /server\/config/ });
    // eslint-disable-next-line global-require
    const configReq = require('./server/config');
    const config = await (configReq.default());

    webpackConfig.devServer = {
      port: 8000,
      contentBase: 'static',
      proxy: {
        '/api/*': {
          target: `http://localhost:${config.get('port')}`,
        },
      },
      historyApiFallback: true,
    };
  }

  return webpackConfig;
};
