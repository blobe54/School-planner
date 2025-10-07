let currentDate=new Date();
let events = {};   
async function loadEvents() {
  const snapshot = await db.collection("events").get();   
  snapshot.forEach(doc => {     
    events[doc.id] = doc.data().eventsArray; // or however you structure events  
  });   
  renderCalendar(); }  
loadEvents();
let settings=JSON.parse(localStorage.getItem("settings")||"{}");
let filters=["exam","handin","other"];
let pendingDateStr=null;
let currentDetail={dateStr:null,index:null,event:null};

async function saveEvents() {
  for (const [dateStr, evts] of Object.entries(events)) {
    await db.collection("events").doc(dateStr).set({ eventsArray: evts });
  }
}

function saveSettings(){ settings.semesterStart=document.getElementById("semesterStart").value; settings.semesterEnd=document.getElementById("semesterEnd").value; localStorage.setItem("settings",JSON.stringify(settings)); closeSettings(); }
function openSettings(){ document.getElementById("semesterStart").value=settings.semesterStart||""; document.getElementById("semesterEnd").value=settings.semesterEnd||""; document.getElementById("settingsModal").style.display="flex"; }
function closeSettings(){ document.getElementById("settingsModal").style.display="none"; }

function selectType(button){ document.querySelectorAll(".typeBtn").forEach(b=>b.classList.remove("active")); button.classList.add("active"); }
function toggleFilter(type){ if(filters.includes(type)) filters=filters.filter(t=>t!==type); else filters.push(type); renderCalendar(); }
function prevMonth(){ currentDate.setMonth(currentDate.getMonth()-1); renderCalendar(); }
function jumpToMonth(){const month = parseInt(document.getElementById("monthSelect").value);currentDate.setMonth(month); renderCalendar();}
function nextMonth(){ currentDate.setMonth(currentDate.getMonth()+1); renderCalendar(); }

function openNewEvent(dateStr){ pendingDateStr=dateStr; document.getElementById("newEventTitle").value=""; document.getElementById("newEventDesc").value=""; document.querySelectorAll(".typeBtn").forEach(b=>b.classList.remove("active")); document.getElementById("newEventModal").style.display="flex"; }
function closeNewEvent(){ document.getElementById("newEventModal").style.display="none"; }

function saveNewEvent(){
  if(!pendingDateStr) return;
  const title=document.getElementById("newEventTitle").value.trim();
  if(!title) return alert("Enter a title");
  const type=document.querySelector(".typeBtn.active")?.getAttribute('data-type')||'other';
  const desc=document.getElementById("newEventDesc").value;
  const freq=document.getElementById("newEventFrequency").value;
  if(!events[pendingDateStr]) events[pendingDateStr]=[];
  events[pendingDateStr].push({title,type,desc,completed:false,recurrence:freq,origin:pendingDateStr});
  saveEvents(); closeNewEvent(); renderCalendar();
}

function repeatForSemester(){
  if(!pendingDateStr) return;
  const title=document.getElementById("newEventTitle").value.trim();
  if(!title) return alert("Enter a title");
  const type=document.querySelector(".typeBtn.active")?.getAttribute('data-type')||'other';
  const desc=document.getElementById("newEventDesc").value;
  const freq=document.getElementById("newEventFrequency").value;
  if(!settings.semesterEnd) return alert("Set semester end date in settings!");
  let currentDateIter=new Date(pendingDateStr);
  currentDateIter.setHours(0,0,0,0);
  const semesterEnd=new Date(settings.semesterEnd);
  semesterEnd.setHours(0,0,0,0);
  while(currentDateIter<=semesterEnd){
    const dateStr=`${currentDateIter.getFullYear()}-${String(currentDateIter.getMonth()+1).padStart(2,"0")}-${String(currentDateIter.getDate()).padStart(2,"0")}`;
    if(!events[dateStr]) events[dateStr]=[];
    events[dateStr].push({title,type,desc,completed:false,recurrence:freq,origin:pendingDateStr});
    if(freq==="weekly"){ currentDateIter.setDate(currentDateIter.getDate()+7); }
    else break;
  }
  saveEvents(); closeNewEvent(); renderCalendar();
}

function getEventInstancesForRange(start,end){
  let arr=[];
  for(const [dateStr,evts] of Object.entries(events)){
    const [y,m,d]=dateStr.split("-").map(Number);
    const dt=new Date(y,m-1,d);
    if(dt>=start && dt<=end){
      evts.forEach((e,i)=>arr.push({...e,date:dt,dateStr,index:i}));
    }
  }
  return arr;
}

function openEventDetail(evt){ currentDetail={dateStr:evt.dateStr,index:evt.index,event:evt}; document.getElementById("detailTitle").textContent=evt.title; document.getElementById("detailDesc").value=evt.desc||""; document.getElementById("eventDetailModal").style.display="flex"; }
function closeEventDetail(){ document.getElementById("eventDetailModal").style.display="none"; currentDetail={dateStr:null,index:null,event:null}; }

function saveEdit(all){
  if(!currentDetail.dateStr) return;
  const newDesc=document.getElementById("detailDesc").value;
  const ev=events[currentDetail.dateStr][currentDetail.index];
  ev.desc=newDesc;
  if(all && ev.recurrence==="weekly"){
    for(const [dateStr,evts] of Object.entries(events)){
      evts.forEach(e=>{ if(e.origin===ev.origin){ e.title=ev.title; e.type=ev.type; e.desc=newDesc; } });
    }
  }
  saveEvents(); renderCalendar(); closeEventDetail();
}

function deleteEvent(all){
  if(!currentDetail.dateStr) return;
  const ev=events[currentDetail.dateStr][currentDetail.index];
  if(all && ev.recurrence==="weekly"){
    for(const [dateStr,evts] of Object.entries(events)){
      events[dateStr]=evts.filter(e=>e.origin!==ev.origin);
      if(events[dateStr].length===0) delete events[dateStr];
    }
  } else {
    events[currentDetail.dateStr].splice(currentDetail.index,1);
    if(events[currentDetail.dateStr].length===0) delete events[currentDetail.dateStr];
  }
  saveEvents(); renderCalendar(); closeEventDetail();
}

function toggleComplete(){
  if(!currentDetail.dateStr) return;
  const ev=events[currentDetail.dateStr][currentDetail.index];
  ev.completed=!ev.completed;
  saveEvents(); renderCalendar(); closeEventDetail();
}

function renderCalendar(){
  const year=currentDate.getFullYear(), month=currentDate.getMonth();
  let firstDay=new Date(year,month,1).getDay(); 
  firstDay = (firstDay + 6) % 7; // Monday start
  const daysInMonth=new Date(year,month+1,0).getDate();
  applySeasonalTheme(month);
  document.getElementById("monthYear").textContent=currentDate.toLocaleDateString("default",{month:"long"})+" "+year;
  const calendar=document.getElementById("calendar"); calendar.innerHTML="";
  
  // Weekday labels
  const weekdays = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  weekdays.forEach(dayName => {
    const headerCell = document.createElement("div");
    headerCell.className = "weekday";
    headerCell.textContent = dayName;
    calendar.appendChild(headerCell);
  });

  const todayDate=new Date(); todayDate.setHours(0,0,0,0);
  for(let i=0;i<firstDay;i++){ calendar.appendChild(document.createElement("div")); }
  for(let day=1;day<=daysInMonth;day++){
    const dateStr=`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    let cell=document.createElement("div"); cell.className="day";
    if(new Date(year,month,day).toDateString()===todayDate.toDateString()) cell.classList.add("highlight");
    cell.innerHTML=`<strong>${day}</strong><div class="events-container"></div>`;
    const container=cell.querySelector(".events-container");
    const dayStart=new Date(year,month,day,0,0,0);
    const dayEnd=new Date(year,month,day,23,59,59);
    getEventInstancesForRange(dayStart,dayEnd).forEach(evt=>{
      if(!filters.includes(evt.type)) return;
      const eDiv=document.createElement("div"); 
      eDiv.className="event "+evt.type+(evt.completed?" completed":"");
      eDiv.innerHTML=`<span>${evt.title}</span><button onclick="event.stopPropagation(); toggleCompleteFromCalendar('${evt.dateStr}',${evt.index})">✔️</button>`;
      eDiv.onclick=(ev)=>{ ev.stopPropagation(); openEventDetail(evt); };
      container.appendChild(eDiv);
    });
    cell.onclick=()=>openNewEvent(dateStr);
    calendar.appendChild(cell);
  }
  renderUpcoming();

  const monthSelect=document.getElementById('monthSelect');
  if(monthSelect){monthSelect.value=month;}
}

function toggleCompleteFromCalendar(dateStr,index){
  events[dateStr][index].completed=!events[dateStr][index].completed;
  saveEvents(); renderCalendar();
}

function renderUpcoming(){
  const upcomingList=document.getElementById("upcomingList"); upcomingList.innerHTML="";
  const today=new Date(); today.setHours(0,0,0,0);
  const sevenDaysLater=new Date(today); sevenDaysLater.setDate(today.getDate()+7);
  const upcoming=getEventInstancesForRange(today,sevenDaysLater);
  upcoming.sort((a,b)=>a.date-b.date || a.title.localeCompare(b.title));
  let currentGroup=null;
  upcoming.forEach(evt=>{
    const dateStr=evt.date.toISOString().split("T")[0];
    if(currentGroup!==dateStr){
      currentGroup=dateStr;
      const dateBox=document.createElement("div"); dateBox.className="upcoming-date-box";
      const dateHeader=document.createElement("div"); dateHeader.style.fontWeight="bold"; dateHeader.style.marginBottom="6px";
      dateHeader.textContent=evt.date.toLocaleDateString(undefined,{weekday:'short',day:'2-digit'});
      dateBox.appendChild(dateHeader); upcomingList.appendChild(dateBox);
    }
    const div=document.createElement("div"); 
    div.className="upcoming-event "+evt.type+(evt.completed?" completed":"");
    div.innerHTML=`<span>${evt.title}</span><button onclick="event.stopPropagation(); toggleCompleteFromCalendar('${evt.dateStr}',${evt.index})">✔️</button>`;
    div.onclick=()=>openEventDetail(evt);
    upcomingList.lastChild.appendChild(div);
  });
  
}
function applySeasonalTheme(month) {
  document.body.classList.remove("winter","spring","summer","autumn");
  if([11,0,1].includes(month)) { 
    document.body.classList.add("winter");
  } else if([2,3,4].includes(month)) { 
    document.body.classList.add("spring");
  } else if([5,6,7].includes(month)) { 
    document.body.classList.add("summer");
  } else if([8,9,10].includes(month)) { 
    document.body.classList.add("autumn");
  }
}
function goToToday(){
  currentDate = new Date();
  renderCalendar();
}
renderCalendar();
