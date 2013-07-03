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
  // if (globpath[0] == '!') {
  //   excludes.push(minimatch.filter(globpath.slice(1)));
  // }
  // else {
  //   includes.push(globpath);
  // }
}

function run(command, args, filepaths) {
  var child;

  var change = function(filepath) {
    child.kill();
  };
  var change_2000 = _.debounce(change, 2000, true);

  var watchers = filepaths.map(function(filepath) {
    return fs.watch(filepath, {persistent: false}, function(event) {
      // event is either 'rename' or 'change'
      console.error('[%d] file %sd: %s', Date.now(), event, filepath);
      change_2000(filepath);
    });
  });
  var unwatch = function() {
    // unwatch all watched files
    watchers.forEach(function(watcher) { watcher.close(); });
  };

  var start = function() {
    console.error('[%d] child starting. %s %s', Date.now(), command, args.join(' '));
    child = child_process.spawn(command, args, {stdio: 'inherit'});
    child.on('exit', function(code, signal) {
      console.error('[%d] child exited. code: %d, signal: %s', Date.now(), code, signal);
      start_1000();
    });
  };
  var start_1000 = _.debounce(start, 1000, false);

  process.on('exit', function (code, signal) {
    console.error('[%d] node_restarter exiting. code: %d, signal: %s', Date.now(), code, signal);
    child.kill();
    unwatch();
  });

  start();
}

function main() {
  // don't use optimist because we can't tell optimist to keep
  //  everything flat that's not a specified option.
  var includes = ['**/*.js', '**/*.mu'];
  // specified on the command line by a ! in front of them.
  var excludes = ['node_modules/**/*.js', 'node_modules/**/*.mu'];

  // argv[0] = 'node', argv[1] = 'index.js', ...
  var command = process.argv[2];
  if (command[0] !== '/') {
    command = './' + command;
  }
  var args = process.argv.slice(3);


  matchFiles(includes, excludes, function(err, filepaths) {
    console.log('node_restarter watching %d files', filepaths.length);
    if (err) throw err;
    run(command, args, filepaths);
  });
}

if (require.main === module) main(); // closures are nice
