// Upload-kø-status (#50): ét fælles sted at gemme/læse det aktive batch-jobId.
// Scan-siden skriver via hjælperne her, og Navbar-indikatoren (og andre
// klienter) læser samme nøgle — så køens status kan ses fra alle menus.
//
// sessionStorage (ikke localStorage): jobbet følger fanens levetid, samme
// mønster som Scan-sidens genoptagelses-logik.

const ACTIVE_BATCH_JOB_KEY = "activeBatchJobId";

/** Custom event der udløses når det aktive jobId ændres (start/slut/annulleret). */
export const UPLOAD_QUEUE_CHANGED_EVENT = "upload-queue-changed";

/** Læs det aktive batch-jobId for denne fane (null hvis intet kører). */
export function getActiveBatchJobId(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_BATCH_JOB_KEY);
  } catch {
    return null;
  }
}

/** Registrér et nyt aktivt batch-job og underret lyttere. */
export function setActiveBatchJob(jobId: string): void {
  try {
    sessionStorage.setItem(ACTIVE_BATCH_JOB_KEY, jobId);
  } catch {
    /* sessionStorage kan være blokeret */
  }
  notifyQueueChanged();
}

/** Fjern det aktive job (færdigt/annulleret/ukendt) og underret lyttere. */
export function clearActiveBatchJob(): void {
  try {
    sessionStorage.removeItem(ACTIVE_BATCH_JOB_KEY);
  } catch {
    /* sessionStorage kan være blokeret */
  }
  notifyQueueChanged();
}

function notifyQueueChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(UPLOAD_QUEUE_CHANGED_EVENT));
}
