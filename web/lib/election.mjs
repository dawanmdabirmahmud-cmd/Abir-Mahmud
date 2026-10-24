import {validId,validateElection} from './vote.mjs';
async function digest(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');}
export async function createElection(db,owner,body){
 const normalized=validateElection(body);
 if(!validId(body.request))throw new Error('A valid creation request ID is required.');
 const id=await digest(JSON.stringify([owner,body.request]));
 const config=await digest(JSON.stringify(normalized));
 const now=new Date().toISOString();
 const result=await db.batch([
 db.prepare("INSERT INTO elections (id,owner,title,state,created,config) VALUES (?,?,?,'OPEN',?,?) ON CONFLICT(id) DO NOTHING").bind(id,owner,normalized.title,now,config),
 ...normalized.candidates.map((label,i)=>db.prepare('INSERT INTO candidates (election,id,label) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM elections WHERE id=? AND owner=? AND config=?) ON CONFLICT(election,id) DO NOTHING').bind(id,'C'+(i+1),label,id,owner,config)),
 ...normalized.voters.map(voter=>db.prepare('INSERT INTO eligible (election,voter) SELECT ?,? WHERE EXISTS(SELECT 1 FROM elections WHERE id=? AND owner=? AND config=?) ON CONFLICT(election,voter) DO NOTHING').bind(id,voter,id,owner,config)),
 db.prepare("INSERT INTO events (id,election,voter,code,created) SELECT ?,id,NULL,'ELECTION_CREATED',? FROM elections WHERE id=? AND owner=? AND config=? ON CONFLICT(id) DO NOTHING").bind(id+':created',now,id,owner,config),
 db.prepare('SELECT id,config FROM elections WHERE id=? AND owner=?').bind(id,owner)
 ]);
 const stored=result.at(-1).results[0];
 if(!stored || stored.config!==config)throw new Error('CREATE_REQUEST_CONFLICT');
 return {id:stored.id};
}
