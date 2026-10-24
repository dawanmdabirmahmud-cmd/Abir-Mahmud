import { authorize,database,json,owned,failure } from '../../../../lib/server';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
 try {const user=await authorize(request),{id}=await params;
 await owned(id,user);const db=database();
 const r=await db.batch([
 db.prepare('SELECT id,title,state,created FROM elections WHERE id=? AND owner=?').bind(id,user),
 db.prepare("SELECT c.id,c.label,COUNT(s.id) AS votes FROM candidates c LEFT JOIN submissions s ON s.election=c.election AND s.candidate=c.id AND s.code='ACCEPTED' WHERE c.election=? GROUP BY c.id,c.label ORDER BY c.id").bind(id),
 db.prepare("SELECT e.voter AS id, EXISTS(SELECT 1 FROM submissions s WHERE s.election=e.election AND s.voter=e.voter AND s.code='ACCEPTED') AS voted FROM eligible e WHERE e.election=? ORDER BY e.voter").bind(id),
 db.prepare('SELECT id,voter,code,created FROM (SELECT id,voter,code,created FROM submissions WHERE election=? UNION ALL SELECT id,voter,code,created FROM events WHERE election=?) ORDER BY created DESC,id DESC LIMIT 100').bind(id,id),
 db.prepare("SELECT COUNT(*) AS attempts, COALESCE(SUM(code='ACCEPTED'),0) AS accepted, COALESCE(SUM(code<>'ACCEPTED'),0) + (SELECT COUNT(*) FROM events WHERE election=? AND code='REQUEST_CONFLICT') AS rejected FROM submissions WHERE election=?").bind(id,id)
 ]);
 return json({election:r[0].results[0],candidates:r[1].results,voters:r[2].results,audit:r[3].results,stats:r[4].results[0]});
 }catch(e){return failure(e);}
}
