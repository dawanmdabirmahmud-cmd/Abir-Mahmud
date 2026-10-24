import { authorize,database,json,failure } from '../../../lib/server';
import { validateElection } from '../../../lib/vote.mjs';
export async function GET(request:Request) {
 try { const user=await authorize(request);
 const result=await database().prepare('SELECT id,title,state,created FROM elections WHERE owner=? ORDER BY created DESC LIMIT 100').bind(user).all();
 return json({elections:result.results}); } catch(e) {return failure(e);}
}
export async function POST(request:Request) {
 try { const user=await authorize(request);
 let body;try{body=validateElection(await request.json());}catch(e){return json({error:e instanceof Error?e.message:'Invalid input'},400);}
 const db=database(), id=crypto.randomUUID(), now=new Date().toISOString();
 await db.batch([
 db.prepare("INSERT INTO elections VALUES (?,?,?,'OPEN',?)").bind(id,user,body.title,now),
 ...body.candidates.map((label:string,i:number)=>db.prepare('INSERT INTO candidates VALUES (?,?,?)').bind(id,'C'+(i+1),label)),
 ...body.voters.map((voter:string)=>db.prepare('INSERT INTO eligible VALUES (?,?)').bind(id,voter)),
 db.prepare('INSERT INTO events VALUES (?,?,NULL,?,?)').bind(crypto.randomUUID(),id,'ELECTION_CREATED',now)
 ]);return json({id},201);
 }catch(e){return failure(e);}
}
