# Vergabe-Advisor Backend — Setup & Dokumentation

## 🚀 Quick Start (5 Minuten)

### Voraussetzungen
- Docker & Docker Compose installiert
- Git
- Texteditor oder IDE

### Installation

```bash
# 1. Repo klonen oder Dateien herunterladen
cd vergabe-advisor-backend

# 2. .env erstellen
cp .env.example .env

# 3. Docker starten
docker-compose up

# Fertig! Backend läuft auf http://localhost:5000
```

**Output sollte sein:**
```
✅ Vergabe-Advisor Backend läuft auf http://localhost:5000
postgres_1  | database system is ready to accept connections
```

---

## 🧪 Test: Health-Check

```bash
curl http://localhost:5000/health
```

**Response:**
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

---

## 🔐 Login & JWT Token

### 1. Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "kristian@tempelhof.de",
    "password": "any_password"
  }'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "kristian@tempelhof.de",
    "vorname": "Kristian",
    "nachname": "Beantragender",
    "rolle": "beantragender"
  }
}
```

### 2. Token speichern & verwenden

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Token in jedem Request im Header:
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/vergaben
```

---

## 📋 API Endpoints

### **VERGABEN**

#### GET /api/vergaben
Liste aller Vergaben (gefiltert nach Rolle)

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/vergaben
```

**Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "ersteller_id": "123e4567-e89b-12d3-a456-426614174000",
    "auftraggeber_typ": "klassisch",
    "leistungsbeschreibung": "Plakatierung Kulturveranstaltung",
    "leistungsart": "Liefer- und Dienstleistungen",
    "volumen": 25000,
    "struktur": "einzeln",
    "status": "entwurf",
    "erstellt_am": "2024-01-15T10:00:00Z"
  }
]
```

---

#### GET /api/vergaben/:id
Einzelne Vergabe mit Freigabenkette

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/vergaben/550e8400-e29b-41d4-a716-446655440000
```

**Response:**
```json
{
  "vergabe": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "auftraggeber_typ": "klassisch",
    "leistungsbeschreibung": "Plakatierung Kulturveranstaltung",
    "volumen": 25000,
    "struktur": "einzeln",
    "status": "in_freigabe"
  },
  "freigabenkette": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "reihenfolge": 1,
      "grund": "Regel: freigeber_stufe_1",
      "status": "pending",
      "freigeber_id": "660e8400-e29b-41d4-a716-446655440002",
      "vorname": "Lisa",
      "nachname": "Vergabestelle",
      "rolle": "freigeber_stufe_1"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440003",
      "reihenfolge": 2,
      "grund": "Regel: freigeber_stufe_2",
      "status": "pending",
      "freigeber_id": "660e8400-e29b-41d4-a716-446655440004",
      "vorname": "Max",
      "nachname": "Finanzen",
      "rolle": "freigeber_stufe_2"
    }
  ]
}
```

---

#### POST /api/vergaben
Neue Vergabe erstellen

```bash
curl -X POST http://localhost:5000/api/vergaben \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "auftraggeber_typ": "klassisch",
    "leistungsbeschreibung": "Plakatierung Kulturveranstaltung",
    "leistungsart": "Liefer- und Dienstleistungen",
    "volumen": 25000,
    "struktur": "einzeln",
    "erfuellungszeitraum": "3 Monate ab Freigabe",
    "anfordernde_stelle": "Kultur & Events",
    "ansprechpartner_name": "Anna Schmidt",
    "ansprechpartner_telefon": "030 1234567",
    "ansprechpartner_email": "anna@tempelhof.de",
    "begruendung": "Bewerbung für Musikfestival im Sommer",
    "besonderheiten": "Nachhaltiges Design erforderlich",
    "risikoklasse": "gering",
    "projektbezeichnung": "Musikfest 2024"
  }'
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Vergabe erstellt"
}
```

**Was passiert automatisch:**
1. ✅ Vergabe-Regeln werden angewendet (basierend auf Volumen + Struktur)
2. ✅ Freigabenkette wird erstellt (alle nötigen Freigeber hinzugefügt)
3. ✅ Audit-Log wird geschrieben
4. ✅ Status: `entwurf`

---

#### POST /api/vergaben/:id/submit
Vergabe einreichen (Entwurf → In Freigabe)

```bash
curl -X POST http://localhost:5000/api/vergaben/550e8400-e29b-41d4-a716-446655440000/submit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "manual_approvals_to_add": ["660e8400-e29b-41d4-a716-446655440005"],
    "manual_approvals_to_remove": []
  }'
```

**Response:**
```json
{
  "message": "Vergabe eingereicht"
}
```

**Status ändert sich:** `entwurf` → `in_freigabe`

---

#### POST /api/vergaben/:id/approve/:freigaber_id
Freigabe gewähren (als Freigeber)

```bash
curl -X POST http://localhost:5000/api/vergaben/550e8400-e29b-41d4-a716-446655440000/approve/660e8400-e29b-41d4-a716-446655440002 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "kommentar": "Alles in Ordnung, Vergabestelle freigegeben"
  }'
```

**Response:**
```json
{
  "message": "Freigegeben"
}
```

**Was passiert:**
1. Freigabe-Status: `pending` → `approved`
2. System prüft: Sind ALLE Freigaben genehmigt?
3. Wenn ja: Vergabe-Status → `genehmigt`
4. Audit-Log: "Freigegeben von Lisa Vergabestelle"

---

#### POST /api/vergaben/:id/reject/:freigaber_id
Freigabe ablehnen

```bash
curl -X POST http://localhost:5000/api/vergaben/550e8400-e29b-41d4-a716-446655440000/reject/660e8400-e29b-41d4-a716-446655440002 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ablehnungsgrund": "Budgetüberschreitung nicht akzeptabel",
    "kommentar": "Bitte überarbeiten Sie die Kostenschätzung"
  }'
```

**Response:**
```json
{
  "message": "Abgelehnt"
}
```

**Was passiert:**
1. Freigabe-Status: `pending` → `rejected`
2. Vergabe-Status: `in_freigabe` → `abgelehnt`
3. Beantragender muss neu einreichen
4. Audit-Log: "Abgelehnt von Max Finanzen"

---

### **FREIGABE-REGELN** (Admin nur)

#### GET /api/freigabe-regeln
Alle Regeln anschauen (nur Admin)

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/freigabe-regeln
```

**Response:**
```json
[
  {
    "id": "760e8400-e29b-41d4-a716-446655440001",
    "name": "Standard bis €20.000",
    "bedingung_volumen_min": 0,
    "bedingung_volumen_max": 20000,
    "erforderliche_freigeber_rollen": ["freigeber_stufe_1", "freigeber_stufe_2"],
    "prioritaet": 10,
    "aktiv": true
  },
  {
    "id": "760e8400-e29b-41d4-a716-446655440002",
    "name": "Standard €20.001 - €100.000",
    "bedingung_volumen_min": 20000.01,
    "bedingung_volumen_max": 100000,
    "erforderliche_freigeber_rollen": ["freigeber_stufe_1", "freigeber_stufe_2", "freigeber_stufe_4"],
    "prioritaet": 20,
    "aktiv": true
  }
]
```

---

## 📊 Workflow-Beispiel (von A bis Z)

### **Szenario: Plakatierung für Kulturveranstaltung (€25.000)**

```
1. Beantragender: Kristian trägt Formular aus
   POST /api/vergaben
   → Vergabe ID: 550e8400-e29b-41d4-a716-446655440000
   → Status: entwurf
   → Freigabenkette wird berechnet:
      - Stufe 1: Lisa (Vergabestelle)
      - Stufe 2: Max (Finanzen)
      - Stufe 4: Frank (Bereichsleitung) ← weil > €20k

2. Beantragender: Submits Vergabe
   POST /api/vergaben/.../submit
   → Status: in_freigabe
   → Emails gehen raus an Lisa, Max, Frank

3. Lisa (Vergabestelle): Prüft & genehmigt
   POST /api/vergaben/.../approve/lisa-id
   → Freigabe-Status: pending → approved
   → Max wird benachrichtigt (nächst im linearen Flow)

4. Max (Finanzen): Prüft & genehmigt
   POST /api/vergaben/.../approve/max-id
   → Freigabe-Status: pending → approved
   → Frank wird benachrichtigt

5. Frank (Bereichsleitung): Prüft & genehmigt
   POST /api/vergaben/.../approve/frank-id
   → Freigabe-Status: pending → approved
   → ALLE genehmigt! ✅

6. Vergabe-Status: in_freigabe → genehmigt
   Beantragender: Sieht grünes Häkchen, kann jetzt Vergabeverfahren starten
```

---

## 🧑‍💻 Datenbank direkt queryen (optional)

```bash
# Terminal öffnen
docker exec -it vergabe_postgres psql -U vergabe_user -d vergabe_db

# Im psql:
SELECT * FROM vergaben;
SELECT * FROM vergabe_freigabenkette;
SELECT * FROM users;
SELECT * FROM freigabe_regeln;
```

---

## 🐛 Debugging

### Logs anschauen
```bash
docker-compose logs -f backend
docker-compose logs -f postgres
```

### Container neu starten
```bash
docker-compose restart backend
docker-compose restart postgres
```

### Alles neu
```bash
docker-compose down -v
docker-compose up
```

---

## 📝 Nächste Schritte

- [ ] Vue.js Frontend aufsetzen
- [ ] Freigabe-Dashboard bauen
- [ ] E-Mail-Benachrichtigungen
- [ ] Anhang-Upload
- [ ] Export zu PDF
- [ ] Authentifizierung (echtes Password-Hashing)

---

## 💡 Tipps für die Entwicklung

**Postman/Insomnia installieren** für API-Testing:
1. Starte Backend: `docker-compose up`
2. Öffne Postman
3. Importiere die API-Endpoints oben
4. Teste jeden Endpoint

**Oder nutze curl** (wie in dieser Doku gezeigt)

---

**Fragen? Kristian, los geht's!** 🚀
