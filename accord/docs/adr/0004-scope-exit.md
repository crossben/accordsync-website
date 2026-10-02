# ADR-0004: What happens when a record leaves a device's scope

- Status: accepted
- Date: 2026-10-02

## Context

Sync scopes decide which records a user may read and write. Records move out of a scope, for
example when a dossier is reassigned to another agent, possibly while the device is offline with
pending edits to it.

## Decision

1. On reconnect, the device pushes its pending ops first, including those for the record.
2. The server rejects any op that is out of the user's scope **at the time it is received**, and
   returns it as refused, with a reason.
3. The next pull carries a scope-exit marker for the record; the device deletes its local copy.
4. Refused ops are reported to the app through the client API. Nothing is dropped silently.

## Consequences

- A device never keeps data its user can no longer access.
- An agent's offline edit to a reassigned record is refused, not lost silently. The app decides how
  to tell the user.
