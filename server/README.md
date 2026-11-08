# Gemini review analysis (local development)

1. Create a Gemini API key in Google AI Studio. Keep it private; do not put it in a `VITE_` variable or client-side code.
2. Copy `.env.example` to `.env` and set `GEMINI_API_KEY`. The default model is `gemini-3.5-flash`; change `GEMINI_MODEL` if that model is unavailable to your account.
3. Open two terminals in the project folder:

   ```powershell
   npm.cmd run ai:server
   npm.cmd run dev
   ```

4. Open the Vite URL and click **Analyze with Gemini** in the home-page reviews section.

The AI server binds to localhost on port 5001 and limits requests to 12 per minute per local client. The browser sends review text to this local server, which calls Gemini; the API key never goes to the browser. Google AI Studio free-tier model access, quotas, region availability, and terms can change. This local-development endpoint should not be exposed publicly without authentication and deployment rate limits.
