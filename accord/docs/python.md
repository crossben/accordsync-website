# Python

Accord has Python packages for both ends. The client makes a Python program an Accord device: it
writes offline and syncs like a phone or a browser. The server speaks the same protocol, merges by
the same rules and uses the same PostgreSQL schema as `@accordsync/server`, so every Accord client
syncs with it unchanged; serve it from FastAPI or Django. They live in their own repository,
[crossben/accordsync-python](https://github.com/crossben/accordsync-python).

| Package              | What it is                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `accordsync`         | The client: local-first writes, background sync, conflicts, refusals; SQLite.            |
| `accordsync-fastapi` | The server for FastAPI: a router, and a CLI for migrations and compaction.               |
| `accordsync-django`  | The server for Django: an app with URLs, management commands and a system check.         |
| `accordsync-server`  | The sync server on PostgreSQL, framework-agnostic (and WSGI). The two above use it.      |
| `accordsync-core`    | The merge core: hybrid logical clocks, operations, `lww`, `counter`, `set_`, `conflict`. |

Python 3.11+. The server needs PostgreSQL.

## Install

```sh
pip install accordsync                    # the client
pip install accordsync-fastapi uvicorn    # the server, for FastAPI
pip install accordsync-django             # the server, for Django
```

## Open the client

Declare the same schema as your server, then open the client with SQLite storage and the HTTP
transport.

```python
from accordsync import (
    AccordClient,
    HttpTransport,
    SqliteStorage,
    conflict,
    counter,
    define_schema,
    lww,
    set_,
)

schema = define_schema(
    {"dossier": {"agent": lww(), "visits": counter(), "docs": set_(), "status": conflict()}}
)

accord = AccordClient.open(
    schema=schema,
    storage=SqliteStorage("accord.db"),
    transport=HttpTransport("https://sync.example.com", get_token=get_token),
)

accord.assign("dossier:91", "agent", "awa")
accord.inc("dossier:91", "visits", 1)
accord.on("refused", lambda r: print(f"refused {r.record}.{r.field}: {r.reason}"))
accord.start()  # sync in a background thread; or call accord.sync() for one round
```

Leave `device_id` unset: the client generates one with a secure random source and stores it.
`get_token` returns your app's current JWT; the client calls it before every request. Writes return
once they are saved on the device, online or not. `set_()` has a trailing underscore so it does not
shadow Python's `set`.

## Conflicts

```python
for c in accord.conflicts():
    print(c.record, c.field, [v.value for v in c.values])
    accord.resolve(c.record, c.field, c.values[0].value)
```

`accord.on("change", …)` reports records whose local state changed, from a local write or a sync.
Refused writes are already rolled back; tell the user.

## Define the server

`define_server()` takes the same parts as `defineServer` in TypeScript: the schema, a scope function
per record type, the access a user gets from their JWT claims, and how tokens are checked. Mount it
in FastAPI with `accord_router`:

```python
from accordsync_core import conflict, counter, define_schema, lww, set_
from accordsync_fastapi import accord_router
from accordsync_server import Access, Auth, ScopedRecord, define_server
from fastapi import FastAPI

schema = define_schema(
    {"dossier": {"agent": lww(), "visits": counter(), "docs": set_(), "status": conflict()}}
)


def dossier_scope(record: ScopedRecord) -> list[str]:
    agent = record.fields.get("agent")
    return [f"agent:{agent}"] if isinstance(agent, str) else []


server = define_server(
    schema=schema,
    scopes={"dossier": dossier_scope},
    access=lambda claims: Access(read=[f"agent:{claims['sub']}"], write=[f"agent:{claims['sub']}"]),
    auth=Auth.jwks(
        "https://auth.example.com/.well-known/jwks.json",
        issuer="https://auth.example.com/",
        audience="accord",
    ),
)

app = FastAPI()
app.include_router(accord_router(server, database_url="postgresql://…", prefix="/sync"))
```

Clients then use `https://your-app/sync` as their server URL. The router opens its connection pool
in the application's lifespan and closes it at shutdown.

## Django

```python
# settings.py
INSTALLED_APPS = [..., "accordsync_django"]
ACCORD_SERVER = "myapp.sync:server"  # the ServerDefinition above

# urls.py
urlpatterns = [path("sync/", include("accordsync_django.urls")), ...]
```

The database is `ACCORD_DATABASE_URL`, or else the `default` database, which must use
`django.db.backends.postgresql`. The sync views use their own psycopg pool, never Django's ORM
connections; they are CSRF-exempt and need no session. `manage.py check` reports a missing or wrong
`ACCORD_SERVER`. Serve with a threaded WSGI server.

## Migrations and compaction

```sh
ACCORD_DATABASE_URL=postgresql://… python -m accordsync_fastapi migrate
python manage.py accord_migrate
```

The migrations are the TypeScript server's, in the same ledger: a database migrated by either server
is up to date for the other. By default each server process compacts on the definition's interval
(default hourly) in a background thread. With several worker processes, turn that off
(`schedule_compaction=False`, or `ACCORD_SCHEDULE_COMPACTION = False`) and run
`python -m accordsync_fastapi compact --definition myapp.sync:server` or
`python manage.py accord_compact` from cron. Compaction takes a PostgreSQL advisory lock, so
overlapping runs do not conflict. Rate limits are kept in memory, per process.

## Same behaviour as TypeScript

The Python core passes the golden vectors in [`vectors/`](../vectors/) in every delivery order, and
reproduces byte for byte the snapshots of random scenarios generated by the TypeScript core. In the
Python repository's CI:

- the [server conformance suite](../conformance/README.md) runs against the Python server and
  against its FastAPI and Django example apps;
- the Python client runs against the real TypeScript server, alone and together with TypeScript
  devices over a network that loses requests and responses;
- a mixed-server fleet test runs the TypeScript and Python servers on one database at the same time,
  with Python and TypeScript devices sending each request to either server through that lossy
  network.

Each run checks every device ends with identical data.

## Check list

- [ ] The schema is identical on the server and every client.
- [ ] `get_token` returns a fresh token; the client calls it before every request.
- [ ] Refusals are shown to the user (`accord.on("refused", …)`).
- [ ] Conflicts are shown where the user can decide (`accord.conflicts()`, `accord.resolve()`).
- [ ] Production auth uses `Auth.jwks()` with an issuer and an audience; `Auth.hs256()` is for
      development and tests.
- [ ] Migrations run on deploy, and compaction runs once per interval (in-process or cron).
- [ ] The device database is protected like the rest of your program's data. Accord does not
      encrypt it.

## Prompt for an AI coding agent

Copy this into your coding agent (Claude Code, Cursor, Copilot) to add Accord to an existing app.

```text
Integrate the Accord client (accordsync 0.3.x) into this Python program.
Install: pip install "accordsync>=0.3,<0.4" (Python 3.11+).
Create:
1. The same schema as the Accord server: define_schema({...}) with lww(), counter(), set_(),
   conflict() from accordsync (set_ has a trailing underscore).
2. One client: AccordClient.open(schema=schema, storage=SqliteStorage("accord.db"),
   transport=HttpTransport(<sync URL>, get_token=get_token)); get_token returns the current JWT.
3. accord.start() for background sync in a thread, or accord.sync() for one round (scripts,
   cron); accord.close() at shutdown.
Write with accord.assign / inc / add / remove; read with accord.read(record).
Pick a merge rule for every field, deliberately:
- lww(): the latest write wins. Names, notes, simple scalars.
- counter(): every increment is summed, none is lost. Quantities, stock adjustments.
- set_(): add-wins set of elements. Tags, assigned people, attached documents.
- conflict(): concurrent values are all kept and flagged; a person decides. Use it for
  status, approvals, amounts and anything with money or legal weight. Never lww() there.
Handling:
- accord.on("refused", ...): the write was already rolled back; report r.record, r.field, r.reason.
- accord.conflicts(): show c.values to someone who can choose, then
  accord.resolve(c.record, c.field, value).
Do not:
- set device_id: the client generates and stores one; a fixed id can get writes refused.
- check the network before writing: writes are local and sync catches up.
- edit or replay ops, or write to the accord_ tables yourself.
Verify: run two copies with different SQLite files, write in both while one has no network,
sync both, and check accord.read() matches and the conflict is listed.
Docs: https://accord.benhattab.pro/docs/python/ https://accord.benhattab.pro/docs/schema/
```
