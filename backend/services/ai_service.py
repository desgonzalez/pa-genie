import os
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def summarize_for_prior_auth(text: str):
    try:
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {
                    "role": "system",
                    "content": """
You are an insurance prior authorization specialist.

When given a patient, payer, CPT codes, ICD10 codes, and request details, return a realistic insurance call note.

Always include:
- Insurance rep name with last initial
- State the call is recorded
- Whether authorization is required
- If no auth is required: explain why and provide a reference number
- If auth is required: auth number, units/visits, valid dates, reference number
- If unclear: say nurse review required

Respond ONLY with a readable call note. Do not return JSON or a dictionary.
""",
                },
                {
                    "role": "user",
                    "content": text,
                },
            ],
            temperature=0.4,
        )

        return response.choices[0].message.content.strip()

    except Exception as e:
        print("OPENAI ERROR:", e)

        return f"""
📞 Called insurance
Rep: Sarah C.
Call recorded

Unable to complete AI analysis.
Fallback response used.

Reference #: REF99999
"""

