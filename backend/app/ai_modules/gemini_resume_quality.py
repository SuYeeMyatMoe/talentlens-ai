"""
TalentLens AI - Gemini Resume Quality Scorer (Flash)
Standalone resume quality scoring — independent of job requirements.
Evaluates content richness, specificity, structure, and impact.
"""
import json
import re
from typing import Dict, Any, List
from app.ai_modules.gemini_client import flash_generate


def score_resume_quality(
    raw_text: str,
    skills: List[str],
    experience_years: float,
    projects: List[str],
) -> Dict[str, Any]:
    """
    Evaluate standalone resume quality using Gemini Flash.
    Score is based on the resume itself — not compared to any specific job.
    Returns: quality_score (0-100), grade, strengths, improvements, summary
    """
    if not raw_text or len(raw_text.strip()) < 30:
        return _default_quality()

    skills_preview = ", ".join(skills[:15]) if skills else "None extracted"
    projects_preview = "; ".join(projects[:5]) if projects else "None extracted"

    prompt = f"""You are an expert career counsellor evaluating a resume's standalone quality.
Score this resume strictly on its own merits — NOT compared to a specific job.

EXTRACTED DATA:
- Skills ({len(skills)}): {skills_preview}
- Experience: {experience_years} years
- Projects ({len(projects)}): {projects_preview}
- Full resume text (first 2500 chars):
{raw_text[:2500]}

SCORING CRITERIA (total 100 pts):
1. Content richness (25 pts): Are skills specific and numerous? Are projects described with impact?
2. Experience clarity (25 pts): Is work history clear, with dates, roles, and responsibilities?
3. Quantified achievements (20 pts): Does it use numbers, metrics, outcomes? (e.g. "reduced latency by 40%")
4. Technical depth (20 pts): Does the resume show genuine technical depth beyond buzzwords?
5. Structure & readability (10 pts): Is it well-organised and concise?

GRADE RUBRIC: A+ (95-100), A (90-94), B+ (80-89), B (70-79), C (55-69), D (<55)

Return ONLY valid JSON:
{{
  "quality_score": <integer 0-100>,
  "grade": "<A+/A/B+/B/C/D>",
  "strengths": ["<specific strength 1>", "<specific strength 2>", "<specific strength 3>"],
  "improvements": ["<specific improvement 1>", "<specific improvement 2>", "<specific improvement 3>"],
  "summary": "<2-sentence honest, actionable assessment of this resume's strengths and where it can improve>"
}}

Be specific and actionable. Do NOT give generic advice like "add more details" — say WHAT details."""

    raw = flash_generate(prompt)
    return _parse_quality_response(raw)


def _parse_quality_response(raw: str) -> Dict[str, Any]:
    if not raw:
        return _default_quality()
    try:
        cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip()
        cleaned = re.sub(r"```\s*$", "", cleaned).strip()
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if match:
            cleaned = match.group(0)

        data = json.loads(cleaned)
        score = max(0, min(100, int(data.get("quality_score", 50))))
        grade = str(data.get("grade", _score_to_grade(score)))
        strengths = [str(s).strip() for s in data.get("strengths", []) if s][:5]
        improvements = [str(i).strip() for i in data.get("improvements", []) if i][:5]
        summary = str(data.get("summary", "Resume evaluated by AI.")).strip()

        # Ensure at least one of each
        if not strengths:
            strengths = ["Resume successfully uploaded and parsed"]
        if not improvements:
            improvements = ["Add quantified achievements (e.g. 'reduced processing time by 30%')"]

        return {
            "quality_score": score,
            "grade": grade,
            "strengths": strengths,
            "improvements": improvements,
            "summary": summary,
        }
    except Exception as e:
        print(f"[GeminiQuality] Parse error: {e} | raw[:200]: {raw[:200]}")
        return _default_quality()


def _score_to_grade(score: int) -> str:
    if score >= 95: return "A+"
    if score >= 90: return "A"
    if score >= 80: return "B+"
    if score >= 70: return "B"
    if score >= 55: return "C"
    return "D"


def _default_quality() -> Dict[str, Any]:
    return {
        "quality_score": 50,
        "grade": "C",
        "strengths": ["Resume uploaded successfully"],
        "improvements": [
            "Add specific technical skills (e.g. Python, Docker, PostgreSQL)",
            "Include project names with brief descriptions and impact metrics",
            "List roles with company names and date ranges",
        ],
        "summary": "Resume content is limited. Adding more specific skills, dated work experience, and project descriptions will significantly improve your score.",
    }
