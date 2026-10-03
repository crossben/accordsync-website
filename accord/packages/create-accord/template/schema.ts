// Your records and how each field merges. Shared by the server and every client.
// lww: the latest write wins · counter: increments add up · set: add-wins set ·
// conflict: concurrent values are kept for your app (or a human) to decide.
import { conflict, counter, defineSchema, lww, set } from '@accordsync/core';

export const schema = defineSchema({
  task: {
    owner: lww(), // who the task belongs to: used by the scope rules
    title: lww(),
    tags: set(),
    time_spent: counter(),
    status: conflict(), // never decided for you
  },
});
