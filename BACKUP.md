# Backups

## Wie es läuft

- **Täglich ~04:43 UTC** holt die GitHub Action `DB Backup` (`.github/workflows/backup.yml`)
  einen Voll-Export aller App-Tabellen von `https://matchos-ten.vercel.app/api/backup`
  (Auth: `Authorization: Bearer <BACKUP_SECRET>`) und speichert ihn als
  **Workflow-Artifact** (gzip + GPG, 90 Tage Aufbewahrung). Nichts landet in der Git-History.
- **Verschlüsselt mit `BACKUP_SECRET`.** Bei einem öffentlichen Repository kann jeder
  Workflow-Artifacts herunterladen — deshalb liegt dort nur Chiffrat.
- Roter Workflow-Lauf = GitHub schickt eine Mail = Frühwarnung.
- GitHub deaktiviert Schedules nach 60 Tagen ohne Repo-Aktivität — bei der
  Deaktivierungs-Mail den Workflow manuell wieder aktivieren.

## Backup manuell ziehen

GitHub → Actions → „DB Backup" → „Run workflow", oder direkt:

```bash
curl -H "Authorization: Bearer $BACKUP_SECRET" \
  https://matchos-ten.vercel.app/api/backup -o backup.json
```

Artifact herunterladen: GitHub → Actions → Lauf anklicken → „Artifacts".

## Wiederherstellen

1. Backup-JSON besorgen. Artifact herunterladen, dann entschlüsseln und entpacken:

```bash
BACKUP_SECRET='…' openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in backup.json.gz.enc -out backup.json.gz -pass env:BACKUP_SECRET
gunzip backup.json.gz
```

2. `.env.local` braucht `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
   (Supabase-Dashboard → Settings → API → service_role).
3. Zurückspielen (Upsert, löscht nichts):

```bash
node scripts/restore-backup.mjs backup.json
```

Für einen **sauberen Voll-Restore** (z. B. nach Datenmüll) vorher die betroffenen
Tabellen im Supabase-Dashboard (Table Editor bzw. SQL: `truncate <tabelle> cascade`)
leeren und dann das Script laufen lassen.

## Neue Tabelle angelegt?

In `src/app/api/backup/route.ts` (TABLES) **und** `scripts/restore-backup.mjs` (ORDER)
ergänzen, sonst fehlt sie im Backup.
