import os
import google.generativeai as genai
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import requests
from bs4 import BeautifulSoup
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables
load_dotenv()

# Configure Gemini model
genai.configure(api_key=os.environ.get("GOOGLE_API_KEY"))
model = genai.GenerativeModel(
    model_name='gemini-2.5-flash',
    generation_config={"temperature": 0.7}
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],     # <-- allow all origins (or specify)
    allow_credentials=True,
    allow_methods=["*"],     # <-- allow POST, GET, OPTIONS, etc.
    allow_headers=["*"],     # <-- allow headers like Content-Type
)
# --------------------------------------------------------
# Pydantic Models
# --------------------------------------------------------

class ConversationRequest(BaseModel):
    raw_conversation: str

class ScrapeRequest(BaseModel):
    url: str
    summarize: bool = False
    word_limit: Optional[int] = 200

# --------------------------------------------------------
# Prompt Creators
# --------------------------------------------------------

def prompt_conversation_summary(raw_html: str):
    return f"""
    You are an AI assistant tasked with summarizing a conversation history.

    Input: A series of messages between a user and an AI, formatted as plain text:
    {raw_html}

    Your goal:
    - Provide a concise, structured summary.
    - Only include factual content.
    - Remove UI, system messages, or irrelevant text.
    - Highlight intentions, topics, and needed context.

    Output ONLY the summary.
    """

def prompt_text_extraction(raw_html: str):
    return f"""
        Extract ONLY meaningful human-readable text from this RAW HTML.

        RULES:
        - Remove all ads, UI, navbars, JS, CSS, popups, cookie banners.
        - Keep: body text, headings, paragraphs, lists.
        - Clean, readable plaintext only.

        RAW HTML:
        {raw_html}
    """

def prompt_summarizer(clean_text: str, word_limit: int):
    return f"""
        Summarize the following cleaned webpage text.

        Requirements:
        - Preserve key facts only
        - Clear short sentences
        - No fluff
        - No added info
        - Keep it under {word_limit} words

        TEXT:
        {clean_text}
    """

# --------------------------------------------------------
# Scrape Utility
# --------------------------------------------------------

def scrape_page(url: str):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    }

    try:
        response = requests.get(url, headers=headers, timeout=10)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Request error: {str(e)}")

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"Failed to fetch page: {response.status_code}"
        )

    return BeautifulSoup(response.text, "html.parser"), response.text

# --------------------------------------------------------
# Route — Conversation Summary
# --------------------------------------------------------

@app.post("/summarize-conversation")
def summarize_conversation(req: ConversationRequest):
    try:
        prompt = prompt_conversation_summary(req.raw_conversation)
        response = model.generate_content(prompt)
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "summary": response.text
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --------------------------------------------------------
# Route — Scrape + Optional Summary
# --------------------------------------------------------

@app.post("/scrape")
def scrape_and_process(req: ScrapeRequest):
    try:
        soup, raw_html = scrape_page(req.url)

        # Extract clean text
        clean_text = prompt_text_extraction(raw_html)
        # clean_text = model.generate_content(prompt_text_extraction(raw_html)).text

        # If not summarizing → return extracted text
        if not req.summarize:
            return JSONResponse(
                status_code=200,
                content={
                    "status": "success",
                    "url": req.url,
                    "extracted_text": clean_text
                }
            )

        # Summarize extracted text
        summary = model.generate_content(
            prompt_summarizer(clean_text, req.word_limit)
        ).text

        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "url": req.url,
                "summary": summary
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --------------------------------------------------------
# Global Error Handler
# --------------------------------------------------------

@app.exception_handler(Exception)
def global_exception_handler(_, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"status": "error", "message": str(exc)}
    )
