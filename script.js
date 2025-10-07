// ----------------------
// Initialization
// ----------------------
let currentDate = new Date();
let events = {};
let filters = ["exam", "handin", "other"];
let pendingDateStr = null;
let currentDetail = { dateStr: null, index: null, event: null };

// ----------------------
// Firebase Anonymous Auth
// ----------------------
firebase.auth().signInAnonymously()
  .catch(err => console.error("❌ Firebase auth error:", err));

firebase.auth().onAuthStateChanged(user => {
  if (!user) return;
  const uid = user.uid;
  console.log("✅ Signed in anonymously with UID:", uid);

  const eventsRef = db.collection("events").doc(uid);

  // Listen for real-time updates
  eventsRef.onSnapshot(doc => {
    events = doc.exists ? doc.data().eventsArray || {} : {};
    console.log("Loaded events from Firestore:", events);
    renderCalendar();
  });

  // ----------------------
  // Save events to Firestore
  // ----------------------
  window.saveEvents = async function () {
    await eventsRef.set({ eventsArray: events });
    console.log("Saved events to Firestore");
  };
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
// Filters & Calendar Controls
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
function prevMonth() { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); }
function nextMonth() { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); }
function jumpToMonth() {
  const month = parseInt(document.getElementById("monthSelect").value);
  currentDate.setMonth(month);
  renderCalendar();
}
function goToToday() { currentDate = new Date(); renderCalendar(); }

// ----------------------
// Event Modals
// ----------------------
function openNewEvent(dateStr) {
  pendingDateStr = dateStr;
  document.getElementById("newEventTitle").value = "";
  document.getElementById("newEventDesc").value = "";
  document.querySelectorAll(".typeBtn").forEach(b => b.classList.remove("active"));
  document.getElementById("newEventModal").style.display = "flex";
}
function closeNewEvent() { document.getElementById("newEventModal").style.display = "none"; }
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

// ----------------------
// Event Functions
// ----------------------
function saveNewEvent() {
  if (!pendingDateStr) return;
  const title = document.getElementById("newEventTitle").value.trim();
  if (!title) return alert("Enter a title");
  const type = document.querySelector(".typeBtn.active")?.getAttribute('data-type') || 'other';
  const desc = document.getElementById("newEventDesc").value;
  const freq = document.getElementById("newEventFrequency").value;

  if (!events[pendingDateStr]) events[pendingDateStr] = [];
  events[pendingDateStr].push({ title, type, desc, completed: false, recurrence: freq, origin: pendingDateStr });

  saveEvents();
  closeNewEvent();
  renderCalendar();
}

function repeatForSemester() {
  if (!pendingDateStr) return;
  const title = document.getElementById("newEventTitle").value.trim();
  if (!title) return alert("Enter a title");
  const type = document.querySelector(".typeBtn.active")?.getAttribute('data-type') || 'other';
  const desc = document.getElementById("newEventDesc").value;
  const freq = document.getElementById("newEventFrequency").value;

  if (!settings.semesterEnd) return alert("Set semester end date in settings!");
  let currentIter = new Date(pendingDateStr);
  currentIter.setHours(0, 0, 0, 0);
  const semesterEnd = new Date(settings.semesterEnd);
  semesterEnd.setHours(0, 0, 0, 0);

  while (currentIter <= semesterEnd) {
    const dateStr = `${currentIter.getFullYear()}-${String(currentIter.getMonth() + 1).padStart(2, "0")}-${String(currentIter.getDate()).padStart(2, "0")}`;
    if (!events[dateStr]) events[dateStr] = [];
    events[dateStr].push({ title, type, desc, completed: false, recurrence: freq, origin: pendingDateStr });

    if (freq === "weekly") currentIter.setDate(currentIter.getDate() + 7);
    else break;
  }

  saveEvents();
  closeNewEvent();
  renderCalendar();
}

function toggleCompleteFromCalendar(dateStr, index) {
  events[dateStr][index].completed = !events[dateStr][index].completed;
  saveEvents();
  renderCalendar();
}

// ----------------------
// Utility Functions
// ----------------------
function getEventInstancesForRange(start, end) {
  let arr = [];
  for (const [dateStr, evts] of Object.entries(events)) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    if (dt >= start && dt <= end) evts.forEach((e, i) => arr.push({ ...e, date: dt, dateStr, index: i }));
  }
  return arr;
}

function saveEdit(all) {
  if (!currentDetail.dateStr) return;
  const newDesc = document.getElementById("detailDesc").value;
  const ev = events[currentDetail.dateStr][currentDetail.index];
  ev.desc = newDesc;

  if (all && ev.recurrence === "weekly") {
    for (const [dateStr, evts] of Object.entries(events)) {
      evts.forEach(e => { if (e.origin === ev.origin) e.desc = newDesc; });
    }
  }

  saveEvents();
  renderCalendar();
  closeEventDetail();
}

function deleteEvent(all) {
  if (!currentDetail.dateStr) return;
  const ev = events[currentDetail.dateStr][currentDetail.index];

  if (all && ev.recurrence === "weekly") {
    for (const [dateStr, evts] of Object.entries(events)) {
      events[dateStr] = evts.filter(e => e.origin !== ev.origin);
      if (events[dateStr].length === 0) delete events[dateStr];
    }
  } else {
    events[currentDetail.dateStr].splice(currentDetail.index, 1);
    if (events[currentDetail.dateStr].length === 0) delete events[currentDetail.dateStr];
  }

  saveEvents();
  renderCalendar();
  closeEventDetail();
}

// ----------------------
// Rendering Calendar
// ----------------------
function renderCalendar() {
  const year = currentDate.getFullYear(), month = currentDate.getMonth();
  let firstDay = (new Date(year, month, 1).getDay() + 6) % 7; // Monday start
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  document.getElementById("monthYear").textContent =
    currentDate.toLocaleDateString("default", { month: "long" }) + " " + year;

  const calendar = document.getElementById("calendar");
  calendar.innerHTML = "";

  // Weekday labels
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  weekdays.forEach(dayName => {
    const headerCell = document.createElement("div");
    headerCell.className = "weekday";
    headerCell.textContent = dayName;
    calendar.appendChild(headerCell);
  });

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  for (let i = 0; i < firstDay; i++) calendar.appendChild(document.createElement("div"));

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const cell = document.createElement("div");
    cell.className = "day";
    if (new Date(year, month, day).toDateString() === todayDate.toDateString()) cell.classList.add("highlight");
    cell.innerHTML = `<strong>${day}</strong><div class="events-container"></div>`;

    const container = cell.querySelector(".events-container");
    const dayStart = new Date(year, month, day);
    const dayEnd = new Date(year, month, day, 23, 59, 59);
    const evts = getEventInstancesForRange(dayStart, dayEnd);
    evts.filter(e => filters.includes(e.type)).forEach((evt, idx) => {
      const evtDiv = document.createElement("div");
      evtDiv.className = `event ${evt.type}${evt.completed ? " completed" : ""}`;
      evtDiv.textContent = evt.title;
      evtDiv.onclick = () => openEventDetail(evt);
      container.appendChild(evtDiv);
    });

    cell.onclick = () => openNewEvent(dateStr);
    calendar.appendChild(cell);
  }
}
