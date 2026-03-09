"""
TalentLens AI - Bias Detection Engine
Detects: Experience bias, Education bias, Career gap bias
Returns FairnessScore 0-100
"""
from typing import List, Dict, Any

ELITE_UNIVERSITIES = ["mit", "stanford", "harvard", "cambridge", "oxford", "caltech", "iit", "nus"]
DEGREE_KEYWORDS = ["bachelor", "master", "phd", "b.sc", "m.sc", "b.tech", "m.tech", "b.e", "m.e"]


def detect_experience_bias(experience_years: float) -> Dict[str, Any]:
    """
    Bias: Penalizing candidates with fewer years of experience disproportionately.
    We flag if raw exp score would unfairly filter junior talent with high skills.
    """
    bias_score = 0.0
    details = []

    if experience_years == 0:
        bias_score = 20.0
        details.append("No work experience detected — entry-level candidates may be unfairly filtered")
    elif experience_years < 2:
        bias_score = 10.0
        details.append("Low experience years — junior candidates may face experience bias")
    else:
        details.append("Experience level acceptable — minimal experience bias detected")

    return {"bias_score": bias_score, "details": details}


def detect_education_bias(education: str) -> Dict[str, Any]:
    """
    Bias: Preferring elite universities or specific degree types.
    """
    bias_score = 0.0
    details = []
    edu_lower = education.lower() if education else ""

    has_degree = any(kw in edu_lower for kw in DEGREE_KEYWORDS)
    is_elite = any(u in edu_lower for u in ELITE_UNIVERSITIES)

    if not has_degree:
        bias_score = 15.0
        details.append("No recognized degree detected — education bias risk for non-traditional candidates")
    elif is_elite:
        # Elite school overweighting risk
        bias_score = 5.0
        details.append("Elite university detected — ensure skills-based evaluation is primary")
    else:
        details.append("Standard educational background — low education bias")

    return {"bias_score": bias_score, "details": details}


def detect_career_gap_bias(experience_years: float, education: str, projects: List[str]) -> Dict[str, Any]:
    """
    Bias: Penalizing career gaps or non-linear career paths.
    Proxy: If high skills/projects but low experience → possible career changer, self-taught.
    """
    bias_score = 0.0
    details = []

    if experience_years < 1 and len(projects) > 2:
        bias_score = 15.0
        details.append("High project activity with low formal experience — may indicate career gap or self-taught candidate")
    elif experience_years < 2:
        bias_score = 5.0
        details.append("Early career stage — minor career gap bias risk")
    else:
        details.append("Consistent career progression — low career gap bias")

    return {"bias_score": bias_score, "details": details}


def compute_fairness_score(exp_bias: float, edu_bias: float, gap_bias: float) -> float:
    """
    FairnessScore = 100 - weighted average of bias components.
    Higher = more fair.
    """
    weighted_bias = exp_bias * 0.4 + edu_bias * 0.35 + gap_bias * 0.25
    fairness = max(100 - weighted_bias, 60.0)  # Floor at 60 so no one is unfairly eliminated
    return round(fairness, 2)


def detect_bias(
    experience_years: float,
    education: str,
    skills: List[str],
    projects: List[str],
) -> Dict[str, Any]:
    exp_result = detect_experience_bias(experience_years)
    edu_result = detect_education_bias(education)
    gap_result = detect_career_gap_bias(experience_years, education, projects)

    fairness_score = compute_fairness_score(
        exp_result["bias_score"],
        edu_result["bias_score"],
        gap_result["bias_score"],
    )

    return {
        "experience_bias": exp_result["bias_score"],
        "education_bias": edu_result["bias_score"],
        "career_gap_bias": gap_result["bias_score"],
        "fairness_score": fairness_score,
        "details": {
            "experience": exp_result["details"],
            "education": edu_result["details"],
            "career_gap": gap_result["details"],
            "summary": f"Fairness Score: {fairness_score}/100 — {'High Fairness' if fairness_score >= 85 else 'Moderate Fairness' if fairness_score >= 70 else 'Review Recommended'}",
        },
    }
