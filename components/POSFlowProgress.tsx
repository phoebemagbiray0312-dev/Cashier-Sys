'use client';
const flows={
 standard:['Details','Quotation','COGS Review','Payment'],
 deposit:['Details','First Quotation','Downpayment'],
 final:['Details','Downpayment','Final Quotation','COGS Review','Full Payment'],
} as const;
export default function POSFlowProgress({flow,step}:{flow:'standard'|'deposit'|'final';step:number}){
 const stages=flows[flow],total=stages.length,current=Math.max(1,Math.min(step,total));
 return <div className="cms-pos-progress" aria-label={`POS progress: ${stages[current-1]}, step ${current} of ${total}`}>
  <div className="cms-pos-progress-head"><strong>{stages[current-1]}</strong><span>Step {current} of {total}</span></div>
  <div className="cms-pos-progress-track" role="progressbar" aria-valuenow={current} aria-valuemin={1} aria-valuemax={total} aria-valuetext={`${stages[current-1]} — ${current} of ${total}`}><div style={{width:`${current/total*100}%`}}/></div>
  <ol className="cms-pos-progress-steps">{stages.map((stage,index)=><li key={stage} className={index+1===current?'current':index+1<current?'complete':''}>{index+1}. {stage}</li>)}</ol>
 </div>;
}
