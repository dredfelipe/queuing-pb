# Courtside

A pickleball queue for a venue TV, organizer phones/laptops, and player QR registration. Runs entirely on the venue’s local Wi-Fi after installation. No cloud service, account, CDN, or internet connection is required at play time.

## Start

Install Node.js 20 or newer, then run these commands in this folder:

```sh
npm install
npm start
```

Dependencies are already installed in this checkout. Installation on another computer needs internet once, or a copy of this folder including `node_modules`.

The terminal prints the local-network URLs and a generated organizer PIN. Open the TV URL in the TV browser, or connect the server computer to the TV with HDMI. Click **Fullscreen TV** on the TV display to show just the courts and waiting queue, hiding navigation, headings, and the QR panel. Press **Esc** or use the **Exit fullscreen** button in the lower-right corner to restore the normal view. If the TV browser does not support fullscreen requests, the simplified view still works; use the browser’s own fullscreen control to hide its toolbar. Open `/admin` on the organizer phone/laptop. Players scan the TV QR code to open `/join`.

All devices must use the same venue network. Keep the server computer awake with the app running. Allow Node.js through the computer’s firewall on the private venue network. Guest Wi-Fi with device/client isolation must be disabled or replaced by a network where devices can communicate. No internet is needed, but the Wi-Fi router must be working.

If the QR uses the wrong interface (for example, a VPN address), set the server computer’s reachable LAN address explicitly:

```sh
PUBLIC_URL=http://192.168.1.50:3000 npm start
```

A router DHCP reservation keeps that address stable. Restart after changing the address. Optional settings: `PORT` (default `3000`), `ORGANIZER_PIN`, and `DATA_DIR`.

## Play

- Add players in organizer controls or let players register themselves. Names must be unique in the session; add a surname/initial if needed.
- Photos are optional: choose a JPEG, PNG, or WebP during registration or add/change/remove one through **Edit** on a waiting player. The browser reduces uploaded photos to thumbnails; images are stored in `data/photos/` and appear on court cards and in the waiting queue. Players without photos use their initial.
- **Returning players** in admin opens the saved directory. Search by name and click **Check in** to reuse a player’s name, skill, photo, and identity. You can optionally select another saved player as a locked partner. Already checked-in players are marked and cannot be added twice. Profiles are saved automatically on first registration and kept after removal from the queue. Returning players who use QR registration should ask the organizer to check them in from the directory.
- Choose Beginner, Intermediate, or Advanced. Join individually to choose your partner on court, or enter both players together to lock teammates. Locked pairs are one queue entry and always stay on the same team.
- Add named courts as needed (up to 100). Pause an idle court to take it out of service.
- Tap **Start next four** on an available court. The earliest complete group of four is assigned. Courts start manually so players are not sent onto an unready court.
- If someone backs out, use **Replace player** on their active court. Choose the outgoing player and an individual waiting replacement. Remove the outgoing player from the session or return them to the back of the queue. The match timer and other players stay in place. Replacing a member of a locked pair requires explicit confirmation to unlock that pair; the remaining partner stays on court. To use a new arrival, add them to the waiting queue first.
- Tap **Finish & rotate** when a match ends. All four players return to the back in their original queue-entry order. The next complete group is immediately assigned to that court. With only four eligible players, those same four play again.
- Each court box shows its four players in queue-entry order, without a team split or VS label. Players decide their partners on court. Skill levels remain visible only in organizer controls.
- A locked pair is never split to fill one remaining spot. The system selects the earliest compatible complete group; this can temporarily bypass an entry that cannot fit. Unselected players keep their queue positions.
- Use **Edit** beside a waiting entry in organizer controls to update player names and skill levels. Locked pairs can be edited together without changing queue position or teammate history. Players already on court cannot be edited until they return to the waiting queue. Skill levels appear in organizer controls but are hidden on the TV.
- Remove a waiting entry if a player leaves. Removing a locked pair removes both players. Players currently on court return to the waiting queue after **Finish & rotate**.

## Saved sessions and access

Changes save atomically to `data/session.json`; restarting restores courts, waiting players, active matches, teammate history, and the saved player directory. Existing session players are automatically included in the directory when upgrading. Directory lookup and returning-player check-in require the organizer PIN. Photos live in `data/photos/`; back up the whole `data/` folder to retain them. The organizer PIN is stored in `data/organizer-pin` and stays the same across restarts. Do not share the PIN with players. The app uses ordinary HTTP on your trusted venue LAN. Names and skill levels are visible to connected devices; organizer actions require the PIN, and repeated incorrect PIN attempts are rate limited.

The saved directory is part of `data/session.json`. Keep this file between visits and remove departing players through organizer controls; they can be checked in again later. Deleting or moving this file also clears the saved directory, so do that only when intentionally clearing all records and after making a backup. Keep `data/organizer-pin` to preserve the same PIN. Back up `data/` while the server is stopped if you need to move computers. There is one shared session per server; this version supports multiple courts at one venue.

## Checks

```sh
npm test
npm run check
```

Tests cover rotation, skill balance, locked pairs, teammate variation, court allocation, input validation, organizer access, QR rendering, live event updates, and persistence across server restarts. Browser layout and real devices on the venue Wi-Fi need an on-site check.
