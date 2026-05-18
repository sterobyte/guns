# GUNS Panel

Version: `0.1.9`

Separate web admin panel for `guns.gs`.

## Run locally

Start the game backend first:

```cmd
cd C:\Users\stero\Documents\Codex\2026-05-12\files-mentioned-by-the-user-guns\guns-next1
npm run server
```

Start the panel:

```cmd
cd C:\Users\stero\Documents\Codex\2026-05-12\files-mentioned-by-the-user-guns\guns-panel
npm run dev
```

Open:

```txt
http://127.0.0.1:5179/
```

Current menu:

- Users

In `0.1.2`, the Users table shows `Kind`: `CADET`, `NICK`, or `PILOT`.

In `0.1.3`, the top metrics replace `Updated` with backend `Uptime`.

In `0.1.4`, the Users table shows the anonymous `Callsign` separately from
the visible `Nick`.

In `0.1.5`, the Users table renames `Kind` to `Status`; online state now lives
in the separate `Online` column.

In `0.1.6`, each Users row has a delete action backed by the admin API.

In `0.1.7`, the Users table shows the internal row `ID`; the visible value is
shortened, and the full ID is available in the cell tooltip.

In `0.1.8`, account status displays `CLAIMED` instead of `REGISTERED`.

In `0.1.9`, Users shows one public identity column: `Callsign`. The old
separate `Nick` column is hidden from the admin table.

In `0.1.10`, Users shows active live connections separately from cumulative
sessions. One claimed account can be one user row with several active browsers.

The panel reads users from:

```txt
http://127.0.0.1:3000/admin/users
```
