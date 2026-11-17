/* =========================================
   다모아 - Firebase 연동 JS
   ========================================= */

// 1. Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyCKMmnGx4JrnDBGO-mXwTjGkkm-t9LjuVs",
  authDomain: "planner-b7348.firebaseapp.com",
  projectId: "planner-b7348",
  storageBucket: "planner-b7348.firebasestorage.app",
  messagingSenderId: "643684962639",
  appId: "1:643684962639:web:e3c62ec53eae854562b53a",
  measurementId: "G-H1L2VH31MC"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// 학생 공통 접속 비밀번호
// 아래 문구를 원하는 비밀번호로 바꾸세요.
const STUDENT_ACCESS_CODE = "1029";

// 2. HTML 요소
const $ = id => document.getElementById(id);

const loginForm = $("loginForm");
const studentLoginForm = $("studentLoginForm");
const studentPassword = $("studentPassword");
const adminLoginDetails = loginForm?.closest("details");
const loginEmail = $("loginEmail");
const loginPassword = $("loginPassword");
const authMessage = $("authMessage");
const logoutButton = $("logoutButton");

const openFormButton = $("openForm");
const taskForm = $("taskForm");
const taskTitle = $("taskTitle");
const taskSubject = $("taskSubject");
const taskDate = $("taskDate");
const taskNote = $("taskNote");
const cancelFormButton = $("cancelForm");

const taskList = $("taskList");
const calendarGrid = $("calendarGrid");
const dayTasks = $("dayTasks");
const prevMonthButton = $("prevMonth");
const nextMonthButton = $("nextMonth");
const filters = $("filters");

// 3. 앱 상태
let currentUser = null;
let isAdmin = false;
let tasks = [];
let completionMap = {};
let activeFilter = "all";
let editingTaskId = null;
let selectedDate = todayString();
let calendarMonth = new Date();

let stopAssignmentsListener = null;
let stopCompletionListener = null;
let authVersion = 0;

const subjectStyles = {
  "국어": "korean",
  "영어": "english",
  "수학": "math",
  "사회": "social",
  "과학": "science",
  "한국사": "history",
  "기타": "other"
};

// 4. 공통 함수
function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

function formatDate(value) {
  if (!value) return "날짜 미정";
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return "날짜 미정";
  return `${parts[1]}월 ${parts[2]}일`;
}

function subjectClass(subject) {
  return subjectStyles[subject] || "other";
}

function showMessage(message) {
  if (authMessage) authMessage.textContent = message;
}

function sortedTasks() {
  return [...tasks].sort((a, b) => {
    if (!a.due && !b.due) return 0;
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due.localeCompare(b.due);
  });
}

function filteredTasks() {
  const list = sortedTasks();

  if (activeFilter === "all") return list;
  if (activeFilter === "todo") return list.filter(t => !t.done);
  if (activeFilter === "done") return list.filter(t => t.done);

  return list.filter(t => t.subject === activeFilter);
}

function stopListeners() {
  if (stopAssignmentsListener) {
    stopAssignmentsListener();
    stopAssignmentsListener = null;
  }

  if (stopCompletionListener) {
    stopCompletionListener();
    stopCompletionListener = null;
  }
}

// 5. 로그인 화면과 권한 표시
function updateAccessUI() {
    const plannerContent = document.getElementById("plannerContent");

  if (plannerContent) {
    plannerContent.style.display = currentUser ? "block" : "none";
  }
  if (studentLoginForm) {
    studentLoginForm.style.display = currentUser ? "none" : "block";
  }

  if (adminLoginDetails) {
    adminLoginDetails.style.display = currentUser ? "none" : "block";
  }

  if (loginForm) {
    loginForm.style.display = currentUser ? "none" : "block";
  }

  if (logoutButton) {
    logoutButton.style.display = currentUser ? "block" : "none";
  }

  if (openFormButton) {
    openFormButton.style.display =
      currentUser && isAdmin ? "" : "none";
  }

  if (!isAdmin && taskForm) {
    taskForm.style.display = "none";
  }

  if (!currentUser) {
    showMessage("학생은 공통 비밀번호로, 운영진은 운영진 로그인으로 접속해 주세요.");
  } else if (isAdmin) {
    showMessage("관리자로 로그인했어요. 공통 과제를 관리할 수 있어요.");
  } else {
    showMessage("로그인했어요. 과제를 확인하고 완료 여부를 기록할 수 있어요.");
  }
}

// 6. 과제 목록 표시
function renderTasks() {
  if (!taskList) return;

  if (!currentUser) {
    taskList.innerHTML =
      '<p class="empty-state">로그인하면 과제를 확인할 수 있어요.</p>';
    return;
  }

  const list = filteredTasks();

  if (!list.length) {
    taskList.innerHTML =
      '<p class="empty-state">표시할 과제가 없어요.</p>';
    return;
  }

  taskList.innerHTML = list.map(task => {
    const checked = task.done ? "checked" : "";
    const completed = task.done ? " completed" : "";
const today = new Date();
today.setHours(0, 0, 0, 0);

const dueDate = new Date(task.due + "T00:00:00");
const dayDiff = Math.round((dueDate - today) / 86400000);

const dDayText = dayDiff > 0
  ? `D-${dayDiff}`
  : dayDiff === 0
    ? "D-DAY"
    : `D+${Math.abs(dayDiff)}`;
    return `
      <article class="task-card${completed}">
        <div class="task-top">
          <label class="task-check-label">
            <input
              type="checkbox"
              class="task-check"
              data-complete="${escapeHTML(task.id)}"
              ${checked}
              aria-label="${escapeHTML(task.title)} 완료 여부"
            >
          </label>

          <div class="task-content">
            <div class="task-meta">
              <span class="subject-tag ${subjectClass(task.subject)}">
                ${escapeHTML(task.subject || "기타")}
              <span class="task-date">
  ${escapeHTML(formatDate(task.due))}
</span>
<span class="task-dday">${dDayText}</span>
            </div>

            <h3 class="task-title">${escapeHTML(task.title)}</h3>

            ${task.note
              ? `<p class="task-note">${escapeHTML(task.note)}</p>`
              : ""}
          </div>
        </div>

        ${isAdmin ? `
          <div class="admin-actions">
            <button type="button" class="edit-btn"
              data-edit="${escapeHTML(task.id)}">수정</button>
            <button type="button" class="delete-btn"
              data-delete="${escapeHTML(task.id)}">삭제</button>
          </div>
        ` : ""}
      </article>
    `;
  }).join("");
}

// 7. 달력 표시
function renderCalendar() {
  if (!calendarGrid) return;

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const previousMonthDays = new Date(year, month, 0).getDate();

  const titleElement = $("calendarTitle");
  if (titleElement) {
    titleElement.textContent = `${year}년 ${month + 1}월`;
  }

  let html = "";

  for (let i = 0; i < firstDay; i++) {
    const day = previousMonthDays - firstDay + i + 1;
    html += `<button type="button" class="calendar-day muted" disabled>${day}</button>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const hasTask = tasks.some(t => t.due === date);
    const selected = selectedDate === date ? " selected" : "";
    const today = todayString() === date ? " today" : "";

    html += `
      <button type="button"
        class="calendar-day${selected}${today}${hasTask ? " has-task" : ""}"
        data-date="${date}">
        ${day}${hasTask ? '<span class="calendar-dot"></span>' : ""}
      </button>
    `;
  }

  const usedCells = firstDay + daysInMonth;
  const trailingCells = (7 - usedCells % 7) % 7;

  for (let day = 1; day <= trailingCells; day++) {
    html += `<button type="button" class="calendar-day muted" disabled>${day}</button>`;
  }

  calendarGrid.innerHTML = html;
}

// 8. 선택한 날짜의 과제 표시
function renderDayTasks() {
  if (!dayTasks) return;

  const heading = $("selectedDateTitle");
  if (heading) {
    heading.textContent = `${formatDate(selectedDate)} 과제`;
  }

  if (!currentUser) {
    dayTasks.innerHTML =
      '<p class="empty-state">로그인 후 과제를 확인할 수 있어요.</p>';
    return;
  }

  const list = sortedTasks().filter(t => t.due === selectedDate);

  if (!list.length) {
    dayTasks.innerHTML =
      '<p class="empty-state">이 날짜에는 등록된 과제가 없어요.</p>';
    return;
  }

  dayTasks.innerHTML = list.map(task => `
    <div class="day-task">
      <span class="subject-tag ${subjectClass(task.subject)}">
        ${escapeHTML(task.subject || "기타")}
      </span>
      <span class="day-task-title${task.done ? " completed-text" : ""}">
        ${escapeHTML(task.title)}
      </span>
      ${isAdmin ? `
        <button type="button" class="edit-btn"
          data-edit="${escapeHTML(task.id)}">수정</button>
        <button type="button" class="delete-btn"
          data-delete="${escapeHTML(task.id)}">삭제</button>
      ` : ""}
    </div>
  `).join("");
}

function render() {
  renderTasks();
  renderCalendar();
  renderDayTasks();
}

// 9. 과제 폼 열기 및 닫기
function openTaskForm(task = null) {
  if (!currentUser || !isAdmin || !taskForm) return;

  editingTaskId = task ? task.id : null;

  if (taskTitle) taskTitle.value = task?.title || "";
  if (taskSubject) taskSubject.value = task?.subject || "기타";
  if (taskDate) taskDate.value = task?.due || "";
  if (taskNote) taskNote.value = task?.note || "";

  const submitButton = taskForm.querySelector('[type="submit"]');
  if (submitButton) {
    submitButton.textContent = task ? "수정 내용 저장" : "과제 저장";
  }

  taskForm.classList.remove("hidden");
  taskForm.style.display = "block";

  if (openFormButton) {
    openFormButton.style.display = "none";
  }

  taskForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closeTaskForm() {
  editingTaskId = null;

  if (taskForm) {
    taskForm.reset();
    taskForm.classList.add("hidden");
    taskForm.style.display = "";
  }

  if (openFormButton && currentUser && isAdmin) {
    openFormButton.style.display = "";
  }

  const submitButton = taskForm?.querySelector('[type="submit"]');
  if (submitButton) submitButton.textContent = "과제 저장";
}

// 10. 학생 공통 비밀번호 로그인
if (studentLoginForm) {
  studentLoginForm.addEventListener("submit", async event => {
    event.preventDefault();

    const enteredCode = studentPassword?.value || "";

    if (!enteredCode) {
      showMessage("공통 비밀번호를 입력해 주세요.");
      return;
    }

    if (enteredCode !== STUDENT_ACCESS_CODE) {
      showMessage("공통 비밀번호가 올바르지 않아요.");
      if (studentPassword) studentPassword.value = "";
      return;
    }

    showMessage("학생 계정으로 접속 중입니다.");

    try {
      await auth.signInAnonymously();
      if (studentPassword) studentPassword.value = "";
    } catch (error) {
      console.error("학생 익명 로그인 오류:", error);
      showMessage("접속에 실패했어요. Firebase 익명 인증 설정을 확인해 주세요.");
    }
  });
}

// 11. 운영진 이메일 로그인
if (loginForm) {
  loginForm.addEventListener("submit", async event => {
    event.preventDefault();

    const email = loginEmail?.value.trim();
    const password = loginPassword?.value;

    if (!email || !password) {
      showMessage("이메일과 비밀번호를 입력해 주세요.");
      return;
    }

    showMessage("로그인 중입니다.");

    try {
      await auth.signInWithEmailAndPassword(email, password);
      if (loginPassword) loginPassword.value = "";
    } catch (error) {
      console.error("로그인 오류:", error);
      showMessage("로그인 실패: 이메일과 비밀번호를 확인해 주세요.");
    }
  });
}

// 12. 로그아웃
if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    try {
      await auth.signOut();
      showMessage("로그아웃했어요.");
    } catch (error) {
      console.error("로그아웃 오류:", error);
      showMessage("로그아웃 중 오류가 발생했어요.");
    }
  });
}

// 13. 폼 버튼
if (openFormButton) {
  openFormButton.addEventListener("click", () => openTaskForm());
}

if (cancelFormButton) {
  cancelFormButton.addEventListener("click", closeTaskForm);
}

// 14. 공통 과제 추가 및 수정
if (taskForm) {
  taskForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!currentUser || !isAdmin) {
      showMessage("관리자만 과제를 추가하거나 수정할 수 있어요.");
      return;
    }

    const title = taskTitle?.value.trim();
    const subject = taskSubject?.value || "기타";
    const due = taskDate?.value || "";
    const note = taskNote?.value.trim() || "";

    if (!title) {
      showMessage("과제 제목을 입력해 주세요.");
      return;
    }

    const data = {
      title,
      subject,
      due,
      note,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      if (editingTaskId) {
        await db.collection("assignments")
          .doc(editingTaskId)
          .update(data);
        showMessage("과제를 수정했어요.");
      } else {
        data.createdAt =
          firebase.firestore.FieldValue.serverTimestamp();

        await db.collection("assignments").add(data);
        showMessage("과제를 등록했어요.");
      }

      closeTaskForm();
    } catch (error) {
      console.error("과제 저장 오류:", error);
      showMessage("저장 실패: 관리자 권한과 Firestore 규칙을 확인해 주세요.");
    }
  });
}

// 15. 개인별 완료 체크 저장
async function updateCompletion(assignmentId, done) {
  if (!currentUser) {
    throw new Error("로그인이 필요합니다.");
  }

  await db.collection("users")
    .doc(currentUser.uid)
    .collection("completed")
    .doc(assignmentId)
    .set({ done });
}

if (taskList) {
  taskList.addEventListener("change", async event => {
    const checkbox = event.target.closest("[data-complete]");
    if (!checkbox) return;

    const id = checkbox.dataset.complete;
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const previousValue = Boolean(task.done);
    const newValue = checkbox.checked;

    task.done = newValue;
    completionMap[id] = newValue;
    render();

    try {
      await updateCompletion(id, newValue);
    } catch (error) {
      console.error("완료 상태 저장 오류:", error);
      task.done = previousValue;
      completionMap[id] = previousValue;
      render();
      showMessage("완료 상태 저장 실패: 로그인과 Firestore 규칙을 확인해 주세요.");
    }
  });
}

// 16. 관리자 전용 수정 및 삭제
function editTask(id) {
  if (!isAdmin) return;
  const task = tasks.find(t => t.id === id);
  if (task) openTaskForm(task);
}

async function deleteTask(id) {
  if (!currentUser || !isAdmin) {
    showMessage("관리자만 과제를 삭제할 수 있어요.");
    return;
  }

  const task = tasks.find(t => t.id === id);
  if (!task) return;

  if (!confirm(`'${task.title}' 과제를 삭제할까요?`)) return;

  try {
    await db.collection("assignments").doc(id).delete();
    showMessage("과제를 삭제했어요.");
  } catch (error) {
    console.error("삭제 오류:", error);
    showMessage("삭제 실패: 관리자 권한과 Firestore 규칙을 확인해 주세요.");
  }
}

document.addEventListener("click", event => {
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");

  if (editButton) editTask(editButton.dataset.edit);
  if (deleteButton) deleteTask(deleteButton.dataset.delete);
});

// 17. 필터
if (filters) {
  filters.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;

    const filter = button.dataset.filter || button.dataset.subject;
    if (!filter) return;

    activeFilter = filter === "전체" ? "all" : filter;

    filters.querySelectorAll("button").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    renderTasks();
  });
}

// 18. 달력 이동 및 날짜 선택
if (calendarGrid) {
  calendarGrid.addEventListener("click", event => {
    const button = event.target.closest("[data-date]");
    if (!button) return;

    selectedDate = button.dataset.date;
    renderCalendar();
    renderDayTasks();
  });
}

if (prevMonthButton) {
  prevMonthButton.addEventListener("click", () => {
    calendarMonth = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth() - 1,
      1
    );
    renderCalendar();
  });
}

if (nextMonthButton) {
  nextMonthButton.addEventListener("click", () => {
    calendarMonth = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth() + 1,
      1
    );
    renderCalendar();
  });
}

// 19. Firebase 로그인 상태 및 실시간 동기화
auth.onAuthStateChanged(async user => {
  const version = ++authVersion;

  stopListeners();

  currentUser = user;
  isAdmin = false;
  tasks = [];
  completionMap = {};

  updateAccessUI();
  render();

  if (!user) return;

  try {
    // 관리자 UID 확인
    const adminDoc = await db.collection("admins")
      .doc(user.uid)
      .get();

    if (version !== authVersion) return;

    isAdmin = adminDoc.exists;
    updateAccessUI();

    // 개인별 완료 상태 구독
    stopCompletionListener = db.collection("users")
      .doc(user.uid)
      .collection("completed")
      .onSnapshot(snapshot => {
        if (version !== authVersion) return;

        completionMap = {};

        snapshot.docs.forEach(doc => {
          completionMap[doc.id] = Boolean(doc.data().done);
        });

        tasks = tasks.map(task => ({
          ...task,
          done: Boolean(completionMap[task.id])
        }));

        render();
      }, error => {
        console.error("완료 상태 불러오기 오류:", error);
        showMessage("완료 상태를 불러오지 못했어요. Firestore 규칙을 확인해 주세요.");
      });

    // 공통 과제 실시간 구독
    stopAssignmentsListener = db.collection("assignments")
      .onSnapshot(snapshot => {
        if (version !== authVersion) return;

        tasks = snapshot.docs.map(doc => {
          const data = doc.data();

          return {
            id: doc.id,
            title: data.title || "",
            subject: data.subject || "기타",
            due: data.due || "",
            note: data.note || "",
            done: Boolean(completionMap[doc.id])
          };
        });

        render();
      }, error => {
        console.error("과제 불러오기 오류:", error);
        showMessage("과제를 불러오지 못했어요. Firestore 규칙을 확인해 주세요.");
      });

  } catch (error) {
    console.error("계정 권한 확인 오류:", error);

    if (version === authVersion) {
      isAdmin = false;
      updateAccessUI();
      showMessage("계정 권한을 확인하지 못했어요. admins 문서와 Firestore 규칙을 확인해 주세요.");
    }
  }
});

// 20. 처음 화면 표시
updateAccessUI();
render();