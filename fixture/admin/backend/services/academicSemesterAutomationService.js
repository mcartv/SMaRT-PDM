async function saveYear(academicYearId,payload){
 const windows=validate(periods.map(p=>{const input=(payload.windows||[]).find(w=>w.term===p.term);if(!input)throw Error('Missing schedule for '+p.term);const start=fmt(input.start_date),end=fmt(input.end_date);if(Number(start.slice(0,4))<p.start_year||Number(start.slice(0,4))>p.end_year||Number(end.slice(0,4))<p.start_year||Number(end.slice(0,4))>p.end_year)throw Error('Date outside academic year.');return {period_id:p.period_id,term:p.term,start_date:start,end_date:end};}));
 // SMARTPDM_FLEXIBLE_SEMESTER_V7: preserve administrator-selected semester dates without month restrictions.
 const first=windows.find(w=>w.term==='First Semester');
 const second=windows.find(w=>w.term==='Second Semester');
 if (!first || !second || first.start_date > first.end_date ||
     second.start_date > second.end_date || second.start_date <= first.end_date) {
   throw Error('Semester windows must be chronological and must not overlap.');
 }
}
async function tick(){
 const target=q.rows[0];if(target.is_archived)return {status:'archived'};if(target.is_active)return {status:'already-current'};
 const currentYear=Number(today.slice(0,4));if(currentYear<target.start_year||currentYear>target.end_year)return {status:'year-mismatch'};
 const outcome=await academic.activateAcademicPeriod(target.period_id,null);
}
