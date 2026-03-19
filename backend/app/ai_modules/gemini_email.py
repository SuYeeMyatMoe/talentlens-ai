"""
TalentLens AI - Gemini Email Generator (Flash)
Generates professional interview invitation emails using Gemini Flash.
Sends via SMTP (configured in .env) or simulates if not configured.
"""
import json
import re
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any
from app.ai_modules.gemini_client import flash_generate


def generate_interview_email(
    candidate_name: str,
    candidate_email: str,
    job_title: str,
    company_name: str,
    interview_date: str,
    interview_time: str,
    duration_minutes: int,
    mode: str,
    meeting_link: str = "",
    location: str = "",
    agenda: str = "",
) -> Dict[str, Any]:
    """
    Generate a professional interview invitation email using Gemini Flash.
    Returns: subject, body (HTML), plain_text
    """
    mode_detail = f"Video Call (Link: {meeting_link})" if mode == "online" else f"In-Person at {location}"
    
    prompt = f"""You are an HR communication specialist. Write a professional interview invitation email.

DETAILS:
- Candidate: {candidate_name}
- Position: {job_title}
- Company: {company_name}
- Date: {interview_date}
- Time: {interview_time}
- Duration: {duration_minutes} minutes
- Mode: {mode_detail}
- Agenda: {agenda or "Interview discussion"}

Return ONLY valid JSON:
{{
  "subject": "<compelling email subject line>",
  "body": "<full professional email body in plain text, formal but warm tone>",
  "opening_line": "<first sentence of the email>"
}}

The body should include:
- Congratulations/invitation opening
- Interview details (date, time, mode)
- Agenda/what to expect
- What to prepare
- Contact info placeholder
- Warm closing

Respond with ONLY the JSON object."""

    raw = flash_generate(prompt)
    return _parse_email_response(raw, candidate_name, job_title, interview_date, interview_time, mode_detail)


def _parse_email_response(raw, candidate_name, job_title, date, time, mode_detail) -> Dict[str, Any]:
    if not raw:
        return _default_email(candidate_name, job_title, date, time, mode_detail)
    try:
        cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("```").strip()
        data = json.loads(cleaned)
        return {
            "subject": str(data.get("subject", f"Interview Invitation - {job_title}")),
            "body": str(data.get("body", "")),
            "opening_line": str(data.get("opening_line", "")),
        }
    except Exception as e:
        print(f"[GeminiEmail] Parse error: {e}")
        return _default_email(candidate_name, job_title, date, time, mode_detail)


def _default_email(candidate_name, job_title, date, time, mode_detail) -> Dict[str, Any]:
    body = f"""Dear {candidate_name},

We are pleased to invite you to interview for the {job_title} position.

Interview Details:
- Date: {date}
- Time: {time}
- Mode: {mode_detail}

Please confirm your attendance by replying to this email.

We look forward to speaking with you.

Best regards,
The Recruitment Team"""
    return {
        "subject": f"Interview Invitation — {job_title}",
        "body": body,
        "opening_line": f"Dear {candidate_name},",
    }


def send_email_smtp(to_email: str, subject: str, body: str) -> Dict[str, Any]:
    """
    Send email via SMTP. Falls back to simulation if SMTP not configured.
    """
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    from_email = os.getenv("SMTP_FROM", smtp_user or "noreply@talentlens.ai")

    if not smtp_host or not smtp_user:
        # Simulate email send (for demo/hackathon)
        print(f"[Email Simulated] To: {to_email} | Subject: {subject}")
        return {"sent": True, "simulated": True, "to": to_email}

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_email
        msg["To"] = to_email
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(from_email, to_email, msg.as_string())

        return {"sent": True, "simulated": False, "to": to_email}
    except Exception as e:
        print(f"[Email Error] {e}")
        return {"sent": False, "simulated": False, "error": str(e)}
