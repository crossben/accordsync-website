# Java

Accord has Java modules for both ends. The client makes a Java or Kotlin program an Accord device: it
writes offline and syncs like a phone or a browser. The server speaks the same protocol, merges by
the same rules and uses the same PostgreSQL schema as `@accordsync/server`, so every Accord client
syncs with it unchanged; serve it from Spring Boot with the starter. They live in their own
repository, [crossben/accordsync-java](https://github.com/crossben/accordsync-java), and are
published on Maven Central under `io.github.crossben`.

| Artifact                         | What it is                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| `accordsync-client`              | The client: local-first writes, background sync, conflicts, refusals; SQLite (JDBC).         |
| `accordsync-spring-boot-starter` | The server for Spring Boot: auto-configuration, properties, endpoints, scheduled compaction. |
| `accordsync-server`              | The sync server on PostgreSQL, framework-agnostic. The starter uses it.                      |
| `accordsync-core`                | The merge core: hybrid logical clocks, operations, `lww`, `counter`, `set`, `conflict`.      |

Java 17+ (usable from Kotlin and Android). The server needs PostgreSQL; the starter targets Spring
Boot 4.1.

## Install

Maven:

```xml
<!-- the client; sqlite-jdbc is optional, add it for JdbcStorage.sqlite(...) -->
<dependency>
  <groupId>io.github.crossben</groupId>
  <artifactId>accordsync-client</artifactId>
  <version>0.3.1</version>
</dependency>
<dependency>
  <groupId>org.xerial</groupId>
  <artifactId>sqlite-jdbc</artifactId>
  <version>3.53.4.0</version>
</dependency>

<!-- the server, for Spring Boot (next to spring-boot-starter-webmvc) -->
<dependency>
  <groupId>io.github.crossben</groupId>
  <artifactId>accordsync-spring-boot-starter</artifactId>
  <version>0.3.1</version>
</dependency>
```

Gradle:

```kotlin
implementation("io.github.crossben:accordsync-client:0.3.1")
implementation("org.xerial:sqlite-jdbc:3.53.4.0")
implementation("io.github.crossben:accordsync-spring-boot-starter:0.3.1")
```

## Open the client

Declare the same schema as your server, then open the client with SQLite storage and the HTTP
transport.

```java
import static io.github.crossben.accordsync.core.Strategy.conflict;
import static io.github.crossben.accordsync.core.Strategy.counter;
import static io.github.crossben.accordsync.core.Strategy.lww;
import static io.github.crossben.accordsync.core.Strategy.set;

import io.github.crossben.accordsync.client.AccordClient;
import io.github.crossben.accordsync.client.HttpTransport;
import io.github.crossben.accordsync.client.JdbcStorage;
import io.github.crossben.accordsync.core.Schema;
import java.util.Map;

Schema schema = Schema.define(Map.of(
        "dossier", Map.of("agent", lww(), "visits", counter(), "docs", set(), "status", conflict())));

AccordClient accord = AccordClient.open(AccordClient.options()
        .schema(schema)
        .storage(JdbcStorage.sqlite("accord.db"))
        .transport(new HttpTransport("https://sync.example.com", () -> auth.currentJwt())));

accord.assign("dossier:91", "agent", "awa");
accord.inc("dossier:91", "visits", 1);
accord.onRefused(r -> System.out.println("refused " + r.record() + "." + r.field() + ": " + r.reason()));
accord.start(); // sync on a background thread; or call accord.sync() for one round
```

Leave the device id unset: the client generates one with `SecureRandom` and stores it. The token
supplier returns your app's current JWT; the client calls it before every request. Writes return
once they are saved on the device, online or not. `AccordClient` is thread-safe and
`AutoCloseable`: `close()` stops background sync and closes the storage. `JdbcStorage.of(...)` takes
a `Connection` or a `DataSource` instead of a file; on Android, implement `StorageAdapter`.
`MemoryStorage` keeps nothing on disk (tests).

## Conflicts

```java
for (ConflictInfo c : accord.conflicts()) {
    System.out.println(c.record() + " " + c.field() + " " + c.values());
    accord.resolve(c.record(), c.field(), c.values().get(0).value());
}
```

`accord.onChange(...)` reports records whose local state changed, from a local write or a sync.
Refused writes are already rolled back; tell the user. Every `on...` method returns a
`Subscription`; call `unsubscribe()` to remove the listener.

## Define the server

With the starter, the whole integration is one `ServerDefinition` bean. It takes the same parts as
`defineServer` in TypeScript: the schema, a scope function per record type, the access a user gets
from their JWT claims, and how tokens are checked.

```java
@Configuration
public class SyncConfig {
    @Bean
    public ServerDefinition accordDefinition() {
        Schema schema = Schema.define(Map.of(
                "dossier", Map.of("agent", lww(), "visits", counter(), "docs", set(), "status", conflict())));
        return AccordServer.define(d -> d
                .schema(schema)
                .scope("dossier", r -> r.string("agent") == null ? List.of() : List.of("agent:" + r.string("agent")))
                .access(claims -> Access.readWrite("agent:" + ((JsonString) claims.get("sub")).value()))
                .auth(Auth.jwks("https://auth.example.com/.well-known/jwks.json")
                        .issuer("https://auth.example.com/")
                        .audience("accord")));
    }
}
```

The starter serves `/v1/push`, `/v1/pull` and `/health` on the app's own `DataSource` (HikariCP),
and adds an "accord" component to `/actuator/health` when Actuator is present. Set
`accord.path-prefix=/sync` to serve `/sync/v1/push` instead; clients then use
`https://your-app/sync` as their server URL. CORS comes only from the definition (`cors(origins)`).
With Spring Security, let the sync paths through: the server checks the JWT itself.

## Migrations and compaction

```properties
accord.migrate-on-startup=true   # default: pending migrations run when the server starts
accord.compaction.enabled=true   # default: compaction on the definition's interval (hourly)
```

The migrations are the TypeScript server's, in the same ledger: a database migrated by either server
is up to date for the other, and concurrent startups are safe. Without Spring, `Migrations.migrate(dataSource)`
and `server.compact()` do the same; `io.github.crossben.accordsync.server.Cli migrate|compact` runs
them from the command line. Compaction takes a PostgreSQL advisory lock, so overlapping runs do not
conflict. Rate limits are kept in memory, per instance.

## Same behaviour as TypeScript

The Java core passes the golden vectors in [`vectors/`](../vectors/) in every delivery order, and
the random vectors generated by the TypeScript core. In the Java repository's CI:

- the [server conformance suite](../conformance/README.md) runs against the Java server and against
  its Spring Boot example app;
- the Java client runs against the real TypeScript server, alone and together with TypeScript
  devices over a network that loses requests and responses;
- a mixed-server fleet test runs the TypeScript and Java servers on one database at the same time,
  with Java and TypeScript devices sending each request to either server through that lossy
  network.

Each run checks every device ends with identical data.

## Check list

- [ ] The schema is identical on the server and every client.
- [ ] The token supplier returns a fresh token; the client calls it before every request.
- [ ] Refusals are shown to the user (`accord.onRefused(...)`).
- [ ] Conflicts are shown where the user can decide (`accord.conflicts()`, `accord.resolve()`).
- [ ] Production auth uses `Auth.jwks()` with an issuer and an audience; `Auth.hs256()` is for
      development and tests.
- [ ] Migrations run on deploy, and compaction runs once per interval.
- [ ] The device database is protected like the rest of your program's data. Accord does not
      encrypt it.

## Prompt for an AI coding agent

Copy this into your coding agent (Claude Code, Cursor, Copilot) to add Accord to an existing app.

```text
Integrate the Accord client (io.github.crossben:accordsync-client 0.3.x) into this Java program.
Install: add io.github.crossben:accordsync-client:0.3.1 and org.xerial:sqlite-jdbc (Java 17+).
Create:
1. The same schema as the Accord server: Schema.define(Map.of(...)) with lww(), counter(), set(),
   conflict() from io.github.crossben.accordsync.core.Strategy.
2. One client: AccordClient.open(AccordClient.options().schema(schema)
   .storage(JdbcStorage.sqlite("accord.db"))
   .transport(new HttpTransport(<sync URL>, () -> <current JWT>))).
3. accord.start() for background sync on a daemon thread, or accord.sync() for one round
   (scripts, batch jobs); accord.close() at shutdown.
Write with accord.assign / inc / add / remove; read with accord.read(record) (an Optional<JsonObject>).
Pick a merge rule for every field, deliberately:
- lww(): the latest write wins. Names, notes, simple scalars.
- counter(): every increment is summed, none is lost. Quantities, stock adjustments.
- set(): add-wins set of elements. Tags, assigned people, attached documents.
- conflict(): concurrent values are all kept and flagged; a person decides. Use it for
  status, approvals, amounts and anything with money or legal weight. Never lww() there.
Handling:
- accord.onRefused(r -> ...): the write was already rolled back; report r.record(), r.field(), r.reason().
- accord.conflicts(): show c.values() to someone who can choose, then
  accord.resolve(c.record(), c.field(), value).
Do not:
- set deviceId(...): the client generates and stores one; a fixed id can get writes refused.
- check the network before writing: writes are local and sync catches up.
- edit or replay ops, or write to the accord_ tables yourself.
Verify: run two copies with different SQLite files, write in both while one has no network,
sync both, and check accord.read() matches and the conflict is listed.
Docs: https://accord.benhattab.pro/docs/java/ https://accord.benhattab.pro/docs/schema/
```
