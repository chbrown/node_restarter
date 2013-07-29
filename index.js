#!/usr/bin/env node
'use strict'; /*jslint node: true, es5: true, indent: 2 */ /*globals setImmediate */
var _ = require('underscore');
var async = require('async');
var child_process = require('child_process');
var fs = require('fs');
var glob = require('glob');
var minimatch = require('minimatch');

var EXITS = {
  SIGINT: 130,
};

function matchFiles(includes, exclude_pattern, callback) {
  // callback signature: (err, filepaths)
  // console.error('matchFiles(' + includes + ',' + exclude_pattern + ')');
  var excludeFunction = minimatch.filter(exclude_pattern);
  async.map(includes, glob, function(err, include_files)  {
    var files = _.chain(include_files)
      .flatten(true)
      .uniq()
      .reject(excludeFunction)
      .value();
    callback(err, files);
  });
}

function run(command, args, filepaths) {
  var child;

  var change = function(filepath) {
    child.kill('SIGINT');
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
      // if a file was changed, code = EXITS.SIGINT, and we should restart immediately
      if (code == EXITS.SIGINT) {
        start();
      }
      else {
        start_1000();
      }
    });
  };
  // start_1000 has immediate=false, so that it
  var start_1000 = _.debounce(start, 1000, false);

  process.on('exit', function (code, signal) {
    console.error('[%d] node_restarter exiting. code: %d, signal: %s', Date.now(), code, signal);
    child.kill('SIGTERM');
    unwatch();
  });

  start();
}

function main() {
  // don't use optimist because we can't tell optimist to keep
  //  everything flat that's not a specified option.

  // argv[0] = 'node', argv[1] = 'index.js', argv[2] = 'your-app.js', argv[3] = '--port', ...
  var args = process.argv.slice(2);

  // the last argument will always be the full command.
  // if ONLY one argument is given, assume it is an executable script, and watch some default files
  var includes = args.slice(0, -1);
  var exclude_pattern = '';
  if (!includes.length) {
    // assume node.js and mustache defaults
    includes = ['**/*.js', '**/*.mu'];
    exclude_pattern = 'node_modules/**/*.{js,mu}';
  }

  // should shlex this or something
  var commands = _.last(args).split(' ');
  if (commands.length == 1 && commands[0] !== '/') {
    // assume that, if only one command is specified, that it is an executable with a hashbang
    commands[0] = './' + commands[0];
  }

  matchFiles(includes, exclude_pattern, function(err, filepaths) {
    console.log('node_restarter watching %d files', filepaths.length);
    if (err) {
      throw err;
    }
    else {
      run(commands[0], commands.slice(1), filepaths);
    }
  });
}

if (require.main === module) main(); // closures are nice
