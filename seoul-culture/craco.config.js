// craco.config.js
module.exports = {
  // CSS 처리 방식을 설정하는 부분
  style: {
    postcss: {
      mode: 'file', // craco에게 외부 파일을 사용하라고 명령
    },
  },
};