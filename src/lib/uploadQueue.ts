// Upload-kø-status (#50): ét fælles sted at gemme/læse det aktive batch-jobId.
// Hver person har sin egen slot, så flere familiemedlemmer kan have kørende
// uploads samtidig — indikatoren i Navbar og Scan-siden viser altid den
// valgte persons kø. Scan-siden skriver via hjælperne her, og
// Navbar-indikatoren læser samme slot — så status kan ses fra alle menus.
//
// sessionStorage (ikke localStorage): jobbet følger fanens levetid, samme
// mønster som Scan-sidens genoptagelses-logik.

const ACTIVE_BATCH_JOB_KEY_PREFIX = "activeBatchJobId:";
// Gammelt nøgleformat fra før køen blev pr. person — migreres ved læsning
const LEGACY_ACTIVE_BATCH_JOB_KEY = "activeBatchJobId";
const SELECTED_PERSON_KEY = "selectedPersonId";

/** Custom event der udløses når det aktive jobId ændres (start/slut/annulleret). */
export const UPLOAD_QUEUE_CHANGED_EVENT = "upload-queue-changed";

/** Custom event der udløses når den valgte person ændres. */
export const SELECTED_PERSON_CHANGED_EVENT = "selected-person-changed";

function jobKey(personId: string): string {
  return `${ACTIVE_BATCH_JOB_KEY_PREFIX}${personId}`;
}

/** Læs den valgte persons id (null hvis ingen er valgt endnu). */
export function getSelectedPersonId(): string | null {
  try {
    return localStorage.getItem(SELECTED_PERSON_KEY);
  } catch {
    return null;
  }
}

/** Skift valgt person og underret lyttere (kø-indikatoren følger med). */
export function setSelectedPersonId(personId: string): void {
  try {
    localStorage.setItem(SELECTED_PERSON_KEY, personId);
  } catch {
    /* lager kan være blokeret */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SELECTED_PERSON_CHANGED_EVENT));
  }
}

/** Læs det aktive batch-jobId for en person (null hvis intet kører). */
export function getActiveBatchJobId(personId: string | null): string | null {
  if (!personId) return null;
  try {
    const scoped = sessionStorage.getItem(jobKey(personId));
    if (scoped) return scoped;

    // Én gammel nøgle fra før opdelingen pr. person — flyt den til slotten
    const legacy = sessionStorage.getItem(LEGACY_ACTIVE_BATCH_JOB_KEY);
    if (legacy) {
      sessionStorage.removeItem(LEGACY_ACTIVE_BATCH_JOB_KEY);
      sessionStorage.setItem(jobKey(personId), legacy);
      return legacy;
    }
    return null;
  } catch {
    return null;
  }
}

/** Registrér et nyt aktivt batch-job for en person og underret lyttere. */
export function setActiveBatchJob(personId: string | null, jobId: string): void {
  if (!personId) return;
  try {
    sessionStorage.setItem(jobKey(personId), jobId);
  } catch {
    /* sessionStorage kan være blokeret */
  }
  notifyQueueChanged();
}

/** Fjern personens aktive job (færdigt/annulleret/ukendt) og underret lyttere. */
export function clearActiveBatchJob(personId: string | null): void {
  if (!personId) return;
  try {
    sessionStorage.removeItem(jobKey(personId));
  } catch {
    /* sessionStorage kan være blokeret */
  }
  notifyQueueChanged();
}

function notifyQueueChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(UPLOAD_QUEUE_CHANGED_EVENT));
}
