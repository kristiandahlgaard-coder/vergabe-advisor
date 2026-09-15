-- Vergabe-Advisor Backend Database Schema
-- PostgreSQL 14+

-- =============================================================================
-- USERS & AUTHENTICATION
-- =============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    vorname VARCHAR(100) NOT NULL,
    nachname VARCHAR(100) NOT NULL,
    abteilung VARCHAR(100),
    telefon VARCHAR(20),
    rolle VARCHAR(50) NOT NULL CHECK (rolle IN (
        'beantragender',
        'freigeber_stufe_1',
        'freigeber_stufe_2',
        'freigeber_stufe_3',
        'freigeber_stufe_4',
        'freigeber_stufe_5',
        'admin'
    )),
    aktiv BOOLEAN DEFAULT TRUE,
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    geaendert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- FREIGABE-REGELN (Admin konfiguriert diese)
-- =============================================================================

CREATE TABLE freigabe_regeln (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    beschreibung TEXT,
    
    -- Bedingungen (alle optional - wenn NULL, dann egal)
    bedingung_volumen_min DECIMAL(12, 2),
    bedingung_volumen_max DECIMAL(12, 2),
    bedingung_leistungsart VARCHAR(100),
    bedingung_struktur VARCHAR(50),
    bedingung_besonderheit VARCHAR(100),
    
    -- Erforderliche Freigeber (als JSON Array von User-IDs oder Rollen)
    erforderliche_freigeber_rollen TEXT[], -- array of rolle names
    
    -- Seriierung (bei mehreren passenden Regeln)
    prioritaet INTEGER DEFAULT 100,
    aktiv BOOLEAN DEFAULT TRUE,
    
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    geaendert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- VERGABEN (Kernentität)
-- =============================================================================

CREATE TABLE vergaben (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Wer hat es angelegt
    ersteller_id UUID NOT NULL REFERENCES users(id),
    
    -- KERNINFO
    auftraggeber_typ VARCHAR(50) NOT NULL CHECK (auftraggeber_typ IN (
        'klassisch',
        '98_gwb',
        'sektoren'
    )),
    leistungsbeschreibung TEXT NOT NULL,
    leistungsart VARCHAR(100),
    volumen DECIMAL(12, 2) NOT NULL,
    struktur VARCHAR(50) NOT NULL CHECK (struktur IN (
        'einzeln',
        'rahmen',
        'dps'
    )),
    erfuellungszeitraum TEXT,
    
    -- ANFORDERER
    anfordernde_stelle VARCHAR(255),
    ansprechpartner_name VARCHAR(255),
    ansprechpartner_telefon VARCHAR(20),
    ansprechpartner_email VARCHAR(255),
    
    -- DOKUMENTATION
    begruendung TEXT,
    besonderheiten TEXT,
    risikoklasse VARCHAR(50) CHECK (risikoklasse IN ('gering', 'mittel', 'hoch')),
    projektbezeichnung VARCHAR(255),
    
    -- STATUS
    status VARCHAR(50) NOT NULL DEFAULT 'entwurf' CHECK (status IN (
        'entwurf',
        'in_freigabe',
        'genehmigt',
        'abgelehnt',
        'archiviert'
    )),
    
    -- Abgelehnt-Begründung
    ablehnungsgrund TEXT,
    
    -- Timestamps
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    geaendert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indices für Performance
    CONSTRAINT fk_ersteller FOREIGN KEY (ersteller_id) REFERENCES users(id)
);

CREATE INDEX idx_vergaben_ersteller ON vergaben(ersteller_id);
CREATE INDEX idx_vergaben_status ON vergaben(status);
CREATE INDEX idx_vergaben_erstellt_am ON vergaben(erstellt_am);

-- =============================================================================
-- DYNAMISCHE FREIGABENKETTE (pro Vergabe)
-- =============================================================================

CREATE TABLE vergabe_freigabenkette (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vergabe_id UUID NOT NULL REFERENCES vergaben(id) ON DELETE CASCADE,
    
    freigeber_id UUID NOT NULL REFERENCES users(id),
    
    -- Reihenfolge: 1, 2, 3 = linear / 'parallel' = zeitgleich mit anderen
    reihenfolge VARCHAR(20) NOT NULL DEFAULT '1',
    
    -- Warum wurde dieser Freigeber hinzugefügt?
    grund VARCHAR(255),
    
    -- Status dieser einzelnen Freigabe
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'approved',
        'rejected'
    )),
    
    -- Kommentar des Freigebers
    kommentar TEXT,
    
    -- Wann genehmigt/abgelehnt?
    entschieden_am TIMESTAMP,
    
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_vergabe FOREIGN KEY (vergabe_id) REFERENCES vergaben(id),
    CONSTRAINT fk_freigeber FOREIGN KEY (freigeber_id) REFERENCES users(id)
);

CREATE INDEX idx_freigabenkette_vergabe ON vergabe_freigabenkette(vergabe_id);
CREATE INDEX idx_freigabenkette_freigeber ON vergabe_freigabenkette(freigeber_id);
CREATE INDEX idx_freigabenkette_status ON vergabe_freigabenkette(status);

-- =============================================================================
-- ANHÄNGE (PDF, Excel, CSV)
-- =============================================================================

CREATE TABLE anhaenge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vergabe_id UUID NOT NULL REFERENCES vergaben(id) ON DELETE CASCADE,
    
    dateiname VARCHAR(255) NOT NULL,
    dateityp VARCHAR(50),
    dateigroesse INTEGER,
    dateipfad VARCHAR(500),
    
    hochgeladen_von UUID NOT NULL REFERENCES users(id),
    hochgeladen_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_vergabe_anhaenge FOREIGN KEY (vergabe_id) REFERENCES vergaben(id)
);

CREATE INDEX idx_anhaenge_vergabe ON anhaenge(vergabe_id);

-- =============================================================================
-- AUDIT-TRAIL (Wer hat wann was gemacht)
-- =============================================================================

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vergabe_id UUID REFERENCES vergaben(id) ON DELETE SET NULL,
    
    benutzer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    aktion VARCHAR(100) NOT NULL, -- 'created', 'updated', 'approved', 'rejected', etc.
    
    beschreibung TEXT,
    aenderte_felder JSONB, -- welche Felder wurden geändert
    
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_vergabe ON audit_log(vergabe_id);
CREATE INDEX idx_audit_benutzer ON audit_log(benutzer_id);
CREATE INDEX idx_audit_erstellt_am ON audit_log(erstellt_am);

-- =============================================================================
-- DEFAULT FREIGABE-REGELN (Beispiele)
-- =============================================================================

INSERT INTO freigabe_regeln (
    name,
    beschreibung,
    bedingung_volumen_min,
    bedingung_volumen_max,
    erforderliche_freigeber_rollen,
    prioritaet,
    aktiv
) VALUES
(
    'Standard bis €20.000',
    'Vergaben bis €20.000 brauchen Vergabestelle + Finanzen',
    0,
    20000,
    ARRAY['freigeber_stufe_1', 'freigeber_stufe_2'],
    10,
    TRUE
),
(
    'Standard €20.001 - €100.000',
    'Vergaben €20.001-€100.000 brauchen zusätzlich Bereichsleitung',
    20000.01,
    100000,
    ARRAY['freigeber_stufe_1', 'freigeber_stufe_2', 'freigeber_stufe_4'],
    20,
    TRUE
),
(
    'Standard über €100.000',
    'Vergaben über €100.000 brauchen Geschäftsführung',
    100000.01,
    999999999,
    ARRAY['freigeber_stufe_1', 'freigeber_stufe_2', 'freigeber_stufe_4', 'freigeber_stufe_5'],
    30,
    TRUE
),
(
    'Rahmenvereinbarung',
    'Alle Rahmenvereinbarungen brauchen RV-Verantwortliche',
    NULL,
    NULL,
    ARRAY['freigeber_stufe_3'],
    15,
    TRUE
);

-- =============================================================================
-- DEFAULT TEST-USER (für Entwicklung)
-- =============================================================================

INSERT INTO users (
    email,
    password_hash,
    vorname,
    nachname,
    abteilung,
    rolle
) VALUES
(
    'kristian@tempelhof.de',
    '$2b$12$placeholder_hash_do_not_use',
    'Kristian',
    'Beantragender',
    'Vergabestelle',
    'beantragender'
),
(
    'vergabestelle@tempelhof.de',
    '$2b$12$placeholder_hash_do_not_use',
    'Lisa',
    'Vergabestelle',
    'Vergabestelle',
    'freigeber_stufe_1'
),
(
    'finanzen@tempelhof.de',
    '$2b$12$placeholder_hash_do_not_use',
    'Max',
    'Finanzen',
    'Finanzen',
    'freigeber_stufe_2'
),
(
    'recht@tempelhof.de',
    '$2b$12$placeholder_hash_do_not_use',
    'Anna',
    'Recht',
    'Recht',
    'freigeber_stufe_3'
),
(
    'bereichsleitung@tempelhof.de',
    '$2b$12$placeholder_hash_do_not_use',
    'Frank',
    'Bereichsleitung',
    'Leitung',
    'freigeber_stufe_4'
),
(
    'geschaeftsfuehrung@tempelhof.de',
    '$2b$12$placeholder_hash_do_not_use',
    'Petra',
    'Geschäftsführung',
    'Geschäftsführung',
    'freigeber_stufe_5'
),
(
    'admin@tempelhof.de',
    '$2b$12$placeholder_hash_do_not_use',
    'Admin',
    'System',
    'IT',
    'admin'
);
