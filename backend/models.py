# backend/models.py

from sqlmodel import SQLModel, Field
from typing import Optional
from enum import Enum
from datetime import date


# =========================================================
# ENUMS
# =========================================================

class PAStatus(str, Enum):
    NEW = "NEW"
    REVIEW = "REVIEW"
    PENDING_PAYER = "PENDING_PAYER"
    APPROVED = "APPROVED"
    DENIED = "DENIED"


class SubmissionStatus(str, Enum):
    NOT_SUBMITTED = "NOT_SUBMITTED"
    SUBMITTED = "SUBMITTED"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    DENIED = "DENIED"
    NEEDS_INFO = "NEEDS_INFO"


# =========================================================
# BASE FIELDS (Shared)
# =========================================================

class PACaseBase(SQLModel):
    patient_name: str
    payer_name: str

    cpt_codes: Optional[str] = Field(
        default=None,
        description="Comma-separated CPT codes"
    )

    icd10_codes: Optional[str] = Field(
        default=None,
        description="Comma-separated ICD-10 codes"
    )

    visit_type: Optional[str] = Field(
        default="IN_OFFICE",
        description="IN_OFFICE, OUTPATIENT, INPATIENT, etc."
    )


# =========================================================
# DATABASE TABLE
# =========================================================

class PACase(PACaseBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    # Internal workflow status
    status: PAStatus = Field(default=PAStatus.NEW)

    # AI-generated summary
    summary_text: Optional[str] = None

    # -----------------------------------------------------
    # 📞 Call Documentation
    # -----------------------------------------------------
    auth_rep_name: Optional[str] = Field(
        default=None,
        description="Name of insurance representative spoken to"
    )

    reference_number: Optional[str] = Field(
        default=None,
        description="Call reference number from payer"
    )

    call_notes: Optional[str] = Field(
        default=None,
        description="Free-text notes from call or portal submission"
    )

    # -----------------------------------------------------
    # 📑 Submission Outcome
    # -----------------------------------------------------
    submission_status: SubmissionStatus = Field(
        default=SubmissionStatus.NOT_SUBMITTED
    )

    auth_number: Optional[str] = Field(
        default=None,
        description="Authorization number issued by payer"
    )

    # -----------------------------------------------------
    # ⭐ Authorization Validity Window
    # -----------------------------------------------------
    auth_start_date: Optional[date] = Field(
        default=None,
        description="Authorization effective start date"
    )

    auth_end_date: Optional[date] = Field(
        default=None,
        description="Authorization expiration / good-through date"
    )

    # -----------------------------------------------------
    # 📅 Operational Tracking Dates
    # -----------------------------------------------------
    submitted_date: Optional[date] = Field(
        default=None,
        description="Date auth was submitted"
    )

    follow_up_date: Optional[date] = Field(
        default=None,
        description="Next follow-up date with payer"
    )


# =========================================================
# POST PAYLOAD
# =========================================================

class PACaseCreate(PACaseBase):
    chart_note_text: str

# =========================================================
# UPDATE AUTH OUTCOME PAYLOAD
# =========================================================

class PACaseAuthUpdate(SQLModel):
    auth_rep_name: Optional[str] = None
    reference_number: Optional[str] = None
    call_notes: Optional[str] = None

    submission_status: Optional[SubmissionStatus] = None
    auth_number: Optional[str] = None

    auth_start_date: Optional[date] = None
    auth_end_date: Optional[date] = None

    submitted_date: Optional[date] = None
    follow_up_date: Optional[date] = None

# =========================================================
# READ RESPONSE
# =========================================================

class PACaseRead(PACaseBase):
    id: int
    status: PAStatus
    summary_text: Optional[str] = None

    auth_rep_name: Optional[str] = None
    reference_number: Optional[str] = None
    call_notes: Optional[str] = None

    submission_status: SubmissionStatus
    auth_number: Optional[str] = None

    auth_start_date: Optional[date] = None
    auth_end_date: Optional[date] = None

    submitted_date: Optional[date] = None
    follow_up_date: Optional[date] = None


# =========================================================
# HELPERS
# =========================================================

def pack_codes(codes: str | list[str] | None) -> Optional[str]:
    if codes is None:
        return None
    if isinstance(codes, list):
        return ",".join(codes)
    return codes


def db_to_api_case(db_case: PACase) -> PACaseRead:
    return PACaseRead(
        id=db_case.id,
        patient_name=db_case.patient_name,
        payer_name=db_case.payer_name,
        cpt_codes=db_case.cpt_codes,
        icd10_codes=db_case.icd10_codes,
        visit_type=db_case.visit_type,
        status=db_case.status,
        summary_text=db_case.summary_text,

        auth_rep_name=db_case.auth_rep_name,
        reference_number=db_case.reference_number,
        call_notes=db_case.call_notes,

        submission_status=db_case.submission_status,
        auth_number=db_case.auth_number,

        auth_start_date=db_case.auth_start_date,
        auth_end_date=db_case.auth_end_date,

        submitted_date=db_case.submitted_date,
        follow_up_date=db_case.follow_up_date,
    )