import { authorize,database,json,owned,failure } from '../../../../../lib/server';
import { castVote } from '../../../../../lib/vote.mjs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
 try {const user=await authorize(request),{id}=await params;await owned(id,user);
 let body;try{body=await request.json();}catch{return json({error:'Invalid JSON'},400);}
 try{return json(await castVote(database(),id,body));}catch(e){
 if(e instanceof Error && e.message==='INVALID_INPUT')return json({error:'Enter valid voter, candidate and request IDs.'},400);
 throw e;}
 }catch(e){return failure(e);}
}
