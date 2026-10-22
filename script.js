
"use strict";

/* ==========================================
   BLOOM — Your Little Productivity Space
   Data is saved locally using localStorage.
========================================== */

const STORAGE_KEY = "bloomWebDataV1";

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const makeId = () =>
  window.crypto && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function createDefaultData() {
  return {
    name: "Victoria",
    theme: "light",
    plans: [],
    goals: [],
    habits: [],
    notes: [],
    remindersEnabled: false,
    reminderLog: []
  };
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return createDefaultData();

    const parsed = JSON.parse(saved);
    const defaults = createDefaultData();

    return {
      ...defaults,
      ...parsed,
      plans: Array.isArray(parsed.plans) ? parsed.plans : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      habits: Array.isArray(parsed.habits) ? parsed.habits : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      remindersEnabled: Boolean(parsed.remindersEnabled),
      reminderLog: Array.isArray(parsed.reminderLog) ? parsed.reminderLog : []
    };
  } catch (error) {
    console.error("BLOOM could not read saved data:", error);
    return createDefaultData();
  }
}

let data = loadData();
let calendarDate = new Date();
let selectedDate = todayISO();
let toastTimer;

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("BLOOM could not save data:", error);
    showToast("Could not save data. Your browser storage may be full.");
    return false;
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatDate(dateString) {
  if (!dateString) return "No date set";
  const parts = dateString.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return "No date set";

  const date = new Date(parts[0], parts[1] - 1, parts[2]);

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

/* ---------- DEADLINE STATUS ---------- */

function getPlanDeadlineStatus(plan) {
  if (plan.completed) {
    return { label: "Completed ✓", className: "deadline-completed" };
  }

  if (!plan.dueDate) {
    return { label: "No deadline set", className: "deadline-none" };
  }

  const today = todayISO();

  if (plan.dueDate < today) {
    return { label: "OVERDUE", className: "deadline-overdue" };
  }

  if (plan.dueDate === today) {
    return { label: "DEADLINE IS TODAY!", className: "deadline-today" };
  }

  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);

  const tomorrow =
    `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, "0")}-${String(tomorrowDate.getDate()).padStart(2, "0")}`;

  if (plan.dueDate === tomorrow) {
    return { label: "Due tomorrow", className: "deadline-soon" };
  }

  return {
    label: `Due ${formatDate(plan.dueDate)}`,
    className: "deadline-future"
  };
}

function sameMonth(date, year, month) {
  return date.getFullYear() === year && date.getMonth() === month;
}

function showToast(message) {
  const toast = document.getElementById("toast");

  if (!toast) {
    console.log(message);
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

function emptyState(message, emoji = "🌸") {
  return `<div class="empty-state"><span>${emoji}</span>${escapeHTML(message)}</div>`;
}

function priorityClass(priority) {
  return ["high", "medium", "low"].includes(priority) ? priority : "medium";
}

function applyTheme() {
  document.body.classList.toggle("dark", data.theme === "dark");

  const themeToggle = document.getElementById("themeToggle");
  const themeSetting = document.getElementById("themeSetting");
  const themeColor = document.querySelector('meta[name="theme-color"]');

  if (themeToggle) {
    themeToggle.textContent = data.theme === "dark" ? "☀" : "☾";
  }

  if (themeSetting) themeSetting.value = data.theme;

  if (themeColor) {
    themeColor.content = data.theme === "dark" ? "#211923" : "#FFF7FB";
  }
}

function updateHeader() {
  const hour = new Date().getHours();

  let greeting = "Good evening";
  if (hour < 12) greeting = "Good morning";
  else if (hour < 17) greeting = "Good afternoon";

  const greetingElement = document.getElementById("greeting");
  const profileName = document.getElementById("profileName");
  const topDate = document.getElementById("topDate");
  const nameSetting = document.getElementById("nameSetting");

  if (greetingElement) {
    greetingElement.textContent = `${greeting}, ${data.name || "friend"} 💕`;
  }

  if (profileName) profileName.textContent = data.name || "Friend";

  if (topDate) {
    topDate.textContent = new Date().toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short"
    });
  }

  if (nameSetting) nameSetting.value = data.name || "";
}

function navigate(pageName) {
  const validPages = [
    "dashboard", "plans", "goals", "calendar",
    "habits", "progress", "notes", "settings"
  ];

  if (!validPages.includes(pageName)) return;

  document.querySelectorAll(".page").forEach(page => {
    page.classList.toggle("active", page.id === `page-${pageName}`);
  });

  document.querySelectorAll(".nav-link[data-page]").forEach(button => {
    button.classList.toggle("active", button.dataset.page === pageName);
  });

  const activeButton = document.querySelector(
    `.nav-link[data-page="${pageName}"]`
  );

  const currentPageName = document.getElementById("currentPageName");

  if (currentPageName) {
    currentPageName.textContent = activeButton
      ? activeButton.textContent.trim()
      : pageName;
  }

  document.getElementById("sidebar")?.classList.remove("open");

  if (pageName === "calendar") renderCalendar();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- DASHBOARD ---------- */

function renderDashboard() {
  const completedPlans = data.plans.filter(plan => plan.completed).length;

  const todayHabits = data.habits.filter(habit =>
    (habit.completedDates || []).includes(todayISO())
  ).length;

  document.getElementById("statPlans").textContent = data.plans.length;

  document.getElementById("statGoals").textContent =
    data.goals.filter(goal => Number(goal.progress) < 100).length;

  document.getElementById("statHabits").textContent =
    `${todayHabits}/${data.habits.length}`;

  document.getElementById("statCompleted").textContent = completedPlans;

  const plans = [...data.plans]
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
    })
    .slice(0, 4);

  document.getElementById("dashboardPlans").innerHTML = plans.length
    ? plans.map(plan => {
        const deadline = getPlanDeadlineStatus(plan);

        return `
          <div class="list-item">
            <input class="item-check" type="checkbox"
              data-action="toggle-plan"
              data-id="${escapeHTML(plan.id)}"
              aria-label="Complete ${escapeHTML(plan.title)}"
              ${plan.completed ? "checked" : ""}>
            <div class="list-item-main">
              <p class="list-item-title ${plan.completed ? "done" : ""}">
                ${escapeHTML(plan.title)}
              </p>
              <div class="item-meta">
                ${formatDate(plan.dueDate)} · ${escapeHTML(plan.priority || "medium")} priority
              </div>
              <span class="deadline-badge ${deadline.className}">
                ${escapeHTML(deadline.label)}
              </span>
            </div>
          </div>
        `;
      }).join("")
    : emptyState("No plans yet. Add a little task to get started!");

  const goals = data.goals.slice(0, 3);

  document.getElementById("dashboardGoals").innerHTML = goals.length
    ? goals.map(goal => `
      <div class="list-item">
        <div class="list-item-main">
          <p class="list-item-title">${escapeHTML(goal.title)}</p>
          <div class="progress-line">
            <span>${escapeHTML(goal.category || "Personal goal")}</span>
            <strong>${Number(goal.progress) || 0}%</strong>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${clampPercent(goal.progress)}%"></div>
          </div>
        </div>
      </div>
    `).join("")
    : emptyState("Your goals will appear here when you add one.", "✨");
}

/* ---------- PLANS ---------- */

function renderPlans() {
  const container = document.getElementById("plansList");
  const searchInput = document.getElementById("planSearch");
  const filterInput = document.getElementById("planFilter");

  const search = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const filter = filterInput ? filterInput.value : "all";

  let plans = [...data.plans];

  if (search) {
    plans = plans.filter(plan =>
      `${plan.title} ${plan.description || ""}`.toLowerCase().includes(search)
    );
  }

  if (filter === "active") plans = plans.filter(plan => !plan.completed);
  if (filter === "completed") plans = plans.filter(plan => plan.completed);

  plans.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
  });

  if (!plans.length) {
    container.innerHTML = emptyState(
      "No plans match what you're looking for. Add a plan or try another filter."
    );
    return;
  }

  container.innerHTML = plans.map(plan => {
    const deadline = getPlanDeadlineStatus(plan);

    return `
      <article class="plan-card">
        <div class="card-top">
          <div>
            <h3 class="card-title ${plan.completed ? "done" : ""}">
              ${escapeHTML(plan.title)}
            </h3>
            <span class="badge ${priorityClass(plan.priority)}">
              ${escapeHTML(plan.priority || "medium")} priority
            </span>
          </div>
          <input class="item-check" type="checkbox"
            data-action="toggle-plan"
            data-id="${escapeHTML(plan.id)}"
            aria-label="Mark ${escapeHTML(plan.title)} as completed"
            ${plan.completed ? "checked" : ""}>
        </div>

        ${plan.description
          ? `<p class="card-description">${escapeHTML(plan.description)}</p>`
          : ""}

        <div class="item-meta">
          Deadline: ${formatDate(plan.dueDate)}
        </div>

        <span class="deadline-badge ${deadline.className}">
          ${escapeHTML(deadline.label)}
        </span>

        <div class="card-bottom">
          <span class="item-meta">
            ${plan.completed ? "Finished" : "Keep going, one step at a time ♡"}
          </span>
          <div class="card-actions">
            <button class="mini-button" data-action="edit-plan"
              data-id="${escapeHTML(plan.id)}" aria-label="Edit plan">✎</button>
            <button class="mini-button" data-action="delete-plan"
              data-id="${escapeHTML(plan.id)}" aria-label="Delete plan">🗑</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

/* ---------- GOALS ---------- */

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(100, Math.max(0, number));
}

function renderGoals() {
  const container = document.getElementById("goalsList");

  if (!data.goals.length) {
    container.innerHTML = emptyState("Every big dream starts somewhere. Add your first goal!", "✨");
    return;
  }

  container.innerHTML = data.goals.map(goal => {
    const progress = clampPercent(goal.progress);

    return `
      <article class="goal-card">
        <div class="card-top">
          <div>
            <h3 class="card-title">${escapeHTML(goal.title)}</h3>
            <span class="badge">${escapeHTML(goal.category || "Personal")}</span>
          </div>
          <div class="card-actions">
            <button class="mini-button" data-action="edit-goal"
              data-id="${escapeHTML(goal.id)}" aria-label="Edit goal">✎</button>
            <button class="mini-button" data-action="delete-goal"
              data-id="${escapeHTML(goal.id)}" aria-label="Delete goal">🗑</button>
          </div>
        </div>

        ${goal.description
          ? `<p class="card-description">${escapeHTML(goal.description)}</p>`
          : ""}

        <div class="progress-line">
          <span>Progress</span>
          <strong>${progress}%</strong>
        </div>

        <div class="progress-track">
          <div class="progress-fill" style="width:${progress}%"></div>
        </div>

        <div class="goal-controls">
          <input type="range" min="0" max="100" step="5"
            value="${progress}" data-action="goal-progress"
            data-id="${escapeHTML(goal.id)}"
            aria-label="Update progress for ${escapeHTML(goal.title)}">
          <span class="goal-percent">${progress}%</span>
        </div>
      </article>
    `;
  }).join("");

  renderDashboard();
}

/* ---------- CALENDAR ---------- */

function renderCalendar() {
  const grid = document.getElementById("calendarGrid");
  const monthTitle = document.getElementById("calendarMonth");

  if (!grid || !monthTitle) return;

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  monthTitle.textContent = calendarDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  let html = weekdays.map(day =>
    `<div class="calendar-weekday">${day}</div>`
  ).join("");

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const previousMonthDays = new Date(year, month, 0).getDate();

  for (let i = 0; i < 42; i++) {
    let dayNumber;
    let cellDate;
    let outside = false;

    if (i < firstDay) {
      dayNumber = previousMonthDays - firstDay + i + 1;
      cellDate = new Date(year, month - 1, dayNumber);
      outside = true;
    } else if (i >= firstDay + daysInMonth) {
      dayNumber = i - firstDay - daysInMonth + 1;
      cellDate = new Date(year, month + 1, dayNumber);
      outside = true;
    } else {
      dayNumber = i - firstDay + 1;
      cellDate = new Date(year, month, dayNumber);
    }

    const dateKey =
      `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, "0")}-${String(cellDate.getDate()).padStart(2, "0")}`;

    const isToday = dateKey === todayISO();
    const isSelected = dateKey === selectedDate;

    const plansForDay = data.plans.filter(plan => plan.dueDate === dateKey);
    const goalsForDay = data.goals.filter(goal => goal.dueDate === dateKey);

    const classes = [
      "calendar-day",
      outside ? "outside" : "",
      isToday ? "today" : "",
      isSelected ? "selected" : ""
    ].filter(Boolean).join(" ");

    html += `
      <button class="${classes}" data-action="select-date"
        data-date="${dateKey}" aria-label="${formatDate(dateKey)}">
        <span class="day-number">${dayNumber}</span>
        <div class="day-dots">
          ${plansForDay.length ? '<span class="day-dot"></span>'.repeat(Math.min(plansForDay.length, 5)) : ""}
          ${goalsForDay.length ? '<span class="day-dot goal-dot"></span>'.repeat(Math.min(goalsForDay.length, 5)) : ""}
        </div>
      </button>
    `;
  }

  grid.innerHTML = html;
  renderSelectedDay();
}

function renderSelectedDay() {
  const title = document.getElementById("selectedDateTitle");
  const container = document.getElementById("selectedDayItems");

  if (!title || !container) return;

  title.textContent = formatDate(selectedDate);

  const plans = data.plans.filter(plan => plan.dueDate === selectedDate);

  container.innerHTML = plans.length
    ? plans.map(plan => {
        const deadline = getPlanDeadlineStatus(plan);

        return `
          <div class="list-item">
            <input class="item-check" type="checkbox"
              data-action="toggle-plan"
              data-id="${escapeHTML(plan.id)}"
              aria-label="Complete ${escapeHTML(plan.title)}"
              ${plan.completed ? "checked" : ""}>
            <div class="list-item-main">
              <p class="list-item-title ${plan.completed ? "done" : ""}">
                ${escapeHTML(plan.title)}
              </p>
              <div class="item-meta">
                ${escapeHTML(plan.priority || "medium")} priority
              </div>
              <span class="deadline-badge ${deadline.className}">
                ${escapeHTML(deadline.label)}
              </span>
            </div>
            <div class="item-actions">
              <button class="mini-button" data-action="edit-plan"
                data-id="${escapeHTML(plan.id)}" aria-label="Edit plan">✎</button>
            </div>
          </div>
        `;
      }).join("")
    : emptyState("Nothing planned for this day yet.", "🌷");
}

/* ---------- HABITS ---------- */

function getHabitStreak(habit) {
  const dates = new Set(habit.completedDates || []);
  let cursor = new Date();
  let streak = 0;

  if (!dates.has(todayISO())) cursor.setDate(cursor.getDate() - 1);

  while (streak < 366) {
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    if (!dates.has(iso)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function renderHabits() {
  const todayCount = data.habits.filter(habit =>
    (habit.completedDates || []).includes(todayISO())
  ).length;

  document.getElementById("habitSummaryTitle").textContent =
    data.habits.length && todayCount === data.habits.length
      ? "You did it! All habits checked off 🎉"
      : `${todayCount} of ${data.habits.length} habits completed today`;

  document.getElementById("habitSummaryText").textContent =
    data.habits.length
      ? "Keep showing up for yourself. Small steps count."
      : "Add a habit you'd like to practise regularly.";

  document.getElementById("habitsList").innerHTML = data.habits.length
    ? data.habits.map(habit => {
      const done = (habit.completedDates || []).includes(todayISO());
      return `
        <article class="habit-card">
          <div class="card-top">
            <div><h3 class="card-title">${escapeHTML(habit.title)}</h3>
              ${habit.description ? `<p class="card-description">${escapeHTML(habit.description)}</p>` : ""}
            </div>
            <div class="card-actions">
              <button class="mini-button" data-action="edit-habit" data-id="${escapeHTML(habit.id)}" aria-label="Edit habit">✎</button>
              <button class="mini-button" data-action="delete-habit" data-id="${escapeHTML(habit.id)}" aria-label="Delete habit">🗑</button>
            </div>
          </div>
          <div class="habit-check-row">
            <input type="checkbox" id="habit-${escapeHTML(habit.id)}" data-action="toggle-habit"
              data-id="${escapeHTML(habit.id)}" ${done ? "checked" : ""}>
            <label for="habit-${escapeHTML(habit.id)}">${done ? "Completed today — lovely work!" : "Mark as complete today"}</label>
          </div>
          <div class="habit-streak">🔥 ${getHabitStreak(habit)} day streak · ${Number((habit.completedDates || []).length)} total check-ins</div>
        </article>`;
    }).join("")
    : emptyState("Choose one small habit to start building your routine.", "☘");
}

/* ---------- PROGRESS ---------- */

function renderProgress() {
  const completed = data.plans.filter(plan => plan.completed).length;
  const reached = data.goals.filter(goal => Number(goal.progress) >= 100).length;
  const habits = data.habits.filter(habit =>
    (habit.completedDates || []).includes(todayISO())
  ).length;
  const planPercent = data.plans.length ? Math.round(completed / data.plans.length * 100) : 0;

  document.getElementById("progressCompleted").textContent = `${completed}/${data.plans.length}`;
  document.getElementById("progressGoalsReached").textContent = `${reached}/${data.goals.length}`;
  document.getElementById("progressHabits").textContent = `${habits}/${data.habits.length}`;

  document.getElementById("goalProgressList").innerHTML = data.goals.length
    ? data.goals.map(goal => `
      <div class="progress-item">
        <div class="task-progress-label"><strong>${escapeHTML(goal.title)}</strong><span>${clampPercent(goal.progress)}%</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${clampPercent(goal.progress)}%"></div></div>
      </div>`).join("")
    : emptyState("Your goal progress will appear here.", "✨");

  document.getElementById("taskProgress").innerHTML = `
    <div class="task-progress-label">
      <strong>Plans completed</strong>
      <span>${completed} of ${data.plans.length} · ${planPercent}%</span>
    </div>
    <div class="progress-track"><div class="progress-fill" style="width:${planPercent}%"></div></div>
    <p class="item-meta" style="margin-top:12px">
      ${data.plans.length ? "Every finished task is a little win." : "Add a plan, then check it off when you finish."}
    </p>`;
}

/* ---------- NOTES ---------- */

function renderNotes() {
  const searchInput = document.getElementById("noteSearch");
  const search = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const notes = [...data.notes]
    .filter(note => `${note.title} ${note.body}`.toLowerCase().includes(search))
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));

  document.getElementById("notesList").innerHTML = notes.length
    ? notes.map(note => `
      <article class="note-card ${note.pinned ? "pinned" : ""}">
        <div class="card-top">
          <h3>${note.pinned ? "📌 " : ""}${escapeHTML(note.title)}</h3>
          <div class="card-actions">
            <button class="mini-button" data-action="pin-note" data-id="${escapeHTML(note.id)}" aria-label="Pin note">${note.pinned ? "★" : "☆"}</button>
            <button class="mini-button" data-action="edit-note" data-id="${escapeHTML(note.id)}" aria-label="Edit note">✎</button>
            <button class="mini-button" data-action="delete-note" data-id="${escapeHTML(note.id)}" aria-label="Delete note">🗑</button>
          </div>
        </div>
        <div class="note-body">${escapeHTML(note.body)}</div>
        <div class="note-footer"><span>${formatDate(note.updatedAt || todayISO())}</span><span>${note.pinned ? "Pinned ♡" : "A little thought"}</span></div>
      </article>`).join("")
    : emptyState(search ? "No notes match your search." : "Your thoughts and ideas will live here.", "📝");
}

/* ---------- ADD / EDIT MODALS ---------- */

function openModal(type, item = null, presetDate = "") {
  const editing = Boolean(item);
  const forms = {
    plan: {
      title: editing ? "Edit your plan ♡" : "Add a little plan ♡",
      subtitle: "Break your day into manageable steps.",
      fields: [
        { name: "title", label: "Plan name", placeholder: "e.g. Study Python", required: true, value: item?.title || "" },
        { name: "description", label: "Details (optional)", type: "textarea", placeholder: "Add a few details...", value: item?.description || "" },
        { name: "dueDate", label: "Due date", type: "date", value: item?.dueDate || presetDate || todayISO() },
        { name: "priority", label: "Priority", type: "select", value: item?.priority || "medium", options: [["low", "Low"], ["medium", "Medium"], ["high", "High"]] }
      ]
    },
    goal: {
      title: editing ? "Edit your goal ✨" : "Add a new goal ✨",
      subtitle: "Dream big, then take one small step.",
      fields: [
        { name: "title", label: "Goal name", placeholder: "e.g. Learn web development", required: true, value: item?.title || "" },
        { name: "description", label: "Why does this matter to you? (optional)", type: "textarea", placeholder: "Describe your dream...", value: item?.description || "" },
        { name: "category", label: "Category", placeholder: "e.g. Learning, Personal, Career", value: item?.category || "Personal" },
        { name: "deadline", label: "Target date", type: "date", value: item?.deadline || "" },
        { name: "progress", label: "Current progress (%)", type: "number", min: 0, max: 100, value: item?.progress ?? 0 }
      ]
    },
    habit: {
      title: editing ? "Edit your habit ☘" : "Start a lovely habit ☘",
      subtitle: "Choose a routine you want to practise.",
      fields: [
        { name: "title", label: "Habit name", placeholder: "e.g. Read for 15 minutes", required: true, value: item?.title || "" },
        { name: "description", label: "Details (optional)", type: "textarea", placeholder: "When or how will you practise it?", value: item?.description || "" }
      ]
    },
    note: {
      title: editing ? "Edit your note 📝" : "Write a little note 📝",
      subtitle: "Keep your ideas and reminders in one place.",
      fields: [
        { name: "title", label: "Note title", placeholder: "e.g. Ideas for my website", required: true, value: item?.title || "" },
        { name: "body", label: "Your note", type: "textarea", placeholder: "Write your thoughts here...", required: true, value: item?.body || "" }
      ]
    }
  };

  const config = forms[type];
  if (!config) return;

  const fieldHTML = config.fields.map(field => {
    const id = `field-${field.name}`;
    let control = "";

    if (field.type === "textarea") {
      control = `<textarea id="${id}" name="${field.name}" placeholder="${escapeHTML(field.placeholder || "")}" ${field.required ? "required" : ""}>${escapeHTML(field.value)}</textarea>`;
    } else if (field.type === "select") {
      control = `<select id="${id}" name="${field.name}">${field.options.map(([value, label]) =>
        `<option value="${value}" ${field.value === value ? "selected" : ""}>${label}</option>`
      ).join("")}</select>`;
    } else {
      const typeAttr = field.type || "text";
      const effectiveMin = type === "plan" && field.name === "dueDate" ? todayISO() : field.min;
      const limits = [
        effectiveMin !== undefined ? `min="${effectiveMin}"` : "",
        field.max !== undefined ? `max="${field.max}"` : ""
      ].join(" ");

      control = `<input id="${id}" name="${field.name}" type="${typeAttr}" value="${escapeHTML(field.value)}" placeholder="${escapeHTML(field.placeholder || "")}" ${limits} ${field.required ? "required" : ""}>`;
    }

    return `<div class="form-field"><label for="${id}">${escapeHTML(field.label)}</label>${control}</div>`;
  }).join("");

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.id = "activeModal";
  backdrop.innerHTML = `
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <button type="button" class="icon-button modal-close" data-modal-close aria-label="Close dialog">×</button>
      <h2 id="modalTitle">${config.title}</h2>
      <p class="modal-subtitle">${config.subtitle}</p>
      <form class="modal-form" id="entryForm">
        ${fieldHTML}
        <div class="form-actions">
          <button type="button" class="secondary-button" data-modal-close>Cancel</button>
          <button type="submit" class="primary-button">${editing ? "Save changes" : "Save to BLOOM ♡"}</button>
        </div>
      </form>
    </section>`;

  document.body.appendChild(backdrop);
  backdrop.querySelector("input, textarea, select")?.focus();

  backdrop.addEventListener("click", event => {
    if (event.target === backdrop || event.target.closest("[data-modal-close]")) closeModal();
  });

  backdrop.querySelector("#entryForm").addEventListener("submit", event => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const values = Object.fromEntries(formData.entries());

    if (!values.title?.trim()) {
      showToast("Please enter a name first.");
      return;
    }

    if (type === "goal") values.progress = clampPercent(values.progress);

    if (type === "plan") {
      const dueDate = values.dueDate;

      if (!dueDate) {
        showToast("Please choose a deadline for your plan.");
        backdrop.querySelector('[name="dueDate"]')?.focus();
        return;
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || dueDate < todayISO()) {
        showToast("Invalid date! Choose today or a future date.");
        backdrop.querySelector('[name="dueDate"]')?.focus();
        return;
      }

      values.completed = item?.completed || false;
      values.priority = priorityClass(values.priority);
    }

    if (type === "habit") values.completedDates = item?.completedDates || [];

    if (type === "note") {
      values.pinned = item?.pinned || false;
      values.updatedAt = todayISO();
    }

    if (editing) {
      const index = data[`${type}s`].findIndex(entry => entry.id === item.id);
      if (index !== -1) {
        data[`${type}s`][index] = { ...data[`${type}s`][index], ...values };
      }
    } else {
      data[`${type}s`].push({ id: makeId(), ...values });
    }

    saveData();
    closeModal();
    renderAll();
    showToast(editing ? "Your changes have been saved ♡" : "Added to your BLOOM space 🌸");

    if (type === "plan") checkDeadlineReminders();
  });
}

function closeModal() {
  document.getElementById("activeModal")?.remove();
}

/* ---------- ACTIONS ---------- */

function findItem(type, id) {
  return data[`${type}s`]?.find(item => item.id === id);
}

function deleteItem(type, id) {
  const item = findItem(type, id);
  if (!item) return;

  const label = item.title || "this item";

  if (!confirm(`Are you sure you want to delete "${label}"?`)) return;

  data[`${type}s`] = data[`${type}s`].filter(entry => entry.id !== id);
  saveData();
  renderAll();
  showToast("Item deleted.");
}

function handleAction(action, id, element) {
  const map = {
    "edit-plan": "plan",
    "edit-goal": "goal",
    "edit-habit": "habit",
    "edit-note": "note"
  };

  if (map[action]) {
    const type = map[action];
    const item = findItem(type, id);
    if (item) openModal(type, item);
    return;
  }

  if (action.startsWith("delete-")) {
    deleteItem(action.replace("delete-", ""), id);
    return;
  }

  if (action === "toggle-plan") {
    const plan = findItem("plan", id);
    if (!plan) return;

    plan.completed = Boolean(element.checked);
    saveData();
    renderAll();

    showToast(plan.completed ? "Plan completed! Well done 🎉" : "Plan marked as unfinished.");
    return;
  }

  if (action === "toggle-habit") {
    const habit = findItem("habit", id);
    if (!habit) return;

    if (!Array.isArray(habit.completedDates)) habit.completedDates = [];

    if (element.checked) {
      if (!habit.completedDates.includes(todayISO())) {
        habit.completedDates.push(todayISO());
      }
    } else {
      habit.completedDates = habit.completedDates.filter(date => date !== todayISO());
    }

    saveData();
    renderAll();
    showToast(element.checked ? "Lovely! Habit checked off ☘" : "Habit check-in removed.");
    return;
  }

  if (action === "goal-progress") {
    const goal = findItem("goal", id);
    if (!goal) return;

    goal.progress = clampPercent(element.value);
    saveData();
    renderAll();
    return;
  }

  if (action === "pin-note") {
    const note = findItem("note", id);
    if (!note) return;

    note.pinned = !note.pinned;
    saveData();
    renderAll();
    showToast(note.pinned ? "Note pinned 📌" : "Note unpinned.");
    return;
  }

  if (action === "select-date") {
    selectedDate = element.dataset.date;
    const parts = selectedDate.split("-").map(Number);
    calendarDate = new Date(parts[0], parts[1] - 1, 1);
    renderCalendar();
  }
}

/* ---------- DEADLINE REMINDERS ---------- */

function renderReminderSettings() {
  const button = document.getElementById("enableRemindersBtn");
  const status = document.getElementById("reminderStatus");

  if (!button || !status) return;

  button.textContent = data.remindersEnabled ? "Disable reminders" : "Enable reminders";

  status.textContent = data.remindersEnabled
    ? "Reminders are enabled while BLOOM is open. Plans due today or tomorrow will be checked."
    : "Turn on reminders for plans due today or tomorrow.";

  button.setAttribute("aria-pressed", String(data.remindersEnabled));
}

function getTomorrowISO() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
}

function checkDeadlineReminders() {
  if (!data.remindersEnabled) return;

  const today = todayISO();
  const tomorrow = getTomorrowISO();

  if (!Array.isArray(data.reminderLog)) data.reminderLog = [];

  const duePlans = data.plans.filter(plan =>
    !plan.completed && (plan.dueDate === today || plan.dueDate === tomorrow)
  );

  for (const plan of duePlans) {
    const reminderKey = `${plan.id}-${plan.dueDate}-${today}`;
    if (data.reminderLog.includes(reminderKey)) continue;

    const message = plan.dueDate === today
      ? `🔔 "${plan.title}" is due today!`
      : `🌸 Reminder: "${plan.title}" is due tomorrow.`;

    data.reminderLog.push(reminderKey);

    if (data.reminderLog.length > 500) {
      data.reminderLog = data.reminderLog.slice(-400);
    }

    saveData();
    showToast(message);
    break;
  }
}

const enableRemindersButton = document.getElementById("enableRemindersBtn");

if (enableRemindersButton) {
  enableRemindersButton.addEventListener("click", () => {
    data.remindersEnabled = !data.remindersEnabled;
    saveData();
    renderReminderSettings();

    if (data.remindersEnabled) {
      showToast("Deadline reminders enabled! 🔔");
      checkDeadlineReminders();
    } else {
      showToast("Deadline reminders disabled.");
    }
  });
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) checkDeadlineReminders();
});

window.addEventListener("focus", checkDeadlineReminders);

/* ---------- RENDER EVERYTHING ---------- */

function renderAll() {
  applyTheme();
  updateHeader();
  renderDashboard();
  renderPlans();
  renderGoals();
  renderCalendar();
  renderHabits();
  renderProgress();
  renderNotes();
  renderReminderSettings();
}

/* ---------- EVENT LISTENERS ---------- */

document.querySelectorAll(".nav-link[data-page]").forEach(button => {
  button.addEventListener("click", () => navigate(button.dataset.page));
});

document.getElementById("menuToggle")?.addEventListener("click", () => {
  document.getElementById("sidebar")?.classList.toggle("open");
});

document.getElementById("themeToggle").addEventListener("click", () => {
  data.theme = data.theme === "dark" ? "light" : "dark";
  saveData();
  applyTheme();
  showToast(data.theme === "dark" ? "Dark mode enabled 🌙" : "Light pink mode enabled 🌸");
});

document.getElementById("themeSetting").addEventListener("change", event => {
  data.theme = event.target.value === "dark" ? "dark" : "light";
  saveData();
  applyTheme();
  showToast("Your theme preference has been saved.");
});

document.getElementById("saveName").addEventListener("click", () => {
  const name = document.getElementById("nameSetting").value.trim();

  if (!name) {
    showToast("Please enter your name.");
    return;
  }

  data.name = name;
  saveData();
  renderAll();
  showToast("Your name has been updated ♡");
});

document.getElementById("planSearch").addEventListener("input", renderPlans);
document.getElementById("planFilter").addEventListener("change", renderPlans);
document.getElementById("noteSearch").addEventListener("input", renderNotes);

document.getElementById("prevMonth").addEventListener("click", () => {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
  renderCalendar();
});

document.getElementById("nextMonth").addEventListener("click", () => {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
  renderCalendar();
});

document.getElementById("todayButton").addEventListener("click", () => {
  calendarDate = new Date();
  selectedDate = todayISO();
  renderCalendar();
});

document.getElementById("addPlanForDate").addEventListener("click", () => {
  openModal("plan", null, selectedDate);
});

document.getElementById("exportData").addEventListener("click", () => {
  const fileContents = JSON.stringify(data, null, 2);
  const blob = new Blob([fileContents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `bloom-backup-${todayISO()}.json`;

  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showToast("Your BLOOM backup has been exported.");
});

document.getElementById("resetData").addEventListener("click", () => {
  const confirmed = confirm(
    "This will permanently delete all plans, goals, habits and notes saved in this browser. Export a backup first if you want to keep them. Continue?"
  );

  if (!confirmed) return;

  data = createDefaultData();
  saveData();
  selectedDate = todayISO();
  calendarDate = new Date();

  document.getElementById("planSearch").value = "";
  document.getElementById("planFilter").value = "all";
  document.getElementById("noteSearch").value = "";

  renderAll();
  navigate("dashboard");
  showToast("BLOOM has been reset. A fresh start 🌸");
});

document.addEventListener("click", event => {
  const addButton = event.target.closest("[data-add]");

  if (addButton) {
    openModal(addButton.dataset.add);
    return;
  }

  const goButton = event.target.closest("[data-go]");

  if (goButton) {
    navigate(goButton.dataset.go);
    return;
  }

  const actionElement = event.target.closest("[data-action]");

  if (actionElement) {
    const action = actionElement.dataset.action;
    const id = actionElement.dataset.id;
    handleAction(action, id, actionElement);
  }
});

document.addEventListener("input", event => {
  const slider = event.target.closest('[data-action="goal-progress"]');
  if (!slider) return;

  const card = slider.closest(".goal-card");
  const percent = card?.querySelector(".goal-percent");
  const fill = card?.querySelector(".progress-fill");
  const line = card?.querySelector(".progress-line strong");

  if (percent) percent.textContent = `${slider.value}%`;
  if (fill) fill.style.width = `${slider.value}%`;
  if (line) line.textContent = `${slider.value}%`;
});

setInterval(checkDeadlineReminders, 60000);

/* ---------- START THE APP ---------- */

renderAll();
checkDeadlineReminders();
