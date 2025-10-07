// ----------------------
// Initialization
// ----------------------
let currentDate = new Date();
let events = {};
let settings = JSON.parse(localStorage.getItem("settings")||"{}");
let filters = ["exam","handin","other"];
let pendingDateStr = null;
let currentDetail = {dateStr:null, index:null, event:null};

// Wait for auth to be ready
firebase.auth().onAuthStateChanged(user => {
  if (user) {
    const uid = user.uid;
    const eventsRef = db.collection("events").doc(uid);

    // Listen for real-time updates
    eventsRef.onSnapshot(doc => {
      if (doc.exists) {
        events = doc.data().eventsArray || {};
      } else {
        events = {};
      }
      console.log("Loaded events for user:", uid, events);
      renderCalendar();
    });

    // Save events function
    window.saveEvents = async function() {
      await eventsRef.set({ eventsArray: events });
      console.log("Saved events for user:", uid);
    };
  } else {
    console.log("User not signed in yet.");
  }
});

  });
  console.log("✅ Loaded events from Firestore:", events);
  renderCalendar();
});

// ----------------------
// Settings
// ----------------------
let settings = JSON.parse(localStorage.getItem("settings") || "{}");

function saveSettings() {
  settings.semesterStart = document.getElementById("semesterStart").value;
  settings.semesterEnd = document.getElementById("semesterEnd").value;
  localStorage.setItem("settings", JSON.stringify(settings));
  closeSettings();
}

function openSettings() {
  document.getElementById("semesterStart").value = settings.semesterStart || "";
  document.getElementById("semesterEnd").value = settings.semesterEnd || "";
  document.getElementById("settingsModal").style.display = "flex";
}

function closeSettings() {
  document.getElementById("settingsModal").style.display = "none";
}

// ----------------------
// Event Type & Filters
// ----------------------
function selectType(button) {
  document.querySelectorAll(".typeBtn").forEach(b => b.classList.remove("active"));
  button.classList.add("active");
}

function toggleFilter(type) {
  if (filters.includes(type)) filters = filters.filter(t => t !== type);
  else filters.push(type);
  renderCalendar();
}

// ----------------------
// Calendar Navigation
// ----------------------
function prevMonth() { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); }
function nextMonth() { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); }
function jumpToMonth() { 
  const month = parseInt(document.getElementById("monthSelect").value);
  currentDate.setMonth(month); 
  renderCalendar();
}
function goToToday() { currentDate = new Date(); renderCalendar(); }

// ----------------------
// Event CRUD Functions
// ----------------------
async function saveNewEvent() {
  if (!pendingDateStr) return;
  const title = document.getElementById("newEventTitle").value.trim();
  if (!title) return alert("Enter a title");

  const type = document.querySelector(".typeBtn.active")?.getAttribute('data-type') || 'other';
  const desc = document.getElementById("newEventDesc").value;
  const freq = document.getElementById("newEventFrequency").value;

  if (!events[pendingDateStr]) events[pendingDateStr] = [];
  const newEvent = { title, type, desc, completed: false, recurrence: freq, origin: pendingDateStr };
  events[pendingDateStr].push(newEvent);

  await db.collection("events").doc(pendingDateStr).set({ eventsArray: events[pendingDateStr] });

  closeNewEvent();
  renderCalendar();
}

async function repeatForSemester() {
  if (!pendingDateStr) return;
  const title = document.getElementById("newEventTitle").value.trim();
  if (!title) return alert("Enter a title");

  const type = document.querySelector(".typeBtn.active")?.getAttribute('data-type') || 'other';
  const desc = document.getElementById("newEventDesc").value;
  const freq = document.getElementById("newEventFrequency").value;

  if (!settings.semesterEnd) return alert("Set semester end date in settings!");

  let currentIter = new Date(pendingDateStr);
  currentIter.setHours(0,0,0,0);
  const semesterEnd = new Date(settings.semesterEnd);
  semesterEnd.setHours(0,0,0,0);

  while (currentIter <= semesterEnd) {
    const dateStr = `${currentIter.getFullYear()}-${String(currentIter.getMonth()+1).padStart(2,"0")}-${String(currentIter.getDate()).padStart(2,"0")}`;
    if (!events[dateStr]) events[dateStr] = [];
    events[dateStr].push({ title, type, desc, completed: false, recurrence: freq, origin: pendingDateStr });
    await db.collection("events").doc(dateStr).set({ eventsArray: events[dateStr] });
    if (freq === "weekly") currentIter.setDate(currentIter.getDate() + 7);
    else break;
  }

  closeNewEvent();
  renderCalendar();
}

function openNewEvent(dateStr) {
  pendingDateStr = dateStr;
  document.getElementById("newEventTitle").value = "";
  document.getElementById("newEventDesc").value = "";
  document.querySelectorAll(".typeBtn").forEach(b => b.classList.remove("active"));
  document.getElementById("newEventModal").style.display = "flex";
}

function closeNewEvent() {
  document.getElementById("newEventModal").style.display = "none";
}

function openEventDetail(evt) {
  currentDetail = { dateStr: evt.dateStr, index: evt.index, event: evt };
  document.getElementById("detailTitle").textContent = evt.title;
  document.getElementById("detailDesc").value = evt.desc || "";
  document.getElementById("eventDetailModal").style.display = "flex";
}

function closeEventDetail() {
  document.getElementById("eventDetailModal").style.display = "none";
  currentDetail = { dateStr: null, index: null, event: null };
}

async function saveEdit(all) {
  if (!currentDetail.dateStr) return;
  const newDesc = document.getElementById("detailDesc").value;
  const ev = events[currentDetail.dateStr][currentDetail.index];
  ev.desc = newDesc;

  if (all && ev.recurrence === "weekly") {
    for (const [dateStr, evts] of Object.entries(events)) {
      evts.forEach(e => { if (e.origin === ev.origin) { e.desc = newDesc; } });
      await db.collection("events").doc(dateStr).set({ eventsArray: evts });
    }
  } else {
    await db.collection("events").doc(currentDetail.dateStr).set({ eventsArray: events[currentDetail.dateStr] });
  }

  renderCalendar();
  closeEventDetail();
}

async function deleteEvent(all) {
  if (!currentDetail.dateStr) return;
  const ev = events[currentDetail.dateStr][currentDetail.index];

  if (all && ev.recurrence === "weekly") {
    for (const [dateStr, evts] of Object.entries(events)) {
      events[dateStr] = evts.filter(e => e.origin !== ev.origin);
      if (events[dateStr].length === 0) delete events[dateStr];
      else await db.collection("events").doc(dateStr).set({ eventsArray: events[dateStr] });
    }
  } else {
    events[currentDetail.dateStr].splice(currentDetail.index, 1);
    if (events[currentDetail.dateStr].length === 0) {
      await db.collection("events").doc(currentDetail.dateStr).delete();
      delete events[currentDetail.dateStr];
    } else {
      await db.collection("events").doc(currentDetail.dateStr).set({ eventsArray: events[currentDetail.dateStr] });
    }
  }

  renderCalendar();
  closeEventDetail();
}

async function toggleCompleteFromCalendar(dateStr, index) {
  events[dateStr][index].completed = !events[dateStr][index].completed;
  await db.collection("events").doc(dateStr).set({ eventsArray: events[dateStr] });
  renderCalendar();
}

function toggleComplete() {
  if (!currentDetail.dateStr) return;
  toggleCompleteFromCalendar(currentDetail.dateStr, currentDetail.index);
}

// ----------------------
// Calendar Rendering
// ----------------------
function getEventInstancesForRange(start, end) {
  let arr = [];
  for (const [dateStr, evts] of Object.entries(events)) {
    const [y,m,d] = dateStr.split("-").map(Number);
    const dt = new Date(y,m-1,d);
    if (dt >= start && dt <= end) {
      evts.forEach((e,i) => arr.push({...e, date: dt, dateStr, index: i}));
    }
  }
  return arr;
}

function renderCalendar() {
  const year = currentDate.getFullYear(), month = currentDate.getMonth();
  let firstDay = (new Date(year, month, 1).getDay() + 6) % 7; // Monday start
  const daysInMonth = new Date(year, month+1, 0).getDate();

  applySeasonalTheme(month);
  document.getElementById("monthYear").textContent = currentDate.toLocaleDateString("default", { month: "long" }) + " " + year;

  const calendar = document.getElementById("calendar");
  calendar.innerHTML = "";

  const weekdays = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  weekdays.forEach(dayName => {
    const headerCell = document.createElement("div");
    headerCell.className = "weekday";
    headerCell.textContent = dayName;
    calendar.appendChild(headerCell);
  });

  const todayDate = new Date();
  todayDate.setHours(0,0,0,0);

  for(let i=0;i<firstDay;i++){ calendar.appendChild(document.createElement("div")); }

  for(let day=1; day<=daysInMonth; day++){
    const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    let cell = document.createElement("div");
    cell.className = "day";
    if(new Date(year,month,day).toDateString() === todayDate.toDateString()) cell.classList.add("highlight");
    cell.innerHTML = `<strong>${day}</strong><div class="events-container"></div>`;

    const container = cell.querySelector(".events-container");
    const dayStart = new Date(year,month,day,0,0,0);
    const dayEnd = new Date(year,month,day,23,59,59);

    getEventInstancesForRange(dayStart, dayEnd).forEach(evt => {
      if(!filters.includes(evt.type)) return;
      const eDiv = document.createElement("div");
      eDiv.className = "event " + evt.type + (evt.completed ? " completed" : "");
      eDiv.innerHTML = `<span>${evt.title}</span><button onclick="event.stopPropagation(); toggleCompleteFromCalendar('${evt.dateStr}',${evt.index})">✔️</button>`;
      eDiv.onclick = ev => { ev.stopPropagation(); openEventDetail(evt); };
      container.appendChild(eDiv);
    });

    cell.onclick = () => openNewEvent(dateStr);
    calendar.appendChild(cell);
  }

  renderUpcoming();

  const monthSelect = document.getElementById('monthSelect');
  if(monthSelect) monthSelect.value = month;
}

function renderUpcoming() {
  const upcomingList = document.getElementById("upcomingList");
  upcomingList.innerHTML = "";

  const today = new Date(); today.setHours(0,0,0,0);
  const sevenDaysLater = new Date(today); sevenDaysLater.setDate(today.getDate() + 7);
  const upcoming = getEventInstancesForRange(today, sevenDaysLater);
  upcoming.sort((a,b) => a.date - b.date || a.title.localeCompare(b.title));

  let currentGroup = null;
  upcoming.forEach(evt => {
    const dateStr = evt.date.toISOString().split("T")[0];
    if(currentGroup !== dateStr){
      currentGroup = dateStr;
      const dateBox = document.createElement("div");
      dateBox.className = "upcoming-date-box";
      const dateHeader = document.createElement("div");
      dateHeader.style.fontWeight = "bold";
      dateHeader.style.marginBottom = "6px";
      dateHeader.textContent = evt.date.toLocaleDateString(undefined,{ weekday:'short', day:'2-digit' });
      dateBox.appendChild(dateHeader);
      upcomingList.appendChild(dateBox);
    }
    const div = document.createElement("div");
    div.className = "upcoming-event " + evt.type + (evt.completed ? " completed" : "");
    div.innerHTML = `<span>${evt.title}</span><button onclick="event.stopPropagation(); toggleCompleteFromCalendar('${evt.dateStr}',${evt.index})">✔️</button>`;
    div.onclick = () => openEventDetail(evt);
    upcomingList.lastChild.appendChild(div);
  });
}

// ----------------------
// Seasonal Theme
// ----------------------
function applySeasonalTheme(month) {
  document.body.classList.remove("winter","spring","summer","autumn");
  if([11,0,1].includes(month)) document.body.classList.add("winter");
  else if([2,3,4].includes(month)) document.body.classList.add("spring");
  else if([5,6,7].includes(month)) document.body.classList.add("summer");
  else if([8,9,10].includes(month)) document.body.classList.add("autumn");
}

// ----------------------
// Initial Render
// ----------------------
renderCalendar();


