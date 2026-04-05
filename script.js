const API_URL = 'http://localhost:3000';
let allCustomers = [];
let allNotes = [];
let lineChartInstance = null;
let donutChartInstance = null;
let currentCalendarDate = new Date();

// --- LOGIN ---
function login() {
  const username = document.getElementById('username')?.value.trim();
  const password = document.getElementById('password')?.value;

  if (!username || !password) {
    alert('Please enter username and password.');
    return;
  }

  fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        window.location.href = 'dashboard.html';
      } else {
        alert('Invalid login: check username/password');
      }
    })
    .catch((err) => {
      console.error('Login request failed', err);
    });
}

// --- SPA VIEW ROUTING ---
function switchView(viewId, element) {
  document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
  document.getElementById(viewId).classList.remove('hidden');
  
  if (element) {
    document.querySelectorAll('.nav-items a').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
  }

  if (viewId === 'dashboardView') {
    renderCharts();
  } else if (viewId === 'calendarView') {
    renderCalendar();
  } else if (viewId === 'settingsView') {
    loadSettingsData();
  }
}

// --- SETTINGS VIEW LOGIC ---
async function loadSettingsData() {
  try {
    // Load Users
    const resUsers = await fetch(`${API_URL}/users`);
    const users = await resUsers.json();
    const uBody = document.getElementById('userTableBody');
    if (uBody) {
      uBody.innerHTML = users.map(u => `
        <tr>
          <td>${u.username}</td>
          <td><span style="padding:4px 8px; border-radius:4px; font-size:0.75rem; background:${u.role === 'Admin' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)'}; color:${u.role === 'Admin' ? 'var(--warning)' : 'var(--text-muted)'};">${u.role}</span></td>
          <td><span style="color:${u.status === 'Active' ? 'var(--success)' : 'var(--danger)'}">${u.status}</span></td>
          <td><button class="icon-btn" style="width:auto; padding:4px 8px;" onclick="toggleUserStatus(${u.id}, '${u.status}')">${u.status === 'Active' ? 'Deactivate' : 'Activate'}</button></td>
        </tr>
      `).join('');
    }

    // Load History
    const resHistory = await fetch(`${API_URL}/loginHistory`);
    const history = await resHistory.json();
    const hBody = document.getElementById('loginHistoryBody');
    if (hBody) {
      hBody.innerHTML = history.map(h => {
        const t = new Date(h.login_time).toLocaleString();
        const sc = h.status === 'Success' ? 'var(--success)' : 'var(--danger)';
        return `<tr><td style="font-size:0.8rem; color:var(--text-muted);">${t}</td><td>${h.username}</td><td style="color:${sc};">${h.status}</td></tr>`;
      }).join('');
    }
  } catch (e) {
    console.error('Failed to load settings data', e);
  }
}

async function addNewUser() {
  const userStr = document.getElementById('newUsername').value;
  const passStr = document.getElementById('newPassword').value;
  const roleStr = document.getElementById('newRole').value;

  if(!userStr || !passStr) return alert("Missing user or pass");

  await fetch(`${API_URL}/addUser`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: userStr, password: passStr, role: roleStr, status: 'Active' })
  });
  
  document.getElementById('newUsername').value = '';
  document.getElementById('newPassword').value = '';
  loadSettingsData(); // refresh the interface instantly
}

async function toggleUserStatus(id, currentStatus) {
  const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
  await fetch(`${API_URL}/updateUserStatus`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status: newStatus })
  });
  loadSettingsData();
}

// --- INITIAL LOAD & CLOCK ---
window.onload = () => {
  if (document.getElementById('dashboardView')) {
    loadCustomers();
  }
};

setInterval(() => {
  const clock = document.getElementById('realtimeClock');
  if(clock) {
    clock.innerText = new Date().toLocaleTimeString('en-US');
  }
}, 1000);

async function loadCustomers() {
  try {
    const res = await fetch(`${API_URL}/customers`);
    allCustomers = await res.json();
    
    const notesRes = await fetch(`${API_URL}/notes`);
    allNotes = await notesRes.json();
    
    updateDashboardStats();
    renderCharts();
    filterTable(); 
    renderCalendar();
  } catch (err) {
    console.error("Failed to load customers", err);
  }
}

// --- CALENDAR LOGIC ---
function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  if(!grid) return;
  grid.innerHTML = '';

  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  const today = new Date();

  document.getElementById('currentMonthYear').innerText = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for(let i=0; i<firstDay; i++){
    const cell = document.createElement('div');
    cell.className = 'calendar-day empty';
    grid.appendChild(cell);
  }

  for(let d=1; d<=daysInMonth; d++){
    const cell = document.createElement('div');
    cell.className = 'calendar-day';
    if(d === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
      cell.classList.add('today');
    }

    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    
    const leadsOnDay = allCustomers.filter(c => {
      if(!c.created_at) return false;
      return c.created_at.startsWith(dateStr);
    });

    let leadsHtml = '';
    const maxShow = 2;
    leadsOnDay.slice(0, maxShow).forEach(l => {
      leadsHtml += `<div class="calendar-lead-badge">${l.name}</div>`;
    });
    if(leadsOnDay.length > maxShow){
      leadsHtml += `<div class="calendar-lead-badge" style="background:var(--border-light);">+${leadsOnDay.length - maxShow} more</div>`;
    }

    const noteObj = allNotes.find(n => n.id_date === dateStr);
    const hasNoteClass = noteObj && noteObj.content.trim() !== '' ? 'has-note' : '';
    const noteIcon = noteObj && noteObj.content.trim() !== '' ? '📝' : '➕';

    cell.innerHTML = `
      <div class="day-number">${d}</div>
      <div class="leads-container">${leadsHtml}</div>
      <button class="note-toggle ${hasNoteClass}" onclick="openNoteModal('${dateStr}')">${noteIcon}</button>
    `;
    grid.appendChild(cell);
  }
}

function prevMonth() {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
  renderCalendar();
}
function nextMonth() {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
  renderCalendar();
}

function openNoteModal(dateStr) {
  document.getElementById('noteTargetDate').value = dateStr;
  document.getElementById('noteDateDisplay').innerText = `Date: ${dateStr}`;
  
  const noteObj = allNotes.find(n => n.id_date === dateStr);
  document.getElementById('dailyNoteText').value = noteObj ? noteObj.content : '';
  
  document.getElementById('noteModal').classList.remove('hidden');
}

function closeNoteModal() {
  document.getElementById('noteModal').classList.add('hidden');
}

async function saveDailyNote() {
  const dateStr = document.getElementById('noteTargetDate').value;
  const content = document.getElementById('dailyNoteText').value;

  try {
    await fetch(`${API_URL}/saveNote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_date: dateStr, content })
    });
    const res = await fetch(`${API_URL}/notes`);
    allNotes = await res.json();
    renderCalendar();
    closeNoteModal();
  } catch(e) {
    alert('Failed to save note.');
  }
}

// --- DASHBOARD AGGREGATIONS ---
function updateDashboardStats() {
  document.getElementById('stat-total').innerText = allCustomers.length;
  
  let pipelineValue = 0;
  let newLeads = 0;
  let convertedLeads = 0;

  allCustomers.forEach(c => {
    pipelineValue += parseFloat(c.value) || 0;
    if (c.status === 'New') newLeads++;
    if (c.status === 'Converted') convertedLeads++;
  });

  const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits:0 });
  document.getElementById('stat-value').innerText = formatter.format(pipelineValue);
  document.getElementById('stat-new').innerText = newLeads;
  document.getElementById('stat-converted').innerText = convertedLeads;
}

// --- CHART.JS RENDERING ---
function renderCharts() {
  const lineCtx = document.getElementById('lineChart');
  const donutCtx = document.getElementById('donutChart');
  if(!lineCtx || !donutCtx) return;

  const today = new Date();
  const labels = [];
  const lineData = [];
  for(let i=6; i>=0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      labels.push(d.toISOString().split('T')[0]);
      lineData.push(Math.floor(Math.random() * 5) + 1); 
  }

  if(lineChartInstance) lineChartInstance.destroy();
  lineChartInstance = new Chart(lineCtx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Lead Acquisition',
        data: lineData,
        borderColor: '#8B5CF6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#8B5CF6'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });

  const sourceCounts = { 'Website':0, 'Referral':0, 'Social':0, 'Cold Call':0 };
  allCustomers.forEach(c => {
    const sourceKey = (c.source || 'Website').trim();
    const normalizedSource = sourceKey === 'Cold' ? 'Cold Call' : sourceKey;
    if(sourceCounts[normalizedSource] !== undefined) sourceCounts[normalizedSource]++;
    else sourceCounts['Website']++;
  });

  if(donutChartInstance) donutChartInstance.destroy();
  donutChartInstance = new Chart(donutCtx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(sourceCounts),
      datasets: [{
        data: Object.values(sourceCounts),
        backgroundColor: ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94A3B8', boxWidth: 12 } }
      },
      cutout: '75%'
    }
  });
}

// --- ALL LEADS TABLE & FILTERS ---
function filterTable() {
  const searchQ = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const statusQ = document.getElementById('statusFilter')?.value || 'All';
  let sourceQ = document.getElementById('sourceFilter')?.value || 'All';
  if (sourceQ === 'Cold') sourceQ = 'Cold Call';

  const tbody = document.getElementById('tableBody');
  if(!tbody) return;
  tbody.innerHTML = '';

  let filtered = allCustomers.filter(c => {
    const searchStr = `${c.name} ${c.email} ${c.company}`.toLowerCase();
    const matchSearch = searchStr.includes(searchQ);
    const matchStatus = statusQ === 'All' || c.status === statusQ;
    const matchSource = sourceQ === 'All' || c.source === sourceQ;
    return matchSearch && matchStatus && matchSource;
  });

  document.getElementById('totalRecordsText').innerText = `${filtered.length} total records found`;

  filtered.forEach(c => {
    const statusClass = getStatusClass(c.status);
    const dateFormatted = c.created_at ? c.created_at.split('T')[0] : 'Today';
    const valFormatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(c.value||0));
    
    let dueStr = '';
    let isWarning = false;
    if (c.due_date) {
        const dueDateObj = new Date(c.due_date);
        const todayObj = new Date();
        if (dueDateObj < todayObj && c.status !== 'Converted' && c.status !== 'Lost') isWarning = true;
        dueStr = ` <br><span style="font-size:0.7rem; color:${isWarning ? 'var(--warning)' : 'var(--text-muted)'}">Due: ${c.due_date.split('T')[0]}</span>`;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="lead-cell">
          <div class="lead-avatar" style="${isWarning ? 'box-shadow: 0 0 10px var(--warning); border:1px solid var(--warning);' : ''}">${getAvatarInitials(c.name)}</div>
          <div class="lead-info">
            <strong style="color:${isWarning ? 'var(--warning)' : 'var(--text-main)'}">${c.name}</strong>
            <span>${c.email}</span>
          </div>
        </div>
      </td>
      <td style="color:var(--primary-light); font-weight:600;">${valFormatted}</td>
      <td>${c.company || 'N/A'}</td>
      <td>
        <div class="source-badge">
          <span style="color:var(--text-muted)">•</span> ${c.source || 'Website'}
        </div>
      </td>
      <td>
        <div class="status-badge ${statusClass}">${c.status || 'New'}</div>
      </td>
      <td style="color:var(--text-muted); font-size:0.8rem;">
        ${dateFormatted}
        ${dueStr}
      </td>
      <td>
        <div class="row-actions">
          <button class="icon-btn">✏️</button>
          <button class="icon-btn delete" onclick="handleDelete(${c.id})">🗑️</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// --- MODAL CONTROLS & HELPERS ---
function getStatusClass(status) {
  if(status === 'New') return 'status-new';
  if(status === 'Contacted' || status === 'Qualified' || status === 'In Progress') return 'status-contacted';
  if(status === 'Converted') return 'status-converted';
  if(status === 'Lost') return 'status-lost';
  return 'status-new';
}

function getAvatarInitials(name) {
  if(!name) return '??';
  const parts = name.split(' ');
  if(parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function openAddModal() {
  document.getElementById('addModal').classList.remove('hidden');
}

function closeAddModal() {
  document.getElementById('addModal').classList.add('hidden');
}

async function submitLead() {
  const customer = {
    name: document.getElementById('add-name').value,
    email: document.getElementById('add-email').value,
    company: document.getElementById('add-company').value,
    phone: document.getElementById('add-phone').value,
    value: document.getElementById('add-value').value || 0,
    due_date: document.getElementById('add-due-date')?.value || null,
    source: document.getElementById('add-source').value || 'Website',
    status: document.getElementById('add-status').value || 'New'
  };
  
  try {
    await fetch(`${API_URL}/addCustomer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customer)
    });
    
    document.getElementById('add-name').value = '';
    document.getElementById('add-email').value = '';
    document.getElementById('add-company').value = '';
    document.getElementById('add-phone').value = '';
    document.getElementById('add-value').value = '';
    if(document.getElementById('add-due-date')) document.getElementById('add-due-date').value = '';
    
    closeAddModal();
    loadCustomers();
  } catch (e) {
    alert('Failed to add lead');
  }
}

async function handleDelete(id) {
  if(!confirm('Are you sure you want to delete this lead?')) return;
  try {
    await fetch(`${API_URL}/delete/${encodeURIComponent(id)}`, { method: 'DELETE' });
    loadCustomers();
  } catch(e) {
    alert('Failed to delete lead');
  }
}