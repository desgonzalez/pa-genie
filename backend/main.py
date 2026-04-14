from typing import List, Optional
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from models import (
    PACaseCreate,
    PACase,
    PACaseRead,
    PACaseAuthUpdate,
    PAStatus,
    SubmissionStatus,
    db_to_api_case,
    pack_codes,
)
from services.ai_service import summarize_for_prior_auth
from db import get_session, create_db_and_tables

app = FastAPI(
    title="PA Genie API",
    description="Backend for PA Genie - AI Prior Authorization & Benefits Platform",
    version="0.1.0",
)

# Allow frontend + local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    create_db_and_tables()


# CREATE CASE
@app.post("/pa-cases", response_model=PACaseRead)
def create_case(case: PACaseCreate, session: Session = Depends(get_session)):
    db_case = PACase.from_orm(case)

    try:
        summary = summarize_for_prior_auth(case.chart_note_text)

        # Convert dict response to string if needed
        if isinstance(summary, dict):
            summary = "\n".join(
                [
                    f"{key.replace('_', ' ').title()}: {value}"
                    for key, value in summary.items()
                ]
            )

        db_case.summary_text = str(summary)

    except Exception as e:
        print("SUMMARY ERROR:", e)
        db_case.summary_text = "Unable to generate AI summary."

    db_case.status = PAStatus.REVIEW

    session.add(db_case)
    session.commit()
    session.refresh(db_case)

    return db_to_api_case(db_case)


# GET ALL CASES
@app.get("/pa-cases", response_model=List[PACaseRead])
def get_cases(session: Session = Depends(get_session)):
    cases = session.exec(select(PACase)).all()
    return [db_to_api_case(c) for c in cases]


# UPDATE AUTH / STATUS
@app.patch("/pa-cases/{case_id}/auth", response_model=PACaseRead)
def update_auth(
    case_id: int,
    update: PACaseAuthUpdate,
    session: Session = Depends(get_session),
):
    case = session.get(PACase, case_id)

    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    for key, value in update.dict(exclude_unset=True).items():
        setattr(case, key, value)

    session.add(case)
    session.commit()
    session.refresh(case)

    return db_to_api_case(case)


# AI CALL SIMULATION
@app.post("/ai-call/{case_id}", response_model=PACaseRead)
def ai_call(case_id: int, session: Session = Depends(get_session)):
    case = session.get(PACase, case_id)

    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    prompt = f"""
You are an expert insurance prior authorization specialist.

Patient: {case.patient_name}
Insurance: {case.payer_name}
CPT Codes: {case.cpt_codes}
ICD10 Codes: {case.icd10_codes}

Simulate a realistic insurance call and include:

- Insurance rep name + last initial
- Statement that the call is being recorded
- Determine if prior authorization is required for the CPT codes
- If no auth is required:
  - Explain why
  - Give a reference number
- If auth is required:
  - Give auth number
  - Units / visits approved
  - Valid date range
  - Reference number
- If unclear or additional clinical review is required:
  - State that nurse review is needed

Make it realistic, professional, and concise.
"""

    try:
        ai_response = summarize_for_prior_auth(prompt)

        # summarize_for_prior_auth may return a dict — convert to readable text
        if isinstance(ai_response, dict):
            ai_response = "\n".join(
                [
                    f"{key.replace('_', ' ').title()}: {value}"
                    for key, value in ai_response.items()
                ]
            )

        ai_response = str(ai_response)

    except Exception as e:
        print("AI CALL ERROR:", e)

        ai_response = f"""
📞 Called {case.payer_name}
Rep: Sarah C.
Call recorded

CPT reviewed: {case.cpt_codes}

Unable to complete AI call — fallback used.

Reference #: REF{case.id}999
"""

    case.call_notes = ai_response
    case.submission_status = "APPROVED"

    session.add(case)
    session.commit()
    session.refresh(case)

    return db_to_api_case(case)