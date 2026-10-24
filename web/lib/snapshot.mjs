import {COUNT_SQL,STATS_SQL} from './vote.mjs';
export async function listElections(db,owner){const r=await db.prepare('SELECT id,title,state,created FROM elections WHERE owner=? ORDER BY created DESC,id DESC LIMIT 100').bind(owner).all();return r.results;}
export async function loadSnapshot(db,id,owner){
 const r=await db.batch([
 db.prepare('SELECT id,title,state,created FROM elections WHERE id=? AND owner=?').bind(id,owner),
 db.prepare(COUNT_SQL).bind(id),
 db.prepare("SELECT e.voter AS id, EXISTS(SELECT 1 FROM submissions s WHERE s.election=e.election AND s.voter=e.voter AND s.code='ACCEPTED') AS voted FROM eligible e WHERE e.election=? ORDER BY e.voter").bind(id),
 db.prepare('SELECT id,voter,code,created FROM (SELECT id,voter,code,created FROM submissions WHERE election=? UNION ALL SELECT id,voter,code,created FROM events WHERE election=?) ORDER BY created DESC,id DESC LIMIT 100').bind(id,id),
 db.prepare(STATS_SQL).bind(id,id,id)
 ]);
 // Never return any part of a batch when ownership is not established.
 if(!r[0].results[0])throw new Response('Election not found',{status:404});
 return {election:r[0].results[0],candidates:r[1].results,voters:r[2].results,audit:r[3].results,stats:r[4].results[0]};
}
