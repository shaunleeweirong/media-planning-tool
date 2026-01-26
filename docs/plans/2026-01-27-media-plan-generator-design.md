# Media Plan Generator - Design Document

## Overview

A web app where agencies and in-house digital marketers input campaign parameters and receive a downloadable Excel media plan with 3 forecast scenarios (Aggressive, Moderate, Conservative).

## Users

- **Primary:** Digital agencies and in-house marketing teams
- **Secondary:** Their clients (viewing shared plans)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Database + Auth | Supabase |
| UI | Tailwind CSS + shadcn/ui |
| Excel Generation | ExcelJS |
| Deployment | Vercel |

## Features (MVP)

- Email/password authentication
- Create, edit, duplicate, delete media plans
- Organize plans by client name
- Configure multiple channels per plan
- Custom pacing weights across campaign flight
- Generate 3 forecast scenarios
- Download Excel with Summary + Detailed Breakdown tabs

## Channels & Inputs

### Search
| Input | Required |
|-------|----------|
| Budget | Yes |
| CPC | Yes |
| CTR | Yes |

### Display
| Input | Required |
|-------|----------|
| Budget | Yes |
| CPM | Yes |
| CTR | Yes |
| Frequency | Yes |

### Video (YouTube/OLV)
| Input | Required |
|-------|----------|
| Budget | Yes |
| CPV | Yes |

### Programmatic
| Input | Required |
|-------|----------|
| Budget | Yes |
| CPM | Yes |
| CTR | Yes |
| Frequency | Yes |

### Social Media (per platform: Meta, TikTok, LinkedIn, etc.)

Each platform requires selecting an objective, which determines the inputs:

| Objective | Inputs Required |
|-----------|-----------------|
| Awareness/Reach | Budget, CPM, Frequency |
| Video Views | Budget, CPV |
| Website Visits | Budget, CPC, CTR |
| Engagements | Budget, CPE |
| Website Conversions | Budget, CPC, CTR, Website Conversion Rate |
| Lead Generation | Budget, CPC, CTR, Lead Form Completion Rate |

## Calculation Logic

### Core Formulas

**Search:**
- Clicks = Budget ÷ CPC
- Impressions = Clicks ÷ CTR

**Display / Programmatic:**
- Impressions = (Budget ÷ CPM) × 1000
- Clicks = Impressions × CTR
- Reach = Impressions ÷ Frequency

**Video:**
- Views = Budget ÷ CPV

**Social - Awareness:**
- Impressions = (Budget ÷ CPM) × 1000
- Reach = Impressions ÷ Frequency

**Social - Video Views:**
- Views = Budget ÷ CPV

**Social - Website Visits:**
- Clicks = Budget ÷ CPC
- Impressions = Clicks ÷ CTR

**Social - Engagements:**
- Engagements = Budget ÷ CPE

**Social - Website Conversions:**
- Clicks = Budget ÷ CPC
- Impressions = Clicks ÷ CTR
- Conversions = Clicks × Conversion Rate

**Social - Lead Generation:**
- Clicks = Budget ÷ CPC
- Impressions = Clicks ÷ CTR
- Leads = Clicks × Form Completion Rate

### Scenarios

| Scenario | Multiplier |
|----------|------------|
| Aggressive | Results × 1.2 |
| Moderate | Results × 1.0 (baseline) |
| Conservative | Results × 0.9 |

Multiplier applies to calculated results, not budget.

### Pacing

- User defines weight (%) for each week/month in flight period
- Weights must total 100%
- Each period's metrics = Total metrics × pacing weight %

## Database Schema

```sql
-- Managed by Supabase Auth
-- users table (id, email, etc.)

-- Our tables:

profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  client_name TEXT,
  total_budget DECIMAL NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  pacing_weights JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

plan_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  channel_type TEXT NOT NULL,
  platform TEXT,
  objective TEXT,
  budget DECIMAL NOT NULL,
  inputs JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

### Channel Type Values
- `search`
- `social`
- `display`
- `video`
- `programmatic`

### Platform Values (for social)
- `meta`
- `tiktok`
- `linkedin`
- `twitter`
- `pinterest`
- `snapchat`

### Objective Values (for social)
- `awareness`
- `video_views`
- `website_visits`
- `engagements`
- `website_conversions`
- `lead_generation`

## Pages & Routes

```
/                     → Landing page
/login                → Login form
/signup               → Signup form
/forgot-password      → Password reset request
/reset-password       → Set new password

/dashboard            → List of plans
/plans/new            → Create plan (wizard)
/plans/[id]           → View plan (read-only)
/plans/[id]/edit      → Edit plan (wizard)
```

## User Flows

### Authentication
1. Sign up: Email + Password + First Name + Last Name
2. Log in: Email + Password
3. Password reset via email link

### Create Plan
1. **Step 1 - Plan Details:** Name, Client name, Flight dates, Total budget
2. **Step 2 - Pacing:** Enter % weight for each week/month (must total 100%)
3. **Step 3 - Channels:** Add channels, select objectives (social), enter inputs
4. **Step 4 - Review:** Preview calculations, save plan

### Dashboard
- View all plans (name, client, dates)
- Search/filter by client name
- Actions: New, Edit, Duplicate, Delete, Download Excel

## Excel Output

### Tab 1: Summary
- Header: Plan name, Client, Flight dates, Total budget, Generated date
- Table: Channel | Objective | Budget | Impressions | Clicks | Reach | Key Result
- All 3 scenarios shown
- Assumptions section with all inputs

### Tab 2: Detailed Breakdown
- Header: Same as Summary
- Assumptions section with all inputs
- Pacing weights displayed
- For each scenario:
  - Row per Channel × Time Period
  - Columns: Channel, Objective, Period, Budget, Impressions, Clicks, Reach, Key Result
  - Channel totals at bottom

## Future Enhancements (Post-MVP)
- Google authentication
- Team collaboration / sharing
- Platform API integrations for historical data
- Custom Excel templates
- Plan versioning / history
