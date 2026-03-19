"""
TalentLens AI - Gemini Candidate Ranker (Flash, fast)
Accurate job-fit scoring using the full resume text + job requirements.
Uses Flash (not Pro) for speed while keeping quality high.
"""
import json
import re
from typing import Dict, Any, List
from app.ai_modules.gemini_client import flash_generate


def rank_candidate_with_gemini(
    skills: List[str],
    experience_years: float,
    projects: List[str],
    job_requirements: str,
    education: str = "",
    fairness_factor: float = 1.0,
    raw_text: str = "",
) -> Dict[str, Any]:
    """
    Score a candidate's fit for the job using Gemini Flash.
    Returns structured scores and a plain-English explanation.
    """
    # Build candidate profile section
    candidate_section = f"""CANDIDATE PROFILE:
- Skills ({len(skills)}): {", ".join(skills[:25]) if skills else "None listed"}
- Experience: {experience_years} years
- Education: {education or "Not specified"}
- Projects ({len(projects)}): {"; ".join(projects[:6]) if projects else "None listed"}"""

    if raw_text:
        candidate_section += f"\n- Resume excerpt: {raw_text[:800]}"

    prompt = f"""You are a senior technical recruiter scoring candidate fit for a specific role.

JOB REQUIREMENTS:
{job_requirements[:1500] if job_requirements else "General technical role — score based on overall candidate strength."}

{candidate_section}

SCORING TASK — rate each dimension 0-100 based on JOB FIT:
- skill_match_score: How well do the candidate's skills match the job's required tech stack? (0=no match, 100=perfect)
- experience_score: Is their experience level appropriate for this role? (0=far too junior/senior, 100=ideal fit)
- project_score: Do their projects demonstrate relevant, hands-on capability? (0=none relevant, 100=directly relevant)
- diversity_score: Does their skill diversity add value beyond the core requirements? (0=very narrow, 100=excellent breadth)
- soft_skills_score: Based on project complexity and roles, infer soft skills & leadership (default 65 if no info)

RULES:
- Be objective. A candidate with 4 relevant skills for a Python job should score skill_match ~70-80, not 50.
- No score below 20 unless the candidate has literally zero relevant experience.
- raw_score = skill_match*0.40 + experience*0.25 + project*0.20 + diversity*0.10 + soft_skills*0.05
- Write explanation as a 3-sentence recruiter summary (strengths and gaps).

Return ONLY valid JSON:
{{
  "skill_match_score": <0-100>,
  "experience_score": <0-100>,
  "project_score": <0-100>,
  "diversity_score": <0-100>,
  "soft_skills_score": <0-100>,
  "raw_score": <weighted average>,
  "explanation": "<3 sentence recruiter summary>"
}}"""

    raw = flash_generate(prompt)
    return _parse_ranking_response(raw, skills, experience_years, projects, fairness_factor)


def _parse_ranking_response(
    raw: str,
    skills: List[str],
    experience_years: float,
    projects: List[str],
    fairness_factor: float,
) -> Dict[str, Any]:
    if not raw:
        return _fallback_ranking(skills, experience_years, projects, fairness_factor)
    try:
        cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip()
        cleaned = re.sub(r"```\s*$", "", cleaned).strip()
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if match:
            cleaned = match.group(0)

        data = json.loads(cleaned)

        def clamp(v, lo=0.0, hi=100.0, default=50.0):
            try:
                return max(lo, min(hi, float(v or default)))
            except (TypeError, ValueError):
                return default

        skill_match = clamp(data.get("skill_match_score"), default=50)
        experience  = clamp(data.get("experience_score"),   default=50)
        project     = clamp(data.get("project_score"),      default=50)
        diversity   = clamp(data.get("diversity_score"),    default=50)
        soft        = clamp(data.get("soft_skills_score"),  default=65)

        # Always recompute raw_score from sub-scores (don't trust LLM arithmetic)
        raw_score = (skill_match * 0.40 + experience * 0.25 +
                     project * 0.20 + diversity * 0.10 + soft * 0.05)

        # Apply fairness factor (≤ 1.0) — slightly penalises evaluations that detected bias
        final_score = min(raw_score * fairness_factor, 100.0)

        explanation = str(data.get("explanation", "AI evaluation completed."))
        full_explanation = (
            f"Overall AI Score: {final_score:.1f}/100 "
            f"(Raw: {raw_score:.1f}, Fairness ×{fairness_factor:.2f})\n\n"
            f"{explanation}"
        )

        return {
            "skill_match_score": round(skill_match, 1),
            "experience_score":  round(experience, 1),
            "project_score":     round(project, 1),
            "diversity_score":   round(diversity, 1),
            "soft_skills_score": round(soft, 1),
            "raw_score":         round(raw_score, 1),
            "final_score":       round(final_score, 1),
            "fairness_factor":   round(fairness_factor, 4),
            "ranking_details": {
                "weights": {
                    "skill_match": 0.40, "experience": 0.25,
                    "project_impact": 0.20, "skill_diversity": 0.10, "soft_skills": 0.05,
                },
                "model": "gemini-flash",
            },
            "explanation": full_explanation,
        }
    except Exception as e:
        print(f"[GeminiRanker] Parse error: {e} | raw[:300]: {raw[:300]}")
        return _fallback_ranking(skills, experience_years, projects, fairness_factor)


def _fallback_ranking(skills, experience_years, projects, fairness_factor) -> Dict[str, Any]:
    """Rule-based fallback if Gemini Flash is unavailable."""
    from app.services.ai_ranking import rank_candidate
    return rank_candidate(
        skills=skills, experience_years=experience_years,
        projects=projects, job_requirements="", fairness_factor=fairness_factor,
    )
