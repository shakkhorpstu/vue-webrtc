<template>
  <div class="video-list" >
      <!--Live streaming-->
      <div v-for="item in videoList"
           v-if="item.id != localVideo.id"
           v-bind:video="item"
           v-bind:key="item.id"display-inline
           :class="getAudioDiv()">
        <video class="js-player" controls v-if="item.id != localVideo.id" @click="maximize(item.id)" autoplay playsinline ref="videos" :height="cameraHeight" :muted="item.muted" :id="item.id"></video>
      </div>

      <!--Local video-->
      <div v-for="item in videoList"
           v-if="item.id == localVideo.id"
           v-bind:video="item"
           v-bind:key="item.id"
           class="video-item"
           :class="getOwnVideoClass(localVideo, audio)">
        <video class="js-player" :class="getLocalVideoClass(localVideo)" controls v-if="!audio" autoplay playsinline ref="videos" :height="cameraHeight" :muted="localVideo.muted" :id="localVideo.id"></video>
      </div>
  </div>
</template>

<script>
  import RTCMultiConnection from 'rtcmulticonnection';
  require('adapterjs');
  export default {
    name: 'vue-webrtc',
    components: {
      RTCMultiConnection
    },
    data() {
      return {
        rtcmConnection: null,
        localVideo: {
          muted: true
        },
        videoList: [],
        canvas: null,
      };
    },
    props: {
      audio: {
        type: Boolean,
        default: false
      },
      roomId: {
        type: String,
        default: 'static-room'
      },
      socketURL: {
        type: String,
        default: 'https://rtcmulticonnection.herokuapp.com:443/'
      },
      cameraHeight: {
        type: [Number, String],
        default: 160
      },
      autoplay: {
        type: Boolean,
        default: true
      },
      screenshotFormat: {
        type: String,
        default: 'image/jpeg'
      },
      enableAudio: {
        type: Boolean,
        default: true
      },
      enableVideo: {
        type: Boolean,
        default: true
      },
      enableLogs: {
        type: Boolean,
        default: false
      },
      stunServer: {
        type: String,
        default: null
      },
      turnServer: {
        type: String,
        default: null
      }
    },
    watch: {},
    mounted() {
      var that = this;

      this.rtcmConnection = new RTCMultiConnection();
      this.rtcmConnection.socketURL = this.socketURL;
      this.rtcmConnection.autoCreateMediaElement = false;
      this.rtcmConnection.enableLogs = this.enableLogs;
      this.rtcmConnection.session = {
        audio: this.enableAudio,
        video: this.enableVideo
      };
      this.rtcmConnection.sdpConstraints.mandatory = {
        OfferToReceiveAudio: this.enableAudio,
        OfferToReceiveVideo: this.enableVideo
      };
      if ((this.stunServer !== null) || (this.turnServer !== null)) {
        this.rtcmConnection.iceServers = []; // clear all defaults
      }
      if (this.stunServer !== null) {
        this.rtcmConnection.iceServers.push({
          urls: this.stunServer
        });
      }
      if (this.turnServer !== null) {
        var parse = this.turnServer.split('%');
        var username = parse[0].split('@')[0];
        var password = parse[0].split('@')[1];
        var turn = parse[1];
        this.rtcmConnection.iceServers.push({
          urls: turn,
          credential: password,
          username: username
        });
      }
      this.rtcmConnection.onstream = function (stream) {
        let found = that.videoList.find(video => {
          return video.id === stream.streamid
        })
        if (found === undefined) {
          let video = {
            id: stream.streamid,
            muted: stream.type === 'local'
          };

          that.videoList.push(video);

          if (stream.type === 'local') {
            that.localVideo = video;
          }
        }

        setTimeout(function(){
          for (var i = 0, len = that.$refs.videos.length; i < len; i++) {
            if (that.$refs.videos[i].id === stream.streamid)
            {
              that.$refs.videos[i].srcObject = stream.stream;
              break;
            }
          }
        }, 1000);

        that.$emit('joined-room', stream.streamid);
      };
      this.rtcmConnection.onstreamended = function (stream) {
        var newList = [];
        that.videoList.forEach(function (item) {
          if (item.id !== stream.streamid) {
            newList.push(item);
          }
        });
        that.videoList = newList;
        that.$emit('left-room', stream.streamid);
      };
    },
    methods: {
      join() {
         var that = this;
         this.rtcmConnection.openOrJoin(this.roomId, function (isRoomExist, roomid) {
          if (isRoomExist === false && that.rtcmConnection.isInitiator === true) {
            that.$emit('opened-room', roomid);
          }
        });
      },
      leave() {
        this.rtcmConnection.attachStreams.forEach(function (localStream) {
          localStream.stop();
        });
        this.videoList = [];
      },
      capture() {
        return this.getCanvas().toDataURL(this.screenshotFormat);
      },
      getCanvas() {
        let video = this.getCurrentVideo();
        if (video !== null && !this.ctx) {
          let canvas = document.createElement('canvas');
          canvas.height = video.clientHeight;
          canvas.width = video.clientWidth;
          this.canvas = canvas;
          this.ctx = canvas.getContext('2d');
        }
        const { ctx, canvas } = this;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas;
      },
      getCurrentVideo() {
        if (this.localVideo === null) {
          return null;
        }
        for (var i = 0, len = this.$refs.videos.length; i < len; i++) {
          if (this.$refs.videos[i].id === this.localVideo.id)
            return this.$refs.videos[i];
        }
        return null;
      },
      shareScreen() {
        var that = this;
        if (navigator.getDisplayMedia || navigator.mediaDevices.getDisplayMedia) {
          function addStreamStopListener(stream, callback) {
            var streamEndedEvent = 'ended';
            if ('oninactive' in stream) {
                streamEndedEvent = 'inactive';
            }
            stream.addEventListener(streamEndedEvent, function() {
                callback();
                callback = function() {};
            }, false);
          }

          function onGettingSteam(stream) {
            that.rtcmConnection.addStream(stream);
            that.$emit('share-started', stream.streamid);

            addStreamStopListener(stream, function() {
              that.rtcmConnection.removeStream(stream.streamid);
              that.$emit('share-stopped', stream.streamid);
            });
          }

          function getDisplayMediaError(error) {
            console.log('Media error: ' + JSON.stringify(error));
          }

          if (navigator.mediaDevices.getDisplayMedia) {
            navigator.mediaDevices.getDisplayMedia({video: true, audio: false}).then(stream => {
              onGettingSteam(stream);
            }, getDisplayMediaError).catch(getDisplayMediaError);
          }
          else if (navigator.getDisplayMedia) {
            navigator.getDisplayMedia({video: true}).then(stream => {
              onGettingSteam(stream);
            }, getDisplayMediaError).catch(getDisplayMediaError);
          }
        }
      },
      maximize(id) {
        let elem = document.getElementById(id);
        if (elem.requestFullscreen) {
          elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) { /* Safari */
          elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) { /* IE11 */
          elem.msRequestFullscreen();
        }
      },
      endTheCall() {
        if(this.videoList.length <= 1) {
          this.leave();
        }
      },
      getOwnVideoClass(localVideo, audio) {
        if(this.videoList.length > 1) {
          if(!audio) {
            return 'own-video'
          } else {
            return 'display-inline';
          }
        } else {
          return '';
        }
      },
      getLocalVideoClass(localVideo) {
        if(this.videoList.length > 1) {
          return 'local-video'
        } else {
          return '';
        }
      },
      getAudioDiv() {
        if(this.audio) {
          return 'audio-div';
        } else {
          return '';
        }
      }
    }
  };
</script>
<style scoped>
  .video-list {
    background: whitesmoke;
    height: auto;
  }
  .video-list div {
    padding: 0px;
  }
  .audio-div {
    /*margin: 0;*/
    /*position: absolute;*/
    /*top: 50%;*/
    /*-ms-transform: translateY(-50%);*/
    /*transform: translateY(-137%);*/
    display: inline-block;
  }
  .display-inline {
    display: inline-block;
  }
  video {
    object-fit: fill;
    height: 320px;
  }
  .own-video {
    position: absolute;
    bottom: 65px;
    right: 16px;
  }
  .local-video {
    height: 110px;
    width: 145px;
  }

  video::-webkit-media-controls-play-button {
    display: none !important;
  }
  video::-webkit-media-controls-current-time-display {
    display: none !important;
  }
  video::-webkit-media-controls-time-remaining-display {
    display: none !important;
  }
  video::-webkit-media-controls-timeline {
    display: none !important;
  }
  video::-webkit-media-controls-volume-slider {
    display: none !important;
  }
  video::-webkit-media-controls-fullscreen-button {
    display: none !important;
  }
  video::-internal-media-controls-download-button {
    display: none !important;
  }

  audio::-webkit-media-controls-play-button {
    display: none !important;
  }
  audio::-webkit-media-controls-current-time-display {
    display: none !important;
  }
  audio::-webkit-media-controls-volume-slider {
    display: none !important;
  }
  audio::-webkit-media-controls-fullscreen-button {
    display: none !important;
  }
  audio::-internal-media-controls-download-button {
    display: none !important;
  }
  audio::-webkit-media-controls-timeline {
    display: none !important;
  }
  audio::-webkit-media-controls-time-remaining-display {
    display: none !important;
  }
</style>
