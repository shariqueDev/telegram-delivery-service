# Telegram link delivery — overview for stakeholders

**Audience:** Product and engineering leadership  
**Purpose:** Summarize what was explored, why it matters, and what the limits are—without implementation detail.

---

## What this is

A small **proof-of-concept backend** that helps send a **link (and a short message)** to a player’s **Telegram account** from our systems. It supports two different technical paths so we can compare them against real-world constraints (stores, regions, and Telegram’s own rules).

---

## Why we care

In some **markets or client environments**, relying on a **standard Telegram bot** inside the game or app is difficult or impossible. We still want players to receive a **verifiable link** on Telegram when that is allowed.

This POC shows how we can:

- **Push** a message to Telegram when Telegram accepts it, and  
- **Return the same link in the API response** so the client can **show or copy** it if the push path fails (for example when the in-app browser cannot open Telegram).

That gives a fallback path for “bot-unfriendly” distribution contexts without changing the core idea: the player gets the link on Telegram or from the game UI.

---

## Two ways to reach Telegram

| Approach | In plain terms | When it tends to fit |
|----------|----------------|----------------------|
| **Official bot channel** | A **bot account** sends the message, like most Telegram integrations. | Normal Telegram integrations; user has interacted with our bot as Telegram expects. |
| **Logged-in user channel** | Our backend uses a **real Telegram user session** (same technology family as the main Telegram apps) to send the message. | When a bot-only path is blocked or unsuitable; must be used carefully and in line with policy. |

Both paths are **subject to Telegram’s rules**, not only our code. Neither path is a guarantee that **every** player can be messaged on first try without prior relationship or consent flows.

---

## API and service footprint (light detail)

**Shape of the service**  
A small **Node.js** backend exposes a **simple HTTP API**: the game or another internal client sends a **recipient** (Telegram user id and/or public username, depending on path), a **link**, and an optional **short line of text**. The service attempts delivery on Telegram and **always returns the same link in the reply** so the client can surface it if the push did not go through. A basic **health** endpoint exists for ops checks.

**Two delivery operations (conceptually)**  
- One operation uses Telegram’s **official bot messaging** (HTTP API with a bot token).  
- The other uses a **saved user login session** (sometimes called MTProto) so messages appear to come from a **normal user account**, not the bot.

**Packages / building blocks (names only)**  
| Piece | Role |
|--------|------|
| **Node.js** | Runtime for the backend. |
| **Express** | Web framework for routes and JSON request/response. |
| **dotenv** | Loads configuration (tokens, session material) from environment files—no secrets in code. |
| **GramJS** (npm package `telegram`) | Client library for the **user-session** path; talks to Telegram with the same protocol family as the main apps. |
| **nodemon** | Development convenience to restart the server on file changes; not required in production. |

Full request/response field names and setup steps live in the engineering **README** in this repo; this section is only so stakeholders know **what kind of system** was built and **what it depends on** at a glance.

---

## What works well in practice

- **Same account** used for testing, **contacts**, and people you already **chat with** are usually reachable.  
- **Public usernames** (where the user has one) are generally easier to resolve than a raw numeric ID alone.  
- **Cold outreach** to arbitrary users is **not** something either path reliably supports; that is by Telegram’s design (spam and privacy).

---

## Risks and governance

- **Terms of service:** Using a **personal / user** session for automated or bulk messaging can conflict with Telegram’s acceptable-use expectations. Any production use needs **legal and compliance** review and strict **volume and consent** controls.  
- **Credentials:** A saved user session is as sensitive as a password; it must be **stored and rotated** like other secrets.  
- **This deliverable is a POC:** It does not include full **security** (who may call the API), **monitoring**, **auditing**, or **database** persistence—those would be required before production.

---

## Suggested takeaway for planning

We have a **clear picture of two delivery mechanisms** and their **real limits** (bot vs user session, cold vs known recipients, fallback via echoed links). The next product decision is **which path** we standardize on per region or client, plus the **compliance and abuse-prevention** work that must wrap it—not more low-level experimentation alone.

---

*Document version: brief overview for management. For technical detail, engineering maintains a separate technical README in the same repository.*
