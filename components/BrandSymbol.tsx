'use client';
import {useEffect} from 'react';

/** Brand logo for the sidebar. Full logo on wide screens, square crest on the tablet rail and browser tab.
 *  v9.31.1: crests are pre-cropped files (/UC-symbol.png, /MND-symbol.png) instead of a runtime canvas crop. */
export default function BrandSymbol({mastermind=false}:{mastermind?:boolean}){
 const symbol=mastermind?'/MND-symbol.png':'/UC-symbol.png';
 useEffect(()=>{
  let link=document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if(!link){link=document.createElement('link');link.rel='icon';document.head.appendChild(link);}
  link.href=symbol;
 },[symbol]);
 return <div className="brand-logo-responsive"><img className="brand-full-img" src={mastermind?'/MND.png':'/UC.png'} alt={mastermind?'Mastermind Autoworks full logo':'Underchargers full logo with tagline'}/><span className="brand-symbol-wrap"><img className="brand-symbol-img" src={symbol} alt={mastermind?'Mastermind Autoworks':'Underchargers'}/></span></div>;
}
