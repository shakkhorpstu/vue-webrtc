import WebRTC from "./webrtc.vue";
import VueAudio from "./VueAudio.vue";

const install = function (Vue, opts = {}) {
  if (install.installed) return;
  Vue.component(WebRTC.name, WebRTC);
  Vue.component(VueAudio.name, VueAudio);
};

module.exports = {
  WebRTC,
  VueAudio,
  install
};

module.exports.default = module.exports;
