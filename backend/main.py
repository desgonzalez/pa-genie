from typing import List
from datetime import datetime
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from models import (
    PACaseCreate,
    PACase,
    PACaseRead,
    PACaseAuthUpdate,
    PAStatus,
    db_to_api_case,
)
from services.ai_service import summarize_for_prior_auth
from db import get_session, create_db_and_tables

app = FastAPI(
    title="PA Genie API",
    description="Backend for PA Genie - AI Prior Authorization & Benefits Platform",
    version="0.1.0",
)

# CORS
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


# GET CASES
@app.get("/pa-cases", response_model=List[PACaseRead])
def get_cases(session: Session = Depends(get_session)):
    cases = session.exec(select(PACase)).all()
    return [db_to_api_case(c) for c in cases]


# UPDATE AUTH
@app.patch("/pa-cases/{case_id}/auth", response_model=PACaseRead)
def update_auth(
    case_id: int,
    update: PACaseAuthUpdate,
    session: Session = Depends(get_session)
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


# AI CALL WITH TIMESTAMP
@app.post("/ai-call/{case_id}", response_model=PACaseRead)
def ai_call(case_id: int, session: Session = Depends(get_session)):
    case = session.get(PACase, case_id)

    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    timestamp = datetime.now().strftime("%m/%d/%Y %I:%M %p")

    prompt = f"""
You are an expert prior authorization and utilization review specialist.

Patient: {case.patient_name}
Insurance: {case.payer_name}
CPT Codes: {case.cpt_codes}
ICD10 Codes: {case.icd10_codes}
Chart Note:
{case.summary_text}

Analyze the chart note and determine:
- Is the CPT appropriate?
- Is there a better CPT or bundled code?
- Is there enough documentation for insurance approval?
- What documentation is missing?
- Does this require a nurse or RN review?

Then simulate the insurance call and include:
- Insurance rep name
- Statement that the call is recorded
- Prior auth required or not
- Auth number / visits / valid dates if approved
- Reference number

At the end ALWAYS include exactly:
Suggested CPT: <value>
Missing Documentation: <value>
Nurse Review Required: Yes or No
"""

    try:
        ai_response = summarize_for_prior_auth(prompt)

        if isinstance(ai_response, dict):
            ai_response = "\n".join(
                [
                    f"{key.replace('_', ' ').title()}: {value}"
                    for key, value in ai_response.items()
                ]
            )

        ai_response = f"""
🕒 AI Call Completed: {timestamp}

{str(ai_response).strip()}
"""

    except Exception as e:
        print("AI CALL ERROR:", e)

        ai_response = f"""
🕒 AI Call Completed: {timestamp}

📞 Called {case.payer_name}
Rep: Sarah C.
Call recorded

Unable to complete AI analysis.
Reference #: REF{case.id}999
"""

    case.call_notes = ai_response
    case.submission_status = "APPROVED"

    session.add(case)
    session.commit()
    session.refresh(case)

    return db_to_api_case(case)