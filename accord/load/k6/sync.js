// Load test: N devices push batches of ops and pull pages against one Accord server.
//   docker compose up -d --build
//   k6 run -e VUS=100 -e DURATION=60s load/k6/sync.js
// Each virtual user is one device of one agent. Agents share zones, so pulls carry other
// devices' ops, like a real field team.
import { check } from 'k6';
import crypto from 'k6/crypto';
import encoding from 'k6/encoding';
import exec from 'k6/execution';
import http from 'k6/http';
import { Trend, Counter } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://localhost:8080';
const SECRET = __ENV.SECRET || 'dev-secret-change-me-at-least-32-bytes';
const BATCH = Number(__ENV.BATCH || 10);
const ZONES = Number(__ENV.ZONES || 10);

export const options = {
  scenarios: {
    devices: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || 50),
      duration: __ENV.DURATION || '60s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
  },
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'],
};

const pushMs = new Trend('accord_push_ms', true);
const pullMs = new Trend('accord_pull_ms', true);
const opsPushed = new Counter('accord_ops_pushed');
const itemsPulled = new Counter('accord_items_pulled');

const b64 = (s) => encoding.b64encode(s, 'rawurl');
function jwt(sub, zones) {
  const head = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64(JSON.stringify({ sub, zones, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const sig = crypto.hmac('sha256', SECRET, `${head}.${body}`, 'base64rawurl');
  return `${head}.${body}.${sig}`;
}

// Per-VU state (each VU runs in its own JS runtime).
let me;
let seq = 0;
let counter = 0;
let lastWall = 0;
let cursor = 0;

function hlc() {
  const now = Date.now();
  if (now > lastWall) {
    lastWall = now;
    counter = 0;
  } else counter++;
  return `${lastWall}:${String(counter).padStart(5, '0')}:${me.device}`;
}

export default function () {
  if (!me) {
    const vu = exec.vu.idInTest;
    const zone = `z${vu % ZONES}`;
    me = {
      device: `k6-${exec.scenario.name}-${vu}-${Date.now() % 100000}`,
      zone,
      own: `dossier:${vu}-${Date.now() % 100000}`,
      shared: `dossier:shared-${zone}`,
      token: jwt(`agent${vu}`, [zone]),
    };
  }
  const headers = {
    Authorization: `Bearer ${me.token}`,
    'Accord-Device': me.device,
    'Content-Type': 'application/json',
  };

  const ops = [];
  if (seq === 0) {
    ops.push(op(me.own, 'zone', 'assign', { value: me.zone, deps: [] }));
    ops.push(op(me.shared, 'zone', 'assign', { value: me.zone, deps: [] }));
  }
  while (ops.length < BATCH) {
    const target = Math.random() < 0.5 ? me.own : me.shared;
    const r = Math.random();
    if (r < 0.6) ops.push(op(target, 'visits', 'inc', { by: 1 }));
    else if (r < 0.8) ops.push(op(target, 'client_name', 'assign', { value: `n${seq}`, deps: [] }));
    else ops.push(op(target, 'documents', 'add', { element: `doc-${seq % 7}` }));
  }

  const push = http.post(`${BASE}/v1/push`, JSON.stringify({ ops }), {
    headers,
    tags: { name: 'push' },
  });
  pushMs.add(push.timings.duration);
  check(push, {
    'push 200': (r) => r.status === 200,
    'push all acked': (r) => r.status === 200 && r.json('acked').length === ops.length,
  });
  if (push.status === 200) opsPushed.add(push.json('acked').length);

  const pull = http.get(`${BASE}/v1/pull?cursor=${cursor}&limit=500`, {
    headers,
    tags: { name: 'pull' },
  });
  pullMs.add(pull.timings.duration);
  check(pull, { 'pull 200': (r) => r.status === 200 });
  if (pull.status === 200) {
    const body = pull.json();
    if (body.items) {
      cursor = body.cursor;
      itemsPulled.add(body.items.length);
    }
  }
}

function op(record, field, kind, rest) {
  seq++;
  return { op_id: `${me.device}:${seq}`, record, field, kind, hlc: hlc(), ...rest };
}
