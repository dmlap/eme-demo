'use strict';

// serve MPD files with an XML MIME type
var serve = require('grunt-contrib-connect/node_modules/connect/node_modules/serve-static');
serve.mime.define({
  'application/xml': ['mpd', 'xml']
});

module.exports = function(grunt) {
  grunt.initConfig({
    connect: {
      server: {
        options: {
          port: 8001,
          keepalive: true
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-connect');
};
