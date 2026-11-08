'use client';
import {useEffect,useState} from 'react';

/** Crops the original brand image for compact sidebar and browser-tab use. Original PNGs stay untouched. */
export default function BrandSymbol({mastermind=false}:{mastermind?:boolean}){
 const [symbol,setSymbol]=useState('');
 useEffect(()=>{
  let cancelled=false;
  const source=mastermind?'/MND.png':'/UC.png';
  const img=new Image();
  img.onload=()=>{
   if(cancelled)return;
   const canvas=document.createElement('canvas');
   canvas.width=192;canvas.height=192;
   const ctx=canvas.getContext('2d');
   if(!ctx)return;
   // The Underchargers crest sits above its lettering in the original square artwork.
   // Mastermind's MND monogram is the symbol itself.
   const crop=mastermind?{x:.23,y:.12,w:.54,h:.76}:{x:.375,y:.285,w:.25,h:.245};
   const sx=img.naturalWidth*crop.x,sy=img.naturalHeight*crop.y;
   const sw=img.naturalWidth*crop.w,sh=img.naturalHeight*crop.h;
   ctx.drawImage(img,sx,sy,sw,sh,0,0,192,192);
   const url=canvas.toDataURL('image/png');
   setSymbol(url);
   let link=document.querySelector<HTMLLinkElement>('link[rel="icon"]');
   if(!link){link=document.createElement('link');link.rel='icon';document.head.appendChild(link);}
   link.href=url;
  };
  img.src=source;
  return()=>{cancelled=true;};
 },[mastermind]);
 return <div className="brand-logo-responsive"><img className="brand-full-img" src={mastermind?'/MND.png':'/UC.png'} alt={mastermind?'Mastermind Autoworks full logo':'Underchargers full logo with tagline'}/><span className="brand-symbol-wrap"><img className="brand-symbol-img" src={symbol||(mastermind?'/MND.png':'/UC.png')} alt={mastermind?'Mastermind symbol':'Underchargers symbol'}/></span></div>;
}
