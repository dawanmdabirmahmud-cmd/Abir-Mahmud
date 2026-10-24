import { COUNT_SQL, STATS_SQL } from '../../../../lib/vote.mjs';
import { authorize,database,json,owned,failure } from '../../../../lib/server';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
 try {const user=await authorize(request),{id}=await params;
 await owned(id,user);const db=database();
 const r=await db.batch([
 db.prepare('SELECT id,title,state,created FROM elections WHERE id=? AND owner=?').bind(id,user),
 db.prepare(COUNT_SQL).bind(id),
 db.prepare("SELECT e.voter AS id, EXISTS(SELECT 1 FROM submissions s WHERE s.election=e.election AND s.voter=e.voter AND s.code='ACCEPTED') AS voted FROM eligible e WHERE e.election=? ORDER BY e.voter").bind(id),
 db.prepare('SELECT id,voter,code,created FROM (SELECT id,voter,code,created FROM submissions WHERE election=? UNION ALL SELECT id,voter,code,created FROM events WHERE election=?) ORDER BY created DESC,id DESC LIMIT 100').bind(id,id),
 db.prepare(STATS_SQL).bind(id,id,id)
 ]);
 return json({election:r[0].results[0],candidates:r[1].results,voters:r[2].results,audit:r[3].results,stats:r[4].results[0]});
 }catch(e){return failure(e);}
}
