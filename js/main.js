'use strict';
var src = 'car.mpd',
    player = videojs(document.querySelector('video')),
    video = player.el().querySelector('video'),
    mp4Mime = 'video/mp4; codecs="avc1.42E01E"',
    mediaSource = new MediaSource(),

    keySystem,

    request = function(url, method, data) {
      var deferred = new $.Deferred(),
          xhr = new XMLHttpRequest();
      xhr.open(method || 'GET', url);
      xhr.responseType = 'arraybuffer';
      xhr.onreadystatechange = function() {
        if (this.readyState === 4) {
          return deferred.resolveWith(this);
        }
        return deferred.notifyWith(this);
      };
      xhr.send(data);
      return deferred;
    };

// invoked when the initial video data is parsed and encryption is
// detected
video.onneedkey = video.onwebkitneedkey = function(event) {
  // seems to always be "" in Chrome 40 so add a useful default
  keySystem = event.keySystem || 'com.widevine.alpha';

  // MIME lifted from https://github.com/google/shaka-player/blob/b3d035be9f00f843535f30e9b7ee4776b7e4be1d/support.html#L38
  // Key system from https://github.com/google/shaka-player/blob/b3d035be9f00f843535f30e9b7ee4776b7e4be1d/support.html#L84
  if (!(video.canPlayType(mp4Mime, keySystem) in {
    'probably': 1,
    'maybe': 1
  })) {
    return player.error({
      type: MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED,
      message: 'Your browser does not support Widevine encrypted MP4 video'
    });
  }

  // request keys for the video from the CDM
  video.webkitGenerateKeyRequest(keySystem, event.initData);
};

// invoked when a key request (via webkitGenerateKeyRequest) is
// fulfilled
video.onkeymessage = video.onwebkitkeymessage = function(event) {
  if (!event.message) {
    throw new Error('Key request generated an invalid response');
  }

  // use the CDM keys to get a license for playbakc
  request('http://widevine-proxy.appspot.com/proxy', 'POST', event.message)
    .then(function() {
      video.webkitAddKey(keySystem, new Uint8Array(this.response), null, event.sessionId);
    });
};

// once the media source is attached to the video element, request the
// DASH manifest
mediaSource.addEventListener('sourceopen', function() {
  var sourceBuffer = mediaSource.addSourceBuffer(mp4Mime),

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
 
  $.get(src, {
    dataType: 'xml'
  })
    .then(function(mpd) {
      var base = mpd.querySelector('MPD > BaseURL').textContent,
          segmentTemplate = mpd.querySelector('SegmentTemplate'),
          drmSchemeUris = mpd.querySelectorAll('ContentProtection'),
          drmScheme = drmSchemeUris[drmSchemeUris.length - 1].getAttribute('schemeIdUri'),
          init = [
            base, 
            segmentTemplate.getAttribute('initialization')
          ].join('/'),
          segment = [
            base, 
            segmentTemplate.getAttribute('media').replace('$Number$', segmentTemplate.getAttribute('startNumber'))
          ].join('/'),
          fetchSegments;

      if (drmScheme !== 'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed') {
        throw new Error('Incompatible content protection scheme');
      }

      return request(init)
        .then(function() {
          return appendData(sourceBuffer, this.response);
        })
        .then(function() {
          return request(segment)
        })
        .then(function() {
          return appendData(sourceBuffer, this.response);
        });
    });
});

// initialize the video and kick off loading the video
video.src = URL.createObjectURL(mediaSource);
