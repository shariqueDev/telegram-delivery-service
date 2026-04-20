# how to create three different Telegram_mtproto session

You get three different sessions by logging in three times, each time as a different Telegram user (different phone number), and saving three different session strings into config/mtproto-accounts.json.

Prerequisites (once)
backend/.env has the same pair for all runs:
TELEGRAM_API_ID
TELEGRAM_API_HASH
(from my.telegram.org/apps)
backend/config/mtproto-accounts.json exists with three entries (acc_1, acc_2, acc_3). 
You can start with placeholders and replace the "session" values as you go.


# Steps to generate different sessions

For account 1 (first Telegram user)
Open a terminal in backend:
cd to the folder that contains package.json.

Run:
npm run mtproto:login
When asked, use phone number A (the first Telegram account).
Enter the login code (and 2FA if prompted).
The script prints a session string. Copy it.
Paste it into mtproto-accounts.json as acc_1 → "session": "…pasted string…".

For account 2 (second Telegram user)
Run npm run mtproto:login again (same machine, same .env).
Use phone number B (a different Telegram account than A).
Copy the new session string (it must not be the same as acc_1).
Put it under acc_2 in mtproto-accounts.json.
Tip: If the script reuses an existing session from acc_1 for “re-login”, either temporarily clear acc_1’s session to dummy text or run login on another machine/copy of the project so it starts empty — or adjust the script so you pick which slot to update. Simplest approach: after first login, replace only acc_2 and acc_3 by running login twice more with B and C phones and pasting into the right rows.