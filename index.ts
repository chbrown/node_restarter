/// <reference path="type_declarations/index.d.ts" />
import child_process = require('child_process');
import fs = require('fs');
import minimatch = require('minimatch');

const debounce_wait = parseInt(process.env.DEBOUNCE || '2000', 10)

function testFilename(filename: string, minimatches: minimatch.IMinimatch[]) {
  var total_match = false;
  // total_match reflects the result of the last minimatch that matches successfully
  for (var i = 0, minimatch: minimatch.IMinimatch; (minimatch = minimatches[i]) !== undefined; i++) {
    var minimatch_matches = minimatch.match(filename);
    // since we set {flipNegate: true} when compiling the Minimatch,
    // `minimatch_matches` reflects whether the pattern, without the !, matches
    // the filename (i.e., we are responsible for interpreting the `negate`
    // flag, instead of minimatch).
    if (minimatch_matches) {
      total_match = !minimatch.negate;
    }
  }
  return total_match;
}

function timestamp() {
  return Date.now();
}
function log(str: string) {
  process.stderr.write(str);
}

export function start(command: string, args: string[], patterns: string[]) {
  var child;
  function startChild() {
    log(`[${timestamp()}] child starting...\r`);
    // "${command} ${args.join(' ')}"
    child = child_process.spawn(command, args, {stdio: 'inherit'});
    log(`[${timestamp()}] child[pid=${child.pid}] started\n`);
    child.on('exit', childExit);
  }
  function childExit(code, signal) {
    log(`[${timestamp()}] child[pid=${child.pid}] exited: code=${code}, signal=${signal}\n`);
    startChild();
  }
  startChild();

  // debouncedKill() calls the function immediately, but ignores subsequent
  // calls for `debounce_wait` milliseconds
  var last_kill = 0;
  function debouncedKill() {
    var since_last_kill = Date.now() - last_kill;
    if (since_last_kill > debounce_wait) {
      child.kill('SIGINT');
      last_kill = Date.now();
    }
    else {
      log(`[${timestamp()}] kill message too soon after last kill\r`);
    }
  }

  var minimatches = patterns.map(pattern => new minimatch.Minimatch(pattern, {flipNegate: true}));

  var fs_watcher = fs.watch(process.cwd(), {
    persistent: false,
    recursive: true
  }, (event, filename) => {
    // event is either 'rename' or 'change'
    log(`[${timestamp()}] file ${event}d: ${filename}\n`);
    if (testFilename(filename, minimatches)) {
      debouncedKill();
    }
  });

  process.on('exit', (code, signal) => {
    log(`node_restarter exiting. code: ${code}, signal: ${signal}\n`);
    child.kill('SIGTERM');
    fs_watcher.close(); // unnecessary, probably
  });
}
