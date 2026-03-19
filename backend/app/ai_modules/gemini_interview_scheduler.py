"""
TalentLens AI - Gemini Interview Scheduler (Flash)
AI-powered interview slot suggestion using Gemini Flash.
"""
import json
import re
from typing import Dict, Any, List
from datetime import datetime, timedelta
from app.ai_modules.gemini_client import flash_generate


def suggest_interview_slot(
    candidate_name: str,
    job_title: str,
    availability_notes: str,
    mode: str = "online",
) -> Dict[str, Any]:
    """
    Use Gemini Flash to suggest an optimal interview time slot.
    Returns: suggested_date, suggested_time, duration_minutes, reasoning
    """
    # Get current date for context
    today = datetime.now()
    next_week = today + timedelta(days=7)
    
    prompt = f"""You are an AI interview scheduling assistant for a hiring platform.

CONTEXT:
- Interview for: {candidate_name}
- Position: {job_title}
- Mode: {mode} ({"video call" if mode == "online" else "in-person"})
- Candidate Availability Notes: {availability_notes or "No specific preferences stated"}
- Current Date: {today.strftime("%A, %B %d, %Y")}
- Schedule within: {today.strftime("%B %d")} to {next_week.strftime("%B %d, %Y")}

Suggest the optimal interview slot. Return ONLY valid JSON:
{{
  "suggested_date": "<YYYY-MM-DD format, a weekday within next 7 days>",
  "suggested_time": "<HH:MM in 24hr format, business hours 9am-5pm>",
  "duration_minutes": <30 or 45 or 60>,
  "timezone": "UTC",
  "reasoning": "<one sentence explaining why this slot was chosen>",
  "meeting_agenda": "<brief 2-3 item agenda for the interview>"
}}

Prefer mornings (9-11am) for technical roles, afternoons (2-4pm) for managerial.
Respond with ONLY the JSON object."""

    raw = flash_generate(prompt)
    return _parse_slot_response(raw, today)


def _parse_slot_response(raw: str, today: datetime) -> Dict[str, Any]:
    if not raw:
        return _default_slot(today)
    try:
        cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("```").strip()
        data = json.loads(cleaned)
        return {
            "suggested_date": str(data.get("suggested_date", _next_weekday(today))),
            "suggested_time": str(data.get("suggested_time", "10:00")),
            "duration_minutes": int(data.get("duration_minutes", 45)),
            "timezone": str(data.get("timezone", "UTC")),
            "reasoning": str(data.get("reasoning", "Optimal business hours slot selected.")),
            "meeting_agenda": str(data.get("meeting_agenda", "Introduction, Technical Discussion, Q&A")),
        }
    except Exception as e:
        print(f"[GeminiScheduler] Parse error: {e}")
        return _default_slot(today)


def _next_weekday(from_date: datetime) -> str:
    """Find next weekday."""
    d = from_date + timedelta(days=2)
    while d.weekday() >= 5:  # Skip weekends
        d += timedelta(days=1)
    return d.strftime("%Y-%m-%d")


def _default_slot(today: datetime) -> Dict[str, Any]:
    return {
        "suggested_date": _next_weekday(today),
        "suggested_time": "10:00",
        "duration_minutes": 45,
        "timezone": "UTC",
        "reasoning": "Default morning slot selected for optimal candidate engagement.",
        "meeting_agenda": "1. Introduction & Company Overview\n2. Technical/Role Discussion\n3. Q&A",
    }
