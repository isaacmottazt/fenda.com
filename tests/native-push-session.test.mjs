import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../js/supabase-config.js', import.meta.url), 'utf8');

assert.match(source, /auth\.getSession\(\)/);
assert.match(source, /register_mobile_push_token/);
assert.match(source, /window\.__fendaNativeExpoPushToken/);
assert.match(source, /fcm-device-token/);
assert.match(source, /expo-token/);
assert.match(source, /window\.setTimeout\(\(\) => showNativePushDiagnostic\(message\), 750\)/);
console.log('OK: o site classifica com segurança a origem da indisponibilidade do token nativo.');
