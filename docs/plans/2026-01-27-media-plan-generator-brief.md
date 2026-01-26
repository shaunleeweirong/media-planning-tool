# Media Plan Generator - Project Brief

## What We're Building

A free web app where digital agencies and in-house marketers create media plans. Users input campaign parameters (budget, dates, channel metrics) and download a professional Excel media plan with 3 forecast scenarios.

## Target Users

- Digital marketing agencies
- In-house marketing teams
- Can share output with their clients

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database & Auth:** Supabase (free tier)
- **UI:** Tailwind CSS + shadcn/ui
- **Excel Generation:** ExcelJS
- **Deployment:** Vercel (free tier)

## Core Features (MVP)

1. **Authentication**
   - Email/password signup (first name, last name, email, password)
   - Login / Logout
   - Password reset via email

2. **Dashboard**
   - List all saved plans
   - Search/filter by client name
   - Actions: Create, Edit, Duplicate, Delete, Download Excel

3. **Create/Edit Plan (Wizard)**
   - Step 1: Plan details (name, client name, total budget, flight dates)
   - Step 2: Pacing (custom % weights per week/month)
   - Step 3: Add channels with inputs
   - Step 4: Review calculations & save

4. **View Plan**
   - Display all 3 scenarios
   - Show all assumptions/inputs
   - Download Excel button

5. **Excel Export**
   - Tab 1: Summary (high-level by channel)
   - Tab 2: Detailed breakdown (by channel × time period)

## Channels Supported

| Channel | Inputs |
|---------|--------|
| Search | Budget, CPC, CTR |
| Display | Budget, CPM, CTR, Frequency |
| Video (YouTube/OLV) | Budget, CPV |
| Programmatic | Budget, CPM, CTR, Frequency |
| Social (per platform) | Varies by objective |

## Social Media Platforms

- Meta (Facebook/Instagram)
- TikTok
- LinkedIn
- Twitter/X
- Pinterest
- Snapchat

## Social Media Objectives & Inputs

| Objective | Inputs |
|-----------|--------|
| Awareness/Reach | Budget, CPM, Frequency |
| Video Views | Budget, CPV |
| Website Visits | Budget, CPC, CTR |
| Engagements | Budget, CPE |
| Website Conversions | Budget, CPC, CTR, Conversion Rate |
| Lead Generation | Budget, CPC, CTR, Form Completion Rate |

## Calculation Formulas

### Search
- Clicks = Budget ÷ CPC
- Impressions = Clicks ÷ CTR

### Display / Programmatic
- Impressions = (Budget ÷ CPM) × 1000
- Clicks = Impressions × CTR
- Reach = Impressions ÷ Frequency

### Video
- Views = Budget ÷ CPV

### Social - Awareness
- Impressions = (Budget ÷ CPM) × 1000
- Reach = Impressions ÷ Frequency

### Social - Video Views
- Views = Budget ÷ CPV

### Social - Website Visits
- Clicks = Budget ÷ CPC
- Impressions = Clicks ÷ CTR

### Social - Engagements
- Engagements = Budget ÷ CPE

### Social - Website Conversions
- Clicks = Budget ÷ CPC
- Impressions = Clicks ÷ CTR
- Conversions = Clicks × Conversion Rate

### Social - Lead Generation
- Clicks = Budget ÷ CPC
- Impressions = Clicks ÷ CTR
- Leads = Clicks × Form Completion Rate

## Scenarios

| Scenario | Modifier |
|----------|----------|
| Aggressive | Baseline results × 1.2 (+20%) |
| Moderate | Baseline results × 1.0 |
| Conservative | Baseline results × 0.9 (-10%) |

Budget stays the same; only forecasted results change.

## Pacing

- User defines % weight for each period (week or month)
- Weights must total 100%
- Metrics distributed: Period metrics = Total × weight %

## Database Tables

### profiles
- id (UUID, links to Supabase auth)
- first_name
- last_name
- created_at

### plans
- id (UUID)
- user_id (FK to auth.users)
- name
- client_name
- total_budget
- start_date
- end_date
- pacing_weights (JSON)
- created_at
- updated_at

### plan_channels
- id (UUID)
- plan_id (FK to plans)
- channel_type (search, social, display, video, programmatic)
- platform (null or meta, tiktok, linkedin, etc.)
- objective (null or awareness, video_views, etc.)
- budget
- inputs (JSON with cpm, cpc, cpv, ctr, frequency, conv_rate, form_rate)
- created_at

## Pages

| Route | Purpose |
|-------|---------|
| / | Landing page |
| /login | Login form |
| /signup | Signup form |
| /forgot-password | Request password reset |
| /reset-password | Set new password |
| /dashboard | List of plans |
| /plans/new | Create plan wizard |
| /plans/[id] | View plan |
| /plans/[id]/edit | Edit plan wizard |

## Excel Output Structure

### Tab 1: Summary
- Header: Plan name, Client, Dates, Budget, Generated date
- Assumptions section: All user inputs displayed
- Results table: Channel, Objective, Budget, Impressions, Clicks, Reach, Key Result
- All 3 scenarios shown

### Tab 2: Detailed Breakdown
- Header: Same as Summary
- Assumptions section
- Pacing weights displayed
- Per scenario:
  - Rows: Channel × Time Period
  - Channel totals at bottom

## Future Enhancements (Post-MVP)
- Google authentication
- Team collaboration
- API integrations (Google Ads, Meta, etc.)
- Custom Excel templates
- Plan versioning
