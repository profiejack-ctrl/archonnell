import {useEffect,useRef,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {Check,ChevronLeft,ChevronRight,FileText,MoreVertical,RotateCcw,ThumbsDown} from 'lucide-react';
import {Button,Card,Empty,ErrorAlert,Field,LoadingState,Modal,Segmented,ghost,input} from '../components/common/ui';
import type {Employee} from '../types/domain';
import {employeeService} from '../features/employees/employeeService';
import {can} from '../features/auth/permissions';
import {getCurrentUser} from '../features/auth/authService';
import {notifyClaimDecided} from '../features/notifications/notificationService';
import {employeeName,normalizeClaims,updateClaim} from '../features/claims/claimsTypes';
import {claimWarnings} from '../../backend-render/claimRules.js';
import type {ClaimReview,ExpenseClaim} from '../features/claims/claimsTypes';
import {ClaimStatusBadge,EmployeeCell,cell,claimDate,flushCard,rowHeader,tableHead} from '../features/claims/claimsUi';
import {ClaimFileModal} from '../features/claims/ClaimFileViewer';
import type {ClaimFileKind} from '../features/claims/ClaimFileViewer';
import {peso} from '../utils/storage';

// Returned claims wait for the employee to correct and resubmit them from ESS; meanwhile they can only be rejected.
const isOpen=(claim:ExpenseClaim)=>claim.approvalStatus==='Pending Approval'||claim.approvalStatus==='Returned';
const isPaid=(claim:ExpenseClaim)=>claim.paymentStatus==='Paid'||claim.paymentStatus==='Included in Payroll';
const FILTERS=[
 {id:'all',label:'All',match:()=>true},
 {id:'pending',label:'Pending',match:isOpen},
 {id:'approved',label:'Approved',match:(claim:ExpenseClaim)=>claim.approvalStatus==='Approved'&&!isPaid(claim)},
 {id:'paid',label:'Paid',match:isPaid},
 {id:'rejected',label:'Rejected',match:(claim:ExpenseClaim)=>claim.approvalStatus==='Rejected'},
] as const;
type Filter=(typeof FILTERS)[number]['id'];
// Returning or rejecting a claim needs a reason; the employee sees it in ESS.
type Pending={kind:'reject'|'return';claim:ExpenseClaim};
// The claim open in the review window, and the claims Prev / Next move through (the list when it was opened).
type Review={id:string;queue:string[]};

export default function Claims(){
 const[employees,setEmployees]=useState<Employee[]>([]);
 const[claims,setClaims]=useState<ExpenseClaim[]>([]);
 const[loading,setLoading]=useState(true),[loadError,setLoadError]=useState('');
 const[review,setReview]=useState<Review|null>(null),[file,setFile]=useState<{claim:ExpenseClaim;kind:ClaimFileKind}|null>(null);
 const[pending,setPending]=useState<Pending|null>(null),[reason,setReason]=useState(''),[saving,setSaving]=useState(false),[actionError,setActionError]=useState('');
 const canDecide=can('claims.approve');
 // The signed-in user's own claims (employee records with their email): another reviewer decides them.
 const email=getCurrentUser()?.email?.trim().toLowerCase();
 const own=new Set(email?employees.filter(employee=>employee.email?.trim().toLowerCase()===email).map(employee=>employee.id):[]);
 // ?status=pending (from the Dashboard) opens on Pending.
 const[params]=useSearchParams();
 const[filter,setFilter]=useState<Filter>(params.get('status')==='pending'?'pending':'all');
 const match=FILTERS.find(item=>item.id===filter)?.match??(()=>true);
 const list=claims.filter(match).sort((a,b)=>b.date.localeCompare(a.date)||b.claimNumber.localeCompare(a.claimNumber));
 const load=()=>{setLoading(true);setLoadError('');employeeService.getAll().then(items=>{setEmployees(items);setClaims(normalizeClaims(items))}).catch(cause=>{setClaims(normalizeClaims([]));setLoadError(cause instanceof Error&&cause.message?cause.message:'Employee records could not be loaded.')}).finally(()=>setLoading(false))};
 useEffect(()=>{load()},[]);
 // Claim decisions are logged by the server when the claim is saved; the employee sees the status in ESS.
 const update=async(id:string,patch:ClaimReview)=>{
  const before=claims.find(item=>item.id===id);setActionError('');
  try{await updateClaim(id,patch)}catch(cause){setActionError(cause instanceof Error&&cause.message?cause.message:'The claim could not be updated.');return false}
  if(before&&(patch.approvalStatus==='Approved'||patch.approvalStatus==='Rejected')&&before.approvalStatus!==patch.approvalStatus)notifyClaimDecided(before.claimNumber,patch.approvalStatus);
  setClaims(normalizeClaims(employees));return true;
 };
 const openPending=(kind:Pending['kind'],claim:ExpenseClaim)=>{setReason('');setPending({kind,claim})};
 const openReview=(claim:ExpenseClaim)=>setReview({id:claim.id,queue:list.map(item=>item.id)});
 const reviewed=review?claims.find(item=>item.id===review.id):undefined;
 const confirmPending=async()=>{if(!pending||reason.trim().length<3)return;setSaving(true);const done=await update(pending.claim.id,{approvalStatus:pending.kind==='reject'?'Rejected':'Returned',notes:reason.trim()});setSaving(false);if(done)setPending(null)};
 return <div className="claims-page space-y-5">
  {loadError&&<ErrorAlert title="Employee records unavailable." onRetry={load}>{loadError} Employee names may show as IDs until this loads.</ErrorAlert>}
  {actionError&&<ErrorAlert title="The claim was not updated." onRetry={load}>{actionError}</ErrorAlert>}
  <Card className={flushCard}>
   <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-50 px-5 py-4">
    <span className="text-[12px] font-medium text-gray-500">{list.length} {list.length===1?'claim':'claims'}</span>
    <Segmented label="Filter claims by status" options={FILTERS} value={filter} onChange={setFilter} idPrefix="claims-filter" panelId="claims-list"/>
   </div>
   <section id="claims-list" role="tabpanel" aria-labelledby={`claims-filter-${filter}`} className="min-w-0">
    {loading?<LoadingState>Loading claims…</LoadingState>:<ClaimsTable claims={list} employees={employees} warningsOf={claim=>claimWarnings(claim,claims)} canDecide={canDecide} own={own} onReject={claim=>openPending('reject',claim)} onReturn={claim=>openPending('return',claim)} onView={openReview} onReceipt={claim=>setFile({claim,kind:'receipt'})}/>}
   </section>
  </Card>
  {review&&reviewed&&<ReviewModal key={reviewed.id} claim={reviewed} employees={employees} warnings={claimWarnings(reviewed,claims)} canDecide={canDecide&&!own.has(reviewed.employeeId)} ownClaim={own.has(reviewed.employeeId)}
   queue={review.queue.filter(id=>claims.some(item=>item.id===id))} onNavigate={id=>setReview({...review,id})} onClose={()=>{if(!file)setReview(null)}} onFile={kind=>setFile({claim:reviewed,kind})} onDecide={patch=>update(reviewed.id,patch)}/>}
  {file&&<ClaimFileModal claim={file.claim} kind={file.kind} onClose={()=>setFile(null)}/>}
  {pending&&<Modal title={pending.kind==='reject'?'Reject claim?':'Return claim for correction?'} onClose={()=>{if(!saving)setPending(null)}}>
   <p className="mb-3 mt-0 text-[13px] text-gray-600">{pending.kind==='reject'?`Reject claim ${pending.claim.claimNumber} for ${peso(pending.claim.amount)}? A rejected claim cannot be approved or reimbursed later.`:`Return claim ${pending.claim.claimNumber} to the employee? They correct it in ESS and resubmit it.`}</p>
   <Field label="Reason (shown to the employee in ESS)"><textarea className={`${input} min-h-24`} maxLength={500} autoFocus value={reason} onChange={event=>setReason(event.target.value)}/></Field>
   <div className="mt-5 flex justify-end gap-2"><button type="button" className={ghost} disabled={saving} onClick={()=>setPending(null)}>Cancel</button><Button className={pending.kind==='reject'?'!bg-red-600 hover:!bg-red-700':''} disabled={saving||reason.trim().length<3} onClick={()=>void confirmPending()}>{saving?'Saving…':pending.kind==='reject'?'Reject':'Return'}</Button></div>
  </Modal>}
 </div>;
}

function ClaimsTable({claims,employees,warningsOf,canDecide,own,onReject,onReturn,onView,onReceipt}:{claims:ExpenseClaim[];employees:Employee[];warningsOf:(claim:ExpenseClaim)=>string[];canDecide:boolean;own:Set<string>;onReject:(claim:ExpenseClaim)=>void;onReturn:(claim:ExpenseClaim)=>void;onView:(claim:ExpenseClaim)=>void;onReceipt:(claim:ExpenseClaim)=>void}){
 return <div role="region" aria-label="Claims table" tabIndex={0} className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"><table className="w-full min-w-[900px] text-left text-[13px] [&_td]:!px-3 [&_th]:!px-3"><caption className="sr-only">Claims with claim number, employee, type, date, amount, status, receipt, and available actions. Open a claim to read its business purpose.</caption>
  <thead><tr className={tableHead}>{['Claim No.','Employee','Type','Date','Amount','Status','Receipt','Actions'].map(header=><th key={header} scope="col" className={`whitespace-nowrap px-4 py-3.5 ${header==='Amount'?'text-right':''}`}>{header}</th>)}</tr></thead>
  <tbody>{claims.length===0?<tr><td colSpan={8}><Empty>No claims with this status.</Empty></td></tr>:claims.map(claim=><tr key={claim.id} className="border-b border-gray-100 transition-colors hover:bg-blue-50/35">
   <th scope="row" className={rowHeader}>{claim.claimNumber}</th>
   <td className={cell}><EmployeeCell employees={employees} claim={claim}/></td>
   <td className={`${cell} whitespace-nowrap text-gray-700`}>{claim.claimType}</td>
   <td className={`${cell} whitespace-nowrap text-gray-600`}>{claimDate(claim.date)}</td>
   <td className={`${cell} whitespace-nowrap text-right font-semibold tabular-nums text-gray-900`}>{peso(claim.amount)}</td>
   <td className={cell}><ClaimStatusBadge claim={claim}/>{claim.approvalStatus==='Returned'&&claim.notes&&<div className="mt-1 max-w-[220px] whitespace-normal text-[11px] text-amber-700">{claim.notes}</div>}{claim.paymentStatus==='Unpaid'&&warningsOf(claim).map(warning=><div key={warning} className="mt-1 max-w-[240px] whitespace-normal text-[11px] font-medium text-amber-700">⚠ {warning}</div>)}</td>
   <td className={`${cell} whitespace-nowrap`}>{claim.hasReceipt?<button type="button" className="font-medium text-blue-600 underline-offset-2 hover:text-blue-800 hover:underline" title={claim.receiptName} aria-label={`View receipt ${claim.receiptName} for ${claim.claimNumber}`} onClick={()=>onReceipt(claim)}>View receipt</button>:claim.receiptName?<span className="text-gray-600" title={claim.receiptName}>Attached</span>:<span className="font-medium text-red-700">Missing</span>}</td>
   <td className={cell}><ClaimActions claim={claim} canDecide={isOpen(claim)&&canDecide&&!own.has(claim.employeeId)} onReject={onReject} onReturn={onReturn} onView={onView}/></td>
  </tr>)}</tbody></table></div>;
}

/** Review (a claim to decide) or View, with Return and Reject in the ⋮ menu. Approve is in the review window, beside the receipt. */
function ClaimActions({claim,canDecide,onReject,onReturn,onView}:{claim:ExpenseClaim;canDecide:boolean;onReject:(claim:ExpenseClaim)=>void;onReturn:(claim:ExpenseClaim)=>void;onView:(claim:ExpenseClaim)=>void}){
 const[menuPosition,setMenuPosition]=useState<{top:number;left:number}|null>(null);
 const menu=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 // Close the menu on an outside click, Escape, scroll or resize, since it is positioned against the viewport.
 useEffect(()=>{
  if(!menuPosition)return;
  const close=()=>setMenuPosition(null);
  const onPointer=(event:MouseEvent)=>{const target=event.target as Node;if(!menu.current?.contains(target)&&!trigger.current?.contains(target))close()};
  const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){close();trigger.current?.focus()}};
  document.addEventListener('mousedown',onPointer);document.addEventListener('keydown',onKey);window.addEventListener('scroll',close,true);window.addEventListener('resize',close);
  return()=>{document.removeEventListener('mousedown',onPointer);document.removeEventListener('keydown',onKey);window.removeEventListener('scroll',close,true);window.removeEventListener('resize',close)};
 },[menuPosition]);
 const toggleMenu=(event:React.MouseEvent<HTMLButtonElement>)=>{if(menuPosition){setMenuPosition(null);return}const rect=event.currentTarget.getBoundingClientRect();const width=150;const top=rect.bottom+8>window.innerHeight-170?Math.max(8,rect.top-170):rect.bottom+8;setMenuPosition({top,left:Math.max(8,Math.min(rect.right-width,window.innerWidth-width-8))})};
 const pick=(action:()=>void)=>()=>{setMenuPosition(null);action()};
 if(!canDecide)return <button className={ghost} onClick={()=>onView(claim)}><FileText size={14}/>View</button>;
 const returned=claim.approvalStatus==='Returned';
 return <div className="flex flex-nowrap items-center gap-2">
  <button className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-blue-600 px-3 py-2 text-[12px] font-semibold text-white hover:bg-blue-700" onClick={()=>onView(claim)}><FileText size={14}/>{returned?'View':'Review'}</button>
  <button ref={trigger} type="button" aria-label={`More actions for ${claim.claimNumber}`} aria-haspopup="menu" aria-expanded={Boolean(menuPosition)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-100 bg-white text-gray-500 hover:bg-gray-50" onClick={toggleMenu}><MoreVertical size={17}/></button>
  {menuPosition&&<div ref={menu} role="menu" className="fixed z-50 min-w-[150px] rounded-lg border border-gray-100 bg-white p-1.5 text-left shadow-lg" style={{top:menuPosition.top,left:menuPosition.left}}>
   {!returned&&<button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[12px] font-medium text-amber-700 hover:bg-amber-50" onClick={pick(()=>onReturn(claim))}><RotateCcw size={14}/>Return</button>}
   <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[12px] font-medium text-red-700 hover:bg-red-50" onClick={pick(()=>onReject(claim))}><ThumbsDown size={14}/>Reject</button>
  </div>}
 </div>;
}

function Detail({label,children}:{label:string;children:React.ReactNode}){return <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</dt><dd className="m-0 mt-1 text-[13px] text-gray-800">{children}</dd></div>}
/** A claim's details, with the decision for a claim to decide; Prev / Next move through the list. */
function ReviewModal({claim,employees,warnings,canDecide,ownClaim,queue,onNavigate,onClose,onFile,onDecide}:{claim:ExpenseClaim;employees:Employee[];warnings:string[];canDecide:boolean;ownClaim:boolean;queue:string[];onNavigate:(id:string)=>void;onClose:()=>void;onFile:(kind:ClaimFileKind)=>void;onDecide:(patch:ClaimReview)=>Promise<boolean>}){
 const[mode,setMode]=useState<'return'|'reject'|null>(null),[reason,setReason]=useState(''),[saving,setSaving]=useState(false);
 const index=queue.indexOf(claim.id),previous=index>0?queue[index-1]:undefined,next=index>=0?queue[index+1]:undefined;
 const decide=async(patch:ClaimReview)=>{setSaving(true);const done=await onDecide(patch);setSaving(false);if(done){setMode(null);setReason('')}};
 const employee=employees.find(item=>item.id===claim.employeeId);
 const nav='inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent';
 const open=isOpen(claim),returned=claim.approvalStatus==='Returned';
 return <Modal title={`${claim.claimNumber} · ${employee?.name??employeeName(employees,claim.employeeId)}`} wide stickyHeader onClose={()=>{if(!saving)onClose()}} actions={queue.length>1&&index>=0?<div className="mr-2 flex items-center gap-1">
   <button type="button" className={nav} disabled={!previous||saving} aria-label="Previous claim" onClick={()=>previous&&onNavigate(previous)}><ChevronLeft size={15}/><span className="hidden sm:inline">Prev</span></button>
   <span className="whitespace-nowrap text-[12px] tabular-nums text-gray-500">{index+1} of {queue.length}</span>
   <button type="button" className={nav} disabled={!next||saving} aria-label="Next claim" onClick={()=>next&&onNavigate(next)}><span className="hidden sm:inline">Next</span><ChevronRight size={15}/></button>
  </div>:undefined}>
  <div className="min-w-0 space-y-4">
    <ClaimStatusBadge claim={claim}/>
    {warnings.length>0&&claim.paymentStatus==='Unpaid'&&<div role="note" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900"><div className="font-semibold">Check before approving</div><ul className="mb-0 mt-1 list-disc pl-5">{warnings.map(warning=><li key={warning}>{warning}</li>)}</ul></div>}
    <dl className="m-0 grid grid-cols-2 gap-4">
     <div className="col-span-2"><Detail label="Employee">{employeeName(employees,claim.employeeId)}{claim.department&&<div className="text-[12px] text-gray-500">{claim.department}</div>}</Detail></div>
     <Detail label="Claim Type">{claim.claimType}</Detail>
     <Detail label="Expense Date">{claimDate(claim.date)}</Detail>
     <Detail label="Amount"><span className="font-semibold tabular-nums">{peso(claim.amount)}</span></Detail>
     <Detail label="Submitted">{claim.source==='ESS'?`${claimDate(claim.createdAt.slice(0,10))} via ESS`:'Encoded in PBMS'}</Detail>
     {claim.decidedBy&&<Detail label="Decided By">{claim.decidedBy}</Detail>}
     {claim.paymentStatus!=='Unpaid'&&<><Detail label="Payment Date">{claimDate(claim.paymentDate)}</Detail><Detail label="Paid By">{[claim.paymentMethod,claim.paymentReference&&`ref. ${claim.paymentReference}`].filter(Boolean).join(' · ')||'—'}</Detail><Detail label="Recorded By">{claim.paidBy||'—'}</Detail><Detail label="Proof of Payment">{claim.hasPaymentProof?<button type="button" className="font-medium text-blue-600 hover:underline" onClick={()=>onFile('proof')}>View proof</button>:'—'}</Detail></>}
     <div className="col-span-2"><Detail label="Receipt">{claim.receiptName?<span className="flex flex-wrap items-center gap-2"><span className="break-all">{claim.receiptName}</span>{claim.hasReceipt&&<button type="button" className="font-medium text-blue-600 hover:underline" onClick={()=>onFile('receipt')}>View receipt</button>}</span>:<span className="font-medium text-red-700">Missing</span>}</Detail></div>
     <div className="col-span-2"><Detail label="Business Purpose"><p className="m-0 rounded-lg bg-gray-50 p-3 text-gray-600">{claim.businessPurpose||'—'}</p></Detail></div>
     {claim.notes&&<div className="col-span-2"><Detail label="Review Notes"><p className="m-0 rounded-lg bg-amber-50 p-3 text-amber-800">{claim.notes}</p></Detail></div>}
     <div className="col-span-2"><Detail label="Business Expense Certification">{claim.certified?'Confirmed — not a personal expense':'Not confirmed'}</Detail></div>
    </dl>
    {open&&ownClaim&&<p className="m-0 text-[12px] text-gray-500">Your claim: another reviewer decides it</p>}
    {open&&canDecide&&<div className="border-t border-gray-100 pt-4">
     {mode?<div className="space-y-3">
      <Field label={mode==='reject'?'Reason for rejecting (shown to the employee)':'Reason for returning (shown to the employee)'}><textarea className={`${input} min-h-20`} maxLength={500} autoFocus value={reason} onChange={event=>setReason(event.target.value)}/></Field>
      <div className="flex justify-end gap-2"><button type="button" className={ghost} disabled={saving} onClick={()=>{setMode(null);setReason('')}}>Cancel</button><Button className={mode==='reject'?'!bg-red-600 hover:!bg-red-700':''} disabled={saving||reason.trim().length<3} onClick={()=>void decide({approvalStatus:mode==='reject'?'Rejected':'Returned',notes:reason.trim()})}>{saving?'Saving…':mode==='reject'?'Reject':'Return'}</Button></div>
     </div>:<div className="flex flex-wrap items-center gap-2">
      {!returned&&<button type="button" className={`${ghost} text-amber-700`} disabled={saving} onClick={()=>setMode('return')}><RotateCcw size={14}/>Return</button>}
      <button type="button" className={`${ghost} text-red-700`} disabled={saving} onClick={()=>setMode('reject')}><ThumbsDown size={14}/>Reject</button>
      {returned?<span className="ml-auto text-[12px] font-medium text-amber-700">Waiting for the employee</span>:<button type="button" className="ml-auto inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50" disabled={saving} onClick={()=>void decide({approvalStatus:'Approved',notes:''})}><Check size={15}/>{saving?'Saving…':'Approve'}</button>}
     </div>}
    </div>}
  </div>
 </Modal>;
}
