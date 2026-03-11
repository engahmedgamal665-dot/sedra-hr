import { useState, useEffect, useRef } from "react";

/* ═══ SUPABASE ═══ */
const SB_URL = "https://atgqbehlldk lxczgagdu.supabase.co".replace(" ","");
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0Z3FiZWhsbGRrbHhjemdhZ2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MzA0MzYsImV4cCI6MjA4ODQwNjQzNn0.nV7kKlA7t1zS1KfJHX1QB_U0KqtyQLmt2HBbe4QMQ0o";
const HDR = {"apikey":SB_KEY,"Authorization":"Bearer "+SB_KEY,"Content-Type":"application/json","Prefer":"resolution=merge-duplicates"};

const SB = {
  async get(k) {
    try {
      const r = await fetch(SB_URL+"/rest/v1/hr_storage?key=eq."+encodeURIComponent(k)+"&select=value",{headers:HDR});
      if(r.ok){const d=await r.json();if(d&&d[0])return d[0].value;}
    } catch(e){}
    try{const v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch(e){return null;}
  },
  async set(k,val) {
    try{localStorage.setItem(k,JSON.stringify(val));}catch(e){}
    try{await fetch(SB_URL+"/rest/v1/hr_storage",{method:"POST",headers:HDR,body:JSON.stringify({key:k,value:val})});}catch(e){}
  },
  async getAll() {
    try{
      const r=await fetch(SB_URL+"/rest/v1/hr_storage?select=key,value",{headers:HDR});
      if(r.ok){const d=await r.json();if(Array.isArray(d)&&d.length>0){const o={};d.forEach(row=>{o[row.key]=row.value;});return o;}}
    }catch(e){}
    return null;
  }
};

/* ═══ UTILS ═══ */
const todayISO=()=>new Date().toISOString().slice(0,10);
const fmt=(d)=>{if(!d)return"—";const x=new Date(d);return isNaN(x)?d:x.toLocaleDateString("en-GB");};
const money=(n)=>isNaN(+n)?"0.00 AED":(+n).toLocaleString("en-US",{minimumFractionDigits:2})+" AED";
const dLeft=(d)=>d?Math.floor((new Date(d)-Date.now())/86400000):null;
const nDays=(y,m)=>new Date(y,m,0).getDate();
const wDay=(y,m,d)=>new Date(y,m-1,d).getDay();
const moKey=(y,m)=>y+"-"+String(m).padStart(2,"0");
const nowStr=()=>new Date().toLocaleString("en-GB");
const expColor=(d)=>{const n=dLeft(d);if(n==null)return"#64748b";if(n<0)return"#ef4444";if(n<30)return"#f97316";if(n<90)return"#eab308";return"#22c55e";};
const MN=["January","February","March","April","May","June","July","August","September","October","November","December"];

/* ═══ AUTH ═══ */
const USERS=[
  {role:"owner",pass:"makka2018",label:"Owner",ar:"المالك",color:"#f59e0b"},
  {role:"accountant",pass:"hasham1980",label:"Accountant",ar:"محاسب",color:"#34d399"},
  {role:"hr",pass:"sedra2026",label:"HR Manager",ar:"موارد بشرية",color:"#60a5fa"},
  {role:"dataentry",pass:"sedra2023",label:"Data Entry",ar:"مُدخل بيانات",color:"#fb923c"},
  {role:"pm",pass:"sedra2024",label:"Proj. Manager",ar:"مدير مشاريع",color:"#06b6d4"},
];
function can(role,perm){
  const map={
    salary:    ["owner","accountant","hr"],
    slips:     ["owner","accountant","hr"],
    adjEdit:   ["owner","accountant"],
    deductions:["owner","accountant","hr","pm"],
    leaveMgr:  ["owner","accountant"],
    warnings:  ["owner","accountant","hr","pm"],
    editEmp:   ["owner","accountant","hr","dataentry"],
    attendance:["owner","hr","dataentry","pm"],
    cars:      ["owner","hr","dataentry"],
    eosb:      ["owner","accountant"],
    audit:     ["owner"],
    export:    ["owner","accountant","hr","dataentry"],
  };
  return(map[perm]||[]).includes(role);
}
function canSeeSalary(role,total){
  if(role==="owner"||role==="accountant")return true;
  if(role==="hr")return(+total||0)<=4000;
  return false;
}

/* ═══ SALARY CALC ═══ */
function salaryCalc(emp,attMap,y,m,adj,warnDed,extraDed){
  if(!adj)adj={};
  const basic=+emp.basic||0;
  if(!basic)return{gross:0,net:0,absD:0,lateD:0,otAmt:0,A:0,L1:0,L2:0,P:0,OT:0,S:0,daily:0,hourly:0,fines:0,bonus:0,ded:0,warnDed:0,extraDed:0};
  const daily=basic/30,hourly=daily/8;
  let P=0,A=0,L1=0,L2=0,OT=0,S=0;
  for(let d=1;d<=nDays(y,m);d++){
    if(wDay(y,m,d)===0)continue;
    const code=(attMap&&attMap[String(d)])||"";
    if(code==="H"||code==="O")continue;
    if(code==="A")A++;
    else if(code==="L1"){P++;L1++;}
    else if(code==="L2"){P++;L2++;}
    else if(code==="OT"){P++;OT++;}
    else if(code==="S"){P++;S++;}
    else P++;
  }
  const gross=+emp.total||((+emp.basic||0)+(+emp.housing||0)+(+emp.transport||0));
  const absD=A*daily,lateD=(L1*0.25+L2*0.5)*daily;
  const otAmt=((+adj.otH||0)+OT*2)*hourly*(+adj.otRate||1.25);
  const bonus=+adj.bonus||0,ded=+adj.ded||0,fines=+adj.carFines||0;
  const wd=+warnDed||0,ed=+extraDed||0;
  return{gross,net:gross-absD-lateD+otAmt+bonus-ded-fines-wd-ed,absD,lateD,otAmt,A,L1,L2,P,OT,S,daily,hourly,fines,bonus,ded,warnDed:wd,extraDed:ed};
}

function eosbCalc(basic,start,end,type){
  if(!basic||!start||!end)return null;
  const s=new Date(start),e=new Date(end);
  if(isNaN(s)||isNaN(e))return null;
  const yrs=(e-s)/(365.25*86400000);
  if(yrs<1)return{ok:false,yrs};
  const d=+basic/30;
  let raw=yrs<=5?d*21*yrs:d*21*5+d*30*(yrs-5);
  const cap=+basic*24,capped=raw>cap;
  if(capped)raw=cap;
  if(type==="res"){if(yrs<3)raw=0;else if(yrs<5)raw/=3;}
  return{ok:true,yrs,amount:raw,capped,cap,d};
}

/* ═══ SLIP CSS ═══ */
const SCSS="*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;color:#111;background:#fff;padding:16px}table{width:100%;border-collapse:collapse}td,th{padding:6px 9px;border:1px solid #d1d5db}th{background:#f3f4f6;font-weight:700}.e{color:#166534;font-weight:700}.d{color:#991b1b;font-weight:700}";
function shdr(c,t,s){return'<div style="background:'+c+';color:#fff;padding:12px 16px;display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:19px;font-weight:900">⚡ سيدرة إليكتريك</div><div style="font-size:10px;opacity:.8">Sedra Electric — UAE</div></div><div style="text-align:right;font-size:11px;opacity:.85"><b>'+t+'</b><br>'+s+'<br><span style="font-size:9px">'+nowStr()+'</span></div></div>';}

function buildSalarySlip(emp,pr,yr,mo){
  const b=+emp.basic||0,h=+emp.housing||0,tr=+emp.transport||0;
  const er=[["Basic / أساسي",b],["Housing / سكن",h],["Transport / مواصلات",tr],["Overtime / أوفر تايم",pr.otAmt],["Bonus / مكافأة",pr.bonus]];
  const dr=[["Absence ("+pr.A+" days)",pr.absD],["Late Deduction",pr.lateD],["Deductions (Manual)",pr.ded],["Car Fines",pr.fines],["Warnings",pr.warnDed],["Other Deductions",pr.extraDed]];
  let rows="";
  const maxR=Math.max(er.length,dr.length);
  for(let i=0;i<maxR;i++){
    const e=er[i]||["",""];const d=dr[i]||["",""];
    rows+='<tr><td>'+(e[0])+'</td><td class="e">'+(e[1]>0?money(e[1]):"—")+'</td><td class="d">'+(d[1]>0?money(d[1]):"—")+'</td></tr>';
  }
  const totE=b+h+tr+pr.otAmt+pr.bonus,totD=pr.absD+pr.lateD+pr.ded+pr.fines+pr.warnDed+pr.extraDed;
  return'<style>'+SCSS+'</style><div style="border:2px solid #1d4ed8;border-radius:8px;overflow:hidden;max-width:720px;margin:0 auto">'+shdr("#1d4ed8","قسيمة راتب — Salary Slip",MN[mo-1]+" "+yr)+'<div style="padding:10px 16px;background:#eff6ff;display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;font-size:11px;border-bottom:1px solid #bfdbfe"><div><b>Name:</b> '+emp.name+'</div><div><b>ID:</b> '+emp.id+'</div><div><b>Role:</b> '+(emp.role||"—")+'</div><div><b>Dept:</b> '+(emp.dept||"—")+'</div><div><b>Present:</b> '+pr.P+' days</div><div><b>Absent:</b> '+pr.A+' days</div></div><table><thead><tr><th>Description</th><th class="e">Earnings</th><th class="d">Deductions</th></tr></thead><tbody>'+rows+'<tr style="background:#f0fdf4;font-weight:700"><td>Total</td><td class="e">'+money(totE)+'</td><td class="d">'+money(totD)+'</td></tr></tbody></table><div style="background:#1d4ed8;color:#fff;padding:12px 16px;display:flex;justify-content:space-between;align-items:center"><b style="font-size:14px">صافي الراتب / Net Salary</b><b style="font-size:26px">'+money(pr.net)+'</b></div><div style="padding:14px 16px;display:grid;grid-template-columns:1fr 1fr;gap:40px;font-size:11px"><div style="border-top:1px solid #333;padding-top:8px;text-align:center">Employee Signature</div><div style="border-top:1px solid #333;padding-top:8px;text-align:center">Management</div></div></div>';
}
function buildWarnSlip(emp,warn){
  return'<style>'+SCSS+'</style><div style="border:2px solid #dc2626;border-radius:8px;overflow:hidden;max-width:720px;margin:0 auto">'+shdr("#dc2626","إنذار رسمي — Official Warning",fmt(warn.date))+'<div style="padding:14px 16px;background:#fef2f2"><div style="font-size:13px;margin-bottom:10px"><b>Employee:</b> '+emp.name+' ('+emp.id+')</div><div style="font-size:13px;margin-bottom:10px"><b>Department:</b> '+(emp.dept||"—")+'</div><div style="font-size:13px;margin-bottom:10px"><b>Warning Type:</b> '+warn.type+'</div><div style="font-size:13px;margin-bottom:14px"><b>Reason:</b> '+warn.reason+'</div>'+(warn.amount>0?'<div style="background:#fee2e2;padding:10px;border-radius:6px;font-size:14px;font-weight:700;color:#991b1b;margin-bottom:14px">Financial Deduction: '+money(warn.amount)+' — will be deducted from '+warn.month+' salary</div>':'')+'<div style="font-size:12px;color:#6b7280;">This is an official warning. Repeated violations may result in further disciplinary action.</div></div><div style="padding:14px 16px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px;font-size:11px"><div style="border-top:1px solid #333;padding-top:8px;text-align:center">Employee Signature</div><div style="border-top:1px solid #333;padding-top:8px;text-align:center">HR Manager</div><div style="border-top:1px solid #333;padding-top:8px;text-align:center">Management</div></div></div>';
}
function buildDedSlip(emp,ded){
  return'<style>'+SCSS+'</style><div style="border:2px solid #7c3aed;border-radius:8px;overflow:hidden;max-width:720px;margin:0 auto">'+shdr("#7c3aed","خصم مالي — Financial Deduction Notice",fmt(ded.date))+'<div style="padding:14px 16px;background:#faf5ff"><div style="font-size:13px;margin-bottom:8px"><b>Employee:</b> '+emp.name+' ('+emp.id+')</div><div style="font-size:13px;margin-bottom:8px"><b>Department:</b> '+(emp.dept||"—")+'</div><div style="font-size:13px;margin-bottom:8px"><b>Deduction Type:</b> '+ded.type+'</div><div style="font-size:13px;margin-bottom:8px"><b>Reason:</b> '+ded.reason+'</div><div style="background:#ede9fe;padding:12px;border-radius:6px;font-size:16px;font-weight:700;color:#6d28d9;margin:12px 0;">Deduction Amount: '+money(ded.amount)+' — Applied to: '+ded.month+'</div></div><div style="padding:14px 16px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px;font-size:11px"><div style="border-top:1px solid #333;padding-top:8px;text-align:center">Employee Signature</div><div style="border-top:1px solid #333;padding-top:8px;text-align:center">Accountant</div><div style="border-top:1px solid #333;padding-top:8px;text-align:center">Management</div></div></div>';
}
function buildEosbSlip(emp,res,type,endDate){
  let rows='<tr><td>Daily Rate</td><td>'+money(res.d)+'</td></tr>';
  if(res.yrs<=5)rows+='<tr><td>21 days/yr × '+res.yrs.toFixed(2)+'</td><td>'+money(res.d*21*res.yrs)+'</td></tr>';
  else{rows+='<tr><td>First 5 years (21d)</td><td>'+money(res.d*21*5)+'</td></tr><tr><td>After 5 years (30d × '+(res.yrs-5).toFixed(2)+')</td><td>'+money(res.d*30*(res.yrs-5))+'</td></tr>';}
  if(res.capped)rows+='<tr style="background:#fef3c7"><td>⚠ Capped 24 months</td><td>'+money(res.cap)+'</td></tr>';
  rows+='<tr style="font-weight:700;background:#f5f3ff"><td>EOSB Amount</td><td style="color:#6d28d9;font-size:16px">'+money(res.amount)+'</td></tr>';
  return'<style>'+SCSS+'</style><div style="border:2px solid #7c3aed;border-radius:8px;overflow:hidden;max-width:720px;margin:0 auto">'+shdr("#7c3aed","مكافأة نهاية الخدمة",type==="res"?"Resignation":"Termination")+'<div style="padding:10px 16px;background:#faf5ff;display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;border-bottom:1px solid #ede9fe"><div><b>Name:</b> '+emp.name+'</div><div><b>ID:</b> '+emp.id+'</div><div><b>Start:</b> '+fmt(emp.start)+'</div><div><b>End:</b> '+fmt(endDate)+'</div><div><b>Years:</b> '+res.yrs.toFixed(2)+'</div><div><b>Basic:</b> '+money(+emp.basic)+'</div></div><table><tbody>'+rows+'</tbody></table><div style="padding:14px 16px;display:grid;grid-template-columns:1fr 1fr;gap:40px;font-size:11px"><div style="border-top:1px solid #333;padding-top:8px;text-align:center">Employee Signature</div><div style="border-top:1px solid #333;padding-top:8px;text-align:center">Management</div></div></div>';
}

/* ═══ SEED DATA ═══ */
function mkE(o){return Object.assign({basic:0,housing:0,transport:0,total:0,nat:"",pass:"",passExp:"",resExp:"",perExp:"",idNo:"",idExp:"",lcNo:"",lcExp:"",csExp:"",canExp:"",visa:"Company",loc:"Site",status:"Active",phone:"",notes:""},o);}
const SEED_EMPS=[
  mkE({id:"SDR-001",name:"Mr. Ahmed Gamal",role:"General Manager",dept:"Management",start:"2023-04-01",phone:"506117580",loc:"Office",nat:"EGY",basic:8000,housing:3000,transport:1000,total:12000}),
  mkE({id:"SDR-002",name:"Mr. Osama",role:"Electrician",dept:"Electrical",start:"2023-05-01",phone:"502836493",nat:"EGY",basic:2200,housing:500,transport:300,total:3000}),
  mkE({id:"SDR-003",name:"Mr. Gul Khan",role:"Electrician",dept:"Electrical",start:"2023-05-13",phone:"569319705",nat:"PAK",basic:2000,housing:500,transport:300,total:2800}),
  mkE({id:"SDR-004",name:"Mr. Abdelhady",role:"Site Supervisor",dept:"Civil",start:"2023-05-21",phone:"501089519",loc:"Office",nat:"EGY",basic:4500,housing:1500,transport:500,total:6500}),
  mkE({id:"SDR-005",name:"Mr. Muhamad Yousaf",role:"Electrician",dept:"Electrical",start:"2023-06-06",status:"Resigned",nat:"PAK",basic:2000,housing:500,transport:300,total:2800}),
  mkE({id:"SDR-006",name:"M. Hasham",role:"Account Manager",dept:"Finance",start:"2023-06-08",phone:"563821107",loc:"Office",nat:"PAK",basic:5000,housing:2000,transport:500,total:7500}),
  mkE({id:"SDR-007",name:"M. Hossam",role:"Electrician",dept:"Electrical",start:"2023-07-22",phone:"504130783",nat:"EGY",basic:2200,housing:500,transport:300,total:3000}),
  mkE({id:"SDR-008",name:"Ibrahim Salah Moustafa",role:"Admin Officer",dept:"Admin",start:"2023-10-10",phone:"561140073",loc:"Office",nat:"EGY",basic:3500,housing:1000,transport:500,total:5000}),
  mkE({id:"SDR-009",name:"Ahmed Ramadan",role:"Electrician",dept:"Electrical",start:"2024-01-01",status:"Resigned",nat:"EGY",basic:2000,housing:500,transport:300,total:2800}),
  mkE({id:"SDR-010",name:"Mr. Hassan Mohamed Mahgoub",role:"Technician",dept:"Technical",start:"2024-01-01",phone:"525352967",nat:"EGY",basic:2800,housing:700,transport:500,total:4000}),
  mkE({id:"SDR-012",name:"Mr. Sahibur Rahman",role:"Electrician",dept:"Electrical",start:"2024-01-01",nat:"BGD",basic:2000,housing:500,transport:300,total:2800}),
  mkE({id:"SDR-014",name:"Ms. Marwa Aki",role:"Receptionist/HR",dept:"Admin",start:"2024-01-01",visa:"Secondment",loc:"Office",nat:"EGY",basic:3000,housing:800,transport:400,total:4200}),
  mkE({id:"SDR-015",name:"Mr. Syed Khan",role:"Electrician",dept:"Electrical",start:"2024-02-01",phone:"521290060",nat:"PAK",basic:2000,housing:500,transport:300,total:2800}),
  mkE({id:"SDR-016",name:"Mr. Jamshed Khan",role:"Electrician",dept:"Electrical",start:"2024-03-18",phone:"562218258",nat:"PAK",basic:2000,housing:500,transport:300,total:2800}),
  mkE({id:"SDR-017",name:"Eng. Kamal Ahmed Kamal",role:"Senior Engineer",dept:"Engineering",start:"2024-04-18",phone:"504130753",loc:"Office",nat:"EGY",basic:6000,housing:2000,transport:800,total:8800}),
  mkE({id:"SDR-018",name:"Mr. Amr Hassanin",role:"Engineer",dept:"Engineering",start:"2024-04-26",nat:"EGY",basic:4000,housing:1200,transport:600,total:5800}),
  mkE({id:"SDR-020",name:"Md Ibran Khan",role:"Electrician",dept:"Electrical",start:"2024-06-04",phone:"561161382",nat:"BGD",basic:2000,housing:500,transport:300,total:2800}),
  mkE({id:"SDR-021",name:"Mr. Farris Abdelmajid",role:"Technician",dept:"Technical",start:"2024-06-06",phone:"558155397",nat:"EGY",basic:2800,housing:700,transport:400,total:3900}),
  mkE({id:"SDR-023",name:"Mr. Hisham Gaber",role:"Engineer",dept:"Engineering",start:"2024-06-27",phone:"529818538",loc:"Office",nat:"EGY",basic:4500,housing:1500,transport:700,total:6700}),
  mkE({id:"SDR-024",name:"Mr. Mahmoud Abdou",role:"Technician",dept:"Technical",start:"2024-08-01",nat:"EGY",basic:2800,housing:700,transport:400,total:3900}),
  mkE({id:"SDR-025",name:"Mr. Mohammed Usman Ali",role:"Foreman",dept:"Electrical",start:"2024-09-01",visa:"Secondment",nat:"PAK",basic:3500,housing:800,transport:500,total:4800}),
  mkE({id:"SDR-026",name:"Mr. Ahmed Essam",role:"Junior Engineer",dept:"Engineering",start:"2024-09-16",nat:"EGY",basic:3500,housing:1000,transport:600,total:5100}),
];
const SEED_CARS=[
  {id:"CAR-001",plate:"Dubai A 11111",make:"Toyota",model:"Hilux",year:"2022",empId:"SDR-001",regExp:"2026-06-30",insExp:"2026-03-31",color:"White",fines:[]},
  {id:"CAR-002",plate:"Dubai B 22222",make:"Mitsubishi",model:"L200",year:"2021",empId:"SDR-004",regExp:"2026-09-30",insExp:"2026-05-31",color:"Silver",fines:[]},
];
const WARN_TYPES=["Bad Attitude","Policy Violation","Absent Without Notice","Late Repeatedly","Misconduct","Safety Violation","Other"];
const DED_TYPES=["Salary Deduction","Advance Recovery","Loan Installment","Equipment Damage","Absence Fine","Uniform/PPE","Policy Violation Fine","Other"];

/* ═══ STYLES ═══ */
const cs={
  page:{minHeight:"100vh",background:"#0f172a",color:"#e2e8f0",fontFamily:"Arial,sans-serif",fontSize:13},
  hdr:{background:"linear-gradient(135deg,#1e3a5f,#1d4ed8)",padding:"12px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"},
  card:{background:"#1e293b",borderRadius:10,padding:16,marginBottom:12,border:"1px solid #334155"},
  inp:{width:"100%",background:"#0f172a",border:"1px solid #334155",borderRadius:6,padding:"7px 10px",color:"#e2e8f0",fontSize:12},
  th:{padding:"8px 10px",background:"#0f172a",textAlign:"left",color:"#94a3b8",fontSize:11,fontWeight:600},
  td:{padding:"7px 10px",borderBottom:"1px solid #1e293b",fontSize:12},
};
const Btn=(c)=>({padding:"7px 16px",background:c||"#2563eb",color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:600});
const TBtn=(a)=>({padding:"8px 13px",border:"none",borderRadius:"6px 6px 0 0",cursor:"pointer",fontSize:11,fontWeight:600,background:a?"#2563eb":"#1e293b",color:a?"#fff":"#94a3b8"});
const Bdg=(c)=>({padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,background:c+"22",color:c,border:"1px solid "+c+"44"});
const CKEYS=["P","A","S","L","H","O","OT","L1","L2"];
const CODES={P:{l:"Present",bg:"#14532d",fg:"#86efac"},A:{l:"Absent",bg:"#7f1d1d",fg:"#fca5a5"},S:{l:"Sick",bg:"#713f12",fg:"#fde68a"},L:{l:"Leave",bg:"#1e3a5f",fg:"#93c5fd"},H:{l:"Holiday",bg:"#2d1b69",fg:"#c4b5fd"},O:{l:"Off",bg:"#1e293b",fg:"#475569"},OT:{l:"OT",bg:"#78350f",fg:"#fcd34d"},L1:{l:"Late<2h",bg:"#312e81",fg:"#a5b4fc"},L2:{l:"Late>2h",bg:"#4c1d95",fg:"#c4b5fd"}};

/* ═══ SLIP MODAL ═══ */
function SlipModal({html,onClose}){
  if(!html)return null;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.95)",zIndex:9999,overflowY:"auto",padding:16}}>
      <div style={{maxWidth:760,margin:"0 auto"}}>
        <div style={{display:"flex",gap:10,marginBottom:14,justifyContent:"center"}}>
          <button onClick={()=>window.print()} style={Btn("#2563eb")}>🖨️ Print</button>
          <button onClick={onClose} style={Btn("#475569")}>✕ Close</button>
        </div>
        <div dangerouslySetInnerHTML={{__html:html}}/>
      </div>
    </div>
  );
}

/* ═══ LOGIN ═══ */
function Login({onLogin}){
  const [role,setRole]=useState("");
  const [pass,setPass]=useState("");
  const [err,setErr]=useState("");
  function submit(){const u=USERS.find(x=>x.role===role&&x.pass===pass);if(u)onLogin(u);else setErr("❌ Invalid credentials");}
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0f172a,#1e3a5f)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#1e293b",borderRadius:16,padding:40,width:360,border:"1px solid #334155",boxShadow:"0 20px 60px rgba(0,0,0,.6)"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:50}}>⚡</div>
          <div style={{fontSize:22,fontWeight:900,color:"#e2e8f0",marginTop:6}}>سيدرة إليكتريك</div>
          <div style={{fontSize:12,color:"#94a3b8"}}>Sedra Electric — HR ERP v7.0</div>
        </div>
        <label style={{display:"block",fontSize:11,color:"#94a3b8",marginBottom:10}}>User Role
          <select value={role} onChange={e=>setRole(e.target.value)} style={{...cs.inp,marginTop:4}}>
            <option value="">— Select —</option>
            {USERS.map(u=><option key={u.role} value={u.role}>{u.label} / {u.ar}</option>)}
          </select>
        </label>
        <label style={{display:"block",fontSize:11,color:"#94a3b8",marginBottom:16}}>Password
          <input type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")submit();}} style={{...cs.inp,marginTop:4}}/>
        </label>
        {err&&<div style={{color:"#fca5a5",fontSize:12,marginBottom:12,textAlign:"center"}}>{err}</div>}
        <button onClick={submit} style={{...Btn(),width:"100%",padding:12,fontSize:14}}>🔐 Login</button>
      </div>
    </div>
  );
}

/* ═══ DASHBOARD ═══ */
function Dashboard({emps,att,leaves,warnings,deds,logs,role,lastSync,syncOk}){
  const now_=new Date(),y=now_.getFullYear(),m=now_.getMonth()+1;
  const active=emps.filter(e=>e.status!=="Resigned"&&e.status!=="Terminated");
  const moAtt=att[moKey(y,m)]||{};
  const todD=String(now_.getDate());
  let pres=0;active.forEach(e=>{const c=(moAtt[e.id]||{})[todD];if(c&&c!=="A"&&c!=="O"&&c!=="H")pres++;});
  const todStr=todayISO();
  const onLeave=leaves.filter(l=>l.from<=todStr&&l.to>=todStr).length;
  const expSoon=emps.filter(e=>[e.passExp,e.resExp,e.perExp,e.idExp,e.lcExp,e.csExp,e.canExp].some(d=>{const n=dLeft(d);return n!==null&&n<60;}));
  const openWarns=warnings.filter(w=>w.status==="active").length;
  const activeDeds=deds.filter(d=>d.status==="active").length;
  const stats=[{l:"Active Staff",v:active.length,c:"#3b82f6"},{l:"Present Today",v:pres,c:"#22c55e"},{l:"On Leave",v:onLeave,c:"#a78bfa"},{l:"Open Warnings",v:openWarns,c:"#ef4444"},{l:"Active Deductions",v:activeDeds,c:"#f59e0b"},{l:"Expiring Docs",v:expSoon.length,c:"#f97316"}];
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:16}}>
        {stats.map(s=>(
          <div key={s.l} style={{...cs.card,textAlign:"center",borderTop:"3px solid "+s.c,padding:12}}>
            <div style={{fontSize:30,fontWeight:900,color:s.c}}>{s.v}</div>
            <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{...cs.card,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",fontSize:11}}>
        <span style={{color:syncOk?"#22c55e":"#f97316"}}>{syncOk?"🟢 Supabase Connected":"🟡 Using Local Storage"}</span>
        <span style={{color:"#64748b"}}>Last sync: {lastSync||"waiting..."}</span>
        <span style={{color:"#64748b"}}>Auto-sync every 20 seconds</span>
      </div>
      {expSoon.length>0&&(
        <div style={cs.card}>
          <div style={{fontWeight:700,marginBottom:10,color:"#f97316"}}>⚠️ Documents Expiring Within 60 Days</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Name","ID","Passport","Residence","Labour Card","UAE ID"].map(h=><th key={h} style={cs.th}>{h}</th>)}</tr></thead>
              <tbody>{expSoon.map(e=>(
                <tr key={e.id} style={{background:"#1e293b"}}>
                  <td style={cs.td}>{e.name}</td>
                  <td style={{...cs.td,fontFamily:"monospace",color:"#60a5fa"}}>{e.id}</td>
                  {[e.passExp,e.resExp,e.lcExp,e.idExp].map((d,i)=><td key={i} style={{...cs.td,color:expColor(d)}}>{d?(fmt(d)+" ("+dLeft(d)+"d)"):"—"}</td>)}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
      {role==="owner"&&logs.length>0&&(
        <div style={cs.card}>
          <div style={{fontWeight:700,marginBottom:8,color:"#60a5fa"}}>🔍 Recent Activity</div>
          {logs.slice(-8).reverse().map((l,i)=>{
            const u=USERS.find(x=>x.role===l.user);
            return(<div key={i} style={{fontSize:11,padding:"4px 0",borderBottom:"1px solid #334155",display:"flex",gap:8,flexWrap:"wrap"}}><span style={{color:"#94a3b8",minWidth:130}}>{l.time}</span><span style={{color:u?u.color:"#fff",minWidth:90}}>[{l.user}]</span><span>{l.action}{l.detail?" — "+l.detail:""}</span></div>);
          })}
        </div>
      )}
    </div>
  );
}

/* ═══ EMPLOYEES ═══ */
const EF=[["id","ID"],["name","Full Name"],["role","Job Title"],["dept","Department"],["start","Start Date","date"],["phone","Phone"],["nat","Nationality"],["basic","Basic","number"],["housing","Housing","number"],["transport","Transport","number"],["total","Total Salary","number"],["pass","Passport No"],["passExp","Pass. Exp","date"],["resExp","Residence Exp","date"],["perExp","Permit Exp","date"],["idNo","UAE ID No"],["idExp","UAE ID Exp","date"],["lcNo","Labour Card No"],["lcExp","Labour Card Exp","date"],["csExp","Safety Exp","date"],["canExp","Canteen Exp","date"],["visa","Visa Type"],["loc","Location"],["notes","Notes"]];
function Employees({emps,setEmps,role,addLog}){
  const blank=mkE({id:"",name:"",role:"",dept:"",start:""});
  const [form,setForm]=useState(blank);
  const [show,setShow]=useState(false);
  const [q,setQ]=useState("");
  const filtered=emps.filter(e=>(e.name+e.id+(e.role||"")).toLowerCase().includes(q.toLowerCase()));
  const setF=(k,v)=>setForm(p=>({...p,[k]:v}));
  function save(){
    if(!form.id||!form.name){alert("ID and Name required");return;}
    setEmps(p=>{const i=p.findIndex(e=>e.id===form.id);if(i>=0){const n=[...p];n[i]=form;return n;}return[...p,form];});
    addLog("Employee Saved",form.name+" ("+form.id+")");setShow(false);
  }
  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <input placeholder="🔍 Search…" value={q} onChange={e=>setQ(e.target.value)} style={{...cs.inp,width:240}}/>
        {can(role,"editEmp")&&<button style={Btn()} onClick={()=>{setForm(blank);setShow(true);}}>+ Add Employee</button>}
        <span style={{marginLeft:"auto",fontSize:12,color:"#94a3b8"}}>{filtered.length} employees</span>
      </div>
      {show&&(
        <div style={{...cs.card,border:"1px solid #2563eb",marginBottom:16}}>
          <div style={{fontWeight:700,marginBottom:12,color:"#60a5fa"}}>{emps.find(e=>e.id===form.id)?"✏️ Edit":"➕ New"} Employee</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:8}}>
            {EF.filter(f=>{
              const sal=["basic","housing","transport","total"];
              if(sal.includes(f[0])){if(role==="dataentry")return false;if(role==="hr")return(+form.total||0)<=4000;return true;}
              return true;
            }).map(f=>(
              <label key={f[0]} style={{fontSize:11,color:"#94a3b8"}}>{f[1]}
                <input type={f[2]||"text"} value={form[f[0]]||""} onChange={e=>setF(f[0],e.target.value)} style={cs.inp}/>
              </label>
            ))}
            <label style={{fontSize:11,color:"#94a3b8"}}>Status
              <select value={form.status||"Active"} onChange={e=>setF("status",e.target.value)} style={cs.inp}>
                <option>Active</option><option>Resigned</option><option>Terminated</option>
              </select>
            </label>
          </div>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button style={Btn()} onClick={save}>💾 Save</button>
            <button style={Btn("#475569")} onClick={()=>setShow(false)}>Cancel</button>
          </div>
        </div>
      )}
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:850}}>
          <thead><tr>{["ID","Name","Role","Dept","Start","Basic","Status",""].map(h=><th key={h} style={cs.th}>{h}</th>)}</tr></thead>
          <tbody>{filtered.map(e=>(
            <tr key={e.id} style={{background:"#1e293b"}}>
              <td style={{...cs.td,fontFamily:"monospace",color:"#60a5fa"}}>{e.id}</td>
              <td style={cs.td}>{e.name}</td>
              <td style={{...cs.td,color:"#94a3b8"}}>{e.role}</td>
              <td style={cs.td}>{e.dept}</td>
              <td style={cs.td}>{fmt(e.start)}</td>
              <td style={cs.td}>{canSeeSalary(role,e.total)?(e.basic?money(+e.basic):"—"):<span style={{color:"#475569",letterSpacing:2}}>****</span>}</td>
              <td style={cs.td}><span style={Bdg(e.status==="Active"?"#22c55e":e.status==="Resigned"?"#f97316":"#ef4444")}>{e.status||"Active"}</span></td>
              <td style={cs.td}>
                {can(role,"editEmp")&&<button style={{...Btn("#1e3a5f"),marginRight:4,fontSize:11}} onClick={()=>{setForm({...blank,...e});setShow(true);}}>✏️</button>}
                {role==="owner"&&<button style={{...Btn("#7f1d1d"),fontSize:11}} onClick={()=>{if(window.confirm("Delete?"))setEmps(p=>p.filter(x=>x.id!==e.id));}}>🗑</button>}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══ ATTENDANCE ═══ */
function Attendance({emps,att,setEmpAtt,addLog}){
  const now_=new Date();
  const [y,setY]=useState(now_.getFullYear());
  const [m,setM]=useState(now_.getMonth()+1);
  const [vm,setVm]=useState("grid");
  const days=nDays(y,m);
  const DA=Array.from({length:days},(_,i)=>i+1);
  const gc=(id,d)=>((att[moKey(y,m)]||{})[id]||{})[String(d)]||"";
  const sc=(id,d,code)=>{const cur=((att[moKey(y,m)]||{})[id]||{});setEmpAtt(y,m,id,{...cur,[String(d)]:code});};
  function fill(id,code){const map={};for(let d=1;d<=days;d++)map[String(d)]=wDay(y,m,d)===0?"O":code;setEmpAtt(y,m,id,map);addLog("Att Fill",id+" → "+code+" "+moKey(y,m));}
  const cnt=(id,k)=>Object.values(((att[moKey(y,m)]||{})[id])||{}).filter(v=>v===k).length;
  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <select value={m} onChange={e=>setM(+e.target.value)} style={{...cs.inp,width:130}}>{MN.map((mn,i)=><option key={i} value={i+1}>{mn}</option>)}</select>
        <input type="number" value={y} onChange={e=>setY(+e.target.value)} style={{...cs.inp,width:90}}/>
        <button style={TBtn(vm==="grid")} onClick={()=>setVm("grid")}>Grid</button>
        <button style={TBtn(vm==="sum")} onClick={()=>setVm("sum")}>Summary</button>
      </div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
        {CKEYS.map(k=><span key={k} style={{padding:"2px 7px",borderRadius:4,fontSize:11,background:CODES[k].bg,color:CODES[k].fg,fontWeight:700}}>{k} {CODES[k].l}</span>)}
      </div>
      {vm==="grid"&&(
        <div style={{overflowX:"auto"}}>
          <table style={{borderCollapse:"collapse",fontSize:11}}>
            <thead>
              <tr>
                <th style={{...cs.th,minWidth:150,position:"sticky",left:0,background:"#0f172a",zIndex:2}}>Employee</th>
                <th style={{...cs.th,width:55}}>Fill</th>
                {DA.map(d=><th key={d} style={{...cs.th,minWidth:34,textAlign:"center",color:wDay(y,m,d)===0?"#475569":"#94a3b8"}}>{d}<br/><span style={{fontSize:9}}>{"SMTWTFS"[wDay(y,m,d)]}</span></th>)}
              </tr>
            </thead>
            <tbody>{emps.map(emp=>(
              <tr key={emp.id}>
                <td style={{...cs.td,position:"sticky",left:0,background:"#1e293b",fontWeight:600,minWidth:150,zIndex:1}}>{emp.name.split(" ").slice(0,2).join(" ")}</td>
                <td style={{...cs.td,textAlign:"center"}}>
                  <select onChange={e=>{if(e.target.value)fill(emp.id,e.target.value);}} style={{...cs.inp,width:46,padding:"2px",fontSize:10}}>
                    <option value="">—</option>
                    {CKEYS.map(k=><option key={k} value={k}>{k}</option>)}
                  </select>
                </td>
                {DA.map(d=>{
                  if(wDay(y,m,d)===0)return <td key={d} style={{padding:2}}><div style={{width:30,height:24,background:"#0f172a",borderRadius:3}}/></td>;
                  const code=gc(emp.id,d);
                  const meta=CODES[code]||{bg:"#1e293b",fg:"#475569"};
                  return (<td key={d} style={{padding:2}}><select value={code} onChange={e=>sc(emp.id,d,e.target.value)} style={{width:34,height:24,background:meta.bg,color:meta.fg,border:"none",borderRadius:3,fontSize:10,fontWeight:700,cursor:"pointer",padding:0,textAlign:"center"}}><option value="">·</option>{CKEYS.map(k=><option key={k} value={k}>{k}</option>)}</select></td>);
                })}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {vm==="sum"&&(
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>{["Employee","P","A","S","L","L1","L2","OT","H","O"].map(h=><th key={h} style={cs.th}>{h}</th>)}</tr></thead>
          <tbody>{emps.map(emp=>(
            <tr key={emp.id} style={{background:"#1e293b"}}>
              <td style={cs.td}>{emp.name}</td>
              {["P","A","S","L","L1","L2","OT","H","O"].map(k=><td key={k} style={{...cs.td,textAlign:"center",color:(CODES[k]||{}).fg||"#e2e8f0"}}>{cnt(emp.id,k)||"—"}</td>)}
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  );
}

/* ═══ DEDUCTIONS TAB ═══ */
function DeductionsTab({emps,deds,setDeds,role,addLog,setSlip}){
  const now_=new Date();
  const blankD={id:0,empId:"",type:DED_TYPES[0],reason:"",amount:0,month:moKey(now_.getFullYear(),now_.getMonth()+1),date:todayISO(),status:"active"};
  const [form,setForm]=useState(blankD);
  const [show,setShow]=useState(false);
  const [q,setQ]=useState("");
  const [mf,setMf]=useState("");
  const setF=(k,v)=>setForm(p=>({...p,[k]:v}));
  function save(){
    if(!form.empId||!form.amount||!form.reason){alert("Fill employee, amount and reason");return;}
    setDeds(p=>{const i=p.findIndex(d=>d.id===form.id);if(i>=0){const n=[...p];n[i]=form;return n;}return[...p,{...form,id:Date.now()}];});
    addLog("Deduction Added",form.empId+" "+money(form.amount)+" — "+form.type);
    setShow(false);setForm(blankD);
  }
  const filtered=deds.filter(d=>{
    const emp=emps.find(e=>e.id===d.empId);
    const nameMatch=(emp?emp.name:"").toLowerCase().includes(q.toLowerCase());
    const monthMatch=!mf||d.month===mf;
    return nameMatch&&monthMatch;
  });
  const totalActive=deds.filter(d=>d.status==="active").reduce((s,d)=>s+(+d.amount||0),0);
  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <input placeholder="🔍 Search employee…" value={q} onChange={e=>setQ(e.target.value)} style={{...cs.inp,width:200}}/>
        <input type="month" value={mf} onChange={e=>setMf(e.target.value)} style={{...cs.inp,width:140}} title="Filter by month"/>
        {mf&&<button style={{...Btn("#475569"),fontSize:11}} onClick={()=>setMf("")}>Clear</button>}
        {can(role,"deductions")&&<button style={Btn("#7c3aed")} onClick={()=>{setForm(blankD);setShow(true);}}>➕ Add Deduction</button>}
        <span style={{marginLeft:"auto",color:"#f59e0b",fontWeight:700,fontSize:13}}>Active: {money(totalActive)}</span>
      </div>

      {show&&(
        <div style={{...cs.card,border:"1px solid #7c3aed",marginBottom:14}}>
          <div style={{fontWeight:700,marginBottom:12,color:"#c4b5fd",fontSize:14}}>💸 New Financial Deduction</div>
          <div style={{...cs.card,background:"#1e1040",border:"1px solid #4c1d95",padding:"10px 14px",marginBottom:12,fontSize:11,color:"#a78bfa"}}>
            ℹ️ This deduction will automatically be applied to the employee's salary for the selected month. A printable slip will be available.
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
            <label style={{fontSize:11,color:"#94a3b8"}}>Employee *
              <select value={form.empId} onChange={e=>setF("empId",e.target.value)} style={cs.inp}>
                <option value="">— select —</option>
                {emps.filter(e=>e.status==="Active").map(e=><option key={e.id} value={e.id}>{e.name} ({e.id})</option>)}
              </select>
            </label>
            <label style={{fontSize:11,color:"#94a3b8"}}>Deduction Type
              <select value={form.type} onChange={e=>setF("type",e.target.value)} style={cs.inp}>
                {DED_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label style={{fontSize:11,color:"#94a3b8"}}>Amount (AED) *
              <input type="number" value={form.amount} onChange={e=>setF("amount",+e.target.value)} style={{...cs.inp,color:"#fca5a5"}} placeholder="0"/>
            </label>
            <label style={{fontSize:11,color:"#94a3b8"}}>Apply to Month *
              <input type="month" value={form.month} onChange={e=>setF("month",e.target.value)} style={cs.inp}/>
            </label>
            <label style={{fontSize:11,color:"#94a3b8"}}>Date
              <input type="date" value={form.date} onChange={e=>setF("date",e.target.value)} style={cs.inp}/>
            </label>
            <label style={{fontSize:11,color:"#94a3b8",gridColumn:"1/-1"}}>Reason / Details *
              <textarea value={form.reason} onChange={e=>setF("reason",e.target.value)} style={{...cs.inp,height:55,resize:"vertical"}} placeholder="Describe the reason for this deduction…"/>
            </label>
          </div>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button style={Btn("#7c3aed")} onClick={save}>💾 Save Deduction</button>
            <button style={Btn("#475569")} onClick={()=>setShow(false)}>Cancel</button>
          </div>
        </div>
      )}

      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr>{["Employee","Type","Amount","Month","Date","Reason","Status",""].map(h=><th key={h} style={cs.th}>{h}</th>)}</tr></thead>
        <tbody>
          {filtered.length===0&&<tr><td colSpan={8} style={{...cs.td,textAlign:"center",color:"#475569"}}>No deductions found</td></tr>}
          {filtered.map(d=>{
            const emp=emps.find(e=>e.id===d.empId);
            return (
              <tr key={d.id} style={{background:"#1e293b",opacity:d.status==="resolved"?.6:1}}>
                <td style={cs.td}><div style={{fontWeight:600}}>{emp?emp.name:d.empId}</div><div style={{fontSize:10,color:"#94a3b8"}}>{d.empId}</div></td>
                <td style={cs.td}><span style={Bdg("#a78bfa")}>{d.type}</span></td>
                <td style={{...cs.td,color:"#fca5a5",fontWeight:700}}>{money(d.amount)}</td>
                <td style={cs.td}>{d.month}</td>
                <td style={cs.td}>{fmt(d.date)}</td>
                <td style={{...cs.td,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.reason}</td>
                <td style={cs.td}><span style={Bdg(d.status==="active"?"#f59e0b":"#22c55e")}>{d.status}</span></td>
                <td style={cs.td}>
                  <button style={{...Btn("#4c1d95"),fontSize:10,marginRight:4}} onClick={()=>{if(emp)setSlip(buildDedSlip(emp,d));}}>🖨️</button>
                  {can(role,"deductions")&&(
                    <button style={{...Btn(d.status==="active"?"#166534":"#78350f"),fontSize:10,marginRight:4}}
                      onClick={()=>setDeds(p=>p.map(x=>x.id===d.id?{...x,status:x.status==="active"?"resolved":"active"}:x))}>
                      {d.status==="active"?"✓ Resolve":"Reopen"}
                    </button>
                  )}
                  {role==="owner"&&<button style={{...Btn("#7f1d1d"),fontSize:10}} onClick={()=>setDeds(p=>p.filter(x=>x.id!==d.id))}>🗑</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ═══ WARNINGS ═══ */
function Warnings({emps,warnings,setWarnings,role,addLog,setSlip}){
  const now_=new Date();
  const blank={id:0,empId:"",type:WARN_TYPES[0],reason:"",date:todayISO(),amount:0,month:moKey(now_.getFullYear(),now_.getMonth()+1),status:"active"};
  const [form,setForm]=useState(blank);
  const [show,setShow]=useState(false);
  const [q,setQ]=useState("");
  const setF=(k,v)=>setForm(p=>({...p,[k]:v}));
  function save(){
    if(!form.empId||!form.reason){alert("Select employee and enter reason");return;}
    setWarnings(p=>{const i=p.findIndex(w=>w.id===form.id);if(i>=0){const n=[...p];n[i]=form;return n;}return[...p,{...form,id:Date.now()}];});
    addLog("Warning Issued",form.empId+" — "+form.type);
    setShow(false);setForm(blank);
  }
  const filtered=warnings.filter(w=>{const emp=emps.find(e=>e.id===w.empId);return(emp?emp.name:"").toLowerCase().includes(q.toLowerCase());});
  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <input placeholder="🔍 Search employee…" value={q} onChange={e=>setQ(e.target.value)} style={{...cs.inp,width:220}}/>
        {can(role,"warnings")&&<button style={Btn("#dc2626")} onClick={()=>{setForm(blank);setShow(true);}}>⚠️ Issue Warning</button>}
      </div>
      {show&&(
        <div style={{...cs.card,border:"1px solid #dc2626",marginBottom:12}}>
          <div style={{fontWeight:700,marginBottom:10,color:"#fca5a5"}}>⚠️ New Warning</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:8}}>
            <label style={{fontSize:11,color:"#94a3b8"}}>Employee
              <select value={form.empId} onChange={e=>setF("empId",e.target.value)} style={cs.inp}>
                <option value="">— select —</option>
                {emps.filter(e=>e.status==="Active").map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </label>
            <label style={{fontSize:11,color:"#94a3b8"}}>Warning Type
              <select value={form.type} onChange={e=>setF("type",e.target.value)} style={cs.inp}>
                {WARN_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label style={{fontSize:11,color:"#94a3b8"}}>Date<input type="date" value={form.date} onChange={e=>setF("date",e.target.value)} style={cs.inp}/></label>
            <label style={{fontSize:11,color:"#94a3b8"}}>Financial Deduction AED (0=none)<input type="number" value={form.amount} onChange={e=>setF("amount",+e.target.value)} style={cs.inp}/></label>
            <label style={{fontSize:11,color:"#94a3b8"}}>Apply to Month<input type="month" value={form.month} onChange={e=>setF("month",e.target.value)} style={cs.inp}/></label>
            <label style={{fontSize:11,color:"#94a3b8",gridColumn:"1/-1"}}>Reason
              <textarea value={form.reason} onChange={e=>setF("reason",e.target.value)} style={{...cs.inp,height:60,resize:"vertical"}}/>
            </label>
          </div>
          <div style={{display:"flex",gap:8,marginTop:10}}>
            <button style={Btn("#dc2626")} onClick={save}>💾 Save Warning</button>
            <button style={Btn("#475569")} onClick={()=>setShow(false)}>Cancel</button>
          </div>
        </div>
      )}
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr>{["Employee","Type","Date","Amount","Month","Reason","Status",""].map(h=><th key={h} style={cs.th}>{h}</th>)}</tr></thead>
        <tbody>
          {filtered.length===0&&<tr><td colSpan={8} style={{...cs.td,textAlign:"center",color:"#475569"}}>No warnings</td></tr>}
          {filtered.map(w=>{
            const emp=emps.find(e=>e.id===w.empId);
            return (
              <tr key={w.id} style={{background:"#1e293b"}}>
                <td style={cs.td}>{emp?emp.name:w.empId}</td>
                <td style={cs.td}><span style={Bdg("#ef4444")}>{w.type}</span></td>
                <td style={cs.td}>{fmt(w.date)}</td>
                <td style={{...cs.td,color:w.amount>0?"#fca5a5":"#64748b",fontWeight:w.amount>0?700:400}}>{w.amount>0?money(w.amount):"None"}</td>
                <td style={cs.td}>{w.month}</td>
                <td style={{...cs.td,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{w.reason}</td>
                <td style={cs.td}><span style={Bdg(w.status==="active"?"#f97316":"#22c55e")}>{w.status}</span></td>
                <td style={cs.td}>
                  <button style={{...Btn("#166534"),fontSize:10,marginRight:4}} onClick={()=>setSlip(buildWarnSlip(emp||{name:w.empId,id:w.empId,dept:""},w))}>🖨️</button>
                  {can(role,"warnings")&&<button style={{...Btn(w.status==="active"?"#475569":"#f97316"),fontSize:10,marginRight:4}} onClick={()=>setWarnings(p=>p.map(x=>x.id===w.id?{...x,status:x.status==="active"?"resolved":"active"}:x))}>{w.status==="active"?"✓ Resolve":"Reopen"}</button>}
                  {role==="owner"&&<button style={{...Btn("#7f1d1d"),fontSize:10}} onClick={()=>setWarnings(p=>p.filter(x=>x.id!==w.id))}>🗑</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ═══ SALARY ═══ */
function Salary({emps,att,adj,getAdj,setAdjK,setSlip,role,getCarFines,addLog,warnings,deds}){
  const now_=new Date();
  const [y,setY]=useState(now_.getFullYear());
  const [m,setM]=useState(now_.getMonth()+1);
  const [selId,setSelId]=useState(null);
  const selEmp=emps.find(e=>e.id===selId)||null;
  const selAdj=selEmp?getAdj(y,m,selId):{};
  const AJ=[["otH","Extra OT Hours"],["otRate","OT Rate (×1.25 default)"],["bonus","Bonus (AED)"],["ded","Manual Deduction (AED)"],["carFines","Car Fines Override (AED)"]];

  function getWarnDed(empId){
    const mk=moKey(y,m);
    return warnings.filter(w=>w.empId===empId&&w.month===mk&&w.status==="active"&&w.amount>0).reduce((s,w)=>s+(+w.amount||0),0);
  }
  function getDedAmt(empId){
    const mk=moKey(y,m);
    return deds.filter(d=>d.empId===empId&&d.month===mk&&d.status==="active").reduce((s,d)=>s+(+d.amount||0),0);
  }

  const visibleEmps=role==="hr"?emps.filter(e=>(+e.total||0)<=4000):emps;
  const rows=visibleEmps.map(emp=>{
    const attMap=(att[moKey(y,m)]||{})[emp.id];
    const carF=getCarFines(emp.id,y,m);
    const adjData={...getAdj(y,m,emp.id),carFines:(getAdj(y,m,emp.id).carFines||0)+(carF||0)};
    const pr=salaryCalc(emp,attMap,y,m,adjData,getWarnDed(emp.id),getDedAmt(emp.id));
    return{emp,pr};
  });
  const totNet=rows.reduce((s,r)=>s+r.pr.net,0);
  const totGross=rows.reduce((s,r)=>s+r.pr.gross,0);

  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <select value={m} onChange={e=>setM(+e.target.value)} style={{...cs.inp,width:130}}>{MN.map((mn,i)=><option key={i} value={i+1}>{mn}</option>)}</select>
        <input type="number" value={y} onChange={e=>setY(+e.target.value)} style={{...cs.inp,width:90}}/>
        <span style={{marginLeft:"auto",color:"#22c55e",fontWeight:700,fontSize:14}}>Total Net: {money(totNet)}</span>
      </div>
      <div style={{...cs.card,background:"#0f2744",border:"1px solid #2563eb",padding:"10px 14px",marginBottom:10,fontSize:12}}>
        📅 <b style={{color:"#60a5fa"}}>{MN[m-1]} {y}</b> — Attendance, warnings & deductions all auto-applied.
        {can(role,"adjEdit")&&<span style={{color:"#a78bfa"}}> &nbsp;|&nbsp; Click ⚙️ on any row to adjust OT, bonus, or manual deductions before printing.</span>}
      </div>

      {selEmp&&can(role,"adjEdit")&&(
        <div style={{...cs.card,border:"1px solid #2563eb",marginBottom:12}}>
          <div style={{fontWeight:700,marginBottom:10,color:"#60a5fa"}}>⚙️ Salary Adjustments — {selEmp.name} ({MN[m-1]} {y})</div>
          <div style={{...cs.card,background:"#0f2030",border:"1px solid #334155",padding:"8px 12px",fontSize:11,color:"#94a3b8",marginBottom:10}}>
            These adjustments are saved per employee per month and will appear on the salary slip. Use "Deductions" tab for permanent tracked deductions.
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:8}}>
            {AJ.map(f=>(
              <label key={f[0]} style={{fontSize:11,color:"#94a3b8"}}>{f[1]}
                <input type="number" value={selAdj[f[0]]||""} onChange={e=>setAdjK(y,m,selId,{...selAdj,[f[0]]:e.target.value})} style={cs.inp} placeholder="0"/>
              </label>
            ))}
          </div>
          <button style={{...Btn("#475569"),marginTop:10}} onClick={()=>setSelId(null)}>✓ Done</button>
        </div>
      )}

      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:1020}}>
          <thead><tr>{["Employee","Att.(P/A)","Gross","Absent(-)","Late(-)","OT(+)","Bonus(+)","Fines(-)","Warn(-)","Ded(-)","NET",""].map(h=><th key={h} style={cs.th}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map(({emp:e,pr})=>{
              const show=canSeeSalary(role,e.total);
              const noAtt=pr.P===0&&pr.A===0&&pr.L1===0&&pr.L2===0;
              const hasDed=(pr.extraDed>0)||(pr.warnDed>0)||(pr.fines>0)||(pr.ded>0);
              return (
                <tr key={e.id} style={{background:"#1e293b",borderLeft:hasDed?"3px solid #f59e0b":"3px solid transparent"}}>
                  <td style={cs.td}><div style={{fontWeight:600}}>{e.name}</div><div style={{fontSize:10,color:"#94a3b8"}}>{e.id}</div></td>
                  <td style={{...cs.td,fontSize:11}}>{noAtt?<span style={{color:"#f97316",fontSize:10}}>⚠️ No data</span>:<span><span style={{color:"#86efac"}}>{pr.P}P </span><span style={{color:"#fca5a5"}}>{pr.A}A </span><span style={{color:"#a5b4fc"}}>{pr.L1}L1 </span><span style={{color:"#c4b5fd"}}>{pr.L2}L2</span></span>}</td>
                  <td style={cs.td}>{show?money(pr.gross):<span style={{color:"#475569",letterSpacing:2}}>****</span>}</td>
                  <td style={{...cs.td,color:pr.absD>0?"#fca5a5":"#64748b"}}>{show&&pr.absD>0?"-"+money(pr.absD):"—"}</td>
                  <td style={{...cs.td,color:pr.lateD>0?"#fde68a":"#64748b"}}>{show&&pr.lateD>0?"-"+money(pr.lateD):"—"}</td>
                  <td style={{...cs.td,color:pr.otAmt>0?"#86efac":"#64748b"}}>{show&&pr.otAmt>0?"+"+money(pr.otAmt):"—"}</td>
                  <td style={{...cs.td,color:pr.bonus>0?"#86efac":"#64748b"}}>{show&&pr.bonus>0?"+"+money(pr.bonus):"—"}</td>
                  <td style={{...cs.td,color:(pr.ded+pr.fines)>0?"#fca5a5":"#64748b"}}>{show&&(pr.ded+pr.fines)>0?"-"+money(pr.ded+pr.fines):"—"}</td>
                  <td style={{...cs.td,color:pr.warnDed>0?"#ef4444":"#64748b"}}>{show&&pr.warnDed>0?"-"+money(pr.warnDed):"—"}</td>
                  <td style={{...cs.td,color:pr.extraDed>0?"#f59e0b":"#64748b"}}>{show&&pr.extraDed>0?"-"+money(pr.extraDed):"—"}</td>
                  <td style={{...cs.td,fontWeight:700,color:pr.net<0?"#ef4444":"#34d399",fontSize:14}}>{show?money(pr.net):<span style={{color:"#475569",letterSpacing:2}}>****</span>}</td>
                  <td style={cs.td}>
                    {can(role,"adjEdit")&&<button style={{...Btn("#1e3a5f"),fontSize:11,marginRight:4}} onClick={()=>setSelId(e.id===selId?null:e.id)}>⚙️</button>}
                    {can(role,"slips")&&show&&<button style={{...Btn("#166634"),fontSize:11}} onClick={()=>{addLog("Slip Printed",e.name+" "+MN[m-1]+" "+y);setSlip(buildSalarySlip(e,pr,y,m));}}>🖨️</button>}
                  </td>
                </tr>
              );
            })}
            <tr style={{background:"#0f172a",fontWeight:700}}>
              <td style={cs.td} colSpan={2}>TOTAL ({rows.length} staff)</td>
              <td style={cs.td}>{money(totGross)}</td>
              <td style={cs.td} colSpan={7}/>
              <td style={{...cs.td,color:"#34d399",fontSize:15}}>{money(totNet)}</td>
              <td style={cs.td}/>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══ CARS ═══ */
function Cars({cars,setCars,emps,role,addLog}){
  const now_=new Date();
  const blankC={id:"",plate:"",make:"",model:"",year:"",empId:"",regExp:"",insExp:"",color:"",fines:[]};
  const blankF={id:0,date:todayISO(),amount:"",desc:"",month:moKey(now_.getFullYear(),now_.getMonth()+1),paid:false};
  const [form,setForm]=useState(blankC);
  const [showForm,setShowForm]=useState(false);
  const [fineForm,setFineForm]=useState(blankF);
  const [showFine,setShowFine]=useState(null);
  const setF=(k,v)=>setForm(p=>({...p,[k]:v}));
  function saveCar(){
    if(!form.id||!form.plate){alert("ID and Plate required");return;}
    setCars(p=>{const i=p.findIndex(c=>c.id===form.id);if(i>=0){const n=[...p];n[i]=form;return n;}return[...p,{...form,fines:form.fines||[]}];});
    addLog("Car Saved",form.plate);setShowForm(false);
  }
  function addFine(carId){
    if(!fineForm.amount||!fineForm.desc){alert("Fill amount and description");return;}
    setCars(p=>p.map(c=>c.id!==carId?c:{...c,fines:[...(c.fines||[]),{...fineForm,id:Date.now()}]}));
    addLog("Car Fine Added",fineForm.desc+" "+fineForm.amount+" AED");setShowFine(null);
  }
  const CF=[["id","Car ID"],["plate","Plate No"],["make","Make"],["model","Model"],["year","Year"],["color","Color"],["regExp","Reg. Exp","date"],["insExp","Ins. Exp","date"]];
  return (
    <div>
      <button style={{...Btn(),marginBottom:12}} onClick={()=>{setForm(blankC);setShowForm(true);}}>+ Add Car</button>
      {showForm&&(
        <div style={{...cs.card,border:"1px solid #06b6d4",marginBottom:12}}>
          <div style={{fontWeight:700,marginBottom:10,color:"#22d3ee"}}>🚗 {cars.find(c=>c.id===form.id)?"Edit":"New"} Car</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(175px,1fr))",gap:8}}>
            {CF.map(f=><label key={f[0]} style={{fontSize:11,color:"#94a3b8"}}>{f[1]}<input type={f[2]||"text"} value={form[f[0]]||""} onChange={e=>setF(f[0],e.target.value)} style={cs.inp}/></label>)}
            <label style={{fontSize:11,color:"#94a3b8"}}>Driver<select value={form.empId||""} onChange={e=>setF("empId",e.target.value)} style={cs.inp}><option value="">— None —</option>{emps.filter(e=>e.status==="Active").map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
          </div>
          <div style={{display:"flex",gap:8,marginTop:10}}>
            <button style={Btn()} onClick={saveCar}>💾 Save</button>
            <button style={Btn("#475569")} onClick={()=>setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}
      {cars.map(car=>{
        const driver=emps.find(e=>e.id===car.empId);
        const unpaid=(car.fines||[]).filter(f=>!f.paid).reduce((s,f)=>s+(+f.amount||0),0);
        return (
          <div key={car.id} style={{...cs.card,border:"1px solid #334155"}}>
            <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{fontWeight:700,fontSize:15,color:"#22d3ee"}}>🚗 {car.plate}</div>
                <div style={{fontSize:12,color:"#94a3b8"}}>{car.make} {car.model} {car.year} — {car.color}</div>
                <div style={{fontSize:12,marginTop:4}}>Driver: <b>{driver?driver.name:"—"}</b> | Reg: <span style={{color:expColor(car.regExp)}}>{fmt(car.regExp)}</span> | Ins: <span style={{color:expColor(car.insExp)}}>{fmt(car.insExp)}</span></div>
                {unpaid>0&&<div style={{color:"#fca5a5",fontSize:12,marginTop:4}}>⚠️ Unpaid Fines: {money(unpaid)}</div>}
              </div>
              <div style={{display:"flex",gap:6}}>
                <button style={{...Btn("#1e3a5f"),fontSize:11}} onClick={()=>{setForm({...blankC,...car});setShowForm(true);}}>✏️</button>
                <button style={{...Btn("#166534"),fontSize:11}} onClick={()=>setShowFine(car.id)}>+ Fine</button>
                <button style={{...Btn("#7f1d1d"),fontSize:11}} onClick={()=>{if(window.confirm("Delete?"))setCars(p=>p.filter(c=>c.id!==car.id));}}>🗑</button>
              </div>
            </div>
            {showFine===car.id&&(
              <div style={{marginTop:10,padding:10,background:"#0f172a",borderRadius:8,border:"1px solid #f97316"}}>
                <div style={{fontWeight:700,marginBottom:8,color:"#f97316"}}>➕ Add Fine</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:8}}>
                  <label style={{fontSize:11,color:"#94a3b8"}}>Date<input type="date" value={fineForm.date} onChange={e=>setFineForm(p=>({...p,date:e.target.value}))} style={cs.inp}/></label>
                  <label style={{fontSize:11,color:"#94a3b8"}}>Amount<input type="number" value={fineForm.amount} onChange={e=>setFineForm(p=>({...p,amount:e.target.value}))} style={cs.inp}/></label>
                  <label style={{fontSize:11,color:"#94a3b8"}}>Salary Month<input type="month" value={fineForm.month} onChange={e=>setFineForm(p=>({...p,month:e.target.value}))} style={cs.inp}/></label>
                  <label style={{fontSize:11,color:"#94a3b8"}}>Description<input value={fineForm.desc} onChange={e=>setFineForm(p=>({...p,desc:e.target.value}))} style={cs.inp}/></label>
                </div>
                <div style={{display:"flex",gap:8,marginTop:8}}>
                  <button style={Btn("#f97316")} onClick={()=>addFine(car.id)}>Add Fine</button>
                  <button style={Btn("#475569")} onClick={()=>setShowFine(null)}>Cancel</button>
                </div>
              </div>
            )}
            {(car.fines||[]).length>0&&(
              <div style={{marginTop:10}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead><tr>{["Date","Amount","Month","Description","Status",""].map(h=><th key={h} style={{...cs.th,fontSize:10}}>{h}</th>)}</tr></thead>
                  <tbody>{(car.fines||[]).map(f=>(
                    <tr key={f.id} style={{background:"#1e293b",opacity:f.paid?.6:1}}>
                      <td style={cs.td}>{fmt(f.date)}</td>
                      <td style={{...cs.td,color:f.paid?"#64748b":"#fca5a5",fontWeight:700}}>{money(+f.amount)}</td>
                      <td style={cs.td}>{f.month}</td>
                      <td style={cs.td}>{f.desc}</td>
                      <td style={cs.td}><span style={Bdg(f.paid?"#22c55e":"#f97316")}>{f.paid?"Paid":"Unpaid"}</span></td>
                      <td style={cs.td}>
                        <button style={{...Btn(f.paid?"#1e3a5f":"#166534"),fontSize:10,marginRight:4}} onClick={()=>setCars(p=>p.map(c=>c.id!==car.id?c:{...c,fines:(c.fines||[]).map(x=>x.id===f.id?{...x,paid:!x.paid}:x)}))}>
                          {f.paid?"Unpay":"✓ Pay"}
                        </button>
                        <button style={{...Btn("#7f1d1d"),fontSize:10}} onClick={()=>setCars(p=>p.map(c=>c.id!==car.id?c:{...c,fines:(c.fines||[]).filter(x=>x.id!==f.id)}))}>🗑</button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
      {cars.length===0&&<div style={{...cs.card,textAlign:"center",color:"#475569"}}>No cars registered yet.</div>}
    </div>
  );
}

/* ═══ LEAVES ═══ */
function Leaves({emps,leaves,setLeaves,addLog}){
  const blank={id:0,empId:"",type:"annual",from:"",to:"",days:0,useTicket:false,lateDays:0};
  const [form,setForm]=useState(blank);
  const [show,setShow]=useState(false);
  const setF=(k,v)=>setForm(p=>({...p,[k]:v}));
  function save(){
    if(!form.empId||!form.from||!form.to){alert("Fill required fields");return;}
    setLeaves(p=>{const i=p.findIndex(l=>l.id===form.id);if(i>=0){const n=[...p];n[i]=form;return n;}return[...p,{...form,id:Date.now()}];});
    addLog("Leave Saved",form.empId+" "+form.from+"→"+form.to);
    setShow(false);setForm(blank);
  }
  return (
    <div>
      <button style={{...Btn(),marginBottom:12}} onClick={()=>{setForm(blank);setShow(true);}}>+ Add Leave</button>
      {show&&(
        <div style={{...cs.card,border:"1px solid #059669",marginBottom:12}}>
          <div style={{fontWeight:700,marginBottom:10,color:"#34d399"}}>🌴 Leave Record</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8}}>
            <label style={{fontSize:11,color:"#94a3b8"}}>Employee<select value={form.empId} onChange={e=>setF("empId",e.target.value)} style={cs.inp}><option value="">— select —</option>{emps.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
            <label style={{fontSize:11,color:"#94a3b8"}}>Type<select value={form.type} onChange={e=>setF("type",e.target.value)} style={cs.inp}><option value="annual">Annual</option><option value="sick">Sick</option><option value="unpaid">Unpaid</option></select></label>
            <label style={{fontSize:11,color:"#94a3b8"}}>From<input type="date" value={form.from} onChange={e=>setF("from",e.target.value)} style={cs.inp}/></label>
            <label style={{fontSize:11,color:"#94a3b8"}}>To<input type="date" value={form.to} onChange={e=>setF("to",e.target.value)} style={cs.inp}/></label>
            <label style={{fontSize:11,color:"#94a3b8"}}>Days<input type="number" value={form.days} onChange={e=>setF("days",+e.target.value)} style={cs.inp}/></label>
            <label style={{fontSize:11,color:"#94a3b8"}}>Late Days on Return<input type="number" value={form.lateDays||0} onChange={e=>setF("lateDays",+e.target.value)} style={cs.inp}/></label>
            <label style={{fontSize:11,color:"#94a3b8",display:"flex",gap:8,alignItems:"center",paddingTop:16}}>
              <input type="checkbox" checked={!!form.useTicket} onChange={e=>setF("useTicket",e.target.checked)}/>Air Ticket (1,000 AED)
            </label>
          </div>
          <div style={{display:"flex",gap:8,marginTop:10}}>
            <button style={Btn()} onClick={save}>💾 Save</button>
            <button style={Btn("#475569")} onClick={()=>setShow(false)}>Cancel</button>
          </div>
        </div>
      )}
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr>{["Employee","Type","From","To","Days","Ticket","Late",""].map(h=><th key={h} style={cs.th}>{h}</th>)}</tr></thead>
        <tbody>
          {leaves.length===0&&<tr><td colSpan={8} style={{...cs.td,textAlign:"center",color:"#475569"}}>No leave records</td></tr>}
          {leaves.map(l=>{
            const emp=emps.find(e=>e.id===l.empId);
            return (
              <tr key={l.id} style={{background:"#1e293b"}}>
                <td style={cs.td}>{emp?emp.name:l.empId}</td>
                <td style={cs.td}><span style={Bdg("#a78bfa")}>{l.type}</span></td>
                <td style={cs.td}>{fmt(l.from)}</td><td style={cs.td}>{fmt(l.to)}</td>
                <td style={cs.td}>{l.days}</td><td style={cs.td}>{l.useTicket?"✈️":"—"}</td>
                <td style={cs.td}>{l.lateDays||"—"}</td>
                <td style={cs.td}><button style={{...Btn("#7f1d1d"),fontSize:11}} onClick={()=>setLeaves(p=>p.filter(x=>x.id!==l.id))}>🗑</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ═══ EOSB ═══ */
function EOSB({emps,setSlip,addLog}){
  const [selId,setSelId]=useState("");
  const [type,setType]=useState("res");
  const [endDate,setEnd]=useState(todayISO());
  const emp=emps.find(e=>e.id===selId)||null;
  const res=emp?eosbCalc(emp.basic,emp.start,endDate,type):null;
  return (
    <div style={cs.card}>
      <div style={{fontWeight:700,marginBottom:14,color:"#a78bfa"}}>🏁 End of Service Calculator</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
        <label style={{fontSize:11,color:"#94a3b8"}}>Employee<select value={selId} onChange={e=>setSelId(e.target.value)} style={cs.inp}><option value="">— select —</option>{emps.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
        <label style={{fontSize:11,color:"#94a3b8"}}>Reason<select value={type} onChange={e=>setType(e.target.value)} style={cs.inp}><option value="res">Resignation</option><option value="term">Termination</option></select></label>
        <label style={{fontSize:11,color:"#94a3b8"}}>End Date<input type="date" value={endDate} onChange={e=>setEnd(e.target.value)} style={cs.inp}/></label>
      </div>
      {emp&&res&&(res.ok?(
        <div style={{marginTop:16}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:8}}>
            {[["Employee",emp.name],["Basic",money(+emp.basic)],["Start",fmt(emp.start)],["End",fmt(endDate)],["Years",res.yrs.toFixed(2)+" yrs"],["Daily",money(res.d)],["EOSB",money(res.amount)],["Capped?",res.capped?"⚠️ Yes":"No"]].map(it=>(
              <div key={it[0]} style={{...cs.card,padding:10}}><div style={{fontSize:10,color:"#94a3b8"}}>{it[0]}</div><div style={{fontWeight:700,fontSize:13,color:"#c4b5fd"}}>{it[1]}</div></div>
            ))}
          </div>
          <button style={{...Btn("#7c3aed"),marginTop:12}} onClick={()=>{addLog("EOSB Slip",emp.name);setSlip(buildEosbSlip(emp,res,type,endDate));}}>🖨️ Print EOSB Slip</button>
        </div>
      ):<div style={{color:"#f97316",marginTop:12,padding:10,background:"#431407",borderRadius:8}}>⚠️ Less than 1 year ({res.yrs.toFixed(2)} yrs) — Not eligible.</div>)}
    </div>
  );
}

/* ═══ DOCUMENTS ═══ */
const DF=[{k:"passExp",l:"Passport"},{k:"resExp",l:"Residence"},{k:"perExp",l:"Work Permit"},{k:"idExp",l:"UAE ID"},{k:"lcExp",l:"Labour Card"},{k:"csExp",l:"Safety Cert"},{k:"canExp",l:"Canteen Card"}];
function Documents({emps}){
  const [filter,setFilter]=useState("all");
  const all=[];
  emps.forEach(e=>DF.forEach(f=>{if(e[f.k])all.push({emp:e,doc:f.l,exp:e[f.k],n:dLeft(e[f.k])});}));
  const rows=all.filter(r=>{if(filter==="exp")return r.n!==null&&r.n<0;if(filter==="soon")return r.n!==null&&r.n>=0&&r.n<60;return true;}).sort((a,b)=>(a.n==null?9999:a.n)-(b.n==null?9999:b.n));
  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        {[["all","All"],["exp","⛔ Expired"],["soon","⚠️ < 60 Days"]].map(f=><button key={f[0]} style={TBtn(filter===f[0])} onClick={()=>setFilter(f[0])}>{f[1]}</button>)}
      </div>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr>{["Employee","ID","Document","Expiry","Days","Status"].map(h=><th key={h} style={cs.th}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.length===0&&<tr><td colSpan={6} style={{...cs.td,textAlign:"center",color:"#475569"}}>No documents match filter</td></tr>}
          {rows.map((r,i)=>{
            const c=expColor(r.exp);
            const st=r.n==null?"—":r.n<0?"Expired":r.n<30?"Critical":r.n<90?"Warning":"Valid";
            return (<tr key={i} style={{background:"#1e293b"}}><td style={cs.td}>{r.emp.name}</td><td style={{...cs.td,fontFamily:"monospace",color:"#60a5fa"}}>{r.emp.id}</td><td style={cs.td}>{r.doc}</td><td style={{...cs.td,color:c}}>{fmt(r.exp)}</td><td style={{...cs.td,color:c,fontWeight:700}}>{r.n!==null?r.n+"d":"—"}</td><td style={cs.td}><span style={Bdg(c)}>{st}</span></td></tr>);
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ═══ AUDIT ═══ */
function AuditLog({logs}){
  const [q,setQ]=useState("");
  const filtered=logs.filter(l=>(l.action+l.detail+l.user).toLowerCase().includes(q.toLowerCase())).slice().reverse();
  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:12,alignItems:"center"}}>
        <input placeholder="🔍 Search logs…" value={q} onChange={e=>setQ(e.target.value)} style={{...cs.inp,width:260}}/>
        <span style={{fontSize:12,color:"#94a3b8",marginLeft:"auto"}}>{filtered.length} entries</span>
      </div>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr>{["Time","User","Action","Detail"].map(h=><th key={h} style={cs.th}>{h}</th>)}</tr></thead>
        <tbody>
          {filtered.length===0&&<tr><td colSpan={4} style={{...cs.td,textAlign:"center",color:"#475569"}}>No logs yet</td></tr>}
          {filtered.map((l,i)=>{
            const u=USERS.find(x=>x.role===l.user);
            return (<tr key={i} style={{background:i%2===0?"#1e293b":"#0f172a"}}><td style={{...cs.td,fontSize:11,color:"#94a3b8",whiteSpace:"nowrap"}}>{l.time}</td><td style={cs.td}><span style={Bdg(u?u.color:"#64748b")}>{l.user}</span></td><td style={{...cs.td,fontWeight:600}}>{l.action}</td><td style={{...cs.td,color:"#94a3b8"}}>{l.detail||"—"}</td></tr>);
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ═══ EXPORT ═══ */
function ExportData({emps,att,leaves,cars,adj,warnings,deds,setEmps,setAtt,setLeaves,setCars,setAdj,setWarnings,setDeds}){
  function dl(){
    const data={employees:emps,attendance:att,leaves,cars,adjustments:adj,warnings,deductions:deds,exportedAt:nowStr(),version:"v7.0"};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="sedra_hr_"+todayISO()+".json";a.click();URL.revokeObjectURL(url);
  }
  function imp(e){
    const file=e.target.files[0];if(!file)return;
    const r=new FileReader();
    r.onload=ev=>{
      try{
        const d=JSON.parse(ev.target.result);
        if(d.employees)setEmps(d.employees);if(d.attendance)setAtt(d.attendance);
        if(d.leaves)setLeaves(d.leaves);if(d.cars)setCars(d.cars);
        if(d.adjustments)setAdj(d.adjustments);if(d.warnings)setWarnings(d.warnings);
        if(d.deductions)setDeds(d.deductions);
        alert("✅ Data imported successfully!");
      }catch(err){alert("❌ Invalid file");}
    };
    r.readAsText(file);
  }
  return (
    <div style={cs.card}>
      <div style={{fontWeight:700,marginBottom:14,color:"#34d399",fontSize:16}}>📤 Export & Backup</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <div style={{...cs.card,border:"1px solid #22c55e"}}>
          <div style={{fontWeight:700,color:"#22c55e",marginBottom:8}}>💾 Backup All Data</div>
          <p style={{fontSize:12,color:"#94a3b8",marginBottom:12}}>Download everything as a JSON file. Keep this safe!</p>
          <button style={Btn("#166534")} onClick={dl}>⬇️ Download Backup</button>
        </div>
        <div style={{...cs.card,border:"1px solid #3b82f6"}}>
          <div style={{fontWeight:700,color:"#3b82f6",marginBottom:8}}>📥 Restore from Backup</div>
          <p style={{fontSize:12,color:"#94a3b8",marginBottom:12}}>Import a JSON backup to restore all data.</p>
          <label style={{...Btn("#1e3a5f"),display:"inline-block",cursor:"pointer"}}>⬆️ Import Backup<input type="file" accept=".json" onChange={imp} style={{display:"none"}}/></label>
        </div>
      </div>
      <div style={{...cs.card,border:"1px solid #475569"}}>
        <div style={{fontWeight:700,marginBottom:8}}>📊 Data Summary</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8,fontSize:12}}>
          {[["👥 Employees",emps.length],["🚗 Cars",cars.length],["🌴 Leaves",leaves.length],["⚠️ Warnings",warnings.length],["💸 Deductions",deds.length],["📅 Att. Months",Object.keys(att).length]].map(item=>(
            <div key={item[0]} style={{background:"#0f172a",padding:"8px 12px",borderRadius:6}}><span style={{color:"#94a3b8"}}>{item[0]}: </span><b>{item[1]}</b></div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══ APP ROOT ═══ */
const ALL_TABS=[
  {k:"dashboard",l:"📊 Dashboard"},
  {k:"employees",l:"👥 Employees"},
  {k:"attendance",l:"📅 Attendance"},
  {k:"salary",l:"💰 Salary",perm:"salary"},
  {k:"deductions",l:"💸 Deductions",perm:"deductions"},
  {k:"warnings",l:"⚠️ Warnings",perm:"warnings"},
  {k:"leaves",l:"🌴 Leaves",perm:"leaveMgr"},
  {k:"cars",l:"🚗 Cars",perm:"cars"},
  {k:"eosb",l:"🏁 EOSB",perm:"eosb"},
  {k:"docs",l:"📋 Documents"},
  {k:"audit",l:"🔍 Audit",perm:"audit"},
  {k:"export",l:"📤 Export",perm:"export"},
];

export default function App(){
  const [user,setUser]=useState(null);
  const [tab,setTab]=useState("dashboard");
  const [emps,setEmps]=useState([]);
  const [att,setAtt]=useState({});
  const [leaves,setLeaves]=useState([]);
  const [adj,setAdj]=useState({});
  const [cars,setCars]=useState([]);
  const [warnings,setWarnings]=useState([]);
  const [deds,setDeds]=useState([]);
  const [payStatus,setPayStatus]=useState({});
  const [logs,setLogs]=useState([]);
  const [slip,setSlip]=useState(null);
  const [loaded,setLoaded]=useState(false);
  const [lastSync,setLastSync]=useState(null);
  const [syncOk,setSyncOk]=useState(false);
  const [saving,setSaving]=useState(false);

  // Load data — Supabase first, localStorage fallback, SEED only if truly empty
  useEffect(()=>{
    (async()=>{
      let sbOk=false;
      try{
        const all=await SB.getAll();
        if(all&&Object.keys(all).length>0){
          sbOk=true;
          if(all["se_emps"]&&all["se_emps"].length>0)setEmps(all["se_emps"]);else setEmps(SEED_EMPS);
          setAtt(all["se_att"]||{});
          setLeaves(all["se_leaves"]||[]);
          setAdj(all["se_adj"]||{});
          if(all["se_cars"]&&all["se_cars"].length>0)setCars(all["se_cars"]);else setCars(SEED_CARS);
          setWarnings(all["se_warnings"]||[]);
          setDeds(all["se_deds"]||[]);
          setPayStatus(all["se_payst"]||{});
          setLogs(all["se_logs"]||[]);
        }
      }catch(e){}
      if(!sbOk){
        // fallback to localStorage
        const le=await SB.get("se_emps");setEmps(le&&le.length>0?le:SEED_EMPS);
        setAtt((await SB.get("se_att"))||{});
        setLeaves((await SB.get("se_leaves"))||[]);
        setAdj((await SB.get("se_adj"))||{});
        const lc=await SB.get("se_cars");setCars(lc&&lc.length>0?lc:SEED_CARS);
        setWarnings((await SB.get("se_warnings"))||[]);
        setDeds((await SB.get("se_deds"))||[]);
        setPayStatus((await SB.get("se_payst"))||{});
        setLogs((await SB.get("se_logs"))||[]);
      }
      setSyncOk(sbOk);
      setLoaded(true);
      setLastSync(new Date().toLocaleTimeString("en-GB"));
    })();
  },[]);

  // Auto-sync every 20 seconds
  useEffect(()=>{
    if(!loaded)return;
    const iv=setInterval(async()=>{
      try{
        const all=await SB.getAll();
        if(all&&Object.keys(all).length>0){
          if(all["se_emps"]&&all["se_emps"].length>0)setEmps(all["se_emps"]);
          if(all["se_att"])setAtt(all["se_att"]);
          if(all["se_leaves"])setLeaves(all["se_leaves"]||[]);
          if(all["se_adj"])setAdj(all["se_adj"]);
          if(all["se_cars"]&&all["se_cars"].length>0)setCars(all["se_cars"]);
          if(all["se_warnings"])setWarnings(all["se_warnings"]||[]);
          if(all["se_deds"])setDeds(all["se_deds"]||[]);
          if(all["se_logs"])setLogs(all["se_logs"]||[]);
          setSyncOk(true);
          setLastSync(new Date().toLocaleTimeString("en-GB"));
        }
      }catch(e){setSyncOk(false);}
    },20000);
    return()=>clearInterval(iv);
  },[loaded]);

  // Save on change — localStorage immediately, Supabase async
  useEffect(()=>{if(loaded)SB.set("se_emps",emps);},[emps,loaded]);
  useEffect(()=>{if(loaded)SB.set("se_att",att);},[att,loaded]);
  useEffect(()=>{if(loaded)SB.set("se_leaves",leaves);},[leaves,loaded]);
  useEffect(()=>{if(loaded)SB.set("se_adj",adj);},[adj,loaded]);
  useEffect(()=>{if(loaded)SB.set("se_cars",cars);},[cars,loaded]);
  useEffect(()=>{if(loaded)SB.set("se_warnings",warnings);},[warnings,loaded]);
  useEffect(()=>{if(loaded)SB.set("se_deds",deds);},[deds,loaded]);
  useEffect(()=>{if(loaded)SB.set("se_payst",payStatus);},[payStatus,loaded]);
  useEffect(()=>{if(loaded)SB.set("se_logs",logs);},[logs,loaded]);

  function addLog(action,detail){
    if(!user)return;
    setLogs(p=>[...p,{time:nowStr(),user:user.role,action:action||"",detail:detail||""}].slice(-500));
  }
  function setEmpAtt(y,m,id,map){setAtt(p=>{const mk=moKey(y,m);return{...p,[mk]:{...(p[mk]||{}),[id]:map}};});}
  function getAdj(y,m,id){return adj[moKey(y,m)+"-"+id]||{};}
  function setAdjK(y,m,id,v){setAdj(p=>({...p,[moKey(y,m)+"-"+id]:v}));}
  function getCarFines(empId,y,m){
    const mk=moKey(y,m);let t=0;
    cars.forEach(car=>{if(car.empId===empId)(car.fines||[]).forEach(f=>{if(!f.paid&&f.month===mk)t+=+f.amount||0;});});
    return t;
  }
  async function manualSave(){
    setSaving(true);
    await Promise.all([
      SB.set("se_emps",emps),SB.set("se_att",att),SB.set("se_leaves",leaves),
      SB.set("se_adj",adj),SB.set("se_cars",cars),SB.set("se_warnings",warnings),
      SB.set("se_deds",deds),SB.set("se_payst",payStatus),SB.set("se_logs",logs)
    ]);
    setSyncOk(true);
    setLastSync(new Date().toLocaleTimeString("en-GB"));
    setSaving(false);
    addLog("Manual Save","All data saved to cloud");
  }

  if(!loaded) return (
    <div style={{...cs.page,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{fontSize:60}}>⚡</div>
      <div style={{fontSize:18,fontWeight:700}}>Loading Sedra Electric HR…</div>
      <div style={{fontSize:12,color:"#64748b"}}>Fetching data from cloud…</div>
    </div>
  );
  if(!user) return <Login onLogin={u=>{setUser(u);setTimeout(()=>addLog("Login",u.label),100);}}/>;

  const role=user.role;
  const active=emps.filter(e=>e.status!=="Resigned"&&e.status!=="Terminated");
  const TABS=ALL_TABS.filter(t=>!t.perm||can(role,t.perm));

  return (
    <div style={cs.page}>
      <SlipModal html={slip} onClose={()=>setSlip(null)}/>
      <div style={cs.hdr}>
        <div>
          <div style={{fontSize:19,fontWeight:900,letterSpacing:.5}}>⚡ سيدرة إليكتريك — Sedra Electric</div>
          <div style={{fontSize:11,opacity:.7}}>HR ERP v7.0 — Multi-Device Sync</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{textAlign:"center",fontSize:11}}>
            <div style={{color:syncOk?"#22c55e":"#f97316",fontSize:10}}>{syncOk?"🟢 Cloud Synced":"🟡 Local Only"} {lastSync?"@ "+lastSync:""}</div>
            <button onClick={manualSave} style={{...Btn(saving?"#475569":syncOk?"#166534":"#92400e"),fontSize:10,padding:"3px 10px",marginTop:2}}>{saving?"Saving…":"💾 Save & Sync Now"}</button>
          </div>
          <div style={{textAlign:"right",fontSize:11}}>
            <div style={{color:user.color,fontWeight:700}}>{user.label}</div>
            <div style={{opacity:.7}}>{active.length} Active Staff</div>
          </div>
          <button style={Btn("#475569")} onClick={()=>{addLog("Logout",user.label);setUser(null);}}>🔓 Logout</button>
        </div>
      </div>
      <div style={{display:"flex",gap:2,padding:"10px 16px 0",background:"#0f172a",flexWrap:"wrap"}}>
        {TABS.map(t=><button key={t.k} style={TBtn(tab===t.k)} onClick={()=>setTab(t.k)}>{t.l}</button>)}
      </div>
      <div style={{padding:16}}>
        {tab==="dashboard"&&<Dashboard emps={emps} att={att} leaves={leaves} warnings={warnings} deds={deds} logs={logs} role={role} lastSync={lastSync} syncOk={syncOk}/>}
        {tab==="employees"&&<Employees emps={emps} setEmps={setEmps} role={role} addLog={addLog}/>}
        {tab==="attendance"&&<Attendance emps={active} att={att} setEmpAtt={setEmpAtt} addLog={addLog}/>}
        {tab==="salary"&&can(role,"salary")&&<Salary emps={active} att={att} adj={adj} getAdj={getAdj} setAdjK={setAdjK} setSlip={setSlip} role={role} getCarFines={getCarFines} addLog={addLog} warnings={warnings} deds={deds} payStatus={payStatus} setPayStatus={setPayStatus}/>}
        {tab==="deductions"&&can(role,"deductions")&&<DeductionsTab emps={emps} deds={deds} setDeds={setDeds} role={role} addLog={addLog} setSlip={setSlip}/>}
        {tab==="warnings"&&can(role,"warnings")&&<Warnings emps={emps} warnings={warnings} setWarnings={setWarnings} role={role} addLog={addLog} setSlip={setSlip}/>}
        {tab==="leaves"&&can(role,"leaveMgr")&&<Leaves emps={emps} leaves={leaves} setLeaves={setLeaves} role={role} addLog={addLog}/>}
        {tab==="cars"&&can(role,"cars")&&<Cars cars={cars} setCars={setCars} emps={emps} role={role} addLog={addLog}/>}
        {tab==="eosb"&&can(role,"eosb")&&<EOSB emps={emps} setSlip={setSlip} addLog={addLog}/>}
        {tab==="docs"&&<Documents emps={emps}/>}
        {tab==="audit"&&can(role,"audit")&&<AuditLog logs={logs}/>}
        {tab==="export"&&<ExportData emps={emps} att={att} leaves={leaves} cars={cars} adj={adj} warnings={warnings} deds={deds} setEmps={setEmps} setAtt={setAtt} setLeaves={setLeaves} setCars={setCars} setAdj={setAdj} setWarnings={setWarnings} setDeds={setDeds}/>}
      </div>
    </div>
  );
}
