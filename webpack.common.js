const path = require('path');

module.exports = {
  entry: {
    app: './js/drawing_canvas.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    filename: './js/drawing_canvas.js',
  },
};
