// Local preview integration tests only. Synthetic headers stand in for the trusted
// Sites dispatcher in this local process. NEVER use this against the deployed Site.
import assert from 'node:assert/strict';
const base='http://terminal.local:4173';
const headers={'oai-authenticated-user-id':'qa-local-owner','oai-authenticated-user-email':'qa@example.test','Origin':base,'Content-Type':'application/json'};
async function call(path,body,extra={}){const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...headers,...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await r.text();let data;try{data=JSON.parse(text);}catch{data={text:text.slice(0,200)}};return {status:r.status,data};}
const auth=await fetch(base+'/api/elections');assert.equal(auth.status,401);
assert.equal((await call('/api/elections',{}, {Origin:'https://untrusted.example'})).status,403);
const created=await call('/api/elections',{title:'Local QA only',candidates:['Alice','Bob'],voters:['V1','V2','V3','V4']});assert.equal(created.status,201,JSON.stringify(created));const id=created.data.id;
assert.equal((await call('/api/elections/'+id,undefined,{'oai-authenticated-user-id':'other-owner'})).status,404);
const vote=(voter,candidate,request)=>call('/api/elections/'+id+'/vote',{voter,candidate,request});
assert.equal((await vote(null,'C1','bad')).status,400);
assert.equal((await vote('V1','WRONG','badcandidate')).data.code,'INVALID_CANDIDATE');
const first=(await vote('V1','C1','R1')).data;assert.equal(first.code,'ACCEPTED');
assert.deepEqual((await vote('V1','C1','R1')).data,first);
assert.equal((await vote('V1','C2','R1')).data.code,'REQUEST_CONFLICT');
assert.equal((await vote('V1','C2','R2')).data.code,'ALREADY_VOTED');
assert.equal((await vote('UNKNOWN','C1','R1')).data.code,'NOT_ELIGIBLE');
const concurrent=await Promise.all(Array.from({length:100},(_,i)=>vote('V2','C2','race'+i)));
assert.equal(concurrent.filter(x=>x.data.code==='ACCEPTED').length,1);
assert.equal(concurrent.filter(x=>x.data.code==='ALREADY_VOTED').length,99);
let state=(await call('/api/elections/'+id)).data;
assert.equal(state.stats.accepted,2);assert.equal(state.candidates.reduce((n,c)=>n+c.votes,0),2);assert.equal(state.voters.filter(v=>v.voted).length,2);
assert.equal(state.audit.length,100);assert.ok(state.audit.every(x=>!('candidate' in x)));
assert.equal((await call('/api/elections/'+id+'/close',{})).status,200);
assert.equal((await vote('V3','C1','afterclose')).data.code,'ELECTION_CLOSED');
assert.deepEqual((await vote('V1','C1','R1')).data,first);
state=(await call('/api/elections/'+id)).data;assert.equal(state.election.state,'CLOSED');assert.equal(state.stats.accepted,2);
console.log('PASS: local auth, origin, ownership, malformed input, candidate/eligibility, replay/conflict, 100 concurrent HTTP requests, tally invariants, closure and audit redaction.');
