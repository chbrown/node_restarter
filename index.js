#!/usr/bin/env node
'use strict'; /*jslint node: true, es5: true, indent: 2 */ /*globals setImmediate */
var _ = require('underscore');
var async = require('async');
var child_process = require('child_process');
var fs = require('fs');
var glob = require('glob');

function matchFiles(includes, excludes, callback) {
  // callback signature: (err, filepaths)
  var files = {};
  async.map(includes, glob, function(err1, include_files)  {
    var includes = Array.prototype.concat.apply([], include_files);
    async.map(excludes, glob, function(err2, exclude_files)  {
      var excludes = Array.prototype.concat.apply([], exclude_files);
      var includes_minus_excludes = _.difference(includes, excludes);
      callback(err1 || err2, _.uniq(includes_minus_excludes));
    });
  });
}

if (require.main === module) {
  // don't use optimist because we can't tell optimist to keep
  //  everything flat that's not a specified option.
  var includes = ['**/*.js', '**/*.mu'];
  // specified on the command line by a ! in front of them.
  var excludes = ['node_modules/**/*.js', 'node_modules/**/*.mu'];
  // if (globpath[0] == '!') {
  //   excludes.push(minimatch.filter(globpath.slice(1)));
  // }
  // else {
  //   includes.push(globpath);
  // }

  // argv[0] = 'node', argv[1] = 'index.js', ...
  var command = process.argv[2];
  if (command[0] !== '/') {
    command = './' + command;
  }
  var args = process.argv.slice(3);

  console.log('- node_restarter: ' + command + ' ' + args.join(' '));

  matchFiles(includes, excludes, function(err, filepaths) {
    var watchers = [];
    var restart = function() {
      watchers.forEach(function(watcher) { watcher.close(); });
      var child = child_process.spawn(command, args, {stdio: 'inherit'});

      var change_debounced = _.debounce(function(filepath) {
        console.error(filepath + ' changed');
        child.kill();
      }, 250, true);

      watchers = filepaths.map(function(filepath) {
        return fs.watch(filepath, {persistent: false}, function(event) {
          change_debounced(filepath);
        });
      });

      child.on('exit', restart_500);

      process.on('exit', function (code) {
        child.kill();
        watchers.forEach(function(watcher) { watcher.close(); });
      });

    };
    var restart_500 = _.debounce(restart, 500, true);
    restart();
  });
}
