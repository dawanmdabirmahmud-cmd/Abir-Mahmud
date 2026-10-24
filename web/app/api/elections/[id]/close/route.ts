import { authorize,database,json,owned,failure } from '../../../../../lib/server';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
 try {const user=await authorize(request),{id}=await params;await owned(id,user);
 const now=new Date().toISOString();
 await database().batch([
 database().prepare("INSERT INTO events SELECT ?,id,NULL,'ELECTION_CLOSED',? FROM elections WHERE id=? AND owner=? AND state='OPEN'").bind(crypto.randomUUID(),now,id,user),
 database().prepare("UPDATE elections SET state='CLOSED' WHERE id=? AND owner=? AND state='OPEN'").bind(id,user)
 ]);return json({closed:true});
 }catch(e){return failure(e);}
}
