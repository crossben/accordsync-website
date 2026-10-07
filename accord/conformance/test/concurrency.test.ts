import { beforeEach, describe, expect, it } from 'vitest';
import { control, Device, opIds, type WireOp } from './accord';

/**
 * ADR-0010: pushes run concurrently, and a pull only reads up to the oldest transaction still
 * running, so no reader ever moves its cursor past an op that commits later.
 */
describe('concurrent pushes and pulls (ADR-0010)', () => {
  beforeEach(async () => {
    await control.reset();
  });

  it('every acked op reaches every reader exactly once, while pushes and pulls overlap', async () => {
    const WRITERS = 8;
    const BATCHES = 8;
    const writers = await Promise.all(
      Array.from({ length: WRITERS }, (_, i) => Device.of(`w${i}`, `u${i}`, { zones: ['all'] })),
    );
    const readers = await Promise.all(
      [0, 1, 2].map((i) => Device.of(`r${i}`, `reader${i}`, { readonly_zones: ['all'] })),
    );

    const acked = new Set<string>();
    // dossier:shared is created first (zone all), so every writer may then write it.
    const creator = writers[0]!;
    const created = await creator.pushOk([
      creator.assign('dossier:shared', 'zone', 'all'),
      creator.inc('dossier:shared', 'visits'),
    ]);
    for (const id of created.acked) acked.add(id);
    let done = false;
    const pushing = Promise.all(
      writers.map(async (w, i) => {
        const record = `dossier:${i}`;
        // Batches built in write order (op numbers increase), as a client pushes its outbox.
        const batches: WireOp[][] = [];
        for (let b = 0; b < BATCHES; b++) {
          const batch =
            b === 0
              ? [w.assign(record, 'agent', `u${i}`), w.assign(record, 'zone', 'all')]
              : [w.inc(record, 'visits'), w.add(record, 'docs', `d${b}`)];
          batch.push(w.inc(record, 'visits'));
          // Every writer also writes a shared record, so pushes contend for the same row lock.
          if (i > 0) batch.push(w.inc('dossier:shared', 'visits'));
          batches.push(batch);
        }
        for (const batch of batches) {
          // Each batch is sent twice at once: a retry racing the original.
          const [x, y] = await Promise.all([w.pushOk(batch), w.pushOk(batch)]);
          expect(x.refused).toEqual([]);
          expect(new Set(y.acked)).toEqual(new Set(x.acked));
          for (const id of x.acked) acked.add(id);
        }
      }),
    ).finally(() => (done = true));

    const seen = readers.map(() => [] as string[]);
    const reading = readers.map(async (r, i) => {
      while (!done) {
        seen[i]!.push(...opIds(await r.pullAll(4)));
        await new Promise((res) => setTimeout(res, 15));
      }
    });
    await pushing;
    await Promise.all(reading);
    for (const [i, r] of readers.entries()) seen[i]!.push(...opIds(await r.pullAll(4)));

    expect(acked.size).toBeGreaterThan(WRITERS * BATCHES * 3);
    for (const ids of seen) {
      expect(ids.length).toBe(new Set(ids).size); // nothing twice
      expect(new Set(ids)).toEqual(acked); // nothing skipped, nothing extra
    }
  }, 60_000);

  it('a pull never moves past a transaction still running: its ops arrive once it commits', async () => {
    const early = await Device.of('early', 'early', { zones: ['z'] });
    const late = await Device.of('late', 'late', { zones: ['z'] });
    const reader = await Device.of('reader', 'reader', { readonly_zones: ['z'] });
    await early.pushOk([early.assign('dossier:held', 'zone', 'z')]);
    expect(opIds(await reader.pullAll())).toEqual(['early:1']);

    // The early push starts first and stays open: it creates dossier:a (its transaction now writes)
    // and then waits for the row lock on dossier:held.
    await control.holdRecord('dossier:held');
    let slow: ReturnType<Device['pushOk']> | undefined;
    try {
      slow = early.pushOk([
        early.assign('dossier:a', 'zone', 'z'),
        early.inc('dossier:held', 'visits'),
      ]);
      for (let i = 0; (await control.held()).waiting < 1; i++) {
        if (i > 200) throw new Error('the push never waited for the held record');
        await new Promise((r) => setTimeout(r, 25));
      }
      // A later transaction commits while the early one is still open.
      expect((await late.pushOk([late.assign('dossier:b', 'zone', 'z')])).acked).toEqual([
        'late:1',
      ]);
      // Whatever this pull returns, its cursor must not pass the early transaction.
      const during = opIds(await reader.pullAll());
      expect(during).not.toContain('early:2');
      await control.release();
      expect((await slow).acked).toEqual(['early:2', 'early:3']);
      const after = opIds(await reader.pullAll());
      expect(new Set([...during, ...after])).toEqual(new Set(['late:1', 'early:2', 'early:3']));
      expect(during.length + after.length).toBe(3);
    } finally {
      await control.release();
      await slow?.catch(() => undefined);
    }
  });

  it('simultaneous pulls from one device all succeed (no 500 from a serialization conflict)', async () => {
    const d = await Device.of('busy-phone', 'busy', { zones: ['z'] });
    await d.pushOk([d.assign('dossier:1', 'zone', 'z'), d.inc('dossier:1', 'visits')]);
    for (let round = 0; round < 5; round++) {
      const answers = await Promise.all(Array.from({ length: 8 }, () => d.pullRaw(0)));
      expect(answers.map((a) => a.status)).toEqual(Array(8).fill(200));
    }
  });
});
