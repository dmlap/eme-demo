'use strict';

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
