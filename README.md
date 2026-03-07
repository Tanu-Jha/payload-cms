# Dynamic Workflow Management System

A fully dynamic, multi-stage approval workflow engine built on **Payload CMS v2** with JavaScript and Express. Admins can create, assign, and track reusable approval workflows for any collection — no hardcoded collection names, no third-party workflow libraries.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Setup Instructions](#setup-instructions)
3. [Project Structure](#project-structure)
4. [Core Features](#core-features)
5. [Sample Workflows](#sample-workflows)
6. [API Reference](#api-reference)
7. [Demo Credentials](#demo-credentials)
8. [Deployment Guide](#deployment-guide)

---

## Architecture Overview

The system has four main pillars:

**1. Workflow Engine** (`src/engine/workflowEngine.js`)
The brain. A standalone class that evaluates conditions, advances steps, handles conditional branching, manages SLA escalation, and creates immutable audit logs. Completely decoupled from any specific collection.

**2. Plugin System** (`src/plugins/workflowPlugin.js`)
A Payload CMS plugin that attaches `afterChange` hooks to any watched collection. When a document is created or updated, it invokes the engine to find matching workflows and triggers them automatically.

**3. REST API Layer** (`src/endpoints/workflowEndpoints.js`)
Custom Express endpoints registered alongside Payload's built-in API. Provides manual trigger, status retrieval, and action capabilities.

**4. Admin UI Components** (`src/components/`)
React components injected into the Payload admin panel. Includes a workflow progress panel (per-document) and a dashboard overview widget.

### Data Flow

```
Document Created/Updated
        |
        v
  Plugin (afterChange hook)
        |
        v
  Workflow Engine
  |-- Find matching workflows (collection + conditions)
  |-- Evaluate trigger conditions (field checks)
  |-- Create WorkflowInstance
  |-- Initialize step statuses
  |-- Activate first applicable step
  |-- Send notification (console log)
  +-- Create audit log entry
        |
        v
  User performs action (approve/reject/review/comment)
        |
        v
  Engine advances to next step
  |-- Conditional branching (field conditions + previous outcome)
  |-- Skip inapplicable steps
  |-- SLA deadline check
  +-- Complete or reject workflow
```

### Collections

| Collection | Purpose |
|---|---|
| `users` | User accounts with roles (admin, manager, reviewer, editor, viewer) |
| `blogs` | Sample content collection for blog posts |
| `contracts` | Sample collection for legal contracts |
| `workflows` | Workflow template definitions with steps and conditions |
| `workflow-instances` | Active workflow executions bound to documents |
| `workflow-logs` | Immutable audit trail (update/delete blocked) |

---

## Setup Instructions

### Prerequisites

- Node.js v18+ (LTS)
- MongoDB v6+ (local or Atlas)
- npm or yarn

### Step 1: Clone and Install

```bash
git clone <your-repo-url>
cd workflow-cms
npm install
```

### Step 2: Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```
MONGODB_URI=mongodb://127.0.0.1:27017/workflow-cms
PAYLOAD_SECRET=your-secure-random-string
PAYLOAD_PORT=3000
SERVER_URL=http://localhost:3000
```

### Step 3: Start MongoDB

Option A — Docker:
```bash
docker-compose up -d
```

Option B — MongoDB Atlas (free tier):
Set `MONGODB_URI` in `.env` to your Atlas connection string.

Option C — Local:
```bash
mongod --dbpath /path/to/data
```

### Step 4: Start Development Server

```bash
npm run dev
```

Admin panel: **http://localhost:3000/admin**

### Step 5: Create First Admin User

On first launch, Payload prompts you to create an admin account at the login screen.

### Step 6: Seed Demo Data

```bash
npm run seed
```

Creates 4 users, 2 blogs, 3 contracts, and 2 workflow definitions.

---

## Project Structure

```
workflow-cms/
|-- src/
|   |-- server.js                    # Express server + Payload init
|   |-- payload.config.js            # Payload CMS configuration
|   |
|   |-- collections/
|   |   |-- Users.js                 # User accounts with roles
|   |   |-- Blogs.js                 # Blog posts (watched collection)
|   |   |-- Contracts.js             # Contracts (watched collection)
|   |   |-- Workflows.js             # Workflow template definitions
|   |   |-- WorkflowInstances.js     # Active workflow executions
|   |   |-- WorkflowLogs.js          # Immutable audit logs
|   |   +-- index.js
|   |
|   |-- engine/
|   |   +-- workflowEngine.js       # Core workflow logic
|   |
|   |-- plugins/
|   |   +-- workflowPlugin.js       # Payload plugin (hooks)
|   |
|   |-- endpoints/
|   |   +-- workflowEndpoints.js    # Custom REST API routes
|   |
|   |-- components/
|   |   |-- WorkflowPanel/
|   |   |   +-- index.jsx           # Per-document workflow panel
|   |   +-- WorkflowDashboard/
|   |       +-- index.jsx           # Dashboard overview widget
|   |
|   |-- access/
|   |   +-- index.js                # Reusable access control
|   |
|   +-- seed/
|       +-- index.js                # Database seed script
|
|-- package.json
|-- docker-compose.yml
|-- .env.example
|-- .gitignore
+-- README.md
```

---

## Core Features

### 1. Dynamic Workflow Engine
- Workflows defined as data (not code) in the `workflows` collection
- Unlimited steps per workflow
- Each step: type (approval/review/sign-off/comment-only), assignee (user or role), conditions, SLA
- Steps evaluated and triggered automatically on document save
- Attachable to ANY collection dynamically via `targetCollection`

### 2. Conditional Branching
- **Field conditions**: e.g., `amount > 100000` activates/skips executive review
- **Previous outcome**: e.g., step 3 only runs if step 2 was "approved"
- Steps not meeting conditions are automatically skipped

### 3. Smart Trigger Conditions
- Trigger event: on create, on update, both, or manual-only
- Field conditions: e.g., only trigger when `status === "draft"`

### 4. Admin UI Components
- **WorkflowPanel**: Per-document step timeline with progress bar, assignees, comments, inline action buttons (approve/reject/review/comment), collapsible audit trail
- **WorkflowDashboard**: Overview widget with stat cards (active/completed/rejected/overdue) and recent activity table

### 5. Immutable Audit Trail
- Every action recorded in `workflow-logs`
- Captures: user, role, action, step, timestamp, comment
- `update: () => false` and `delete: () => false` — logs can never be tampered with

### 6. SLA Management
- Per-step SLA deadlines in hours
- Periodic checker auto-escalates overdue steps
- Escalation logged + notification sent

### 7. Permission-Based Step Locking
- Steps locked to assigned user or role
- Engine validates permissions before allowing any action

### 8. Email Notifications (Simulated)
- Formatted console log notifications on step activation
- Includes workflow name, step, assignee, document, SLA

---

## Sample Workflows

### Blog Post Approval Flow (3 Steps)

```
Step 1: Editor Review (role: editor, SLA: 24h)
   +-- Always starts here
        |
        v (if reviewed)
Step 2: Manager Approval (role: manager, SLA: 48h)
   +-- Previous outcome must be "reviewed"
        |
        v (if approved)
Step 3: Admin Final Sign-off (role: admin, SLA: 72h)
   +-- Previous outcome must be "approved"
   +-- WORKFLOW COMPLETE
```

### Contract Approval Flow (4 Steps, Conditional Branching)

```
Step 1: Reviewer Initial Check (role: reviewer, SLA: 12h)
   +-- All contracts start here
        |
        v (if reviewed)
Step 2: Manager Approval (role: manager, SLA: 24h)
        |
        v (if approved)
Step 3: Executive Review (role: admin, SLA: 48h)
   +-- CONDITIONAL: Only if contract amount > $100,000
   +-- Skipped for smaller contracts
        |
        v (if approved)
Step 4: Final Legal Sign-off (role: admin, SLA: 72h)
   +-- WORKFLOW COMPLETE
```

---

## API Reference

### POST `/api/workflows/trigger`

Manually trigger a workflow on a document.

```json
// Request body
{
  "workflowId": "workflow-id-here",
  "collectionSlug": "blogs",
  "documentId": "document-id-here"
}
```

### GET `/api/workflows/status/:docId`

Get workflow instances and step statuses. Optional query: `?collection=blogs`

### POST `/api/workflows/action`

Perform an action on the current step. Requires authentication.

```json
{
  "instanceId": "workflow-instance-id",
  "action": "approved",
  "comment": "Looks good"
}
```

Valid actions: `approved`, `rejected`, `reviewed`, `commented`

### POST `/api/workflows/escalate-sla`

Manually trigger SLA escalation check.

---

## Demo Credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@workflow.com | admin123 |
| Manager | manager@workflow.com | manager123 |
| Reviewer | reviewer@workflow.com | reviewer123 |
| Editor | editor@workflow.com | editor123 |

---

## Deployment Guide

### Vercel

1. Push code to GitHub
2. Connect repo on [vercel.com](https://vercel.com)
3. Set environment variables:
   - `MONGODB_URI` (use MongoDB Atlas)
   - `PAYLOAD_SECRET`
   - `SERVER_URL` = your Vercel URL
4. Build command: `npm run build`
5. Deploy

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "serve"]
```

### Railway / Render

1. Connect GitHub repo
2. Set environment variables
3. Start command: `npm run serve`
4. Deploy

---

## Technical Decisions

1. **No third-party workflow libraries** — entire engine is custom-built (~350 lines) for full control.
2. **Dynamic collection targeting** — workflows reference collections by slug string, not by import.
3. **Separation of concerns** — engine is pure logic; plugin wires it to Payload; endpoints expose via REST.
4. **Immutable audit trail** — update and delete access set to `() => false`.
5. **Conditional branching** — field conditions + `requiredPreviousOutcome` support complex flows without graph structures.
