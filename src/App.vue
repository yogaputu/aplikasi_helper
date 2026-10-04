<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { clearToken, getAssignment, getAssignments, getStoredUser, getToken, loginDriver, saveProof, saveTracking, updateStatus } from './api';
import { currentPosition, normalizePosition } from './location';

const username = ref('');
const password = ref('');
const activeToken = ref(getToken());
const currentUser = ref(getStoredUser());
const loading = ref(false);
const errorMessage = ref('');
const assignments = ref([]);
const selected = ref(null);
const activeTab = ref('delivery');
const trackingEnabled = ref(false);
const receiverName = ref('');
const proofNotes = ref('');
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://58.147.185.142:9092';
let trackingTimer = null;

const today = new Date().toISOString().slice(0, 10);

const tabs = [
  { key: 'delivery', label: 'Kirim' },
  { key: 'return', label: 'Retur' }
];

const filteredAssignments = computed(() =>
  assignments.value.filter((item) => item.assignment_type === activeTab.value)
);

const activeTask = computed(() => selected.value || filteredAssignments.value[0] || null);

function statusLabel(status) {
  const labels = {
    scheduled: 'Terjadwal',
    loaded: 'Barang Dimuat',
    on_route: 'Dalam Perjalanan',
    arrived: 'Sampai Lokasi',
    delivered: 'Terkirim',
    failed: 'Gagal Kirim',
    return_pickup: 'Ambil Retur',
    return_picked: 'Retur Diambil',
    returned_to_warehouse: 'Retur Diterima Gudang'
  };
  return labels[status] || status || '-';
}

async function login() {
  if (!username.value.trim() || !password.value) {
    errorMessage.value = 'Username dan password wajib diisi.';
    return;
  }

  loading.value = true;
  errorMessage.value = '';
  try {
    const user = await loginDriver({
      username: username.value.trim(),
      password: password.value
    });
    currentUser.value = user;
    activeToken.value = user.token || getToken();
    password.value = '';
    await loadAssignments();
  } catch (error) {
    errorMessage.value = error?.response?.data?.message || 'Login gagal. Cek username dan password.';
  } finally {
    loading.value = false;
  }
}

function logout() {
  stopTracking();
  clearToken();
  activeToken.value = '';
  currentUser.value = null;
  username.value = '';
  password.value = '';
  assignments.value = [];
  selected.value = null;
}

async function loadAssignments() {
  if (!activeToken.value) return;
  loading.value = true;
  errorMessage.value = '';
  try {
    const data = await getAssignments({ date: today });
    assignments.value = Array.isArray(data) ? data : [];
    if (!activeTask.value && assignments.value.length) {
      selected.value = assignments.value[0];
    }
  } catch (error) {
    errorMessage.value = error?.response?.data?.message || 'Tugas belum bisa dimuat.';
  } finally {
    loading.value = false;
  }
}

async function openTask(row) {
  loading.value = true;
  errorMessage.value = '';
  try {
    selected.value = await getAssignment(row.id);
    receiverName.value = '';
    proofNotes.value = '';
  } catch (error) {
    errorMessage.value = error?.response?.data?.message || 'Detail tugas belum bisa dibuka.';
  } finally {
    loading.value = false;
  }
}

async function sendStatus(status) {
  if (!activeTask.value) return;
  loading.value = true;
  errorMessage.value = '';
  try {
    let location = {};
    try {
      location = normalizePosition(await currentPosition());
    } catch (error) {
      location = {};
    }
    selected.value = await updateStatus(activeTask.value.id, { status, ...location });
    await loadAssignments();
  } catch (error) {
    errorMessage.value = error?.response?.data?.message || 'Status belum bisa diperbarui.';
  } finally {
    loading.value = false;
  }
}

async function submitProof() {
  if (!activeTask.value) return;
  if (!receiverName.value.trim()) {
    errorMessage.value = activeTask.value.assignment_type === 'return'
      ? 'Nama penyerah retur wajib diisi.'
      : 'Nama penerima wajib diisi.';
    return;
  }

  loading.value = true;
  errorMessage.value = '';
  try {
    let location = {};
    try {
      location = normalizePosition(await currentPosition());
    } catch (error) {
      location = {};
    }
    selected.value = await saveProof(activeTask.value.id, {
      proof_type: activeTask.value.assignment_type === 'return' ? 'return' : 'delivery',
      receiver_name: receiverName.value.trim(),
      notes: proofNotes.value.trim(),
      ...location
    });
    await loadAssignments();
  } catch (error) {
    errorMessage.value = error?.response?.data?.message || 'Bukti belum bisa disimpan.';
  } finally {
    loading.value = false;
  }
}

async function pushLocation() {
  if (!activeTask.value || !trackingEnabled.value) return;
  try {
    const location = normalizePosition(await currentPosition());
    await saveTracking({
      id_assignment: activeTask.value.id,
      status: activeTask.value.status,
      ...location
    });
  } catch (error) {
    console.warn('GPS belum tersimpan', error);
  }
}

function startTracking() {
  if (!activeTask.value) {
    errorMessage.value = 'Pilih tugas terlebih dahulu.';
    return;
  }
  trackingEnabled.value = true;
  pushLocation();
  trackingTimer = window.setInterval(pushLocation, 30000);
}

function stopTracking() {
  trackingEnabled.value = false;
  if (trackingTimer) {
    window.clearInterval(trackingTimer);
    trackingTimer = null;
  }
}

function openMaps(task) {
  if (!task?.latitude || !task?.longitude) return;
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${task.latitude},${task.longitude}`, '_blank');
}

onMounted(loadAssignments);
onUnmounted(stopTracking);
</script>

<template>
  <main class="app-shell">
    <section v-if="!activeToken" class="login-screen">
      <div class="brand-mark">BD</div>
      <h1>Helper Driver</h1>
      <p>Masuk memakai akun driver atau helper Budimas untuk menerima tugas kirim dan retur.</p>
      <label>
        Username / Email / No HP
        <input v-model="username" autocomplete="username" placeholder="driver01" @keyup.enter="login" />
      </label>
      <label>
        Password
        <input v-model="password" type="password" autocomplete="current-password" placeholder="Password" @keyup.enter="login" />
      </label>
      <button class="primary" :disabled="loading" @click="login">{{ loading ? 'Masuk...' : 'Masuk' }}</button>
      <small>API default: {{ apiBaseUrl }}</small>
    </section>

    <template v-else>
      <header class="topbar">
        <div>
          <p>{{ currentUser?.nama_user || 'Budimas' }}</p>
          <h1>Helper Driver</h1>
        </div>
        <button class="ghost" @click="logout">Keluar</button>
      </header>

      <nav class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key; selected = null"
        >
          {{ tab.label }}
        </button>
      </nav>

      <section v-if="errorMessage" class="alert">{{ errorMessage }}</section>

      <section class="tracking-card">
        <div>
          <p>GPS Kendaraan</p>
          <strong>{{ trackingEnabled ? 'Aktif' : 'Nonaktif' }}</strong>
        </div>
        <button :class="trackingEnabled ? 'danger' : 'primary'" @click="trackingEnabled ? stopTracking() : startTracking()">
          {{ trackingEnabled ? 'Stop' : 'Mulai' }}
        </button>
      </section>

      <section class="task-list">
        <button
          v-for="task in filteredAssignments"
          :key="task.id"
          :class="['task-row', { selected: activeTask?.id === task.id }]"
          @click="openTask(task)"
        >
          <span>{{ task.no_reference }}</span>
          <strong>{{ task.customer_name }}</strong>
          <small>{{ statusLabel(task.status) }} - {{ task.item_count || 0 }} item</small>
        </button>
        <div v-if="!loading && !filteredAssignments.length" class="empty">Belum ada tugas {{ activeTab === 'return' ? 'retur' : 'pengiriman' }} hari ini.</div>
      </section>

      <section v-if="activeTask" class="detail">
        <div class="detail-head">
          <div>
            <p>{{ activeTask.assignment_type === 'return' ? 'Retur ACC' : 'Pengiriman' }}</p>
            <h2>{{ activeTask.customer_name }}</h2>
          </div>
          <span>{{ statusLabel(activeTask.status) }}</span>
        </div>

        <p class="address">{{ activeTask.address }}</p>
        <button class="secondary" :disabled="!activeTask.latitude || !activeTask.longitude" @click="openMaps(activeTask)">
          Navigasi
        </button>

        <div class="actions" v-if="activeTask.assignment_type === 'delivery'">
          <button @click="sendStatus('loaded')">Barang Dimuat</button>
          <button @click="sendStatus('on_route')">Berangkat</button>
          <button @click="sendStatus('arrived')">Sampai</button>
          <button class="danger" @click="sendStatus('failed')">Gagal</button>
        </div>

        <div class="actions" v-else>
          <button @click="sendStatus('return_pickup')">Menuju Retur</button>
          <button @click="sendStatus('arrived')">Sampai</button>
          <button @click="sendStatus('returned_to_warehouse')">Diterima Gudang</button>
        </div>

        <h3>Barang</h3>
        <ul class="items">
          <li v-for="item in activeTask.items || []" :key="item.id">
            <span>{{ item.product_name }}</span>
            <strong>{{ item.qty }} {{ item.unit }}</strong>
          </li>
        </ul>

        <h3>Bukti</h3>
        <label>
          {{ activeTask.assignment_type === 'return' ? 'Nama Penyerah' : 'Nama Penerima' }}
          <input v-model="receiverName" placeholder="Nama lengkap" />
        </label>
        <label>
          Catatan
          <textarea v-model="proofNotes" rows="3" placeholder="Catatan kondisi barang, kendala, atau info penerima"></textarea>
        </label>
        <button class="primary full" :disabled="loading" @click="submitProof">
          {{ activeTask.assignment_type === 'return' ? 'Simpan Bukti Retur' : 'Simpan Bukti Kirim' }}
        </button>
      </section>
    </template>
  </main>
</template>
