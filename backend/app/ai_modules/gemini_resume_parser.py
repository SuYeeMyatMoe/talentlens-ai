"""
TalentLens AI - Gemini Resume Parser (Flash)
Best-in-class resume extraction: prioritises clean project names, verified skills,
accurate experience calculation from date ranges.
Falls back gracefully to rule-based extraction if Gemini is unavailable.
"""
import json
import re
from typing import Dict, Any
from app.ai_modules.gemini_client import flash_generate


def parse_resume_with_gemini(raw_text: str) -> Dict[str, Any]:
    """
    Use Gemini Flash to extract structured resume data.
    Returns: skills, experience_years, projects, education
    """
    if not raw_text or len(raw_text.strip()) < 50:
        return _empty_result()

    # Use up to 5000 chars for best coverage
    text_sample = raw_text[:5000]

    prompt = f"""You are an expert ATS resume parser. Extract structured information from the resume below with maximum accuracy.

IMPORTANT RULES:
1. skills: List SPECIFIC technical skills only (programming languages, frameworks, tools, platforms, libraries).
   - Include: Python, React, Docker, TensorFlow, PostgreSQL, AWS, etc.
   - Exclude: vague words like "communication", "teamwork", "hard-working", "Microsoft Office"
   - Max 25 skills, each skill is a single clean term (no sentences)
2. experience_years: Calculate TOTAL professional work experience in years.
   - Count only paid employment/internships, NOT education duration
   - If date ranges given (e.g. "Jan 2020 – Mar 2023"), calculate 3.2 years
   - If "X years experience" is stated, use that number
   - Return a float (e.g. 4.5), return 0 if unclear or recent graduate
3. projects: List project NAMES only, SHORT titles like "ML Fraud Detection System", "E-Commerce Platform", "Chat API"
   - Each entry: just the project name or a concise title (under 60 chars)
   - Max 8 projects
4. education: Return the highest degree + institution in one string, e.g. "B.Sc Computer Science – MIT" or null if not found

Return ONLY valid JSON, no explanation, no markdown:
{{
  "skills": ["Python", "React", "Docker"],
  "experience_years": 4.5,
  "projects": ["ML Fraud Detection System", "E-Commerce Platform"],
  "education": "B.Tech Computer Science – XYZ University"
}}

Resume Text:
---
{text_sample}
---

JSON output:"""

    raw = flash_generate(prompt)
    result = _parse_json_response(raw)

    # Merge with rule-based if Gemini returned sparse results
    if len(result.get("skills", [])) < 3:
        result = _merge_with_rule_based(result, raw_text)

    return result


def _parse_json_response(raw: str) -> Dict[str, Any]:
    """Safely parse JSON from Gemini response."""
    if not raw:
        return _empty_result()
    try:
        # Strip markdown fences
        cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip()
        cleaned = re.sub(r"```\s*$", "", cleaned).strip()

        # Extract JSON object if embedded in text
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if match:
            cleaned = match.group(0)

        data = json.loads(cleaned)

        skills = [str(s).strip() for s in data.get("skills", []) if s and len(str(s).strip()) > 1]
        skills = list(dict.fromkeys(skills))[:25]  # deduplicate, cap at 25

        projects = [str(p).strip() for p in data.get("projects", []) if p and len(str(p).strip()) > 3]
        projects = list(dict.fromkeys(projects))[:8]  # deduplicate, cap at 8

        exp = data.get("experience_years", 0)
        try:
            exp = float(exp) if exp else 0.0
        except (TypeError, ValueError):
            exp = 0.0

        education = str(data.get("education", "") or "").strip()

        return {
            "skills": skills,
            "experience_years": round(max(0.0, min(exp, 40.0)), 1),
            "projects": projects,
            "education": education,
        }
    except Exception as e:
        print(f"[GeminiParser] JSON parse error: {e} | raw[:300]: {raw[:300]}")
        return _empty_result()


def _merge_with_rule_based(gemini_result: Dict, raw_text: str) -> Dict:
    """Merge sparse Gemini result with rule-based extraction as backup."""
    try:
        from app.services.resume_parser import extract_skills, extract_experience_years, extract_projects, extract_education, clean_text
        cleaned = clean_text(raw_text)
        if not gemini_result.get("skills"):
            gemini_result["skills"] = extract_skills(cleaned)
        if not gemini_result.get("experience_years"):
            gemini_result["experience_years"] = extract_experience_years(cleaned)
        if not gemini_result.get("projects"):
            gemini_result["projects"] = extract_projects(cleaned)
        if not gemini_result.get("education"):
            gemini_result["education"] = extract_education(cleaned)
    except Exception as e:
        print(f"[GeminiParser] Rule-based merge failed: {e}")
    return gemini_result


def _empty_result() -> Dict[str, Any]:
    return {"skills": [], "experience_years": 0.0, "projects": [], "education": ""}
