import {useEffect,useRef,useState} from 'react';
import {Download,Maximize,RotateCw,ZoomIn,ZoomOut} from 'lucide-react';
import {Modal} from '../../components/common/ui';
import {fetchPaymentProof,fetchReceipt} from './claimsTypes';
import type {ExpenseClaim} from './claimsTypes';

export type ClaimFileKind='receipt'|'proof';
// Only JPEG, PNG and PDF files are shown, as the server accepts.
const ALLOWED=/^data:(image\/jpeg|image\/png|application\/pdf);base64,/;
type Loaded={state:'loading'}|{state:'error';message:string}|{state:'unsupported'}|{state:'ready';url:string;pdf:boolean};

export const fileName=(claim:ExpenseClaim,kind:ClaimFileKind)=>kind==='receipt'?claim.receiptName:claim.paymentProofName;
export const hasFile=(claim:ExpenseClaim,kind:ClaimFileKind)=>kind==='receipt'?claim.hasReceipt:claim.hasPaymentProof;

/** A base64 data URL as a blob URL, which the PDF viewer and Download open without length limits. */
function blobUrl(dataUrl:string){
 const [head,data]=dataUrl.split(',',2);
 const bytes=Uint8Array.from(atob(data),char=>char.charCodeAt(0));
 return URL.createObjectURL(new Blob([bytes],{type:head.slice(5).split(';')[0]}));
}

/** Loads a claim's receipt or proof of payment from the server when shown. */
function useClaimFile(claim:ExpenseClaim,kind:ClaimFileKind,attempt:number):Loaded{
 const[loaded,setLoaded]=useState<Loaded>({state:'loading'});
 useEffect(()=>{
  let active=true,url='';setLoaded({state:'loading'});
  (kind==='receipt'?fetchReceipt(claim.id):fetchPaymentProof(claim.id)).then(file=>{
   if(!active)return;
   if(!ALLOWED.test(file.data_url)){setLoaded({state:'unsupported'});return}
   url=blobUrl(file.data_url);setLoaded({state:'ready',url,pdf:file.data_url.startsWith('data:application/pdf')});
  }).catch(cause=>{if(active)setLoaded({state:'error',message:cause instanceof Error&&cause.message?cause.message:'The file could not be loaded.'})});
  return()=>{active=false;if(url)URL.revokeObjectURL(url)};
 },[claim.id,kind,attempt]);
 return loaded;
}

const tool='inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40';
const message='flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-[13px] text-gray-500';

/** A receipt or proof of payment: images with zoom, fit and rotate, PDFs in the browser's viewer, and Download. */
export function ClaimFileViewer({claim,kind,className='h-[60vh]'}:{claim:ExpenseClaim;kind:ClaimFileKind;className?:string}){
 const name=fileName(claim,kind),attached=hasFile(claim,kind);
 const[attempt,setAttempt]=useState(0);
 return <div className="flex min-w-0 flex-col gap-2">
  {attached?<FileBody key={`${claim.id}-${kind}-${attempt}`} claim={claim} kind={kind} name={name} attempt={attempt} className={className} onRetry={()=>setAttempt(value=>value+1)}/>
   :<div className={`${className} rounded-xl border border-dashed border-gray-200 bg-gray-50`}><div className={message}><span className="font-medium text-gray-700">{kind==='receipt'?name?'The receipt file is not on the server':'No receipt attached':'No proof of payment attached'}</span>{name&&<span className="break-all">{name}</span>}</div></div>}
 </div>;
}

function FileBody({claim,kind,name,attempt,className,onRetry}:{claim:ExpenseClaim;kind:ClaimFileKind;name:string;attempt:number;className:string;onRetry:()=>void}){
 const file=useClaimFile(claim,kind,attempt);
 const[broken,setBroken]=useState(false);
 const ready=file.state==='ready'?file:null;
 const image=ready&&!ready.pdf&&!broken?ready:null;
 const view=useImageView();
 return <>
  <div className="flex flex-wrap items-center justify-between gap-2">
   <span className="min-w-0 truncate text-[12px] text-gray-500" title={name}>{name}</span>
   <div className="flex items-center gap-1">
    {image&&<><button type="button" className={tool} aria-label="Zoom out" title="Zoom out" onClick={view.zoomOut}><ZoomOut size={15}/></button>
     <button type="button" className={tool} aria-label="Zoom in" title="Zoom in" onClick={view.zoomIn}><ZoomIn size={15}/></button>
     <button type="button" className={tool} aria-label="Fit" title="Fit" onClick={view.fit}><Maximize size={15}/></button>
     <button type="button" className={tool} aria-label="Rotate" title="Rotate" onClick={view.rotate}><RotateCw size={15}/></button></>}
    {ready&&<a className={tool} href={ready.url} download={name||'receipt'} aria-label="Download" title="Download"><Download size={15}/></a>}
   </div>
  </div>
  <div ref={view.box} className={`${className} overflow-auto rounded-xl border border-gray-100 bg-gray-50`}>
   {file.state==='loading'&&<div className={message}>Loading {kind==='receipt'?'receipt':'proof of payment'}…</div>}
   {file.state==='error'&&<div className={message}><span className="font-medium text-red-700">Couldn't load the file</span><span>{file.message}</span><button type="button" className="font-medium text-blue-600 hover:underline" onClick={onRetry}>Try again</button></div>}
   {file.state==='unsupported'&&<div className={message}><span className="font-medium text-gray-700">This file type can't be shown</span><span>Only JPG, PNG and PDF files are shown.</span></div>}
   {ready?.pdf&&<iframe title={name} src={ready.url} className="h-full w-full border-0 bg-white"/>}
   {ready&&!ready.pdf&&broken&&<div className={message}><span className="font-medium text-gray-700">The image can't be displayed</span><span>Download it to open it on this device.</span></div>}
   {image&&<ZoomableImage url={image.url} name={name} view={view} onError={()=>setBroken(true)}/>}
  </div>
 </>;
}

/** Zoom (null = fit to the box), rotation and the box's size. */
function useImageView(){
 const box=useRef<HTMLDivElement>(null);
 const[scale,setScale]=useState<number|null>(null),[turns,setTurns]=useState(0),[size,setSize]=useState({width:0,height:0}),[natural,setNatural]=useState({width:0,height:0});
 useEffect(()=>{
  const element=box.current;if(!element)return;
  const measure=()=>setSize({width:element.clientWidth,height:element.clientHeight});measure();
  const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();
 },[]);
 const sideways=turns%2===1;
 const shown={width:sideways?natural.height:natural.width,height:sideways?natural.width:natural.height};
 const fitScale=shown.width&&shown.height?Math.min(1,(size.width-16)/shown.width,(size.height-16)/shown.height):1;
 const current=scale??fitScale;
 const zoomTo=(next:number)=>setScale(Math.min(5,Math.max(0.1,next)));
 return {box,scale:current,turns,shown,natural,setNatural,zoomIn:()=>zoomTo(current*1.25),zoomOut:()=>zoomTo(current/1.25),fit:()=>setScale(null),rotate:()=>setTurns(value=>(value+1)%4)};
}

function ZoomableImage({url,name,view,onError}:{url:string;name:string;view:ReturnType<typeof useImageView>;onError:()=>void}){
 const {scale,turns,shown,natural}=view,loaded=natural.width>0;
 // The wrapper takes the rotated size so the box scrolls over the whole zoomed image.
 return <div className="flex min-h-full min-w-full items-center justify-center p-2"><div className="relative shrink-0" style={{width:shown.width*scale,height:shown.height*scale}}>
  <img src={url} alt={name} onError={onError} onLoad={event=>view.setNatural({width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight})}
   className={`absolute left-1/2 top-1/2 max-w-none bg-white shadow-sm ${loaded?'':'invisible'}`} style={{width:natural.width*scale||undefined,height:natural.height*scale||undefined,transform:`translate(-50%,-50%) rotate(${turns*90}deg)`}}/>
 </div></div>;
}

/** The receipt or proof of payment in a window of its own (Reimbursement). */
export function ClaimFileModal({claim,kind,onClose}:{claim:ExpenseClaim;kind:ClaimFileKind;onClose:()=>void}){
 return <Modal title={`${claim.claimNumber} · ${kind==='receipt'?'Receipt':'Proof of Payment'}`} wide="full" onClose={onClose}><ClaimFileViewer claim={claim} kind={kind} className="h-[70vh]"/></Modal>;
}
