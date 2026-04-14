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

# ✅ CORS (IMPORTANT FOR FRONTEND)
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

# 🏥 CREATE CASE
@app.post("/pa-cases", response_model=PACaseRead)
def create_case(case: PACaseCreate, session: Session = Depends(get_session)):
    db_case = PACase.from_orm(case)

    summary = summarize_for_prior_auth(case.chart_note_text)
    db_case.summary_text = summary
    db_case.status = PAStatus.REVIEW

    session.add(db_case)
    session.commit()
    session.refresh(db_case)

    return db_to_api_case(db_case)

# 📄 GET CASES
@app.get("/pa-cases", response_model=List[PACaseRead])
def get_cases(session: Session = Depends(get_session)):
    cases = session.exec(select(PACase)).all()
    return [db_to_api_case(c) for c in cases]

# 🔄 UPDATE AUTH
@app.patch("/pa-cases/{case_id}/auth", response_model=PACaseRead)
def update_auth(case_id: int, update: PACaseAuthUpdate, session: Session = Depends(get_session)):
    case = session.get(PACase, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    for key, value in update.dict(exclude_unset=True).items():
        setattr(case, key, value)

    session.add(case)
    session.commit()
    session.refresh(case)

    return db_to_api_case(case)

# 🤖 REAL AI CALL (SMART VERSION)
@app.post("/ai-call/{case_id}", response_model=PACaseRead)
def ai_call(case_id: int, session: Session = Depends(get_session)):
    case = session.get(PACase, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    prompt = f"""
    You are an experienced insurance prior authorization specialist making a phone call.

    Patient: {case.patient_name}
    Insurance: {case.payer_name}
    CPT Codes: {case.cpt_codes}
    ICD10 Codes: {case.icd10_codes}

    Simulate a REAL insurance call and return a structured response:

    1. Start with:
       📞 Called {case.payer_name}
       Rep name with last initial
       State that the call is recorded

    2. Determine if authorization is required based on CPT codes

    3. If authorization is NOT required:
       - Clearly state "No authorization required"
       - Provide a realistic reference number
       - Explain WHY based on CPT/ICD

    4. If authorization IS required:
       - Provide auth number
       - Units/visits approved
       - Valid date range
       - Reference number
       - Explain reasoning

    5. If unclear or complex:
       - State "Nurse review required"
       - Explain why

    Make it realistic, professional, and clinically accurate.
    """

    ai_response = summarize_for_prior_auth(prompt)

    case.call_notes = ai_response
    case.submission_status = "APPROVED"

    session.add(case)
    session.commit()
    session.refresh(case)

    return db_to_api_case(case)
