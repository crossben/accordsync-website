// Shared by the server config and the field-app example: both sides must declare the same schema.
import { conflict, counter, defineSchema, lww, set } from '@accordsync/core';

export const schema = defineSchema({
  dossier: {
    agent: lww(),
    zone: lww(),
    client_name: lww(),
    documents: set(),
    visits: counter(),
    status: conflict(), // never auto-resolved
  },
});
