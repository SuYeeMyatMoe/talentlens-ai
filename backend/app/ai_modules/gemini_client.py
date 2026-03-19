"""
TalentLens AI - Gemini Client
Provides access to Gemini Flash (fast tasks) and Gemini Pro (deep reasoning).
"""
import os
import google.generativeai as genai

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyBjfB5VA02czf8V88UMZvPHObqhZtkbWFU")

genai.configure(api_key=GEMINI_API_KEY)

# Flash model — fast, cheap, good for extraction and generation
gemini_flash = genai.GenerativeModel("gemini-1.5-flash")

# Pro model — deeper reasoning for ranking and comparison
gemini_pro = genai.GenerativeModel("gemini-1.5-pro")


def flash_generate(prompt: str) -> str:
    """Generate text using Gemini Flash. Returns empty string on error."""
    try:
        response = gemini_flash.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        print(f"[Gemini Flash Error] {e}")
        return ""


def pro_generate(prompt: str) -> str:
    """Generate text using Gemini Pro. Returns empty string on error."""
    try:
        response = gemini_pro.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        print(f"[Gemini Pro Error] {e}")
        return ""
