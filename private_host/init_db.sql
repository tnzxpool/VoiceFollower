-- =================================================================
-- EdgeMesh Knowledge & Dialect Master Schema
-- Author & Architect: nizix (https://github.com/tnzxpool)
-- =================================================================

-- 1. Learned Dialects & Invented Terminology
CREATE TABLE IF NOT EXISTS learned_dialects (
    id VARCHAR(64) PRIMARY KEY,
    term VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(64) NOT NULL, -- 'DIALETTO', 'PAROLA_INVENTATA', 'VERSO', 'GERGO_TECNICO'
    origin_region VARCHAR(128) DEFAULT 'Non Specificata',
    exact_meaning TEXT NOT NULL,
    associated_command VARCHAR(255) DEFAULT 'NONE',
    standard_italian_equivalent VARCHAR(255),
    foreign_equivalents JSONB DEFAULT '{}'::jsonb,
    etymology_and_context TEXT,
    phonetic_ipa VARCHAR(128),
    confidence_score NUMERIC(4,2) DEFAULT 0.95,
    source_terminal VARCHAR(128) DEFAULT 'Terminale A/V Slave',
    cataloged_in_graph BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed Initial Italian & Regional Terminology
INSERT INTO learned_dialects (
    id, term, category, origin_region, exact_meaning, associated_command, standard_italian_equivalent, foreign_equivalents, etymology_and_context, phonetic_ipa, confidence_score, source_terminal
) VALUES 
(
    'dial_01', 
    'Bada lì', 
    'DIALETTO', 
    'Toscana (Firenze/Pisa)', 
    'Esclamazione per indicare di guardare attentamente o prestare attenzione immediata.', 
    'TRIGGER_SURVEILLANCE_CAMERA', 
    'Guarda attentamente / Fai attenzione', 
    '{"en": "Look there / Watch out", "fr": "Regarde là", "de": "Schau mal", "es": "Mira ahí"}'::jsonb, 
    'Espressione toscana arcaica dal verbo badare.', 
    'ˈbaːda ˈli', 
    0.98, 
    'Smartphone Wi-Fi'
),
(
    'dial_02', 
    'Nàna', 
    'PAROLA_INVENTATA', 
    'Gergo Operatore Familiare', 
    'Comando per attivare la modalità notte, spegnere i monitor periferici e impostare l''audio in sussurro.', 
    'SLEEP_STANDBY_MODE', 
    'Metti a nanna / Modalità Notte', 
    '{"en": "Night mode / Sleep time", "fr": "Mode nuit", "de": "Schlafmodus", "es": "Modo noche"}'::jsonb, 
    'Parola affettiva inventata dall''operatore.', 
    'ˈnaːna', 
    0.95, 
    'Polsino Aptico 01'
),
(
    'dial_03', 
    'Cianciare', 
    'DIALETTO', 
    'Toscana', 
    'Parlare a vuoto, dilungarsi in spiegazioni non necessarie.', 
    'REDUCE_VERBOSE_OUTPUT', 
    'Smettere di parlare a lungo / Sintesi rapida', 
    '{"en": "To chatter aimlessly", "fr": "Bavarder", "de": "Quatschen", "es": "Charlar"}'::jsonb, 
    'Termine dantesco toscano.', 
    'tʃanˈtʃaːre', 
    0.96, 
    'Terminale A/V Alpha'
),
(
    'dial_04', 
    'Mò', 
    'DIALETTO', 
    'Centro-Sud (Roma/Napoli)', 
    'Adesso, immediatamente, in questo preciso istante.', 
    'EXECUTE_IMMEDIATE_TASK', 
    'Adesso / Subito', 
    '{"en": "Right now / Immediately", "fr": "Maintenant", "de": "Jetzt sofort", "es": "Ahora mismo"}'::jsonb, 
    'Dal latino modo.', 
    'ˈmɔ', 
    0.99, 
    'Smartphone Wi-Fi'
)
ON CONFLICT (term) DO NOTHING;

-- 2. Knowledge Graph Nodes
CREATE TABLE IF NOT EXISTS graph_nodes (
    id VARCHAR(128) PRIMARY KEY,
    label VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL,
    attributes JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Knowledge Graph Edges
CREATE TABLE IF NOT EXISTS graph_edges (
    id SERIAL PRIMARY KEY,
    source_id VARCHAR(128) NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
    target_id VARCHAR(128) NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
    relation VARCHAR(128) NOT NULL,
    weight NUMERIC(4,2) DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Edge Nodes Hardware Registry
CREATE TABLE IF NOT EXISTS edge_nodes_registry (
    id VARCHAR(128) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(64) NOT NULL,
    status VARCHAR(32) DEFAULT 'ONLINE',
    ip_address VARCHAR(64),
    frequency_band VARCHAR(64),
    signal_dbm INTEGER DEFAULT -45,
    latency_ms INTEGER DEFAULT 14,
    battery_pct INTEGER DEFAULT 100,
    firmware_version VARCHAR(64) DEFAULT 'v3.2.0-nizix',
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for high performance sub-millisecond lookups
CREATE INDEX IF NOT EXISTS idx_learned_dialects_term ON learned_dialects(term);
CREATE INDEX IF NOT EXISTS idx_learned_dialects_category ON learned_dialects(category);
CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON graph_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_edges(target_id);
