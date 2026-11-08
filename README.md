

In the project folder, open a second PowerShell terminal and run:

```powershell
Copy-Item .env.example .env
```

Add your Gemini API key to `.env` as `GEMINI_API_KEY=your_key_here`, then start the server:

```powershell
npm.cmd run ai:server
```

