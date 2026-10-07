# @accordsync/core

Accord's pure merge core: hybrid logical clocks, operations, and the lww / counter / set / conflict merge strategies. No I/O.

Part of **[Accord](https://github.com/crossben/accordsync)**, offline-first sync that stays correct when
the network lies. Most apps use `@accordsync/client` and `@accordsync/server`, which re-export what they need from here.

```sh
safe-install add @accordsync/core
```

or `npm install @accordsync/core`. [safe-install](https://safe-install.benhattab.pro) installs with every
install script off and asks before running any.

Licence: Apache-2.0.
