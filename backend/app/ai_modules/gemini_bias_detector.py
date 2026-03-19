"""
TalentLens AI - Gemini Bias Detector (Flash)
Detects potential evaluation biases and computes a fairness score.

BIAS SCALE SEMANTICS (important):
  - experience_bias (0–20): 0 = no over-weighting bias, 20 = heavy bias
  - education_bias  (0–15): 0 = no prestige bias,        15 = heavy bias
  - career_gap_bias (0–15): 0 = no gap penalisation,     15 = heavy bias
  - fairness_score  (0–100): 100 = perfectly fair, lower = more biased

A candidate with moderate experience (3–6 yrs), mainstream education,
and no gaps should receive LOW bias scores (e.g. 2, 1, 1) → fairness ≈ 96%.
Bias scores only go HIGH when there is a genuine red flag.
"""
import json
import re
from typing import Dict, Any, List
from app.ai_modules.gemini_client import flash_generate


def detect_bias_with_gemini(
    experience_years: float,
    education: str,
    skills: List[str],
    projects: List[str],
) -> Dict[str, Any]:
    """
    Use Gemini Flash to assess potential evaluation biases.
    Returns bias scores and a fairness_score (0-100).
    """
    prompt = f"""You are a fairness auditor reviewing AI hiring evaluation biases.

CANDIDATE PROFILE:
- Professional experience: {experience_years} years
- Education: {education or "Not specified"}
- Number of technical skills listed: {len(skills)}
- Number of projects: {len(projects)}

YOUR TASK: Assess whether standard evaluation criteria would UNFAIRLY disadvantage this candidate.

BIAS DEFINITIONS (higher score = MORE bias/penalisation, LESS fair):
- experience_bias (0-20): Score HIGH only if requiring very high experience (10+ yrs) would exclude this candidate unfairly. Score LOW (0-4) if experience is reasonable or the candidate has compensating strengths.
- education_bias (0-15): Score HIGH only if elite-university preference would exclude this candidate. Score LOW (0-3) if education is standard or not specified (not specifying is normal).
- career_gap_bias (0-15): Score HIGH only if there is evidence of long unexplained gaps (e.g. 0 experience AND no projects over multiple application years). Score VERY LOW (0-2) for typical candidates.

CALIBRATION EXAMPLES:
- 4 years experience, BSc, 5 projects → experience_bias: 2, education_bias: 1, career_gap_bias: 1, fairness_score: 96
- 8 years experience, no degree, 10 skills → experience_bias: 3, education_bias: 4, career_gap_bias: 0, fairness_score: 93
- 0 years experience, no education, 0 skills → experience_bias: 8, education_bias: 6, career_gap_bias: 12, fairness_score: 74
- 15+ years, PhD from top school, many skills → experience_bias: 1, education_bias: 1, career_gap_bias: 0, fairness_score: 98

Return ONLY valid JSON, no explanation:
{{
  "experience_bias": <0-20, typically 0-5 for normal candidates>,
  "education_bias": <0-15, typically 0-4>,
  "career_gap_bias": <0-15, typically 0-3>,
  "fairness_score": <100 - experience_bias - education_bias - career_gap_bias>,
  "details": {{
    "experience_note": "<one-sentence note>",
    "education_note": "<one-sentence note>",
    "gap_note": "<one-sentence note>"
  }}
}}"""

    raw = flash_generate(prompt)
    return _parse_bias_response(raw, experience_years, education, len(skills), len(projects))


def _parse_bias_response(
    raw: str,
    experience_years: float,
    education: str,
    skills_count: int,
    projects_count: int,
) -> Dict[str, Any]:
    if not raw:
        return _rule_based_bias(experience_years, education, skills_count, projects_count)
    try:
        cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip()
        cleaned = re.sub(r"```\s*$", "", cleaned).strip()
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if match:
            cleaned = match.group(0)

        data = json.loads(cleaned)
        exp_bias = max(0.0, min(20.0, float(data.get("experience_bias", 3))))
        edu_bias = max(0.0, min(15.0, float(data.get("education_bias", 2))))
        gap_bias = max(0.0, min(15.0, float(data.get("career_gap_bias", 1))))

        # Recompute fairness from biases (don't blindly trust the LLM's arithmetic)
        computed_fairness = 100.0 - exp_bias - edu_bias - gap_bias
        fairness = max(0.0, min(100.0, computed_fairness))

        return {
            "experience_bias": round(exp_bias, 1),
            "education_bias": round(edu_bias, 1),
            "career_gap_bias": round(gap_bias, 1),
            "fairness_score": round(fairness, 1),
            "details": data.get("details", {}),
        }
    except Exception as e:
        print(f"[GeminiBias] Parse error: {e} | raw[:200]: {raw[:200]}")
        return _rule_based_bias(experience_years, education, skills_count, projects_count)


def _rule_based_bias(
    experience_years: float,
    education: str,
    skills_count: int,
    projects_count: int,
) -> Dict[str, Any]:
    """
    Fast, transparent rule-based fallback.
    Biases are LOW unless there is a genuine red flag.
    """
    # Experience bias: only penalise if candidate has < 1 yr AND no projects
    if experience_years >= 3:
        exp_bias = min(experience_years * 0.3, 4.0)   # mild, capped at 4
    elif experience_years >= 1:
        exp_bias = min(experience_years * 0.5 + 1, 5.0)
    else:
        exp_bias = 6.0 if projects_count == 0 else 3.0  # entry-level

    # Education bias: only notable if no education AND no skills
    edu_lower = (education or "").lower()
    if any(kw in edu_lower for kw in ["phd", "master", "msc", "mtech", "mba"]):
        edu_bias = 0.5  # very low — great education, minimal bias concern
    elif any(kw in edu_lower for kw in ["bachelor", "bsc", "btech", "be", "bca", "bba"]):
        edu_bias = 1.0
    elif education and len(education) > 5:
        edu_bias = 2.0  # some education found
    else:
        edu_bias = 3.0 if skills_count < 3 else 1.5  # no education info

    # Career gap bias: low unless both experience and projects are 0
    if experience_years == 0 and projects_count == 0:
        gap_bias = 8.0
    elif experience_years == 0:
        gap_bias = 3.0  # fresh grad with projects
    else:
        gap_bias = 0.5

    fairness = round(max(50.0, 100.0 - exp_bias - edu_bias - gap_bias), 1)

    return {
        "experience_bias": round(exp_bias, 1),
        "education_bias": round(edu_bias, 1),
        "career_gap_bias": round(gap_bias, 1),
        "fairness_score": fairness,
        "details": {
            "experience_note": f"{experience_years} yrs experience considered.",
            "education_note": "Education background assessed.",
            "gap_note": "Career continuity evaluated.",
        },
    }
