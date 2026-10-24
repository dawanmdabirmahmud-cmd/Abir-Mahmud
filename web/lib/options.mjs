export function filterAudit(rows,query='',status='all'){
 const term=query.trim().toLowerCase();return rows.filter(row=>{
 const matches=status==='all'||(status==='accepted'?row.code==='ACCEPTED':status==='system'?row.code.startsWith('ELECTION_'):row.code!=='ACCEPTED'&&!row.code.startsWith('ELECTION_'));
 return matches&&(!term||[row.id,row.voter||'workspace',row.code,row.created].some(x=>String(x).toLowerCase().includes(term)));
 });
}
export function filterVoters(rows,query='',status='all'){
 const term=query.trim().toLowerCase();return rows.filter(v=>v.id.toLowerCase().includes(term)&&(status==='all'||(status==='voted'?!!v.voted:!v.voted)));
}
export function rankedCandidates(rows,ranked){return ranked?[...rows].sort((a,b)=>b.votes-a.votes||Number(a.id.slice(1))-Number(b.id.slice(1))):rows;}
// Quote CSV and neutralize spreadsheet formulas in user-provided display labels.
export function makeCSV(rows){return '\uFEFF'+rows.map(row=>row.map(value=>{let s=String(value??'');if(/^[\s]*[=+@-]/.test(s)||/^[\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n');}
