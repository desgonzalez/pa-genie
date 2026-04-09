# backend/services/ai_service.py

import os
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

try:
    import openai
except ImportError:
    openai = None

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

PA_SUMMARY_SYSTEM_PROMPT = """
You are an assistant that helps medical offices prepare prior authorization packets.

Given a chart note, extract:
- Primary diagnosis (ICD-10 style text, not code)
- Other relevant diagnoses
- Symptoms and duration
- Prior treatments and outcomes
- Relevant tests/imaging and results
- Planned procedure(s) (CPT-style text, not code)
- Short medical necessity justification (2–4 sentences)

Return a JSON object with keys:
primary_diagnosis, other_diagnoses, symptoms, prior_treatments,
tests, planned_procedures, medical_necessity.
"""


def _fake_summary(note_text: str) -> dict:
    """
    Fallback summary used when OpenAI can't be called.
    Keeps the backend functional.
    """
    print("⚠️ Using fallback AI summary.")
    return {
        "primary_diagnosis": "Not extracted (fallback mode)",
        "other_diagnoses": [],
        "symptoms": "See original chart note (fallback mode).",
        "prior_treatments": "Not extracted (fallback mode).",
        "tests": "Not extracted (fallback mode).",
        "planned_procedures": "Not extracted (fallback mode).",
        "medical_necessity": note_text[:800],
    }


def summarize_for_prior_auth(note_text: str) -> dict:
    """
    Calls OpenAI to extract structured info from a chart note.
    Falls back to _fake_summary if OpenAI fails.
    """

    # If OpenAI not installed or API key missing, fallback immediately
    if openai is None or not OPENAI_API_KEY:
        print("OpenAI not configured; using fake summary.")
        return _fake_summary(note_text)

    try:
        openai.api_key = OPENAI_API_KEY

        response = openai.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {"role": "system", "content": PA_SUMMARY_SYSTEM_PROMPT},
                {"role": "user", "content": note_text},
            ],
            temperature=0.2,
            # This ensures we get a JSON string we can parse
        )

        content = response.choices[0].message.content
        try:
            data = json.loads(content)
            return data
        except json.JSONDecodeError:
            print("⚠️ Failed to parse OpenAI JSON, using fallback.")
            return _fake_summary(note_text)

    except Exception as e:
        print("OpenAI API error, using fallback summary:", e)
        return _fake_summary(note_text)

