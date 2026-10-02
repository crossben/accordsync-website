# Architecture decision records

One file per decision, numbered, never rewritten. To change a decision, add a new ADR that
supersedes the old one.

| ADR                                    | Decision                                                      |
| -------------------------------------- | ------------------------------------------------------------- |
| [0001](0001-why-accord.md)             | Why Accord                                                    |
| [0002](0002-typescript-everywhere.md)  | TypeScript everywhere                                         |
| [0003](0003-merge-strategies-v1.md)    | Four merge strategies in v1; conflicts resolved by operations |
| [0004](0004-scope-exit.md)             | Scope exit                                                    |
| [0005](0005-compaction-device-ttl.md)  | Log compaction and retired devices                            |
| [0006](0006-refused-ops-roll-back.md)  | Refused ops are rolled back on the device that wrote them     |
| [0007](0007-server-feed-and-scopes.md) | The server feed, sync scopes in code, resync on scope change  |
| [0008](0008-snapshots.md)              | Compaction folds history into record snapshots                |
