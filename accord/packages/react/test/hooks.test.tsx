import { act, render, screen } from '@testing-library/react';
import {
  AccordClient,
  conflict,
  counter,
  defineSchema,
  lww,
  MemoryStorage,
  type Transport,
} from '@accordsync/client';
import { describe, expect, it } from 'vitest';
import { encodeOp } from '@accordsync/core';
import { AccordProvider, useConflicts, useRecord, useRecords, useSyncStatus } from '../src/index';

const schema = defineSchema({ dossier: { name: lww(), visits: counter(), status: conflict() } });
const offline: Transport = {
  push: () => Promise.reject(new Error('offline')),
  pull: () => Promise.reject(new Error('offline')),
};
const open = (deviceId: string, transport: Transport = offline) =>
  AccordClient.open({ schema, storage: new MemoryStorage(), transport, deviceId });

describe('@accordsync/react', () => {
  it('re-renders a record on local writes, and only that record', async () => {
    const client = await open('d1');
    const renders: Record<string, number> = { one: 0, two: 0 };
    function Visits({ id, tag }: { id: string; tag: string }) {
      renders[tag]!++;
      const r = useRecord(id);
      return <p data-testid={tag}>{String(r?.visits ?? 'none')}</p>;
    }
    render(
      <AccordProvider client={client}>
        <Visits id="dossier:1" tag="one" />
        <Visits id="dossier:2" tag="two" />
      </AccordProvider>,
    );
    expect(screen.getByTestId('one').textContent).toBe('none');
    await act(() => client.inc('dossier:1', 'visits', 2));
    expect(screen.getByTestId('one').textContent).toBe('2');
    expect(screen.getByTestId('two').textContent).toBe('none');
    // An unchanged record keeps its cached value, so React does not re-render it at all.
    const before = renders.two!;
    await act(() => client.inc('dossier:1', 'visits', 1));
    expect(screen.getByTestId('one').textContent).toBe('3');
    expect(renders.two).toBe(before);
  });

  it('lists records, surfaces conflicts arriving by sync, and tracks pending changes', async () => {
    // Another device approved while this one rejected: the server delivers its op on the next pull.
    const other = await open('d3');
    const theirs = encodeOp(await other.assign('dossier:a', 'status', 'approved'));
    let delivered = false;
    const transport: Transport = {
      push: async (_device, ops) => ({ acked: ops.map((o) => o.op_id), refused: [] }),
      pull: async () => {
        const items = delivered ? [] : [{ type: 'op' as const, op: theirs }];
        delivered = true;
        return { items, cursor: 1, has_more: false };
      },
    };
    const client = await open('d2', transport);
    function View() {
      const ids = useRecords('dossier');
      const conflicts = useConflicts();
      const status = useSyncStatus();
      return (
        <p data-testid="v">
          {ids.join(',')}|{conflicts.length}|{status.pending}
        </p>
      );
    }
    render(
      <AccordProvider client={client}>
        <View />
      </AccordProvider>,
    );
    expect(screen.getByTestId('v').textContent).toBe('|0|0');
    await act(async () => {
      await client.assign('dossier:a', 'status', 'rejected');
      await client.assign('dossier:b', 'name', 'Moussa');
    });
    expect(screen.getByTestId('v').textContent).toBe('dossier:a,dossier:b|0|2');
    await act(() => client.sync());
    expect(screen.getByTestId('v').textContent).toBe('dossier:a,dossier:b|1|0');
  });

  it('throws a helpful error without a provider', () => {
    function Bad() {
      useRecord('dossier:1');
      return null;
    }
    expect(() => render(<Bad />)).toThrow(/AccordProvider/);
  });
});
