# create-accord

Scaffold an [Accord](https://github.com/crossben/accordsync) project:

```sh
npm create accord my-app
```

You get a schema, a server configuration with scope rules, PostgreSQL in Docker Compose, a
development token script, and a client that writes offline and syncs. Requires Node 22.18+ and
Docker. Licence: Apache-2.0.

Inside the project, install and run with [safe-install](https://safe-install.benhattab.pro):
`safe-install install`, then `safe-install run server` and `safe-install run client`. It installs
packages with every install script off and asks before running any.
