"""
TalentLens AI - Ranking Engine
Weighted scoring: Skill Match 40%, Experience 25%, Project Impact 20%, Skill Diversity 10%, Soft Skills 5%
FinalScore = RawScore × FairnessFactor
"""
import math
from typing import List, Dict, Any

WEIGHTS = {
    "skill_match": 0.40,
    "experience": 0.25,
    "project_impact": 0.20,
    "skill_diversity": 0.10,
    "soft_skills": 0.05,
}

SKILL_CATEGORIES = {
    "programming": ["Python", "Javascript", "Typescript", "Java", "C++", "Go", "Rust", "Ruby", "Scala"],
    "web": ["React", "Vue", "Angular", "Nextjs", "Nodejs", "Django", "Fastapi", "Flask"],
    "data": ["Pandas", "Numpy", "Scikit-Learn", "Tensorflow", "Pytorch", "Spark"],
    "cloud": ["Aws", "Gcp", "Azure", "Docker", "Kubernetes", "Terraform"],
    "database": ["Mysql", "Postgresql", "Mongodb", "Redis", "Elasticsearch"],
    "ai_ml": ["Machine Learning", "Deep Learning", "Nlp", "Computer Vision", "Llm", "Bert"],
    "soft": ["Leadership", "Teamwork", "Communication", "Problem Solving", "Agile", "Scrum"],
}

SOFT_SKILLS = ["Leadership", "Teamwork", "Communication", "Problem Solving", "Agile", "Scrum", "Project Management"]

HIGH_IMPACT_PROJECT_KEYWORDS = [
    "machine learning", "ai", "blockchain", "full stack", "microservices",
    "scalable", "production", "deployed", "real-time", "api", "dashboard",
    "automation", "optimization", "fraud", "recommendation", "prediction"
]


def compute_skill_match(skills: List[str], job_requirements: str) -> float:
    """Match candidate skills against job requirements using keyword overlap."""
    if not skills:
        return 0.0
    job_lower = job_requirements.lower()
    matched = sum(1 for s in skills if s.lower() in job_lower)
    total_required = max(len(job_requirements.split(",")), 5)
    base_score = min(matched / total_required, 1.0)
    # Bonus for having many skills
    volume_bonus = min(len(skills) / 20, 0.3)
    return min(base_score + volume_bonus, 1.0) * 100


def compute_experience_score(experience_years: float) -> float:
    """Logarithmic curve — experience has diminishing returns."""
    if experience_years <= 0:
        return 10.0
    # 0yr=10, 1yr=35, 3yr=60, 5yr=75, 8yr=88, 10+yr=95
    score = 10 + (math.log(experience_years + 1) / math.log(11)) * 85
    return min(score, 100.0)


def compute_project_score(projects: List[str]) -> float:
    """Score based on number and quality of projects."""
    if not projects:
        return 5.0
    base = min(len(projects) * 12, 60)
    impact = 0
    for project in projects:
        project_lower = project.lower()
        hits = sum(1 for kw in HIGH_IMPACT_PROJECT_KEYWORDS if kw in project_lower)
        impact += hits * 8
    return min(base + impact, 100.0)


def compute_diversity_score(skills: List[str]) -> float:
    """Score based on breadth across skill categories."""
    if not skills:
        return 0.0
    skills_normalized = [s.title() for s in skills]
    categories_covered = set()
    for skill in skills_normalized:
        for cat, cat_skills in SKILL_CATEGORIES.items():
            if skill in cat_skills:
                categories_covered.add(cat)
    return min((len(categories_covered) / len(SKILL_CATEGORIES)) * 100, 100.0)


def compute_soft_skills_score(skills: List[str]) -> float:
    """Score based on soft skills presence."""
    if not skills:
        return 20.0
    soft_found = sum(1 for s in skills if s in SOFT_SKILLS)
    return min(soft_found * 20 + 20, 100.0)


def generate_explanation(
    skills: List[str],
    experience_years: float,
    projects: List[str],
    scores: Dict[str, float],
    final_score: float,
) -> str:
    strengths = []
    improvements = []

    if scores["skill_match"] >= 70:
        strengths.append(f"Strong skill alignment with {len(skills)} relevant skills")
    elif scores["skill_match"] >= 40:
        improvements.append("Moderate skill match — consider expanding technical skills")
    else:
        improvements.append("Low skill match with job requirements")

    if experience_years >= 5:
        strengths.append(f"{experience_years:.0f} years of solid professional experience")
    elif experience_years >= 2:
        strengths.append(f"{experience_years:.0f} years of growing experience")
    else:
        improvements.append("Limited professional experience detected")

    if scores["project_score"] >= 60:
        strengths.append(f"{len(projects)} high-impact projects demonstrating applied expertise")
    elif projects:
        improvements.append("Projects present but could emphasize more impact")
    else:
        improvements.append("No notable projects detected in resume")

    if scores["diversity_score"] >= 60:
        strengths.append("Diverse tech stack across multiple domains")
    else:
        improvements.append("Consider diversifying across more technology domains")

    explanation = f"Overall AI Score: {final_score:.1f}/100\n\n"
    if strengths:
        explanation += "✅ Strengths:\n" + "\n".join(f"  • {s}" for s in strengths) + "\n\n"
    if improvements:
        explanation += "⚠️ Areas for Consideration:\n" + "\n".join(f"  • {i}" for i in improvements)
    return explanation


def rank_candidate(
    skills: List[str],
    experience_years: float,
    projects: List[str],
    job_requirements: str,
    fairness_factor: float = 1.0,
) -> Dict[str, Any]:
    skill_match = compute_skill_match(skills, job_requirements)
    experience = compute_experience_score(experience_years)
    project_impact = compute_project_score(projects)
    skill_diversity = compute_diversity_score(skills)
    soft_skills = compute_soft_skills_score(skills)

    raw_score = (
        skill_match * WEIGHTS["skill_match"] +
        experience * WEIGHTS["experience"] +
        project_impact * WEIGHTS["project_impact"] +
        skill_diversity * WEIGHTS["skill_diversity"] +
        soft_skills * WEIGHTS["soft_skills"]
    )
    final_score = min(raw_score * fairness_factor, 100.0)

    scores = {
        "skill_match": skill_match,
        "experience": experience,
        "project_score": project_impact,
        "diversity_score": skill_diversity,
        "soft_skills": soft_skills,
    }
    explanation = generate_explanation(skills, experience_years, projects, scores, final_score)

    return {
        "skill_match_score": round(skill_match, 2),
        "experience_score": round(experience, 2),
        "project_score": round(project_impact, 2),
        "diversity_score": round(skill_diversity, 2),
        "soft_skills_score": round(soft_skills, 2),
        "raw_score": round(raw_score, 2),
        "final_score": round(final_score, 2),
        "fairness_factor": round(fairness_factor, 4),
        "ranking_details": {
            "weights": WEIGHTS,
            "component_scores": scores,
        },
        "explanation": explanation,
    }
