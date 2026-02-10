# AI Advisor - Setup Guide

## Panoramica

La nuova funzionalità **AI Advisor** permette agli utenti di cercare investimenti usando linguaggio naturale. L'AI analizza la richiesta dell'utente e suggerisce asset appropriati con motivazioni dettagliate.

## Funzionalità

1. **Input testo libero**: L'utente descrive cosa cerca (settore, rischio, orizzonte temporale, ecc.)
2. **Analisi AI**: L'AI estrae i criteri di ricerca dal testo
3. **Ricerca intelligente**: Il sistema cerca asset nel database che matchano i criteri
4. **Suggerimenti motivati**: Ogni suggerimento include una spiegazione dettagliata del perché è stato selezionato

## Setup n8n Workflow

### 1. Importa il Workflow

1. Apri n8n: http://localhost:5678
2. Vai su **Workflows** → **Import from File**
3. Seleziona il file: `/n8n/workflows/Financy - AI Investment Advisor.json`
4. Click su **Import**

### 2. Configura le Credenziali

Il workflow richiede:

#### PostgreSQL Database
- Nome credenziale: `Financy DB`
- Host: `localhost`
- Port: `5432`
- Database: `financy`
- User: (il tuo DB user)
- Password: (la tua DB password)

#### OpenAI API
- Nome credenziale: `OpenAI`
- API Key: (la tua chiave API OpenAI)
- Model: `gpt-4o` (o `gpt-4-turbo`)

### 3. Attiva il Workflow

1. Apri il workflow importato
2. Verifica che tutti i nodi siano configurati correttamente
3. Click su **Active** (toggle in alto a destra)
4. Copia l'URL del webhook (dovrebbe essere qualcosa come `http://localhost:5678/webhook/advisor-search`)

### 4. Configura l'API Backend

Assicurati che nel file `.env` del backend ci sia:

```env
N8N_WEBHOOK_URL=http://localhost:5678
```

## Come Funziona il Workflow

1. **Webhook**: Riceve la richiesta dall'API con `userId` e `query`
2. **OpenAI - Analyze Query**: Estrae criteri strutturati dal testo libero
   - Settori preferiti
   - Livello di rischio
   - Orizzonte temporale
   - Geografia
   - Stile di investimento
3. **PostgreSQL - Search Assets**: Cerca asset nel database che matchano i criteri
4. **OpenAI - Rank & Explain**: Valuta e spiega perché ogni asset è adatto
5. **Code - Merge Results**: Combina i dati degli asset con le raccomandazioni AI
6. **Respond to Webhook**: Ritorna i suggerimenti all'API

## Esempio di Utilizzo

### Input Utente:
```
Vorrei investire in tecnologia verde con un orizzonte a lungo termine
e rischio moderato. Preferisco aziende europee con buoni fondamentali
e un track record di sostenibilità.
```

### Output del Sistema:
```json
{
  "suggestions": [
    {
      "symbol": "ENGI.PA",
      "name": "Engie",
      "currentPrice": 13.45,
      "currency": "EUR",
      "sector": "Utilities",
      "reason": "Engie è un leader europeo nell'energia rinnovabile con un forte impegno per la transizione energetica. Il lungo orizzonte temporale si allinea bene con i loro piani di espansione nelle rinnovabili...",
      "score": 92,
      "expectedReturn": 8.5,
      "riskLevel": "medium",
      "timeHorizon": "long"
    }
  ]
}
```

## Personalizzazioni

### Modificare i Criteri di Ricerca

Modifica il nodo **PostgreSQL - Search Assets** per cambiare:
- Numero massimo di risultati (`LIMIT 50`)
- Filtri per tipo di asset
- Criteri di ordinamento

### Modificare l'Analisi AI

Modifica i prompt nei nodi OpenAI per:
- Cambiare il tono delle spiegazioni
- Aggiungere nuovi criteri di valutazione
- Modificare il formato dell'output

## Troubleshooting

### Il workflow non risponde
- Verifica che n8n sia in esecuzione: `npm run n8n` dalla root del progetto
- Controlla che il workflow sia **Active**
- Verifica i log di n8n per errori

### Errori di connessione database
- Verifica le credenziali PostgreSQL in n8n
- Assicurati che il database sia accessibile da n8n

### Suggerimenti non pertinenti
- Modifica i prompt OpenAI per essere più specifici
- Aumenta il numero di asset da cercare nel database
- Aggiungi più criteri di filtro nella query SQL

## Costi

Il workflow usa OpenAI GPT-4, che ha dei costi:
- ~$0.03 per richiesta (dipende dalla lunghezza del testo)
- Considera di usare `gpt-3.5-turbo` per costi ridotti (cambia il model nei nodi OpenAI)

## Prossimi Sviluppi

- [ ] Cache dei risultati per query simili
- [ ] Salvataggio storico delle ricerche
- [ ] Aggiunta di più fonti dati (news, sentiment, analisi tecnica)
- [ ] Integrazione con il sistema di portfolio per suggerimenti personalizzati
- [ ] Possibilità di salvare i suggerimenti come watchlist
