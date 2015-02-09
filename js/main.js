'use strict';
var src = 'car.mpd',
    player = videojs(document.querySelector('video')),
    video = player.el().querySelector('video'),
    mp4Mime = 'video/mp4; codecs="avc1.42E01E"',
    mediaSource = new MediaSource();

video.onneedkey = video.onwebkitneedkey = function() {
  // MIME lifted from https://github.com/google/shaka-player/blob/b3d035be9f00f843535f30e9b7ee4776b7e4be1d/support.html#L38
  // Key system from https://github.com/google/shaka-player/blob/b3d035be9f00f843535f30e9b7ee4776b7e4be1d/support.html#L84
  if (!(video.canPlayType(mp4Mime, 'com.widevine.alpha') in {
    'probably': 1,
    'maybe': 1
  })) {
    return player.error({
      type: MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED,
      message: 'Your browser does not support Widevine encrypted MP4 video'
    });
  }
};
mediaSource.addEventListener('sourceopen', function() {
  var sourceBuffer = mediaSource.addSourceBuffer(mp4Mime),

      getData = function(url) {
        var deferred = new $.Deferred(),
            xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.responseType = 'arraybuffer';
        xhr.onreadystatechange = function() {
          if (this.readyState === 4) {
            return deferred.resolveWith(this);
          }
          return deferred.notifyWith(this);
        };
        xhr.send(null);
        return deferred;
      },

      appendData = function(sourceBuffer, data) {
        var deferred = new $.Deferred();
        if (!sourceBuffer.updating) {
          sourceBuffer.appendBuffer(data);
          return deferred.resolveWith();
        }
        sourceBuffer.addEventListener('updateend', function(event) {
          sourceBuffer.appendBuffer(data)
          return deferred.resolveWith(event);
        });
        sourceBuffer.addEventListener('error', function(event) {
          return deferred.rejectWith(event);
        });
        return deferred;
      };
 
  $.get(src)
    .then(function(mpd) {
      var base = mpd.querySelector('MPD > BaseURL').textContent,
          segmentTemplate = mpd.querySelector('SegmentTemplate'),
          init = [
            base, 
            segmentTemplate.getAttribute('initialization')
          ].join('/'),
          segment = [
            base, 
            segmentTemplate.getAttribute('media').replace('$Number$', segmentTemplate.getAttribute('startNumber'))
          ].join('/'),
          fetchSegments;
      return getData(init)
        .then(function() {
          return appendData(sourceBuffer, this.response);
        })
        .then(function() {
          return getData(segment)
        })
        .then(function() {
          return appendData(sourceBuffer, this.response);
        });
    });
});

// initialize the video and kick off loading the video
video.src = URL.createObjectURL(mediaSource);
