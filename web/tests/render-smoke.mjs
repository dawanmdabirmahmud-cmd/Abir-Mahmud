// SSR verification only, not a substitute for authenticated browser interaction.
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createElement} from 'react';
import {renderToString} from 'react-dom/server';
import assert from 'node:assert/strict';
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','app/dashboard.tsx','--outDir','.sites-runtime/render-smoke','--jsx','react-jsx','--target','es2022','--module','esnext','--moduleResolution','bundler','--allowJs','--skipLibCheck'],{stdio:'inherit'});
const {default:Dashboard}=await import(pathToFileURL(resolve('.sites-runtime/render-smoke/app/dashboard.js')).href);
const election={id:'E1',title:'SSR Demo',state:'OPEN',created:'2026-10-24'};
const snapshot={election,candidates:[{id:'C1',label:'Alice',votes:1},{id:'C2',label:'Bob',votes:0}],voters:[{id:'V1',voted:1},{id:'V2',voted:0}],audit:[{id:'A1',voter:'V1',code:'ACCEPTED',created:'2026-10-24T10:00:00Z'}],stats:{accepted:1,rejected:0,attempts:1}};
const html=renderToString(createElement(Dashboard,{initialElections:[election],initialSnapshot:snapshot}));
for(const label of ['SSR Demo','Accepted votes','Voter roster','Search audit','Results CSV','Copy election settings'])assert.ok(html.includes(label),label);
assert.ok(!html.includes('Loading your workspace'));
const empty=renderToString(createElement(Dashboard,{}));assert.ok(empty.includes('Your first election starts here'));
const failed=renderToString(createElement(Dashboard,{initialError:'Network unavailable'}));assert.ok(failed.includes('Retry loading'));
console.log('PASS: SSR renders populated/empty/error states and option controls without client data-loading placeholders.');
