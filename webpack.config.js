const path = require('path');
let HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: './src/app.tsx',
    watch: true,
    output: {
        path: path.resolve('app'),
        filename: './dist/bundle.js'
    },
    resolve: {
        extensions: ['.js', '.jsx', '.ts', '.tsx']
    },
    module: {
        rules: [
            {
                test: /\.((t|j)sx)$/,
                exclude: /node_modules/,
                use: ['ts-loader']
            },
            {
                test: /\.(scss|css)$/,
                exclude: /node_modules/,
                use: ['style-loader', 'css-loader', 'sass-loader']
            },
            {enforce: 'pre', test: /\.js$/, exclude: /node_modules/, loader: 'source-map-loader'}
        ]
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: 'YouTube To MP3',
            filename: './app/app/index.html',
            template: './src/index.html'
        })
    ]
};
