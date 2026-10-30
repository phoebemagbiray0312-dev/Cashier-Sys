'use client';
import {useEffect,useRef} from 'react';
import {AlertTriangle,X} from 'lucide-react';

/** Action is performed only after the person explicitly confirms. No browser-native confirm. */
export default function ConfirmDialog({message,onDecision}:{message:string;onDecision:(approved:boolean)=>void}){
 const panel=useRef<HTMLDivElement>(null);
 const decisionRef=useRef(onDecision);
 decisionRef.current=onDecision;
 useEffect(()=>{
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  panel.current?.focus();
  function keydown(e:KeyboardEvent){
   if(e.key==='Escape'){e.preventDefault();decisionRef.current(false);}
   if(e.key==='Tab'&&panel.current){
    const controls=Array.from(panel.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const first=controls[0],last=controls[controls.length-1];
    if(e.shiftKey&&(document.activeElement===first||document.activeElement===panel.current)){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
   }
  }
  document.addEventListener('keydown',keydown);
  return()=>{document.removeEventListener('keydown',keydown);previous?.focus();};
 },[]);
 const destructive=/delete|clear all|replace|replaced|restore|cannot be undone|permanently|deactivate/i.test(message);
 return <div className="modal-overlay cms-confirm-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onDecision(false)}}>
  <div className="cms-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="cms-confirm-title" aria-describedby="cms-confirm-body" tabIndex={-1} ref={panel}>
   <div className="cms-confirm-heading"><span className={`cms-confirm-icon ${destructive?'destructive':''}`}><AlertTriangle size={20}/></span><h2 id="cms-confirm-title">{destructive?'Confirm sensitive action':'Confirm action'}</h2><button type="button" className="icon-button" aria-label="Cancel confirmation" onClick={()=>onDecision(false)}><X size={18}/></button></div>
   <p id="cms-confirm-body" className="cms-confirm-message">{message}</p>
   <div className="cms-confirm-actions"><button type="button" className="button button-secondary" onClick={()=>onDecision(false)}>Cancel</button><button type="button" className={`button ${destructive?'button-danger':'button-primary'}`} onClick={()=>onDecision(true)}>{destructive?'Confirm action':'Continue'}</button></div>
  </div>
 </div>;
}
