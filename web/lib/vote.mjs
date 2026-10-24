export function validId(x) { return typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.exec(x)?.[0] === x; }
export function validateElection(body) {
  if (!body || typeof body !== 'object' || typeof body.title !== 'string' || !body.title.trim() || body.title.length>100) throw new Error('Enter an election title (1–100 characters).');
  if (!Array.isArray(body.candidates) || body.candidates.length<2 || body.candidates.length>20) throw new Error('Add 2–20 candidate names.');
  if (!body.candidates.every(x=>typeof x==='string' && x.trim() && x.trim().length<=60) || new Set(body.candidates.map(x=>x.trim())).size!==body.candidates.length) throw new Error('Candidate names must be non-empty and unique (maximum 60 characters).');
  if (!Array.isArray(body.voters) || !body.voters.length || body.voters.length>200 || !body.voters.every(validId) || new Set(body.voters).size!==body.voters.length) throw new Error('Add 1–200 unique test voter IDs, for example V001. Use letters, numbers, dot, colon, hyphen or underscore; no spaces.');
  return {title:body.title.trim(),candidates:body.candidates.map(x=>x.trim()),voters:body.voters};
}
// A single SQLite statement makes the check + insert atomic across isolates.
// Unique partial index is a second guard: one accepted ballot per voter/election.
export const CAST_SQL = `INSERT INTO submissions (id,election,voter,candidate,request,code,created)
SELECT ?,?,?,?,?, CASE
 WHEN (SELECT state FROM elections WHERE id=?) <> 'OPEN' THEN 'ELECTION_CLOSED'
 WHEN NOT EXISTS (SELECT 1 FROM eligible WHERE election=? AND voter=?) THEN 'NOT_ELIGIBLE'
 WHEN NOT EXISTS (SELECT 1 FROM candidates WHERE election=? AND id=?) THEN 'INVALID_CANDIDATE'
 WHEN EXISTS (SELECT 1 FROM submissions WHERE election=? AND voter=? AND code='ACCEPTED') THEN 'ALREADY_VOTED'
 ELSE 'ACCEPTED' END, ?
ON CONFLICT(election,voter,request) DO NOTHING`;
export function castParams(id,election,voter,candidate,request,time) {
 return [id,election,voter,candidate,request,election,election,voter,election,candidate,election,voter,time];
}
export async function castVote(db,election,body) {
 if(!body || ![body.voter,body.candidate,body.request].every(validId)) throw new Error('INVALID_INPUT');
 const {voter,candidate,request}=body;
 const eventId=crypto.randomUUID(), time=new Date().toISOString();
 const outcome=await db.batch([
   db.prepare(CAST_SQL).bind(...castParams(eventId,election,voter,candidate,request,time)),
   db.prepare('SELECT id,candidate,code,created FROM submissions WHERE election=? AND voter=? AND request=?').bind(election,voter,request)
 ]);
 const receipt=outcome[1].results[0];
 if(!receipt) throw new Error('Receipt unavailable; retry with the same request ID.');
 if(receipt.candidate!==candidate) {
   const id=crypto.randomUUID();
   await db.prepare('INSERT INTO events VALUES (?,?,?,?,?)').bind(id,election,voter,'REQUEST_CONFLICT',time).run();
   return {id,code:'REQUEST_CONFLICT',accepted:false,created:time};
 }
 return {id:receipt.id,code:receipt.code,accepted:receipt.code==='ACCEPTED',created:receipt.created};
}

export const COUNT_SQL = `SELECT c.id,c.label,COUNT(s.id) AS votes FROM candidates c LEFT JOIN submissions s ON s.election=c.election AND s.candidate=c.id AND s.code='ACCEPTED' WHERE c.election=? GROUP BY c.id,c.label ORDER BY CAST(SUBSTR(c.id,2) AS INTEGER)`;
export const STATS_SQL = `SELECT COUNT(*) + (SELECT COUNT(*) FROM events WHERE election=? AND code='REQUEST_CONFLICT') AS attempts, COALESCE(SUM(code='ACCEPTED'),0) AS accepted, COALESCE(SUM(code<>'ACCEPTED'),0) + (SELECT COUNT(*) FROM events WHERE election=? AND code='REQUEST_CONFLICT') AS rejected FROM submissions WHERE election=?`;
