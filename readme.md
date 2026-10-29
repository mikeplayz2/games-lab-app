# Games Lab desktop app

This folder is the Electron app source. The separate public website can link to the
Windows installer attached to a GitHub Release; the website itself is not part of
the Electron app.

## What is needed

- Windows 10 or 11, 64-bit, for building the Windows installer.
- Node.js LTS, which includes npm.
- Git for Windows.
- A public GitHub repository for the app's releases (`mikeplayz2/games-lab-app`).
- GitHub CLI (`gh`) to publish releases from your computer.

## One-time setup

1. Install Node.js LTS from <https://nodejs.org/>, Git for Windows from
   <https://git-scm.com/download/win>, and GitHub CLI from
   <https://cli.github.com/>.
2. Sign in with GitHub CLI and connect this folder to the existing public
   repository:

   ```powershell
   gh auth login
   git init
   git branch -M main
   git remote add origin https://github.com/mikeplayz2/games-lab-app.git
   git add .
   git commit -m "Prepare Games Lab desktop app"
   git push -u origin main
   ```

   If `git remote add` says `origin` already exists, check it with
   `git remote -v` and update it with
   `git remote set-url origin https://github.com/mikeplayz2/games-lab-app.git`.
   If `git commit` asks who you are, set your Git name and email with
   `git config --global user.name "Your Name"` and
   `git config --global user.email "you@example.com"`, then retry the commit.
3. Open PowerShell in this folder and install the app's dependencies:

   ```powershell
   npm install
   ```

5. In your Firebase Console, add `localhost` to Authentication > Settings >
   Authorized domains if it is not already listed.
5. To enable Community Games, create a Cloud Firestore database in the
   `games-lab-a2298` Firebase project and publish the rules from `firestore.rules`
   in Firestore > Rules. The rules let signed-in users publish and play games,
   keep removed games visible only to their creator and the moderator, and limit
   moderation to the configured administrator UID. Game HTML runs in a sandboxed
   frame and cannot access the app's sign-in session.

Keep the app's local web address at `localhost:37142`. The stable address lets
Firebase keep a user's sign-in between app launches.

## Run and test the app

Start the app in development mode:

```powershell
npm start
```

Sign in, open Games, and try all twelve playable games, including Klondike
Solitaire, one-, two-, or four-suit Spider Solitaire, Neon Slope Run, Snowy
Summit Ride, and Cookie Comet. Then try the profile and settings pages.
Development mode does not check for app updates.

Open **Tutorial** from the bottom navigation for a quick guide to the game
library, community submissions, profile settings, and app updates. Community
publishing requires Firestore to be enabled and `firestore.rules` to be
published in the Firebase Console. A publish that times out can still finish
server-side; the same form can be safely retried without creating a duplicate.

The dashboard includes a random quick-play picker and a pauseable 15-minute
focus sprint. On Windows, Games Lab can show controls for the active system
music session in the bottom corner; enable or disable them in **Settings**.
The controls read track metadata from Windows and send play/pause/skip commands;
they do not record audio.

The navigation is a glass-style side dock on desktop and a bottom bar on
smaller screens. **Local games** scans common Steam, Epic, GOG, EA, Xbox,
Ubisoft, Riot, and Games folders for Windows executables. Use **Add folder** to
include another location. Scanning is local and read-only; selected game
folders are saved on this PC, and games launch only after you choose
**Play game**.

## Build the Windows installer

Build the installer without publishing it:

```powershell
npm run dist:win
```

The output is in `release`, with a name like
`Games-Lab-Setup-1.1.0.exe`. The branded installer uses a Games Lab welcome
panel, header, and matching executable and shortcut icon. Run it to test the
install wizard, Start menu entry, desktop shortcut, sign-in, and games on a
Windows computer.

The Windows app and installer icons are generated from `assets/logo.png` and
`assets/logo.ico`. The branded NSIS header and welcome/finish sidebar artwork
are in `assets/installer-header.bmp` and `assets/installer-sidebar.bmp`.

## Publish a release and deliver app updates

1. Change the `version` in `package.json` (for example, `1.0.0` to `1.0.1`).
   Every release must have a higher version than the last one.
2. Sign in to GitHub CLI:

   ```powershell
   gh auth login
   ```

3. In the same PowerShell window, supply the GitHub CLI token to the release
   publisher and publish the Windows installer:

   ```powershell
   $env:GH_TOKEN = (gh auth token)
   npm run publish:win
   ```

4. Check the GitHub repository's Releases page. If the release is a draft,
   publish it so the updater can see it.
5. Link your separate website's **Download for Windows** button to the latest
   release, or directly to the installer asset. The installer asset name is
   `Games-Lab-Setup-<version>.exe`.

The publisher uploads the installer and the update metadata. Installed copies
check for releases at launch and every four hours while the app is open. Only a
numerically newer release counts as an update; an up-to-date result is shown in
Settings without an interruption. If a newer version is found, the app shows
an in-app prompt and a Windows notification.
The user chooses when to download it and can restart to install it.

These are release checks, not a real-time push channel: a closed app cannot show
a notification. It checks again the next time it starts.

Never put `GH_TOKEN`, a personal access token, or any other publishing secret in
the app source or the public website. Keep the GitHub repository public so the
installed updater can read releases without a private token.

## Add a game

1. Create a folder such as `games/my-game/`.
2. Put the playable page at `games/my-game/index.html` and its custom icon at
   `games/my-game/icon.png` (SVG icons work too).
3. Copy an entry in `js/games-data.js` and set `folder` to
   `../games/my-game` and `icon` to `../games/my-game/icon.png`.

The library creates the game card and genre filter from that entry. Set
`status` to `"Playable"` and provide the folder path to make its Play button
available. Games can be self-contained HTML pages with their own styles and
scripts, so no additional app dependencies are needed.
