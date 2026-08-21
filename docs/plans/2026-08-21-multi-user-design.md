# Multi-bruger system for Blodtryk

## Oversigt
Konverter det nuværende single-user blodtryksapp til et multi-bruger system hvor hver måling tilhører en person. Ingen autentifikation — simpel personvælger gemt i localStorage.

## Datamodel

### Ny Prisma-model `Person`
```prisma
model Person {
  id        Int       @id @default(autoincrement())
  name      String
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  readings  Reading[]
}

model Reading {
  id        Int      @id @default(autoincrement())
  systolic  Int
  diastolic Int
  pulse     Int
  age       Int?
  note      String?
  image     String?
  personId  Int      // NY — foreign key
  person    Person   @relation(fields: [personId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([createdAt])
  @@index([personId])
}
```

## UI-flow

1. **Første åbning:** Redirect til `/persons` for at oprette første person
2. **Personvalg:** Gemmes i `localStorage("selectedPersonId")`, vises som badge i headeren
3. **Skift person:** Tryk på badge → dialog med personliste + opret-knap
4. **Navigation:** 3 faner: 📸 Scan, 📋 Målinger, 👤 Personer

## API-ændringer

| Endpoint | Ændring |
|----------|---------|
| `GET /api/readings` | Filtrerer efter `?personId=X` (påkrævet) |
| `POST /api/readings` | Kræver `personId` i body |
| `GET /api/persons` | NY — hent alle personer |
| `POST /api/persons` | NY — opret person |
| `PATCH /api/persons/[id]` | NY — rediger person |
| `DELETE /api/persons/[id]` | NY — slet person (flyt målinger til "Standard") |

## Implementeringsplan (10 trin)

### Trin 1: Database-migrering
**Fil:** `prisma/schema.prisma`
- Tilføj `Person` model med `id`, `name`, `createdAt`, `updatedAt`
- Tilføj `personId Int` til `Reading` + `person Person @relation(...)`
- Tilføj `@@index([personId])` til Reading
- Kør `npx prisma db push`
- Opret "Standard" person via seed-script

### Trin 2: Persons API-ruter
**Ny fil:** `src/app/api/persons/route.ts`
- `GET`: Hent alle personer med `readings: { select: { id: true } }` til optælling
- `POST`: Valider navn (min 1 tegn), opret person

**Ny fil:** `src/app/api/persons/[id]/route.ts`
- `PATCH`: Opdater navn
- `DELETE`: Slet person + flyt målinger til "Standard"-personen

### Trin 3: Opdater readings API
**Fil:** `src/app/api/readings/route.ts`
- `GET`: Tilføj `personId` query-parameter, filtrer med `where: { personId }`
- `POST`: Tilføj `personId` til validering og create-data

**Fil:** `src/app/api/readings/[id]/route.ts`
- Uændret (single reading operations)

### Trin 4: PersonBadge-komponent
**Ny fil:** `src/components/PersonBadge.tsx`
- Viser valgt persons navn som knap i headeren
- Tryk → åbner `PersonDialog`
- Henter personer fra API + husker valg i localStorage

### Trin 5: PersonDialog-komponent
**Ny fil:** `src/components/PersonDialog.tsx`
- Modal/dialog med liste over alle personer
- Radio-knapparket til at vælge person
- "Tilføj person"-knap → inline inputfelt
- Bekræft-knap → gemmer valg i localStorage + lukker dialog

### Trin 6: Persons-side
**Ny fil:** `src/app/persons/page.tsx`
- Liste med personkort (navn, antal målinger, seneste dato)
- "Tilføj person"-knap → dialog med navn-input
- Tryk på person → mulighed for redigér/slet
- Sletning: bekræftelsesdialog

### Trin 7: Navbar-opdatering
**Fil:** `src/components/Navbar.tsx`
- Tilføj 3. fane: 👤 Personer → `/persons`
- Juster bredde til 3 lige store faner

### Trin 8: Scan-side opdatering
**Fil:** `src/app/scan/page.tsx`
- Vis persons navn øverst (hentet fra localStorage/API)
- Fjern `userAge` state og alder-input (behold alder som valgfrit)
- Send `personId` med i POST-anmodningen
- Redirect til persons-siden hvis ingen person valgt

### Trin 9: Målinger-side opdatering
**Fil:** `src/app/readings/page.tsx`
- Tilføj `personId` query-parameter til fetch
- Vis persons navn øverst
- `PdfExport` modtager person-info

### Trin 10: PDF-opdatering
**Fil:** `src/components/PdfExport.tsx`
- Tilføj persons navn på forsiden
- Filnavn inkluderer persons navn
