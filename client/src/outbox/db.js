import { openDB } from 'idb';

const DB_NAME = 'swasthasetu_offline_db';
const DB_VERSION = 1;

export async function getLocalDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // 1. Outbox store for pending sync actions
      if (!db.objectStoreNames.contains('outbox')) {
        const outboxStore = db.createObjectStore('outbox', { keyPath: 'id' });
        outboxStore.createIndex('by_status', 'status');
        outboxStore.createIndex('by_type', 'type');
        outboxStore.createIndex('by_created', 'createdAt');
      }

      // 2. Cases cache for offline access
      if (!db.objectStoreNames.contains('cases')) {
        const caseStore = db.createObjectStore('cases', { keyPath: 'id' });
        caseStore.createIndex('by_urgency', 'urgency');
        caseStore.createIndex('by_patient', 'patient_id');
      }

      // 3. Messages cache
      if (!db.objectStoreNames.contains('messages')) {
        const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
        msgStore.createIndex('by_case', 'case_id');
        msgStore.createIndex('by_created', 'created_at');
      }
    }
  });
}

// Outbox Operations
export async function enqueueOutboxItem(item) {
  const db = await getLocalDB();
  const outboxEntry = {
    id: item.id || `outbox_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    type: item.type, // 'case', 'message', 'advice', 'upload_chunk'
    endpoint: item.endpoint,
    method: item.method || 'POST',
    payload: item.payload,
    status: 'pending', // 'pending', 'sending', 'sent', 'failed'
    attempts: 0,
    lastError: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  await db.put('outbox', outboxEntry);
  return outboxEntry;
}

export async function getPendingOutboxItems() {
  const db = await getLocalDB();
  const all = await db.getAllFromIndex('outbox', 'by_status', 'pending');
  return all;
}

export async function getOutboxCount() {
  const db = await getLocalDB();
  const pending = await db.getAllFromIndex('outbox', 'by_status', 'pending');
  return pending.length;
}

export async function updateOutboxItemStatus(id, status, error = null) {
  const db = await getLocalDB();
  const item = await db.get('outbox', id);
  if (item) {
    item.status = status;
    item.updatedAt = Date.now();
    if (error) {
      item.attempts += 1;
      item.lastError = error;
    }
    await db.put('outbox', item);
  }
}

export async function removeOutboxItem(id) {
  const db = await getLocalDB();
  await db.delete('outbox', id);
}

// Caching Operations for 100% Offline Viewing
export async function saveCasesLocally(casesList = []) {
  const db = await getLocalDB();
  const tx = db.transaction('cases', 'readwrite');
  for (const c of casesList) {
    await tx.store.put(c);
  }
  await tx.done;
}

export async function getLocalCases() {
  const db = await getLocalDB();
  return db.getAll('cases');
}

export async function saveMessagesLocally(caseId, messagesList = []) {
  const db = await getLocalDB();
  const tx = db.transaction('messages', 'readwrite');
  for (const m of messagesList) {
    await tx.store.put(m);
  }
  await tx.done;
}

export async function getLocalMessages(caseId) {
  const db = await getLocalDB();
  return db.getAllFromIndex('messages', 'by_case', caseId);
}
