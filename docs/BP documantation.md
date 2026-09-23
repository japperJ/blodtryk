# Blodtryksklassifikation i appen

## Regelgrundlag og version

Appens visningskategorier følger Dansk Cardiologisk Selskabs (DCS) *National Behandlingsvejledning: Arteriel hypertension*, afsnit 27.1, tabel 27.1, revision 2026/4. Den officielle onlinekilde blev kontrolleret 2026-09-23: <https://nbv.cardio.dk/kapitel/hypertension/>.

- App-regelversion: `dcs-nbv-2026-4-table-27-1-v1`
- Metadata i kode: `src/lib/bpClassification.ts` (`BP_CLASSIFICATION_METADATA`)
- Enhed: mmHg

| Kategori i DCS tabel 27.1 | Systolisk | Diastolisk | Sammenkobling |
| --- | ---: | ---: | --- |
| Normalt BT | 100–129 | 60–79 | Begge intervaller skal være opfyldt |
| Let forhøjet BT | 130–134 | 80–84 | Enten systolisk eller diastolisk interval |
| Grad 1 HT | 135–154 | 85–94 | Enten systolisk eller diastolisk interval |
| Grad 2 HT | 155–174 | 95–104 | Enten systolisk eller diastolisk interval |
| Grad 3 HT | ≥175 | ≥105 | Enten systolisk eller diastolisk grænse |

## Implementeringens afgrænsning

- De offentliggjorte intervaller anvendes på blodtryk i mmHg. Ved modstridende systoliske og diastoliske kategorier viser appen den højeste angivne kategori; dette er appens visningsregel.
- Appen anvender kategorierne på enkelte gemte målinger og periodesnit. DCS-tabellen gælder gennemsnit i dagtimerne fra hjemme- eller døgnblodtryksmåling, alternativt uobserveret automatisk klinikmåling hvis de andre metoder ikke er mulige. Brug på enkelte målinger er derfor alene en app-visning, ikke en anvendelse af måleprotokollen.
- Periodesnit klassificeres ud fra uafrundede gennemsnit; afrunding bruges kun til visning. Kode sammenligner rå tal direkte med heltalsgrænser. Kilden angiver ikke en særskilt decimalregel; decimaladfærden er en softwaredetalje og ikke klinisk valideret.
- Hvis ingen forhøjet kategori udløses, kræver appens normale kategori, at begge værdier opfylder normalintervallet. Værdier uden for tabellens kategorier bliver `Ikke klassificeret`; appen udleder ikke en kategori for lavt blodtryk.
- Alder ændrer ikke appens kategorier, og appen fastsætter ikke patient-specifikke behandlingsmål. DCS’ tabel 27.2 om behandlingsmål er særskilt og implementeres ikke. DCS bemærker i tabel 27.1, at systolisk blodtryk under 120 mmHg kan være for lavt hos ældre; appen vurderer ikke denne bemærkning.
- Den danske lægerapport angiver ikke et generisk blodtryksmål eller puls-normalområde; patient-specifikke mål skal vurderes af behandler.

## Klinisk forbehold

Denne app-tilpasning er ikke klinisk gennemgået eller valideret. Kategorierne er kun til orientering og er ikke en diagnose, triage, behandlingsanbefaling eller grundlag for ændring af medicin. Fortolkning og eventuelle mål kræver individuel klinisk vurdering. Den officielle kilde, herunder senere revisioner, bør kontrolleres før klinisk anvendelse.

De deterministiske grænse- og metadata-tests køres med `npm run test:classification`.
