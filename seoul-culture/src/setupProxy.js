const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api/seoul',
    createProxyMiddleware({
      target: 'http://openapi.seoul.go.kr:8088',
      changeOrigin: true,
      pathRewrite: {
        // '/api/seoul'을 만나면 '실제키값'으로 바꿔서 요청을 보냄
        '^/api/seoul': '/57516a724b79656f37316e536d4677'
      },
    })
  );
};