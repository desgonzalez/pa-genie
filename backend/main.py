# backend/main.py

from typing import List, Optional
from datetime import date  

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

# --------------------------------
# CORS — allow from anywhere for now
# --------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    """
    Ensure all tables exist before requests arrive.
    """
    create_db_and_tables()


@app.get("/")
def health_check():
    return {"status": "ok", "message": "PA Genie API is running"}


from typing import Optional

@app.get("/pa-cases", response_model=List[PACaseRead])


@app.get("/pa-cases", response_model=List[PACaseRead])
def list_pa_cases(
    status: Optional[PAStatus] = None,
    submission_status: Optional[SubmissionStatus] = None,
    session: Session = Depends(get_session)
):
    query = select(PACase)

    if status:
        query = query.where(PACase.status == status)

    if submission_status:
        query = query.where(PACase.submission_status == submission_status)

    cases = session.exec(query).all()

    return [db_to_api_case(c) for c in cases]
    query = select(PACase)

    if status:
        query = query.where(PACase.status == status)

    cases = session.exec(query).all()

    return [db_to_api_case(c) for c in cases]

@app.get("/pa-cases/follow-up", response_model=List[PACaseRead])
def get_follow_up_cases(session: Session = Depends(get_session)):
    today = date.today()

    query = select(PACase).where(
        PACase.follow_up_date != None,
        PACase.follow_up_date <= today
    )

    cases = session.exec(query).all()

    return [db_to_api_case(c) for c in cases]


@app.get("/pa-cases/{case_id}", response_model=PACaseRead)
def get_pa_case(case_id: int, session: Session = Depends(get_session)):
    case = session.get(PACase, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="PA case not found")
    return db_to_api_case(case)

from datetime import date




@app.post("/pa-cases", response_model=PACaseRead)
def create_pa_case(payload: PACaseCreate, session: Session = Depends(get_session)):
    # 1) Call AI to summarize the chart note
    try:
        ai_data = summarize_for_prior_auth(payload.chart_note_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {e}")

    # convert AI output into our summary model
    summary_text = str(ai_data)

    # 2) Build database object
    db_case = PACase(
        patient_name=payload.patient_name,
        payer_name=payload.payer_name,
        cpt_codes=pack_codes(payload.cpt_codes),
        icd10_codes=pack_codes(payload.icd10_codes),
        visit_type=payload.visit_type,
        status=PAStatus.REVIEW,
        summary_text=summary_text,
    )

    session.add(db_case)
    session.commit()
    session.refresh(db_case)

    return db_to_api_case(db_case)


@app.patch("/pa-cases/{case_id}/status", response_model=PACaseRead)
def update_pa_case_status(
    case_id: int, status: PAStatus, session: Session = Depends(get_session)
):
    case = session.get(PACase, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="PA case not found")

    case.status = status
    session.add(case)
    session.commit()
    session.refresh(case)

    return db_to_api_case(case)
@app.patch("/pa-cases/{case_id}/auth", response_model=PACaseRead)
def update_pa_case_auth(
    case_id: int,
    payload: PACaseAuthUpdate,
    session: Session = Depends(get_session),
):
    case = session.get(PACase, case_id)

    if not case:
        raise HTTPException(status_code=404, detail="PA case not found")

    update_data = payload.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(case, field, value)

    session.add(case)
    session.commit()
    session.refresh(case)

    return db_to_api_case(case)

@app.get("/dashboard/metrics")
def get_dashboard_metrics(session: Session = Depends(get_session)):
    today = date.today()

    all_cases = session.exec(select(PACase)).all()

    return {
        "total_cases": len(all_cases),
        "new_cases": len([c for c in all_cases if c.status == PAStatus.NEW]),
        "in_review": len([c for c in all_cases if c.status == PAStatus.REVIEW]),
        "pending_payer": len([c for c in all_cases if c.status == PAStatus.PENDING_PAYER]),
        "approved": len([c for c in all_cases if c.submission_status == SubmissionStatus.APPROVED]),
        "denied": len([c for c in all_cases if c.submission_status == SubmissionStatus.DENIED]),
        "follow_ups_due": len([
            c for c in all_cases
            if c.follow_up_date and c.follow_up_date <= today
        ])
    }

