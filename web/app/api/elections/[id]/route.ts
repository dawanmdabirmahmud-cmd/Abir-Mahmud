import { authorize,database,json,failure } from '../../../../lib/server';
import {loadSnapshot} from '../../../../lib/snapshot.mjs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
 try{const user=await authorize(request),{id}=await params;return json(await loadSnapshot(database(),id,user));}catch(e){return failure(e);}
}
