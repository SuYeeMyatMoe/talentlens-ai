"""
TalentLens AI - Gemini Candidate Comparator (Pro)
Multi-candidate ranking and comparison using Gemini Pro deep reasoning.
"""
import json
import re
from typing import List, Dict, Any
from app.ai_modules.gemini_client import pro_generate


def compare_candidates_with_gemini(candidates: List[Dict[str, Any]], job_title: str, job_requirements: str) -> List[Dict[str, Any]]:
    """
    Use Gemini Pro to compare multiple candidates holistically.
    Returns candidates list sorted with rank and comparison notes.
    """
    if not candidates:
        return []

    candidate_summaries = []
    for i, c in enumerate(candidates):
        summary = (
            f"Candidate {i+1}: {c.get('name', 'Unknown')}\n"
            f"  AI Score: {c.get('score', 0):.1f}/100\n"
            f"  Experience: {c.get('experience', 0)} years\n"
            f"  Skills: {', '.join(c.get('skills', [])[:10])}\n"
            f"  Projects: {c.get('projects_count', 0)} projects"
        )
        candidate_summaries.append(summary)

    prompt = f"""You are a senior technical recruiter comparing candidates for: {job_title}

JOB REQUIREMENTS:
{job_requirements[:1000]}

CANDIDATES:
{chr(10).join(candidate_summaries)}

Rank these candidates holistically. Return ONLY valid JSON:
{{
  "rankings": [
    {{
      "candidate_index": <0-based index>,
      "rank": <1, 2, 3...>,
      "recommendation": "<hire/interview/consider/pass>",
      "note": "<one sentence reason>"
    }}
  ],
  "top_recommendation": "<name of best candidate>",
  "comparison_summary": "<2-3 sentence overall comparison>"
}}

Respond with ONLY the JSON object."""

    raw = pro_generate(prompt)
    return _parse_comparison(raw, candidates)


def _parse_comparison(raw: str, candidates: List[Dict]) -> List[Dict[str, Any]]:
    if not raw:
        return _sort_by_score(candidates)
    try:
        cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("```").strip()
        data = json.loads(cleaned)
        rankings = data.get("rankings", [])
        
        result = []
        for r in rankings:
            idx = r.get("candidate_index", 0)
            if 0 <= idx < len(candidates):
                c = candidates[idx].copy()
                c["gemini_rank"] = r.get("rank", idx + 1)
                c["recommendation"] = r.get("recommendation", "consider")
                c["comparison_note"] = r.get("note", "")
                result.append(c)
        return result or _sort_by_score(candidates)
    except Exception as e:
        print(f"[GeminiComparator] Parse error: {e}")
        return _sort_by_score(candidates)


def _sort_by_score(candidates: List[Dict]) -> List[Dict]:
    return sorted(candidates, key=lambda x: x.get("score", 0), reverse=True)
