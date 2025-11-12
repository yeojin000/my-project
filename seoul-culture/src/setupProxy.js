// src/setupProxy.js
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/seoulapi',
    createProxyMiddleware({
      target: 'https://openapi.seoul.go.kr:8088',
      changeOrigin: true,
      secure: true,          // https 타깃 인증서 검증
      logLevel: 'debug',     // 프록시 로그 자세히 보기 (터미널에 출력)
      pathRewrite: { '^/seoulapi': '' },
    })
  );
};
