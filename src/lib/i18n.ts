// i18n (#24): danske/engelske tekster + ren oversættelses-hjælper.
// Bevidst UDEN React-importer, så ren lib-kode (exporters m.m.) også kan bruge translate().
// React-delen (provider + hook) ligger i src/lib/I18nProvider.tsx.

import {
  SYSTOLIC_MIN,
  SYSTOLIC_MAX,
  DIASTOLIC_MIN,
  DIASTOLIC_MAX,
  PULSE_MIN,
  PULSE_MAX,
  AGE_MIN,
  AGE_MAX,
  NOTE_MAX_LENGTH,
  BIRTH_YEAR_MIN,
  MEDICATION_NAME_MAX_LENGTH,
  MEDICATION_DOSE_MAX_LENGTH,
} from "./validation";

export type Locale = "da" | "en";
export const LOCALES: Locale[] = ["da", "en"];
/** localStorage-nøgle for valgt sprog */
export const LANG_STORAGE_KEY = "lang";
/** Intl-lokalstreng pr. sprog (datoer/tider formateres med disse) */
export const INTL_LOCALE: Record<Locale, string> = { da: "da-DK", en: "en-GB" };

const da: Record<string, string> = {
  // Nav + indstillinger
  "nav.dashboard": "Dashboard",
  "nav.scan": "Ny måling",
  "nav.readings": "Målinger",
  "nav.trends": "Tendenser",
  "nav.persons": "Personer",
  "nav.settings": "Indstillinger",
  "settings.theme": "Tema",
  "settings.light": "Lys",
  "settings.dark": "Mørk",
  "settings.system": "System",
  "settings.language": "Sprog",
  "settings.danish": "Dansk",
  "settings.english": "Engelsk",
  "settings.reminder": "Daglig påmindelse",
  "settings.remindMe": "Påmind mig",
  "settings.reminderOn": "Påmindelse slået til",
  "settings.reminderOff": "Påmindelse slået fra",
  "settings.time": "Tidspunkt",
  "settings.notificationsBlocked":
    "Notifikationer er blokeret i din browser – påmindelsen vises som banner på forsiden.",

  // Påmindelser
  "reminder.notificationTitle": "📏 Tid til at måle blodtryk",
  "reminder.notificationBody": "Din daglige blodtryksmåling venter – det tager kun et minut.",
  "reminder.bannerTitle": "Påmindelse om måling",
  "reminder.bannerText": "Tid til at måle blodtryk",
  "reminder.measureNow": "Mål nu",
  "reminder.dismissLong": "Afvis påmindelse for i dag",
  "reminder.dismissShort": "Afvis for i dag",

  // Fælles
  "common.save": "Gem",
  "common.saving": "Gemmer...",
  "common.cancel": "Annuller",
  "common.delete": "Slet",
  "common.edit": "Rediger",
  "common.backup": "Backup",
  "common.restore": "Gendan",
  "common.close": "Luk",
  "common.add": "Tilføj",
  "common.back": "Tilbage",
  "common.retry": "Prøv igen",
  "common.loading": "Indlæser...",
  "common.error": "Fejl",
  "common.unknownError": "Ukendt fejl",

  // Felter
  "field.systolic": "Systolisk",
  "field.diastolic": "Diastolisk",
  "field.map": "MAP",
  "field.pulse": "Puls",
  "field.note": "Note",
  "field.date": "Dato",
  "field.time": "Tid",
  "field.age": "Alder",
  "field.bpm": "slag/min",
  "field.mmHg": "mmHg",

  // Antalsformer
  "count.readingsOne": "1 måling",
  "count.readingsMany": "{count} målinger",
  "count.imagesOne": "1 billede",
  "count.imagesMany": "{count} billeder",
  "count.classified": "{count} målinger klassificeret",

  // Kontekst-tags
  "tags.timeLabel": "Tidspunkt",
  "tags.armLabel": "Arm",
  "tod.morning": "Morgen",
  "tod.evening": "Aften",
  "tod.morningEmoji": "🌅 Morgen",
  "tod.eveningEmoji": "🌙 Aften",
  "tod.morningTitle": "Målt om morgenen",
  "tod.eveningTitle": "Målt om aftenen",
  "arm.left": "Venstre arm",
  "arm.right": "Højre arm",
  "arm.leftShort": "V",
  "arm.rightShort": "H",
  "arm.leftName": "Venstre",
  "arm.rightName": "Højre",

  // Klassificering (labels vælges pr. aldersgruppe af bpClassification)
  "bp.normal.label": "Normal",
  "bp.crisis.label": "Krise",
  "bp.crisis.desc": "Søg øjeblikkelig lægehjælp",
  "bp.normal.desc": "Blodtrykket er normalt",
  "bp.normalOld.desc": "Blodtrykket er normalt for din alder",
  "bp.young.elevated.label": "Forhøjet",
  "bp.young.elevated.desc": "Let forhøjet — overvej livsstilsændringer",
  "bp.young.stage1.label": "Let forhøjet",
  "bp.young.stage1.desc": "Hypertension stadium 1 — tal med læge",
  "bp.young.stage2.label": "Forhøjet stadium 2",
  "bp.young.stage2.desc": "Hypertension stadium 2 — kontakt læge",
  "bp.middle.elevated.label": "Let forhøjet",
  "bp.middle.elevated.desc": "Acceptabelt for din alder — følg med",
  "bp.middle.stage1.label": "Forhøjet",
  "bp.middle.stage1.desc": "Overvej behandling — tal med læge",
  "bp.middle.stage2.label": "Højt",
  "bp.middle.stage2.desc": "Kontakt læge for behandling",
  "bp.old.elevated.label": "Acceptabelt",
  "bp.old.elevated.desc": "Acceptabelt for din alder — følg med",
  "ageGroup.under65": "Under 65 år",
  "ageGroup.65to79": "65-79 år",
  "ageGroup.over80": "80+ år",

  // Fejlkoder fra API'en (serveren returnerer kun nøglen)
  "err.invalidRequestFormat": "Ugyldigt anmodningsformat",
  "err.personIdRequired": "personId er påkrævet",
  "err.invalidPersonId": "Ugyldigt personId",
  "err.personNotFound": "Personen findes ikke",
  "err.invalidJson": "Ugyldigt JSON-format",
  "err.readingNotFound": "Målingen findes ikke",
  "err.readingSaveFailed": "Kunne ikke gemme måling",
  "err.readingUpdateFailed": "Kunne ikke opdatere måling",
  "err.personCreateFailed": "Kunne ikke oprette person",
  "err.personUpdateFailed": "Kunne ikke opdatere person",
  "err.personDeleteFailed": "Kunne ikke slette person",
  "err.medicationNotFound": "Medicin blev ikke fundet",
  "err.medicationCreateFailed": "Kunne ikke tilføje medicin",
  "err.medicationUpdateFailed": "Kunne ikke opdatere medicin",
  "err.medicationDeleteFailed": "Kunne ikke slette medicin",
  "err.invalidId": "Ugyldigt ID",
  "err.nameRequired": "Navn er påkrævet",
  "err.nameTooLong": "Navn er påkrævet (højst {nameMax} tegn)",
  "err.doseTooLong": "Dosis er påkrævet (højst {doseMax} tegn)",
  "err.noFieldsToUpdate": "Angiv mindst ét felt at opdatere (navn eller fødselsår)",
  "err.noFieldsToUpdateGeneric": "Angiv mindst ét felt at opdatere",
  "err.cannotDeleteStandard": "Kan ikke slette Standard-personen",
  "err.activeMustBeBoolean": "active skal være true eller false",
  "err.invalidStartDate": "Ugyldig startdato",
  "err.invalidEndDate": "Ugyldig slutdato",
  "err.daysMustBeValid": "days skal være 7, 30, 90 eller 'all'",
  "err.invalidSystolic": "Systolisk skal være et heltal mellem {sysMin} og {sysMax}",
  "err.invalidDiastolic": "Diastolisk skal være et heltal mellem {diaMin} og {diaMax}",
  "err.invalidPulse": "Puls skal være et heltal mellem {pulseMin} og {pulseMax}",
  "err.systolicMustExceedDiastolic": "Systolisk skal være højere end diastolisk",
  "err.invalidNoteType": "Note skal være en tekststreng",
  "err.noteTooLong": "Note må højst være {noteMax} tegn",
  "err.invalidAge": "Alder skal være et heltal mellem {ageMin} og {ageMax}",
  "err.invalidImageType": "Billede skal være en tekststreng (data-URL)",
  "err.invalidTimeOfDayValue": "Tidspunkt skal være 'morning' eller 'evening'",
  "err.invalidArmValue": "Arm skal være 'left' eller 'right'",
  "err.createdAtRequiredFormat": "Tidspunkt skal være en dato/tid (ISO-format)",
  "err.invalidCreatedAt": "Ugyldigt tidspunkt — angiv en gyldig dato og tid",
  "err.createdAtInFuture": "Tidspunktet kan ikke ligge i fremtiden",
  "err.birthYearRange": "Årstal skal være mellem {yearMin} og {yearMax}",
  "err.noImageProvided": "Intet billede modtaget",
  "err.imageTooSmall": "Billedet er for lille eller utydeligt. Prøv igen med bedre lysning.",
  "err.scanCouldNotParse": "Kunne ikke aflæse svaret fra AI'en",
  "err.scanInvalidFormat": "Ugyldigt format på den scannede måling",
  "err.scanParseFailed": "Kunne ikke tolke svaret fra AI'en",
  "err.scanFailed": "Scan fejlede",
  "err.batchJobFailed": "Kunne ikke starte scanning på serveren",
  "err.ollamaOffline": "Ollama svarer ikke — AI-serveren kører ikke",
  "err.ollamaModelMissing": "AI-modellen glm-ocr findes ikke på Ollama-serveren. Kør: ollama pull glm-ocr",
  "err.duplicateImageDetected": "Dette billede er allerede uploadet for denne person.",
  "err.tooManyImages": "For mange billeder i én upload (maks. 50)",
  "err.unknown": "Ukendt fejl",
  "err.fetchMedicationsFailed": "Kunne ikke hente medicin",

  // Kamera
  "camera.open": "Åbn kamera",
  "camera.starting": "Starter kamera...",
  "camera.capture": "Tag billede",
  "camera.denied": "Kameraadgang nægtet. Åbn browserindstillinger og tillad kamera for denne side.",
  "camera.unavailable": "Kamera ikke tilgængeligt. Tillad kameradgang i browseren.",

  // Scan-side
  "scan.title": "Ny måling",
  "scan.tabCamera": "Kamera",
  "scan.tabUpload": "Upload",
  "scan.tabManual": "Manuel",
  "scan.choosePersonTitle": "Vælg en person",
  "scan.choosePersonDesc": "Du skal vælge en person før du kan scanne målinger.",
  "scan.goToPersons": "Gå til personer",
  "scan.reviewPrompt": "Tjek billedet inden AI-scanning:",
  "scan.scanWithAi": "Scan med AI",
  "scan.retake": "Tag igen",
  "scan.scanning": "Scanner måling med AI...",
  "scan.estimatedTime": "Ca. 60-90 sekunder",
  "scan.aiReadTitle": "AI aflæste — ret hvis nødvendigt:",
  "scan.ageLabel": "Alder",
  "scan.ageFromBirthYear": "ud fra fødselsår",
  "scan.ageForBetter": "for bedre vurdering",
  "scan.yearsUnit": "år",
  "scan.agePlaceholder": "f.eks. 65",
  "scan.saveReading": "Gem måling",
  "scan.saved": "Måling gemt!",
  "scan.takeNew": "Tag en ny måling",
  "scan.savedMany": "{count} målinger gemt!",
  "scan.uploadMore": "Upload flere billeder",
  "scan.manualPrompt": "Indtast målingen manuelt:",
  "scan.whenLabel": "Tidspunkt",
  "scan.whenHint": "hvornår blev der målt?",
  "scan.noteOptional": "valgfri",
  "scan.noteExample": "f.eks. målt efter morgenmotion",
  "scan.noteLabel": "Note",
  "scan.addNew": "Tilføj ny",
  "scan.viewReadings": "Se målinger",

  // Batch-flow
  "batch.notImages": "Valgte filer er ikke billeder",
  "batch.duplicateSkipped": "Billedet er allerede valgt og bliver ikke tilføjet igen.",
  "batch.processing": "Behandler billede {current} af {total}...",
  "batch.chooseFromGallery": "Vælg billeder fra galleriet",
  "batch.tapToSelect": "Tryk for at vælge — kan vælge flere på én gang",
  "batch.selectedOne": "1 billede valgt",
  "batch.selectedMany": "{count} billeder valgt",
  "batch.cameraTimestamps": "Tidsstempler fra kamera:",
  "batch.scanImagesOne": "🔍 Scan 1 billede",
  "batch.scanImagesMany": "🔍 Scan {count} billeder",
  "batch.done": "Scanning færdig",
  "batch.scanningN": "Scanner billede {current} af {total}...",
  "batch.secondsLeft": "Ca. {seconds} sekunder tilbage",
  "batch.starting": "Starter scanning...",
  "batch.waiting": "Venter...",
  "batch.scanningShort": "Scanner...",
  "batch.cancelScan": "Annuller scanning",
  "batch.readyOne": "📊 1 måling klar",
  "batch.readyMany": "📊 {count} målinger klar",
  "batch.failedOne": "1 billede kunne ikke aflæses",
  "batch.failedMany": "{count} billeder kunne ikke aflæses",
  "batch.unreadableHeader": "Billeder der ikke kunne aflæses:",
  "batch.saveAllOne": "💾 Gem 1 måling",
  "batch.saveAllMany": "💾 Gem {count} målinger",
  "batch.unknownDate": "Ukendt dato",
  "batch.pulseValue": "Puls {value}",
  "batch.autoSaved": "Målingerne gemmes automatisk på serveren, mens du scanner",
  "batch.waitingForAi": "Venter på AI-serveren...",
  "batch.waitingForAiHint": "Ollama kører ikke eller mangler modellen. Start Ollama (kør evt. \"ollama pull glm-ocr\") — scanningen fortsætter automatisk.",
  "batch.retryFailed": "Prøv de mislykkede billeder igen",

  // Upload-kø-status (#50)
  "queue.scannedProgress": "{done} af {total} scannet",
  "queue.waitingOne": "1 venter på scanning",
  "queue.waitingMany": "{count} venter på scanning",
  "queue.openScan": "Se upload-køen",

  // Målingsliste
  "readings.title": "Målinger",
  "readings.filterAll": "Alle",
  "readings.filterWithImage": "Med billede",
  "readings.filterWithoutImage": "Uden billede",
  "readings.timeAll": "Alle tider",
  "readings.confirmDelete": "Sikker på du vil slette denne måling?",
  "readings.emptyTitle": "Ingen målinger endnu",
  "readings.emptyDesc": "Tag din første måling for at komme i gang",
  "readings.emptyCta": "Tag en måling",
  "readings.filteredEmptyTitle": "Ingen målinger med dette filter",
  "readings.filteredEmptyCta": "Vis alle målinger",
  "readings.countFilteredOne": "1 måling (filtreret)",
  "readings.countFilteredMany": "{count} målinger (filtreret)",
  "readings.loading": "Indlæser målinger",
  "readings.exportCsvTip": "Eksportér filtrerede målinger til CSV (dansk Excel-venlig)",
  "readings.exportJsonTip": "Eksportér filtrerede målinger til JSON",
  "readings.choosePersonDesc": "Du skal vælge en person for at se målinger.",

  // Dashboard
  "dash.latest": "Seneste måling",
  "dash.recent": "Seneste målinger",
  "dash.viewAll": "Se alle målinger →",
  "dash.emptyTitle": "Ingen målinger endnu",
  "dash.emptyDesc": "Tag din første måling for at se dit blodtryk her",
  "dash.emptyCta": "Tag en måling",
  "dash.choosePersonTitle": "Vælg en person",
  "dash.choosePersonDesc": "Du skal vælge en person for at se dit dashboard.",
  "dash.title": "Dashboard",
  "dash.sparkLastDays": "Seneste {days} dage",
  "streak.dayOne": "1 dag i træk",
  "streak.dayMany": "{count} dage i træk",
  "streak.thisWeek": "{count} målinger denne uge",

  // Tendenser
  "trends.heading": "Tendenser",
  "trends.range7": "7 dage",
  "trends.range30": "30 dage",
  "trends.range90": "90 dage",
  "trends.rangeAll": "Alt",
  "trends.emptyTitle": "Ingen målinger i denne periode",
  "trends.emptyDesc": "Prøv et længere interval, eller scan en ny måling.",
  "trends.emptyCta": "Scan en måling",
  "trends.average": "Gennemsnit",
  "trends.streak": "Streak",
  "trends.dailyAvg": "Daglige gennemsnit",
  "trends.weeklyAvg": "Ugentlige gennemsnit",
  "trends.bandLegend": "Målbånd ({group})",
  "trends.legendCount": "{count} målinger",
  "trends.classification": "Klassificering af målinger",
  "trends.timesEqual": "Morgen og aften er ens",
  "trends.eveningHigher": "Aftenen ligger {diff} mmHg over morgenen",
  "trends.morningHigher": "Morgenen ligger {diff} mmHg over aftenen",
  "trends.mmhgSys": "mmHg sys",
  "trends.mapSummaryBelow": "MAP {map} mmHg ({sys}/{dia}) ligger under det normale område {min}–{max} mmHg.",
  "trends.mapSummaryAbove": "MAP {map} mmHg ({sys}/{dia}) ligger over det normale område {min}–{max} mmHg.",
  "trends.mapSummaryInRange": "MAP {map} mmHg ({sys}/{dia}) ligger i det normale område {min}–{max} mmHg.",
  "trends.choosePersonDesc": "Du skal vælge en person for at se tendenser.",
  "trends.goToPersons": "Gå til personer",
  "trends.loading": "Indlæser tendenser",

  // Diagram
  "chart.lineAria": "Linjediagram over daglige gennemsnit af systolisk og diastolisk blodtryk",
  "chart.bandSys": "Målbånd systolisk: {min}–{max}",
  "chart.bandDia": "Målbånd diastolisk: {min}–{max}",
  "chart.bandMap": "Målbånd MAP: {min}–{max}",
  "chart.readingOne": "1 måling",
  "chart.readingMany": "{count} målinger",
  "chart.dot": "{date}: {field} {value} ({readings})",
  "chart.dotPlain": "{date}: {field} {value}",

  // Personer
  "persons.title": "Personer",
  "persons.add": "Tilføj",
  "persons.newPerson": "Ny person",
  "persons.namePlaceholder": "Navn",
  "persons.birthYearPlaceholder": "Fødselsår (f.eks. 1950)",
  "persons.birthYearHint": "Valgfri — bruges til automatisk aldersvurdering",
  "persons.born": "Født {year} · ",
  "persons.lastReading": "· Seneste: {date}",
  "persons.confirmDelete":
    'Er du sikker på du vil slette "{name}"?\n\nMålinger flyttes til Standard.',
  "persons.backupBeforeDelete": 'Før sletning downloades en backup af "{name}". Fortsæt?',
  "persons.footerHint": "Tryk på en person for at vælge den · Valgte person er fremhævet",
  "persons.loading": "Indlæser personer",
  "persons.emptyTitle": "Ingen personer endnu",
  "persons.emptyDesc": "Opret en person for at komme i gang",
  "persons.emptyCta": "Opret person",
  "persons.backup": "Backup",
  "persons.restore": "Gendan",
  "persons.backupSuccess": "Backup downloadet.",
  "persons.backupError": "Kunne ikke lave backup.",
  "persons.restoreSuccess": "Data gendannet.",
  "persons.restoreError": "Kunne ikke gendanne backup.",
  "persons.readingCountOne": "1 måling",
  "persons.readingCountMany": "{count} målinger",
  "persons.createError": "Kunne ikke oprette person",
  "persons.updateError": "Kunne ikke opdatere person",

  // Person-dialog (vælger)
  "dialog.choosePerson": "Vælg person",
  "dialog.newNamePlaceholder": "Navn på ny person",
  "dialog.addNewPerson": "+ Tilføj ny person",
  "dialog.createError": "Kunne ikke oprette person",
  "badge.selectPerson": "Vælg person",

  // Målingskort
  "card.imageAlt": "Måling",
  "card.viewImage": "🖼️ Se billede",
  "card.noImage": "Ingen billede",
  "card.ageChip": "{age} år",
  "card.hideNote": "Skjul note",
  "card.showFullNote": "Vis hele noten",

  // Rediger måling
  "edit.title": "Rediger måling",
  "edit.notePlaceholder": "Note til målingen...",
  "edit.saveError": "Kunne ikke opdatere måling",

  // Billedfremviser
  "viewer.imageAlt": "Blodtryksmåling",
  "viewer.aiRead": "AI aflæste:",
  "viewer.fix": "Ret",
  "viewer.fixTitle": "Ret måling:",
  "viewer.saveFix": "Gem rettelse",
  "viewer.unreadable": "Billedet kunne ikke aflæses",

  // Medicin
  "meds.panel": "Medicin",
  "meds.none": "Ingen medicin registreret",
  "meds.inactive": "(inaktiv)",
  "meds.deactivate": "Deaktivér",
  "meds.reactivate": "Genaktivér",
  "meds.namePlaceholder": "Navn (f.eks. Losartan)",
  "meds.dosePlaceholder": "Dosis (f.eks. 5 mg)",
  "meds.addTitle": "Tilføj medicin",
  "meds.confirmDelete": "Sikker på du vil slette denne medicin?",
  "meds.loading": "Indlæser...",
  "meds.loadError": "Kunne ikke hente medicin",
  "meds.addError": "Kunne ikke tilføje medicin",

  // PDF-rapport
  "pdf.report": "Blodtryksrapport",
  "pdf.generated": "Genereret: {date}",
  "pdf.summary": "Resumé",
  "pdf.period": "Periode: {range}",
  "pdf.count": "Antal målinger: {count}",
  "pdf.avg": "Gennemsnit: {sys}/{dia} mmHg",
  "pdf.avgPulse": "Gennemsnitlig puls: {pulse} bpm",
  "pdf.sysMinMax": "Systolisk (min-maks): {min}-{max} mmHg",
  "pdf.diaMinMax": "Diastolisk (min-maks): {min}-{max} mmHg",
  "pdf.distribution": "Fordeling:",
  "pdf.overall": "Samlet vurdering: {label}",
  "pdf.ageLine": "Alder: {age} år ({group})",
  "pdf.medsLine": "Medicin: {meds}",
  "pdf.colDate": "Dato",
  "pdf.colTime": "Tid",
  "pdf.colAge": "Alder",
  "pdf.colSys": "Sys",
  "pdf.colDia": "Dia",
  "pdf.colPulse": "Puls",
  "pdf.colAssessment": "Vurdering",
  "pdf.colTag": "Tag",
  "pdf.colNote": "Note",
  "pdf.brand": "Blodtryk",
  "pdf.pageOf": "Side {page} af {total}",
  "pdf.dailyAverages": "Daglige gennemsnit",
  "pdf.images": "Målingsbilleder",
  "pdf.exportWithImages": "Med billeder",
  "pdf.exportWithoutImages": "Uden billeder",

  // Eksport (CSV-headere)
  "csv.date": "Dato",
  "csv.systolic": "Systolisk",
  "csv.diastolic": "Diastolisk",
  "csv.pulse": "Puls",
  "csv.timeOfDay": "Tidspunkt",
  "csv.arm": "Arm",
  "csv.note": "Note",
};

const en: Record<string, string> = {
  // Nav + settings
  "nav.dashboard": "Dashboard",
  "nav.scan": "New measurement",
  "nav.readings": "Readings",
  "nav.trends": "Trends",
  "nav.persons": "People",
  "nav.settings": "Settings",
  "settings.theme": "Theme",
  "settings.light": "Light",
  "settings.dark": "Dark",
  "settings.system": "System",
  "settings.language": "Language",
  "settings.danish": "Danish",
  "settings.english": "English",
  "settings.reminder": "Daily reminder",
  "settings.remindMe": "Remind me",
  "settings.reminderOn": "Reminder turned on",
  "settings.reminderOff": "Reminder turned off",
  "settings.time": "Time",
  "settings.notificationsBlocked":
    "Notifications are blocked in your browser – the reminder appears as a banner on the home page.",

  // Reminders
  "reminder.notificationTitle": "📏 Time to measure your blood pressure",
  "reminder.notificationBody":
    "Your daily blood pressure measurement is waiting – it only takes a minute.",
  "reminder.bannerTitle": "Measurement reminder",
  "reminder.bannerText": "Time to measure your blood pressure",
  "reminder.measureNow": "Measure now",
  "reminder.dismissLong": "Dismiss reminder for today",
  "reminder.dismissShort": "Dismiss for today",

  // Common
  "common.save": "Save",
  "common.saving": "Saving...",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.backup": "Backup",
  "common.restore": "Restore",
  "common.close": "Close",
  "common.add": "Add",
  "common.back": "Back",
  "common.retry": "Try again",
  "common.loading": "Loading...",
  "common.error": "Error",
  "common.unknownError": "Unknown error",

  // Fields
  "field.systolic": "Systolic",
  "field.diastolic": "Diastolic",
  "field.map": "MAP",
  "field.pulse": "Pulse",
  "field.note": "Note",
  "field.date": "Date",
  "field.time": "Time",
  "field.age": "Age",
  "field.bpm": "bpm",
  "field.mmHg": "mmHg",

  // Counts
  "count.readingsOne": "1 reading",
  "count.readingsMany": "{count} readings",
  "count.imagesOne": "1 image",
  "count.imagesMany": "{count} images",
  "count.classified": "{count} readings classified",

  // Context tags
  "tags.timeLabel": "Time of day",
  "tags.armLabel": "Arm",
  "tod.morning": "Morning",
  "tod.evening": "Evening",
  "tod.morningEmoji": "🌅 Morning",
  "tod.eveningEmoji": "🌙 Evening",
  "tod.morningTitle": "Measured in the morning",
  "tod.eveningTitle": "Measured in the evening",
  "arm.left": "Left arm",
  "arm.right": "Right arm",
  "arm.leftShort": "L",
  "arm.rightShort": "R",
  "arm.leftName": "Left",
  "arm.rightName": "Right",

  // Classification
  "bp.normal.label": "Normal",
  "bp.crisis.label": "Crisis",
  "bp.crisis.desc": "Seek immediate medical help",
  "bp.normal.desc": "Blood pressure is normal",
  "bp.normalOld.desc": "Blood pressure is normal for your age",
  "bp.young.elevated.label": "Elevated",
  "bp.young.elevated.desc": "Slightly elevated — consider lifestyle changes",
  "bp.young.stage1.label": "Stage 1 hypertension",
  "bp.young.stage1.desc": "Stage 1 hypertension — talk to your doctor",
  "bp.young.stage2.label": "Stage 2 hypertension",
  "bp.young.stage2.desc": "Stage 2 hypertension — contact your doctor",
  "bp.middle.elevated.label": "Slightly elevated",
  "bp.middle.elevated.desc": "Acceptable for your age — keep monitoring",
  "bp.middle.stage1.label": "Elevated",
  "bp.middle.stage1.desc": "Consider treatment — talk to your doctor",
  "bp.middle.stage2.label": "High",
  "bp.middle.stage2.desc": "Contact your doctor about treatment",
  "bp.old.elevated.label": "Acceptable",
  "bp.old.elevated.desc": "Acceptable for your age — keep monitoring",
  "ageGroup.under65": "Under 65 years",
  "ageGroup.65to79": "Ages 65-79",
  "ageGroup.over80": "80+ years",

  // API error codes
  "err.invalidRequestFormat": "Invalid request format",
  "err.personIdRequired": "personId is required",
  "err.invalidPersonId": "Invalid personId",
  "err.personNotFound": "Person not found",
  "err.invalidJson": "Invalid JSON format",
  "err.readingNotFound": "Reading not found",
  "err.readingSaveFailed": "Could not save reading",
  "err.readingUpdateFailed": "Could not update reading",
  "err.personCreateFailed": "Could not create person",
  "err.personUpdateFailed": "Could not update person",
  "err.personDeleteFailed": "Could not delete person",
  "err.medicationNotFound": "Medication not found",
  "err.medicationCreateFailed": "Could not add medication",
  "err.medicationUpdateFailed": "Could not update medication",
  "err.medicationDeleteFailed": "Could not delete medication",
  "err.invalidId": "Invalid ID",
  "err.nameRequired": "Name is required",
  "err.nameTooLong": "Name is required (at most {nameMax} characters)",
  "err.doseTooLong": "Dose is required (at most {doseMax} characters)",
  "err.noFieldsToUpdate": "Provide at least one field to update (name or birth year)",
  "err.noFieldsToUpdateGeneric": "Provide at least one field to update",
  "err.cannotDeleteStandard": "The Default person cannot be deleted",
  "err.activeMustBeBoolean": "active must be true or false",
  "err.invalidStartDate": "Invalid start date",
  "err.invalidEndDate": "Invalid end date",
  "err.daysMustBeValid": "days must be 7, 30, 90 or 'all'",
  "err.invalidSystolic": "Systolic must be an integer between {sysMin} and {sysMax}",
  "err.invalidDiastolic": "Diastolic must be an integer between {diaMin} and {diaMax}",
  "err.invalidPulse": "Pulse must be an integer between {pulseMin} and {pulseMax}",
  "err.systolicMustExceedDiastolic": "Systolic must be higher than diastolic",
  "err.invalidNoteType": "Note must be text",
  "err.noteTooLong": "Note may be at most {noteMax} characters",
  "err.invalidAge": "Age must be an integer between {ageMin} and {ageMax}",
  "err.invalidImageType": "Image must be a string (data URL)",
  "err.invalidTimeOfDayValue": "Time of day must be 'morning' or 'evening'",
  "err.invalidArmValue": "Arm must be 'left' or 'right'",
  "err.createdAtRequiredFormat": "Time must be a date/time (ISO format)",
  "err.invalidCreatedAt": "Invalid time — enter a valid date and time",
  "err.createdAtInFuture": "The time cannot be in the future",
  "err.birthYearRange": "Year must be between {yearMin} and {yearMax}",
  "err.noImageProvided": "No image received",
  "err.imageTooSmall": "The image is too small or unclear. Try again with better lighting.",
  "err.scanCouldNotParse": "Could not read the AI response",
  "err.scanInvalidFormat": "Invalid format of the scanned reading",
  "err.scanParseFailed": "Could not interpret the AI response",
  "err.scanFailed": "Scan failed",
  "err.batchJobFailed": "Could not start scanning on the server",
  "err.ollamaOffline": "Ollama is not responding — the AI server is not running",
  "err.ollamaModelMissing": "The AI model glm-ocr is not installed on the Ollama server. Run: ollama pull glm-ocr",
  "err.duplicateImageDetected": "This image has already been uploaded for this person.",
  "err.tooManyImages": "Too many images in one upload (max. 50)",
  "err.unknown": "Unknown error",
  "err.fetchMedicationsFailed": "Could not load medications",

  // Camera
  "camera.open": "Open camera",
  "camera.starting": "Starting camera...",
  "camera.capture": "Take picture",
  "camera.denied":
    "Camera access denied. Open browser settings and allow camera access for this site.",
  "camera.unavailable": "Camera not available. Allow camera access in the browser.",

  // Scan page
  "scan.title": "New measurement",
  "scan.tabCamera": "Camera",
  "scan.tabUpload": "Upload",
  "scan.tabManual": "Manual",
  "scan.choosePersonTitle": "Choose a person",
  "scan.choosePersonDesc": "You must choose a person before you can scan measurements.",
  "scan.goToPersons": "Go to people",
  "scan.reviewPrompt": "Check the image before AI scanning:",
  "scan.scanWithAi": "Scan with AI",
  "scan.retake": "Retake",
  "scan.scanning": "Scanning measurement with AI...",
  "scan.estimatedTime": "Approx. 60-90 seconds",
  "scan.aiReadTitle": "AI read — correct if needed:",
  "scan.ageLabel": "Age",
  "scan.ageFromBirthYear": "from birth year",
  "scan.ageForBetter": "for better assessment",
  "scan.yearsUnit": "years",
  "scan.agePlaceholder": "e.g. 65",
  "scan.saveReading": "Save measurement",
  "scan.saved": "Measurement saved!",
  "scan.takeNew": "Take a new measurement",
  "scan.savedMany": "{count} readings saved!",
  "scan.uploadMore": "Upload more images",
  "scan.manualPrompt": "Enter the measurement manually:",
  "scan.whenLabel": "Time",
  "scan.whenHint": "when was it measured?",
  "scan.noteOptional": "optional",
  "scan.noteExample": "e.g. measured after morning exercise",
  "scan.noteLabel": "Note",
  "scan.addNew": "Add another",
  "scan.viewReadings": "View readings",

  // Batch flow
  "batch.notImages": "The selected files are not images",
  "batch.duplicateSkipped": "This image is already selected and was skipped.",
  "batch.processing": "Processing image {current} of {total}...",
  "batch.chooseFromGallery": "Choose images from the gallery",
  "batch.tapToSelect": "Tap to choose — you can select several at once",
  "batch.selectedOne": "1 image selected",
  "batch.selectedMany": "{count} images selected",
  "batch.cameraTimestamps": "Camera timestamps:",
  "batch.scanImagesOne": "🔍 Scan 1 image",
  "batch.scanImagesMany": "🔍 Scan {count} images",
  "batch.done": "Scanning finished",
  "batch.scanningN": "Scanning image {current} of {total}...",
  "batch.secondsLeft": "About {seconds} seconds left",
  "batch.starting": "Starting scan...",
  "batch.waiting": "Waiting...",
  "batch.scanningShort": "Scanning...",
  "batch.cancelScan": "Cancel scan",
  "batch.readyOne": "📊 1 reading ready",
  "batch.readyMany": "📊 {count} readings ready",
  "batch.failedOne": "1 image could not be read",
  "batch.failedMany": "{count} images could not be read",
  "batch.unreadableHeader": "Images that could not be read:",
  "batch.saveAllOne": "💾 Save 1 reading",
  "batch.saveAllMany": "💾 Save {count} readings",
  "batch.unknownDate": "Unknown date",
  "batch.pulseValue": "Pulse {value}",
  "batch.autoSaved": "Readings are saved automatically on the server while you scan",
  "batch.waitingForAi": "Waiting for the AI server...",
  "batch.waitingForAiHint": "Ollama is not running or the model is missing. Start Ollama (or run \"ollama pull glm-ocr\") — scanning continues automatically.",
  "batch.retryFailed": "Retry the failed images",

  // Upload queue status (#50)
  "queue.scannedProgress": "{done} of {total} scanned",
  "queue.waitingOne": "1 waiting to be scanned",
  "queue.waitingMany": "{count} waiting to be scanned",
  "queue.openScan": "View the upload queue",

  // Readings list
  "readings.title": "Readings",
  "readings.filterAll": "All",
  "readings.filterWithImage": "With image",
  "readings.filterWithoutImage": "Without image",
  "readings.timeAll": "All times",
  "readings.confirmDelete": "Are you sure you want to delete this reading?",
  "readings.emptyTitle": "No readings yet",
  "readings.emptyDesc": "Take your first measurement to get started",
  "readings.emptyCta": "Take a measurement",
  "readings.filteredEmptyTitle": "No readings match this filter",
  "readings.filteredEmptyCta": "Show all readings",
  "readings.countFilteredOne": "1 reading (filtered)",
  "readings.countFilteredMany": "{count} readings (filtered)",
  "readings.loading": "Loading readings",
  "readings.exportCsvTip": "Export the filtered readings to CSV (Danish Excel friendly)",
  "readings.exportJsonTip": "Export the filtered readings to JSON",
  "readings.choosePersonDesc": "You must choose a person to see readings.",

  // Dashboard
  "dash.latest": "Latest measurement",
  "dash.recent": "Recent measurements",
  "dash.viewAll": "See all readings →",
  "dash.emptyTitle": "No readings yet",
  "dash.emptyDesc": "Take your first measurement to see your blood pressure here",
  "dash.emptyCta": "Take a measurement",
  "dash.choosePersonTitle": "Choose a person",
  "dash.choosePersonDesc": "You must choose a person to see your dashboard.",
  "dash.title": "Dashboard",
  "dash.sparkLastDays": "Last {days} days",
  "streak.dayOne": "1 day in a row",
  "streak.dayMany": "{count} days in a row",
  "streak.thisWeek": "{count} readings this week",

  // Trends
  "trends.heading": "Trends",
  "trends.range7": "7 days",
  "trends.range30": "30 days",
  "trends.range90": "90 days",
  "trends.rangeAll": "All",
  "trends.emptyTitle": "No readings in this period",
  "trends.emptyDesc": "Try a longer period, or scan a new measurement.",
  "trends.emptyCta": "Scan a measurement",
  "trends.average": "Average",
  "trends.streak": "Streak",
  "trends.dailyAvg": "Daily averages",
  "trends.weeklyAvg": "Weekly averages",
  "trends.bandLegend": "Target band ({group})",
  "trends.legendCount": "{count} readings",
  "trends.classification": "Classification of readings",
  "trends.timesEqual": "Morning and evening are equal",
  "trends.eveningHigher": "Evening is {diff} mmHg above morning",
  "trends.morningHigher": "Morning is {diff} mmHg above evening",
  "trends.mmhgSys": "mmHg sys",
  "trends.mapSummaryBelow": "MAP {map} mmHg ({sys}/{dia}) is below the normal range of {min}–{max} mmHg.",
  "trends.mapSummaryAbove": "MAP {map} mmHg ({sys}/{dia}) is above the normal range of {min}–{max} mmHg.",
  "trends.mapSummaryInRange": "MAP {map} mmHg ({sys}/{dia}) is within the normal range of {min}–{max} mmHg.",
  "trends.choosePersonDesc": "You must choose a person to see trends.",
  "trends.goToPersons": "Go to people",
  "trends.loading": "Loading trends",

  // Chart
  "chart.lineAria": "Line chart of daily systolic and diastolic blood pressure averages",
  "chart.bandSys": "Target band (systolic): {min}–{max}",
  "chart.bandDia": "Target band (diastolic): {min}–{max}",
  "chart.bandMap": "Target band (MAP): {min}–{max}",
  "chart.readingOne": "1 reading",
  "chart.readingMany": "{count} readings",
  "chart.dot": "{date}: {field} {value} ({readings})",
  "chart.dotPlain": "{date}: {field} {value}",

  // Persons
  "persons.title": "People",
  "persons.add": "Add",
  "persons.newPerson": "New person",
  "persons.namePlaceholder": "Name",
  "persons.birthYearPlaceholder": "Birth year (e.g. 1950)",
  "persons.birthYearHint": "Optional — used for automatic age assessment",
  "persons.born": "Born {year} · ",
  "persons.lastReading": "· Latest: {date}",
  "persons.confirmDelete":
    'Are you sure you want to delete "{name}"?\n\nReadings move to Default.',
  "persons.backupBeforeDelete": 'Before deletion, a backup of "{name}" will be downloaded. Continue?',
  "persons.footerHint": "Tap a person to select them · The selected person is highlighted",
  "persons.loading": "Loading people",
  "persons.emptyTitle": "No people yet",
  "persons.emptyDesc": "Create a person to get started",
  "persons.emptyCta": "Create person",
  "persons.backup": "Backup",
  "persons.restore": "Restore",
  "persons.backupSuccess": "Backup downloaded.",
  "persons.backupError": "Could not create backup.",
  "persons.restoreSuccess": "Data restored.",
  "persons.restoreError": "Could not restore backup.",
  "persons.readingCountOne": "1 reading",
  "persons.readingCountMany": "{count} readings",
  "persons.createError": "Could not create person",
  "persons.updateError": "Could not update person",

  // Person dialog
  "dialog.choosePerson": "Choose person",
  "dialog.newNamePlaceholder": "Name of new person",
  "dialog.addNewPerson": "+ Add new person",
  "badge.selectPerson": "Choose person",

  // Reading card
  "card.imageAlt": "Measurement",
  "card.viewImage": "🖼️ View image",
  "card.noImage": "No image",
  "card.ageChip": "{age} years",
  "card.hideNote": "Hide note",
  "card.showFullNote": "Show full note",

  // Edit reading
  "edit.title": "Edit reading",
  "edit.notePlaceholder": "Note about the measurement...",
  "edit.saveError": "Could not update reading",

  // Image viewer
  "viewer.imageAlt": "Blood pressure measurement",
  "viewer.aiRead": "AI read:",
  "viewer.fix": "Fix",
  "viewer.fixTitle": "Fix measurement:",
  "viewer.saveFix": "Save fix",
  "viewer.unreadable": "The image could not be read",

  // Medication
  "meds.panel": "Medication",
  "meds.none": "No medication registered",
  "meds.inactive": "(inactive)",
  "meds.deactivate": "Deactivate",
  "meds.reactivate": "Reactivate",
  "meds.namePlaceholder": "Name (e.g. Losartan)",
  "meds.dosePlaceholder": "Dose (e.g. 5 mg)",
  "meds.addTitle": "Add medication",
  "meds.confirmDelete": "Are you sure you want to delete this medication?",
  "meds.loading": "Loading...",
  "meds.loadError": "Could not load medication",
  "meds.addError": "Could not add medication",

  // PDF report
  "pdf.report": "Blood Pressure Report",
  "pdf.generated": "Generated: {date}",
  "pdf.summary": "Summary",
  "pdf.period": "Period: {range}",
  "pdf.count": "Number of readings: {count}",
  "pdf.avg": "Average: {sys}/{dia} mmHg",
  "pdf.avgPulse": "Average pulse: {pulse} bpm",
  "pdf.sysMinMax": "Systolic (min-max): {min}-{max} mmHg",
  "pdf.diaMinMax": "Diastolic (min-max): {min}-{max} mmHg",
  "pdf.distribution": "Distribution:",
  "pdf.overall": "Overall assessment: {label}",
  "pdf.ageLine": "Age: {age} years ({group})",
  "pdf.medsLine": "Medication: {meds}",
  "pdf.colDate": "Date",
  "pdf.colTime": "Time",
  "pdf.colAge": "Age",
  "pdf.colSys": "Sys",
  "pdf.colDia": "Dia",
  "pdf.colPulse": "Pulse",
  "pdf.colAssessment": "Assessment",
  "pdf.colTag": "Tag",
  "pdf.colNote": "Note",
  "pdf.brand": "Blodtryk",
  "pdf.pageOf": "Page {page} of {total}",
  "pdf.dailyAverages": "Daily averages",
  "pdf.images": "Measurement images",
  "pdf.exportWithImages": "With images",
  "pdf.exportWithoutImages": "Without images",

  // Export (CSV headers)
  "csv.date": "Date",
  "csv.systolic": "Systolic",
  "csv.diastolic": "Diastolic",
  "csv.pulse": "Pulse",
  "csv.timeOfDay": "Time of day",
  "csv.arm": "Arm",
  "csv.note": "Note",
};

const dictionaries: Record<Locale, Record<string, string>> = { da, en };

/** Erstat {navn}-pladsholdere i en skabelon. */
function interpolate(
  template: string,
  vars?: Record<string, string | number>
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  );
}

/**
 * Variabler som fejlbeskeder med intervaller behøver — fyldes automatisk i
 * t()/translate(), så kaldere aldrig skal kende serverens grænser.
 */
export function autoVars(): Record<string, string | number> {
  return {
    sysMin: SYSTOLIC_MIN,
    sysMax: SYSTOLIC_MAX,
    diaMin: DIASTOLIC_MIN,
    diaMax: DIASTOLIC_MAX,
    pulseMin: PULSE_MIN,
    pulseMax: PULSE_MAX,
    ageMin: AGE_MIN,
    ageMax: AGE_MAX,
    noteMax: NOTE_MAX_LENGTH,
    yearMin: BIRTH_YEAR_MIN,
    yearMax: new Date().getFullYear(),
    nameMax: MEDICATION_NAME_MAX_LENGTH,
    doseMax: MEDICATION_DOSE_MAX_LENGTH,
  };
}

/**
 * Oversæt en nøgle til det givne sprog.
 * Falder tilbage til dansk og derefter til selve nøglen, så ukendte
 * fejlbeskeder fra API'en altid viser noget læsbart.
 * Kan bruges uden for React (ren funktion).
 */
export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>
): string {
  const dict = dictionaries[locale] ?? dictionaries.da;
  const template = dict[key] ?? dictionaries.da[key] ?? key;
  return interpolate(template, vars ?? autoVars());
}

/**
 * Oversæt en fejlkode fra API'en ("invalidSystolic" → "err.invalidSystolic").
 * Ukendte koder vises råt — så uventede serverfejl stadig er læsbare.
 */
export function translateError(
  locale: Locale,
  code: string,
  vars?: Record<string, string | number>
): string {
  const keyed = `err.${code}`;
  if (dictionaries[locale]?.[keyed] || dictionaries.da[keyed]) {
    return translate(locale, keyed, vars);
  }
  return code;
}

/** Registrér sprog: gemt valg → browser-sprog → dansk. */
export function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === "da" || saved === "en") return saved;
  } catch {
    /* localStorage kan være blokeret */
  }
  try {
    const candidates =
      typeof navigator !== "undefined" && navigator.languages?.length
        ? navigator.languages
        : typeof navigator !== "undefined" && navigator.language
          ? [navigator.language]
          : [];
    for (const tag of candidates) {
      if (!tag) continue;
      const lower = tag.toLowerCase();
      if (lower.startsWith("da")) return "da";
      if (lower.startsWith("en")) return "en";
    }
  } catch {
    /* navigator kan mangle i ikke-browser-miljøer */
  }
  return "da";
}

/** Pluralis-hjælper: vælg entals-/flertalsnøgle ud fra antal. */
export function countKey(
  base: string,
  n: number
): string {
  return n === 1 ? `${base}One` : `${base}Many`;
}
