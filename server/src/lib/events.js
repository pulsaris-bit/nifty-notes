// In-memory pub/sub for SSE broadcast + presence tracker.
// Lives in the API process; restarts wipe state (acceptable for this use case).

// userId -> Set<{ res, deviceId }>
const subscribers = new Map();

// noteId -> Map<userId, { displayName, devices: Map<deviceId, lastSeen> }>
const presence = new Map();

const HEARTBEAT_MS = 25_000;
const PRESENCE_TIMEOUT_MS = 45_000;

export function subscribe(userId, deviceId, res) {
  if (!subscribers.has(userId)) subscribers.set(userId, new Set());
  const entry = { res, deviceId };
  subscribers.get(userId).add(entry);

  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* ignore */ }
  }, HEARTBEAT_MS);

  const cleanup = () => {
    clearInterval(heartbeat);
    const set = subscribers.get(userId);
    if (set) {
      set.delete(entry);
      if (set.size === 0) subscribers.delete(userId);
    }
    // Drop presence registered by this device
    removeDevicePresence(userId, deviceId);
  };
  res.on('close', cleanup);
  res.on('error', cleanup);
  return cleanup;
}

export function publish(userIds, event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const uid of new Set(userIds)) {
    const set = subscribers.get(uid);
    if (!set) continue;
    for (const { res } of set) {
      try { res.write(data); } catch { /* ignore */ }
    }
  }
}

// ---------- Presence ----------

export function setPresence(noteId, userId, deviceId, displayName) {
  if (!noteId) return;
  if (!presence.has(noteId)) presence.set(noteId, new Map());
  const noteMap = presence.get(noteId);
  if (!noteMap.has(userId)) noteMap.set(userId, { displayName, devices: new Map() });
  noteMap.get(userId).devices.set(deviceId, Date.now());
  noteMap.get(userId).displayName = displayName;
}

// Remove this device's presence on every note it touched.
export function removeDevicePresence(userId, deviceId) {
  const affected = new Set();
  for (const [noteId, noteMap] of presence) {
    const u = noteMap.get(userId);
    if (!u) continue;
    if (u.devices.delete(deviceId) && u.devices.size === 0) {
      noteMap.delete(userId);
      if (noteMap.size === 0) presence.delete(noteId);
    }
    affected.add(noteId);
  }
  return [...affected];
}

// Remove presence for one specific (user,device) on one note.
export function clearPresenceForNote(noteId, userId, deviceId) {
  const noteMap = presence.get(noteId);
  if (!noteMap) return false;
  const u = noteMap.get(userId);
  if (!u) return false;
  const had = u.devices.delete(deviceId);
  if (u.devices.size === 0) noteMap.delete(userId);
  if (noteMap.size === 0) presence.delete(noteId);
  return had;
}

export function listViewers(noteId) {
  const noteMap = presence.get(noteId);
  if (!noteMap) return [];
  const now = Date.now();
  const viewers = [];
  for (const [userId, data] of noteMap) {
    // Filter stale devices
    for (const [dev, last] of data.devices) {
      if (now - last > PRESENCE_TIMEOUT_MS) data.devices.delete(dev);
    }
    if (data.devices.size === 0) {
      noteMap.delete(userId);
      continue;
    }
    viewers.push({ userId, displayName: data.displayName });
  }
  if (noteMap.size === 0) presence.delete(noteId);
  return viewers;
}

// Periodic sweep — removes stale devices and emits presence.changed events
// for any note whose viewer list shrank.
export function startPresenceSweeper(getRecipients) {
  setInterval(async () => {
    const changedNotes = [];
    for (const [noteId, noteMap] of presence) {
      const before = totalDevices(noteMap);
      listViewers(noteId); // side effect: prunes stale
      const after = presence.get(noteId) ? totalDevices(presence.get(noteId)) : 0;
      if (before !== after) changedNotes.push(noteId);
    }
    for (const noteId of changedNotes) {
      try {
        const recipients = await getRecipients(noteId);
        publish(recipients, {
          type: 'presence.changed',
          noteId,
          viewers: listViewers(noteId),
        });
      } catch { /* ignore */ }
    }
  }, 15_000).unref();
}

function totalDevices(noteMap) {
  let n = 0;
  for (const u of noteMap.values()) n += u.devices.size;
  return n;
}
