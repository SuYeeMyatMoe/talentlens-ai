"""
TalentLens AI - Gemini Explainer (Flash)
Generates recruiter-readable AI explanations for candidate evaluations.
"""
from app.ai_modules.gemini_client import flash_generate


def generate_explanation_with_gemini(
    candidate_name: str,
    skills: list,
    experience_years: float,
    projects: list,
    final_score: float,
    fairness_score: float,
    job_title: str = "",
) -> str:
    """
    Generate a rich, recruiter-readable explanation using Gemini Flash.
    """
    prompt = f"""You are a recruiting AI assistant generating an explanation for a recruiter.

CANDIDATE: {candidate_name}
JOB: {job_title or "Not specified"}
AI SCORE: {final_score:.1f}/100
FAIRNESS SCORE: {fairness_score:.1f}%
EXPERIENCE: {experience_years} years
SKILLS: {", ".join(skills[:15]) if skills else "None detected"}
PROJECTS: {len(projects)} projects detected

Write a 3-4 paragraph recruiter-readable AI explanation covering:
1. Overall assessment and score interpretation
2. Key strengths observed
3. Areas for consideration or follow-up
4. Fairness analysis note

Be professional, specific, and actionable. Do NOT use JSON — write in plain paragraphs."""

    result = flash_generate(prompt)
    if result:
        return result
    # Fallback
    return f"Overall AI Score: {final_score:.1f}/100\n\nThis candidate has {experience_years} years of experience with {len(skills)} skills detected. Fairness Score: {fairness_score:.1f}%. Please review the detailed scores above."
