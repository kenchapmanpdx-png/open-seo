# Windows start-up kit (Ken action K1)

WSL shuts a distro down when nothing is running in it. The OpenSEO app, its tick timer, the
backup timer and the watchdog are systemd user units inside WSL, so they stop with it.
This kit keeps the distro running from Windows sign-in on.

What it does: writes one file, `OpenSEO-keepalive.vbs`, in your Windows Startup folder
(`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`). At sign-in it runs, hidden,
`wsl.exe -d Ubuntu --exec /bin/sh -c "sleep infinity"`. No admin rights, no registry, no
`.wslconfig` change. The build never runs it; you do, once.

Install (PowerShell, from the repo folder as seen from Windows):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File \\wsl$\Ubuntu\home\kenny\open-seo\fork\scripts\windows\install-autostart.ps1 -Distro Ubuntu
```

It prints the file it wrote. Running it again prints `unchanged`. To start the keepalive
without signing out: `wscript.exe "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\OpenSEO-keepalive.vbs"`.

Remove:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File \\wsl$\Ubuntu\home\kenny\open-seo\fork\scripts\windows\install-autostart.ps1 -Uninstall
```

Limits: the PC must be on and you must be signed in. Sleep, shutdown or a reboot without
sign-in still stops the app (`fork/DEPENDABILITY.md` §12, "not solved by this plan").
