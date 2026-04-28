# PlanningLeads

Trade leads from UK planning applications, powered by [PlanningData.ai](https://planningdata.ai).

Live: https://planningleads-poc.netlify.app

## What it does

Surfaces planning applications that contain trade-relevant materials extracted from planning documents (PDFs). Joinery contractors can search their local area for applications mentioning timber, windows, doors, stairs, cladding etc. — with architect contact details where available.

## Stack

- Frontend: vanilla HTML/CSS/JS, deployed on Netlify
- Data: `api.planningdata.ai/leads` — joins planning applications with document intelligence extracted via Tesseract OCR + pymupdf
