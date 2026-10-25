# AppointHealth AI - User Guide

An AI chatbot that lets patients book clinic appointments through
natural conversation instead of phone calls and long waits, built for
Lunax Digital. It handles different conversation styles, escalates
unresolved conversations to human staff, and includes a staff
dashboard for monitoring clinics and conversations.

*Commits in this project appear under my former university username,
MASAsif.*

**Team:** 5 | **Tech:** Next.js, NestJS, MongoDB, Llama 3.3 70B via the
Groq API, deployed on Vercel (frontend) and Render (backend)

## My contribution

This was a team project. My work spanned project leadership, design,
DevOps and backend features.

### Planning and agile leadership
- Wrote the initial product backlog of 30+ user stories and prioritised
  them using MoSCoW (must/should/could); later refined by the team.
- Led the retrospectives for sprints 1 to 6 and the planning meetings
  for sprints 3 and 5, prioritising stories and defining tasks.
- Booked meeting spaces for sprint planning to support in-person
  collaboration.

### Design and client communication
- Created system workflow diagrams to present the intended behaviour to
  the client and gather feedback in meetings.
- Designed the appointment booking flow, message processing flow and
  conversation phases state diagram, which guided the team's
  implementation.
- Designed and maintained the Figma prototype used for client feedback
  and as the team's implementation reference.
- Unified the UI across pages built by different teammates so the whole
  application looked consistent, and added a dark mode with colours
  matched to the client's branding.

### DevOps and engineering practice
- Created and maintained the CI/CD pipeline (testing, builds,
  deployments, and documentation hosting via GitLab Pages).
- Deployed the frontend on Vercel and the backend on Render.
- Wrote a wiki documenting and justifying the team's Git workflow and
  branching strategy.
- Reviewed teammates' merge requests (short, detailed and
  over-the-shoulder reviews) against our working agreement.
- Set up automatic documentation with Compodoc (backend), Swagger (API)
  and TypeDoc (frontend).

### Features I implemented
- Slot selection: the system works out which appointment slot a lead
  chose from their reply, so the correct booking is made.
- Escalation: complex or unresolved conversations are handed to human
  staff, who are notified to take over.
- Dashboard analytics API endpoints for performance metrics.
- Staff dashboard: overview, clinic list and conversation list.
- Webhook handling: receiving GHL webhooks and routing them to the
  correct clinic.
- Input validation and sanitisation to prevent NoSQL injection.

---

## Table of Contents

1. [Logging In](#1-logging-in)
2. [Dashboard](#2-dashboard)
3. [Managing Clinics](#3-managing-clinics)
4. [Connecting GoHighLevel (GHL)](#4-connecting-gohighlevel-ghl)
5. [Configuring the AI](#5-configuring-the-ai)
6. [Managing Users (Admin only)](#6-managing-users-admin-only)
7. [Conversations](#7-conversations)
8. [Escalations](#8-escalations)
9. [Analytics](#9-analytics)
10. [Notifications & Inbox](#10-notifications--inbox)
11. [Data Protection & GDPR](#11-data-protection--gdpr)
12. [Settings & Account](#12-settings--account)
13. [Roles: Admin vs Staff](#13-roles-admin-vs-staff)
14. [How the AI Booking Flow Works](#14-how-the-ai-booking-flow-works)
15. [Automated Follow-Ups](#15-automated-follow-ups)

---

## 1. Logging In

Go to the application URL and log in with your email and password.

- If you have forgotten your password, click **Forgot password** and follow the link sent to your email.
- New accounts require email verification before you can log in. Check your inbox for a verification email after signing up.

**Default admin login (development seed data):**
- Email: `admin@lunaxdigital.com`
- Password: `admin123`

---

## 2. Dashboard

The dashboard gives you an at-a-glance overview of the platform:

- **Total leads** - how many leads have come in
- **Bookings** - how many appointments have been booked
- **Active conversations** - conversations currently in progress
- **Escalations** - conversations flagged for human attention
- **Recent conversations** - a quick list of the latest activity
- **Clinic performance table** - per-clinic breakdown of key metrics

---

## 3. Managing Clinics

Clinics are the core unit of the platform. Each clinic has its own AI configuration, GHL integration, and team.

### Adding a new clinic (Admin only)

1. Click **Clinics** in the sidebar
2. Click **Add Clinic**
3. Fill in:
   - **Clinic name**
   - **Address**
   - **Phone number**
   - **GHL Location ID** - from your GoHighLevel sub-account (see Section 4)
   - **GHL Calendar ID** - the calendar where appointments will be booked
   - **Services offered** - list the treatments or services available
   - **Service areas** - postcodes or regions the clinic covers
   - **Business hours** - days and times the clinic operates
4. Click **Save**

### Editing a clinic

1. Click **Clinics** in the sidebar
2. Click on a clinic name to open it
3. Use the tabs - **Overview**, **AI Configuration**, **Integrations** - to manage different aspects
4. Click **Edit** to update details, then **Save**

### Activating / Deactivating a clinic

From the clinic detail page, use the **Activate** or **Deactivate** button. Deactivated clinics will not receive or process new leads.

---

## 4. Connecting GoHighLevel (GHL)

AppointHealth AI uses GoHighLevel (GHL) to send messages and book appointments. Each clinic must be connected to a GHL sub-account.

### What you need from GHL

| Field | Where to find it in GHL |
|---|---|
| **GHL Location ID** | Settings → Business Info → Location ID |
| **GHL Calendar ID** | Calendars → click your calendar → Settings → Calendar ID |
| **GHL Private Integration Token** | Settings → Integrations → Private Integrations → create one and copy the token |

### Connecting a clinic to GHL

1. Open the clinic → **Integrations** tab
2. Enter the **Location ID**, **Calendar ID**, and **Private Integration Token**
3. Click **Test Connection** to verify it works
4. Click **Save**

Once connected, the AI can send messages to leads and create calendar appointments directly in GHL.

---

## 5. Configuring the AI

Each clinic has its own AI configuration that controls how the bot talks to leads.

1. Open the clinic → **AI Configuration** tab
2. Configure:
   - **Greeting message** - the first message the AI sends when a lead starts a conversation
   - **AI tone** - choose between Professional, Friendly, or Empathetic
   - **Qualification questions** - questions the AI asks to qualify the lead (e.g. location, issue type, urgency)
   - **Services & locations** - what services and areas the AI should know about
   - **Custom instructions** - any specific rules or information the AI should follow
3. Click **Save**

The AI uses this configuration to qualify leads, answer questions, and guide them towards booking an appointment.

---

## 6. Managing Users (Admin only)

Admins can create and manage staff accounts from the Settings page.

### Creating a staff account

1. Go to **Settings** → **User Management**
2. Click **Add User**
3. Enter:
   - **First name** and **Last name**
   - **Email address**
   - **Role** - Staff or Admin
   - **Clinic** - which clinic they belong to (staff are tied to one clinic; admins see all)
4. Click **Save**

The new user will receive a verification email. They must verify their email before they can log in.

### Roles

| Role | What they can do |
|---|---|
| **Admin** | Full access - manage all clinics, all conversations, all users, analytics, data protection |
| **Staff** | Access to their assigned clinic's conversations, escalations, and notifications |

### Editing or removing a user

From **Settings → User Management**, click the menu icon next to a user to edit their details or delete their account.

---

## 7. Conversations

The Conversations page shows all AI-managed conversations with leads.

### Conversation phases

| Phase | Meaning |
|---|---|
| **Greeting** | AI has just started talking to the lead |
| **Qualifying** | AI is asking qualification questions |
| **Booking** | AI is in the process of booking an appointment |
| **Confirmed** | Appointment successfully booked |
| **Declined** | Lead is outside service area or not suitable |
| **Closed** | Conversation ended (no response, cancelled, or complete) |

### Viewing a conversation

Click any conversation to open the full chat history, lead details, and appointment information.

### Live chat

Click **Live** in the sidebar under Conversations to see conversations happening in real time via the website chat widget.

### High priority

Conversations marked as high priority are flagged in the list. These are leads that the AI has identified as urgent.

---

## 8. Escalations

When the AI cannot handle a conversation (e.g. the lead is frustrated, has an unusual request, or asks something the AI cannot answer), it escalates it to a human.

1. Click **Escalations** in the sidebar
2. You will see all conversations waiting for human attention
3. Click an escalation to open the conversation and take over
4. Once resolved, click **Resolve** to close the escalation
5. The AI will resume or the conversation can be handled manually

Staff members are notified in real time when a new escalation comes in.

---

## 9. Analytics

The Analytics page gives a detailed breakdown of performance.

- **Overview stats** - total leads, bookings, conversion rate, response time
- **Bookings chart** - bookings over time
- **Funnel chart** - how many leads pass through each phase
- **Lead sources** - where leads are coming from (Facebook, Google Ads, website, referral)
- **Phase distribution** - breakdown of conversations by current phase
- **Clinic comparison table** - side-by-side performance across clinics (Admin only)

Use the **date range selector** to filter by last 7 days, last 30 days, or a custom range.

---

## 10. Notifications & Inbox

The notification bell in the top bar shows real-time alerts. Click it to see recent activity.

### Notification types

| Type | Triggered by |
|---|---|
| **New lead** | A new lead starts a conversation |
| **Escalation** | The AI escalates a conversation to staff |
| **Appointment rescheduled** | A lead reschedules an existing appointment |
| **Stalled conversation** | A lead has not responded for 24 hours |
| **GDPR data deletion** | A data erasure request has been submitted |

### Notification preferences

Go to **Settings → Notifications** to choose which alerts you receive. Staff can toggle lead and appointment notifications. Admins have additional options for platform-wide alerts.

---

## 11. Data Protection & GDPR

AppointHealth AI includes built-in GDPR tools to handle data erasure requests.

1. Click **Data Protection** in the sidebar
2. You will see any pending erasure requests submitted by leads
3. Review the request details
4. Click **Approve** to permanently delete the lead's data from the system
5. The system logs the action for compliance purposes

Only admins can action erasure requests.

---

## 12. Settings & Account

Access **Settings** from the sidebar at the bottom.

### Account settings
- Update your name, email, and password
- Change your profile details

### Appearance
- Toggle between **Light** and **Dark** mode

### Notification preferences
- Control which notifications you receive (see Section 10)

### Integrations
- View and manage your connected GHL integration

### User Management (Admin only)
- Add, edit, or remove staff and admin accounts (see Section 6)

---

## 13. Roles: Admin vs Staff

| Feature | Admin | Staff |
|---|---|---|
| View all clinics | Yes | No (own clinic only) |
| Add / edit clinics | Yes | No |
| Manage users | Yes | No |
| View all conversations | Yes | No (own clinic only) |
| Handle escalations | Yes | Yes (own clinic only) |
| View analytics | Yes | Limited |
| Data protection / GDPR | Yes | No |
| Notification preferences | All types | Lead & appointment types |

---

## 14. How the AI Booking Flow Works

1. A lead sends a message via Email.
2. GHL receives the message and forwards it to AppointHealth AI via a webhook
3. The AI greets the lead and begins the qualification process
4. The AI asks configured qualification questions (location, issue, urgency, etc.)
5. If the lead qualifies, the AI checks available slots and proposes an appointment time
6. The lead confirms and the AI books directly into the GHL calendar
7. A confirmation message is sent to the lead
8. If the lead does not respond, the **automated follow-up** system kicks in (see Section 15)
9. If the AI cannot handle the conversation, it escalates to a human staff member

---

## 15. Automated Follow-Ups

If a lead stops responding, AppointHealth AI automatically sends follow-up messages.

| Trigger | Action |
|---|---|
| No response for **24 hours** | Sends: *"Hi [name], just checking in! Still interested in booking?"* |
| No response for **48 hours** | Sends: *"Hey [name], I don't want to keep bothering you! Let me know if I can help."* |
| No response for **7 days** | Conversation is closed, marked as `no_response`, and the lead is tagged as `unresponsive` in GHL |

Follow-up messages are only sent during business hours (Monday–Friday, 9am–6pm UTC). Closing a conversation happens regardless of the time of day.

---

## Version History

AppointHealth AI follows **Semantic Versioning (SemVer 2.0.0)** to track releases and ensure predictable version increments.

### Current Version
**[v1.0.0](https://git.cardiff.ac.uk/c23042139/large-team-project-team-22b-lunax-digital/-/releases/v1.0.0)** - Production Release (May 6, 2026)

### Release Timeline

| Version | Date | Milestone | Key Features |
|---------|------|-----------|--------------|
| [v1.0.0](https://git.cardiff.ac.uk/c23042139/large-team-project-team-22b-lunax-digital/-/releases/v1.0.0) | May 6, 2026 | **Production Release** | Final delivery - all features complete, 85%+ test coverage |
| [v0.9.0](https://git.cardiff.ac.uk/c23042139/large-team-project-team-22b-lunax-digital/-/releases/v0.9.0) | May 1, 2026 | Security Hardening | NoSQL injection prevention, validation filters, security pipeline |
| [v0.8.0](https://git.cardiff.ac.uk/c23042139/large-team-project-team-22b-lunax-digital/-/releases/v0.8.0) | Apr 26, 2026 | Automation | Appointment reminders, automated follow-ups, cron jobs |
| [v0.7.0](https://git.cardiff.ac.uk/c23042139/large-team-project-team-22b-lunax-digital/-/releases/v0.7.0) | Apr 19, 2026 | Enhanced Security | JWT refresh tokens, escalation system, SSE notifications |
| [v0.6.0](https://git.cardiff.ac.uk/c23042139/large-team-project-team-22b-lunax-digital/-/releases/v0.6.0) | Apr 13, 2026 | GDPR Compliance | Consent management, encryption, data erasure workflows |
| [v0.5.0](https://git.cardiff.ac.uk/c23042139/large-team-project-team-22b-lunax-digital/-/releases/v0.5.0) | Apr 7, 2026 | Multi-Channel | Email channel support, threading, auto-reply detection |
| [v0.4.0](https://git.cardiff.ac.uk/c23042139/large-team-project-team-22b-lunax-digital/-/releases/v0.4.0) | Mar 28, 2026 | Analytics | Dashboard with metrics, funnel visualization, lead attribution |
| [v0.3.0](https://git.cardiff.ac.uk/c23042139/large-team-project-team-22b-lunax-digital/-/releases/v0.3.0) | Mar 20, 2026 | Booking System | GHL calendar integration, webhook pipeline, appointment booking |
| [v0.2.0](https://git.cardiff.ac.uk/c23042139/large-team-project-team-22b-lunax-digital/-/releases/v0.2.0) | Mar 12, 2026 | AI Integration | Conversation UI, AI greetings, GHL messaging |
| [v0.1.0](https://git.cardiff.ac.uk/c23042139/large-team-project-team-22b-lunax-digital/-/releases/v0.1.0) | Mar 6, 2026 | Foundation | Database schemas, authentication, clinic management |

*View all releases: [GitLab Releases](https://git.cardiff.ac.uk/c23042139/large-team-project-team-22b-lunax-digital/-/releases)*

---

## Developer Setup

For developers setting up the project locally, see the sections below.

### Prerequisites

| Tool | Purpose | Check |
|---|---|---|
| **Node.js v18+** | Runs frontend and backend | `node -v` |
| **npm** | Installs dependencies | `npm -v` |
| **MongoDB** | Database | Local or [Atlas](https://www.mongodb.com/cloud/atlas) |

### Installation

```bash
# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### Backend environment variables (`backend/.env`)

```env
PORT=3001
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/databaseName
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your-secret-key
GHL_API_BASE_URL=https://services.leadconnectorhq.com/
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@appointhealth.com
FIELD_ENCRYPTION_KEY=your-32-byte-hex-key
ENCRYPTION_KEY=your-encryption-key
```

### Running locally

```bash
# Terminal 1 - backend
cd backend && npm run dev

# Terminal 2 - frontend
cd frontend && npm run dev
```

Frontend: http://localhost:3000
Backend: http://localhost:3001

### Seeding the database (development only)

```bash
cd backend && npm run seed
```

This clears the database and creates sample clinics, leads, conversations, and a default admin account (`admin@lunaxdigital.com` / `admin123`).

> **Warning:** Running `npm run seed` wipes all existing data. Never run this against your production database.

### Useful commands

| Command | Run from | What it does |
|---|---|---|
| `npm run dev` | `frontend/` or `backend/` | Start dev server |
| `npm run build` | `frontend/` or `backend/` | Build for production |
| `npm run seed` | `backend/` | Reset and seed the database |
| `npm test` | `backend/` | Run backend tests |

### Deployment

| Service | Platform |
|---|---|
| Backend API | Render |
| Frontend | Vercel |

Pushes to the `development` branch auto-deploy via the GitLab → GitHub mirror. Render and Vercel detect the push and redeploy automatically.

> Render's free tier spins down after 15 minutes of inactivity. The first request after sleep may take up to 30 seconds.

---

## Project Status

### Academic Context
This project was developed as part of **CM6331 Large Team Project** at Cardiff University (2025-26).

**Team:** Lunax Digital - Team 22b  
**Development Period:** March 2026 - May 2026  
**Current Version:** [v1.0.0](https://git.cardiff.ac.uk/c23042139/large-team-project-team-22b-lunax-digital/-/releases/v1.0.0)  
**Status:** Production Release

[![GitLab Release](https://img.shields.io/badge/release-v1.0.0-blue)](https://git.cardiff.ac.uk/c23042139/large-team-project-team-22b-lunax-digital/-/releases/v1.0.0)
[![Test Coverage](https://img.shields.io/badge/coverage-85%25-brightgreen)](https://git.cardiff.ac.uk/c23042139/large-team-project-team-22b-lunax-digital)
[![License](https://img.shields.io/badge/license-Academic-orange)](https://git.cardiff.ac.uk/c23042139/large-team-project-team-22b-lunax-digital)

### License & Copyright

**Proprietary** - Cardiff University CM6331 Academic Project  
© 2026 Lunax Digital - Team 22b

---

**For any questions about setup or usage, refer to the sections above or contact the development team.**
