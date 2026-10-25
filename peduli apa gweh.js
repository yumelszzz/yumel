const STORAGE_KEY = "orbit-personal-tasks";

const $ = (selector) => document.querySelector(selector);

const taskList = $("#taskList");
const emptyState = $("#emptyState");
const taskDialog = $("#taskDialog");
const taskForm = $("#taskForm");

let tasks = loadTasks();
let currentView = "dashboard";
let currentCategory = null;
let editingId = null;

function loadTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const data = saved ? JSON.parse(saved) : [];
    return Array.isArray(data) ? data.filter(
      task => task && typeof task.id === "string"
        && typeof task.title === "string"
    ) : [];
  } catch {
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    alert("Data gagal disimpan. Coba cek penyimpanan browser kamu.");
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}


function formatDate(dateString) {
  if (!dateString) return "Tanpa deadline";

  const date = new Date(dateString + "T00:00:00");

  if (Number.isNaN(date.getTime())) {
    return "Tanggal tidak valid";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function getDateLabel(dateString) {
  if (!dateString) return "Tanpa deadline";

  const date = new Date(dateString + "T00:00:00");

  if (Number.isNaN(date.getTime())) {
    return "Tanggal tidak valid";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) return "Hari ini";
  if (date.getTime() === tomorrow.getTime()) return "Besok";

  return formatDate(dateString);
}

function isUrgent(task) {
  if (!task.dueDate || task.done) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const due = new Date(task.dueDate + "T00:00:00");

  return due >= today && due <= tomorrow;
}

function priorityLabel(priority) {
  return {
    high: "Penting",
    medium: "Normal",
    low: "Santai"
  }[priority] || "Normal";
}

function categoryClass(category) {
  return ({
    Kuliah: "kuliah",
    Organisasi: "organisasi",
    Personal: "personal"
  })[category] || "personal";
}

function renderStats() {
  const completed = tasks.filter(task => task.done).length;
  const pending = tasks.length - completed;
  const progress = tasks.length
    ? Math.round(completed / tasks.length * 100)
    : 0;

  $("#totalCount").textContent = tasks.length;
  $("#pendingCount").textContent = pending;
  $("#doneCount").textContent = completed;
  $("#urgentCount").textContent = tasks.filter(isUrgent).length;
  $("#progressPercent").textContent = progress + "%";
  $("#progressBar").style.width = progress + "%";

  $("#progressMessage").textContent =
    tasks.length === 0 ? "Mulai dari satu tugas kecil." :
    progress === 100 ? "Semua tugas selesai. Keren banget!" :
    progress >= 60 ? "Kamu sudah jauh melangkah. Lanjutkan!" :
    progress >= 30 ? "Progress yang bagus. Teruskan!" :
    "Sedikit demi sedikit, kamu pasti bisa.";
}


function getVisibleTasks() {
  const query = $("#searchInput").value.trim().toLowerCase();
  const status = $("#statusFilter").value;

  return tasks
    .filter(task => {
      const title = String(task.title || "").toLowerCase();

      const matchesSearch = title.includes(query);
      const matchesCategory =
        !currentCategory || task.category === currentCategory;

      const matchesStatus =
        status === "all" ||
        (status === "pending" && !task.done) ||
        (status === "done" && task.done);

      const matchesView =
        currentView !== "agenda" ||
        (!task.done && Boolean(task.dueDate));

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStatus &&
        matchesView
      );
    })
    .sort((a, b) => {
      if (a.done !== b.done) {
        return Number(a.done) - Number(b.done);
      }

      if (a.dueDate && b.dueDate) {
        return a.dueDate.localeCompare(b.dueDate);
      }

      if (a.dueDate) return -1;
      if (b.dueDate) return 1;

      const priorityOrder = { high: 0, medium: 1, low: 2 };

      return (
        (priorityOrder[a.priority] ?? 1) -
        (priorityOrder[b.priority] ?? 1)
      );
    });
}


function renderTasks() {
  const visibleTasks = getVisibleTasks();

    console.log("Semua data tugas:", tasks);
    console.log("Tugas yang ditampilkan:", visibleTasks);
    taskList.innerHTML = visibleTasks.map(task => `
        <article class="task-item ${task.done ? "completed" : ""}">
        <input
        class="task-check"
        type="checkbox"
        aria-label="Tandai ${escapeHTML(task.title)} selesai"
        data-action="toggle"
        data-id="${escapeHTML(task.id)}"
        ${task.done ? "checked" : ""}
        >
        
        <div class="task-body">
        <p class="task-name">${escapeHTML(task.title)}</p>
        <div class="task-meta">
          <span class="tag ${categoryClass(task.category)}">
            ${escapeHTML(task.category || "Personal")}
          </span>
          <span class="priority ${escapeHTML(task.priority || "medium")}">
            ${priorityLabel(task.priority)}
          </span>
          <span class="due-date">
            ${task.dueDate
              ? "◷ " + escapeHTML(getDateLabel(task.dueDate))
              : "◷ Tanpa deadline"}
          </span>
          </div>
          </div>
          
          <div class="task-actions">
          <button class="icon-btn" data-action="edit"
          data-id="${escapeHTML(task.id)}"
          aria-label="Edit tugas">✎</button>
          <button class="icon-btn" data-action="delete"
          data-id="${escapeHTML(task.id)}"
          aria-label="Hapus tugas">×</button>
          </div>
          </article>
          `).join("");
          
          emptyState.hidden = visibleTasks.length > 0;
          taskList.hidden = visibleTasks.length === 0;
}

function renderAgenda() {
  const upcoming = tasks
    .filter(task => !task.done && task.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 4);

  $("#agendaList").innerHTML = upcoming.length
    ? upcoming.map(task => {
        const date = new Date(task.dueDate + "T00:00:00");
        const day = date.getDate();
        const month = new Intl.DateTimeFormat("id-ID", {
          month: "short"
        }).format(date);

        return `
          <div class="agenda-item">
            <div class="date-box">
              <strong>${day}</strong>
              <small>${escapeHTML(month)}</small>
            </div>
            <div class="agenda-detail">
              <strong>${escapeHTML(task.title)}</strong>
              <small>${escapeHTML(task.category)} · ${escapeHTML(getDateLabel(task.dueDate))}</small>
            </div>
          </div>
        `;
      }).join("")
    : '<p class="agenda-empty">Belum ada deadline. Waktunya atur rencana!</p>';
}

function render() {
  renderStats();
  renderTasks();
  renderAgenda();
}

function setView(view, category = null) {
  currentView = view;
  currentCategory = category;

  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.view === view ||
      (category && button.dataset.category === category)
    );
  });

  const titles = {
    dashboard: "Dashboard",
    tasks: "Semua tugas",
    agenda: "Agenda"
  };

  $("#pageTitle").textContent = category || titles[view] || "Dashboard";
  $("#listTitle").textContent = category
    ? "Tugas " + category
    : view === "agenda" ? "Tugas berdeadline" : "Tugas kamu";

  renderTasks();
}

function openTaskDialog(task = null) {
  editingId = task ? task.id : null;
  taskForm.reset();

  $("#dialogTitle").textContent = task ? "Edit tugas" : "Tambah tugas";
  $("#taskName").value = task ? task.title : "";
  $("#taskCategory").value = task ? task.category : (currentCategory || "Kuliah");
  $("#taskDate").value = task ? task.dueDate : "";
  $("#taskPriority").value = task ? task.priority : "medium";

  taskDialog.showModal();
  $("#taskName").focus();
}

function closeTaskDialog() {
  taskDialog.close();
  editingId = null;
}

function handleTaskSubmit(event) {
  event.preventDefault();

  const title = $("#taskName").value.trim();
  if (!title) return;

  const taskData = {
    title,
    category: $("#taskCategory").value,
    dueDate: $("#taskDate").value,
    priority: $("#taskPriority").value
  };

  if (editingId) {
    tasks = tasks.map(task =>
      task.id === editingId ? { ...task, ...taskData } : task
    );
  } else {
    tasks.push({
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()) + Math.random().toString(16).slice(2),
      ...taskData,
      done: false,
      createdAt: new Date().toISOString()
    });
  }

  saveTasks();
  closeTaskDialog();
  render();
}

function handleTaskAction(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  const { action, id } = target.dataset;
  const task = tasks.find(item => item.id === id);
  if (!task) return;

  if (action === "toggle") {
    task.done = target.checked;
  }

  if (action === "edit") {
    openTaskDialog(task);
    return;
  }

  if (action === "delete") {
    const confirmed = confirm(`Hapus tugas "${task.title}"?`);
    if (!confirmed) return;

    tasks = tasks.filter(item => item.id !== id);
  }

  saveTasks();
  render();
}

$("#topAddBtn").addEventListener("click", () => openTaskDialog());
$("#panelAddBtn").addEventListener("click", () => openTaskDialog());
$("#emptyAddBtn").addEventListener("click", () => openTaskDialog());

$("#closeDialog").addEventListener("click", closeTaskDialog);
$("#cancelDialog").addEventListener("click", closeTaskDialog);
taskForm.addEventListener("submit", handleTaskSubmit);

taskList.addEventListener("click", handleTaskAction);
taskList.addEventListener("change", event => {
  if (event.target.matches('[data-action="toggle"]')) {
    handleTaskAction(event);
  }
});

$("#searchInput").addEventListener("input", renderTasks);
$("#statusFilter").addEventListener("change", renderTasks);

document.querySelectorAll("[data-view]").forEach(button => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

document.querySelectorAll("[data-category]").forEach(button => {
  button.addEventListener("click", () => {
    setView("tasks", button.dataset.category);
  });
});

$("#themeBtn").addEventListener("click", () => {
  document.body.classList.toggle("light");
  const isLight = document.body.classList.contains("light");
  document.documentElement.style.colorScheme = isLight ? "light" : "dark";
  $("#themeBtn").innerHTML = isLight
    ? "☾ <span>Mode gelap</span>"
    : "◐ <span>Mode terang</span>";
});

$("#todayText").textContent = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
}).format(new Date());

render();
