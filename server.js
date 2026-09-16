// Vergabe-Advisor Backend Server
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

// ============================================================================
// KONFIGURATION
// ============================================================================

const app = express();
const PORT = process.env.PORT || 5000;
const DB_URL = process.env.DATABASE_URL || 'postgresql://vergabe_user:vergabe_pass@localhost:5432/vergabe_db';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_production';

// ============================================================================
// MIDDLEWARE
// ============================================================================

app.use(cors());
app.use(express.json());

// Database Connection Pool
const pool = new Pool({
    connectionString: DB_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

// ============================================================================
// AUTHENTIFIZIERUNG (JWT)
// ============================================================================

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token erforderlich' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token ungültig' });
        req.user = user;
        next();
    });
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({
            status: 'ok',
            database: 'connected',
            timestamp: result.rows[0].now
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            database: 'disconnected',
            error: err.message
        });
    }
});

// ============================================================================
// AUTH ENDPOINTS
// ============================================================================

// Login (vereinfacht — in Produktion: richtiges Password-Hashing)
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });
    }

    try {
        const result = await pool.query(
            'SELECT id, email, vorname, nachname, rolle FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Benutzer nicht gefunden' });
        }

        const user = result.rows[0];

        // TOKEN erstellen
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                rolle: user.rolle
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                vorname: user.vorname,
                nachname: user.nachname,
                rolle: user.rolle
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Login-Fehler' });
    }
});

// ============================================================================
// VERGABEN ENDPOINTS
// ============================================================================

// GET: Alle Vergaben (gefiltert nach User-Rolle)
app.get('/api/vergaben', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const rolle = req.user.rolle;

        let query = 'SELECT * FROM vergaben';
        let params = [];

        // Admin sieht alles, andere sehen nur ihre eigenen oder wo sie freigeben müssen
        if (rolle !== 'admin') {
            query += ` WHERE ersteller_id = $1 OR id IN (
                SELECT DISTINCT vergabe_id FROM vergabe_freigabenkette 
                WHERE freigeber_id = $1
            )`;
            params = [userId];
        }

        query += ' ORDER BY erstellt_am DESC LIMIT 100';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Abrufen' });
    }
});

// GET: Einzelne Vergabe mit Freigabenkette
app.get('/api/vergaben/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const vergabeResult = await pool.query(
            'SELECT * FROM vergaben WHERE id = $1',
            [id]
        );

        if (vergabeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Vergabe nicht gefunden' });
        }

        const freigabenResult = await pool.query(
            `SELECT fk.id, fk.reihenfolge, fk.grund, fk.status, fk.kommentar, fk.entschieden_am,
                    u.id as freigeber_id, u.vorname, u.nachname, u.email, u.rolle
             FROM vergabe_freigabenkette fk
             JOIN users u ON fk.freigeber_id = u.id
             WHERE fk.vergabe_id = $1
             ORDER BY fk.reihenfolge ASC`,
            [id]
        );

        res.json({
            vergabe: vergabeResult.rows[0],
            freigabenkette: freigabenResult.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Abrufen' });
    }
});

// POST: Neue Vergabe erstellen
app.post('/api/vergaben', authenticateToken, async (req, res) => {
    const {
        auftraggeber_typ,
        leistungsbeschreibung,
        leistungsart,
        volumen,
        struktur,
        erfuellungszeitraum,
        anfordernde_stelle,
        ansprechpartner_name,
        ansprechpartner_telefon,
        ansprechpartner_email,
        begruendung,
        besonderheiten,
        risikoklasse,
        projektbezeichnung
    } = req.body;

    const ersteller_id = req.user.id;

    try {
        // 1. Vergabe erstellen
        const vergabeResult = await pool.query(
            `INSERT INTO vergaben (
                ersteller_id, auftraggeber_typ, leistungsbeschreibung, leistungsart,
                volumen, struktur, erfuellungszeitraum, anfordernde_stelle,
                ansprechpartner_name, ansprechpartner_telefon, ansprechpartner_email,
                begruendung, besonderheiten, risikoklasse, projektbezeichnung
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING id`,
            [
                ersteller_id, auftraggeber_typ, leistungsbeschreibung, leistungsart,
                volumen, struktur, erfuellungszeitraum, anfordernde_stelle,
                ansprechpartner_name, ansprechpartner_telefon, ansprechpartner_email,
                begruendung, besonderheiten, risikoklasse, projektbezeichnung
            ]
        );

        const vergabe_id = vergabeResult.rows[0].id;

        // 2. Freigabe-Regeln anwenden
        const regelResult = await pool.query(
            `SELECT erforderliche_freigeber_rollen FROM freigabe_regeln
             WHERE aktiv = TRUE
             AND (bedingung_volumen_min IS NULL OR $1 >= bedingung_volumen_min)
             AND (bedingung_volumen_max IS NULL OR $1 <= bedingung_volumen_max)
             AND (bedingung_struktur IS NULL OR $2 = bedingung_struktur)
             ORDER BY prioritaet ASC`,
            [volumen, struktur]
        );

        // Sammle alle erforderlichen Rollen
        const requiredRoles = new Set();
        regelResult.rows.forEach(row => {
            if (row.erforderliche_freigeber_rollen) {
                row.erforderliche_freigeber_rollen.forEach(role => requiredRoles.add(role));
            }
        });

        // 3. Finde Benutzer mit diesen Rollen
        if (requiredRoles.size > 0) {
            const rolesArray = Array.from(requiredRoles);
            const usersResult = await pool.query(
                `SELECT id, rolle FROM users WHERE rolle = ANY($1) AND aktiv = TRUE`,
                [rolesArray]
            );

            // 4. Erstelle Freigabenkette
            let reihenfolge = 1;
            for (const user of usersResult.rows) {
                await pool.query(
                    `INSERT INTO vergabe_freigabenkette (vergabe_id, freigeber_id, reihenfolge, grund)
                     VALUES ($1, $2, $3, $4)`,
                    [vergabe_id, user.id, reihenfolge, `Regel: ${user.rolle}`]
                );
                reihenfolge++;
            }
        }

        // 5. Audit-Log
        await pool.query(
            `INSERT INTO audit_log (vergabe_id, benutzer_id, aktion, beschreibung)
             VALUES ($1, $2, $3, $4)`,
            [vergabe_id, ersteller_id, 'created', `Vergabe erstellt: ${leistungsbeschreibung}`]
        );

        res.status(201).json({ id: vergabe_id, message: 'Vergabe erstellt' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// PUT: Vergabe aktualisieren (nur als Entwurf)
app.put('/api/vergaben/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { leistungsbeschreibung, volumen, struktur, begruendung } = req.body;

    try {
        const result = await pool.query(
            `UPDATE vergaben 
             SET leistungsbeschreibung = $1, volumen = $2, struktur = $3, begruendung = $4, geaendert_am = NOW()
             WHERE id = $5 AND status = 'entwurf'
             RETURNING *`,
            [leistungsbeschreibung, volumen, struktur, begruendung, id]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Vergabe kann nicht mehr bearbeitet werden' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// POST: Vergabe einreichen (Entwurf → In Freigabe)
app.post('/api/vergaben/:id/submit', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { manual_approvals_to_add, manual_approvals_to_remove } = req.body || {};

    try {
        // 1. Status auf 'in_freigabe' setzen
        await pool.query(
            `UPDATE vergaben SET status = 'in_freigabe', geaendert_am = NOW() WHERE id = $1`,
            [id]
        );

        // 2. Manuelle Anpassungen der Freigabenkette (falls provided)
        // TODO: Implementieren

        // 3. Audit-Log
        await pool.query(
            `INSERT INTO audit_log (vergabe_id, benutzer_id, aktion)
             VALUES ($1, $2, $3)`,
            [id, req.user.id, 'submitted']
        );

        res.json({ message: 'Vergabe eingereicht' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// POST: Freigabe gewähren
app.post('/api/vergaben/:id/approve/:freigaber_id', authenticateToken, async (req, res) => {
    const { id, freigaber_id } = req.params;
    const { kommentar } = req.body || {};

    try {
        // Prüfe: Ist der User wirklich der Freigeber?
        if (req.user.id !== freigaber_id && req.user.rolle !== 'admin') {
            return res.status(403).json({ error: 'Keine Berechtigung' });
        }

        // Update Freigabe Status
        await pool.query(
            `UPDATE vergabe_freigabenkette 
             SET status = 'approved', kommentar = $1, entschieden_am = NOW()
             WHERE vergabe_id = $2 AND freigeber_id = $3`,
            [kommentar, id, freigaber_id]
        );

        // Prüfe: Alle Freigaben genehmigt?
        const pendingResult = await pool.query(
            `SELECT COUNT(*) as count FROM vergabe_freigabenkette 
             WHERE vergabe_id = $1 AND status = 'pending'`,
            [id]
        );

        if (pendingResult.rows[0].count === 0) {
            // Alle genehmigt!
            await pool.query(
                `UPDATE vergaben SET status = 'genehmigt', geaendert_am = NOW() WHERE id = $1`,
                [id]
            );
        }

        // Audit-Log
        await pool.query(
            `INSERT INTO audit_log (vergabe_id, benutzer_id, aktion)
             VALUES ($1, $2, $3)`,
            [id, req.user.id, 'approved']
        );

        res.json({ message: 'Freigegeben' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// POST: Freigabe ablehnen
app.post('/api/vergaben/:id/reject/:freigaber_id', authenticateToken, async (req, res) => {
    const { id, freigaber_id } = req.params;
    const { ablehnungsgrund, kommentar } = req.body || {};

    try {
        // Prüche: Ist der User wirklich der Freigeber?
        if (req.user.id !== freigaber_id && req.user.rolle !== 'admin') {
            return res.status(403).json({ error: 'Keine Berechtigung' });
        }

        // Update Freigabe Status
        await pool.query(
            `UPDATE vergabe_freigabenkette 
             SET status = 'rejected', kommentar = $1, entschieden_am = NOW()
             WHERE vergabe_id = $2 AND freigeber_id = $3`,
            [kommentar, id, freigaber_id]
        );

        // Vergabe Status auf 'abgelehnt'
        await pool.query(
            `UPDATE vergaben 
             SET status = 'abgelehnt', ablehnungsgrund = $1, geaendert_am = NOW()
             WHERE id = $2`,
            [ablehnungsgrund, id]
        );

        // Audit-Log
        await pool.query(
            `INSERT INTO audit_log (vergabe_id, benutzer_id, aktion)
             VALUES ($1, $2, $3)`,
            [id, req.user.id, 'rejected']
        );

        res.json({ message: 'Abgelehnt' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// FREIGABE-REGELN (Admin nur)
// ============================================================================

app.get('/api/freigabe-regeln', authenticateToken, async (req, res) => {
    if (req.user.rolle !== 'admin') {
        return res.status(403).json({ error: 'Admin-Zugriff erforderlich' });
    }

    try {
        const result = await pool.query('SELECT * FROM freigabe_regeln ORDER BY prioritaet ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// 404 & ERROR HANDLING
// ============================================================================

app.use((req, res) => {
    res.status(404).json({ error: 'Route nicht gefunden' });
});

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Interner Fehler' });
});

// ============================================================================
// SERVER STARTEN
// ============================================================================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ Vergabe-Advisor Backend läuft auf http://0.0.0.0:${PORT}`);
    console.log(`📊 Health-Check: GET http://0.0.0.0:${PORT}/health`);
    console.log(`🔐 Login: POST http://0.0.0.0:${PORT}/api/auth/login`);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM empfangen, fahre herunter...');
    pool.end();
    process.exit(0);
});
