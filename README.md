# node_restarter

Just a simple script to monitor changes to compiled files in or below the current directory.

By default, it uses [node-glob](https://github.com/isaacs/node-glob) to find `*.js` and `*.mu` files in subdirectories.

# Directions

    node_restarter superfierce_app.js
    node_restarter node myapp.js --password yeehaw

## License

Copyright © 2012-2013 Christopher Brown. [MIT Licensed](http://chbrown.github.io/licenses/MIT/#2012-2013).
