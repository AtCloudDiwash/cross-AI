import google.generativeai as genai
import os
from dotenv import load_dotenv
import json
import requests
from bs4 import BeautifulSoup
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
from fastapi.responses import JSONResponse


load_dotenv()

app = FastAPI()

def create_prompt(raw_html):
    return f"""
        You are a highly capable content extraction engine. 
        Your task is to take RAW HTML as input and return only the meaningful human-visible text content.

        ### IMPORTANT RULES
        1. Remove ALL noise:
        - HTML tags
        - CSS / JavaScript
        - Ads, banners, navigation menus
        - Cookie banners, popups, GDPR notices
        - Repeated footer/header items
        - Buttons, forms, login prompts

        2. Extract ONLY the valuable text content:
        - Main article/body text
        - Headings (H1, H2, H3…)
        - Paragraphs
        - Lists
        - Table data (converted to readable text)
        - Any meaningful information

        3. Keep the output:
        - Clean
        - Well-structured
        - No code blocks (plain text only)
        - No HTML or CSS
        - No commentary about what you did

        4. If the page is mostly empty or non-textual, output the best meaningful text you can find.

        ### OUTPUT FORMAT
        Return ONLY:
        - Clean text
        - Structured with headings and bullet points when useful
        - No explanation
        - No markup other than simple text

        ### INPUT (RAW HTML)
        {raw_html}
    """

def create_prompt_summarize(filtered_text, word_count):
    return f"""
        You are a highly skilled summarization engine. 
        Your task is to take the cleaned, filtered text extracted from a webpage and produce a clear, concise, and well-structured summary.

        ### RULES
        1. Keep only the essential information.
        2. Remove any filler, redundant sentences, or fluff.
        3. Preserve important facts, numbers, names, and key points.
        4. Organize the summary into sections if useful (headings, bullet points).
        5. Do NOT add new information that wasn't present.
        6. Do NOT include HTML, code, or commentary about your process.

        ### OUTPUT REQUIREMENTS
        - Be short, sharp, and readable.
        - Use bullet points when appropriate.
        - If the text is long, create a multi-section summary.
        - If the content has a clear topic (product, news, article, event), highlight the main message.
        - Follow the minimum word count rule. It should be less than {word_count}.
        - Include the link of the website, saying if you can visit this link for more info

        ### INPUT CONTENT
        {filtered_text}
    """

# cleaned_response = response.text.replace("```json", "").replace("```", "").strip()
# data = json.loads(cleaned_response)

# for key, value in data.items():
#     print(key, value)

def scrape_url(url:str):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Referer": "https://www.google.com/",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-User": "?1",
        "Sec-Fetch-Dest": "document"
    }

    response = requests.get(url, headers=headers)  #Making a request to the website with the url

    if response.status_code != 200:
        raise Exception(f"Failed to fetch page: {response.status_code}")
    
    html = response.text  #response
    soup = BeautifulSoup(html, "html.parser")  #html parser

    return soup, html


class get_my_scrape(BaseModel):
    url:str
    taste:Optional[str] = "default"


@app.post("/scrape")
def get_my_scrape(url:str, taste = "default"):

    try:   
        genai.configure(api_key=os.environ['GOOGLE_API_KEY'])
        model = genai.GenerativeModel(model_name='gemini-2.5-flash',  generation_config={ "temperature": 0.7})

        soup, raw_html = scrape_url(url)
        response = model.generate_content(create_prompt(raw_html))
        summarized = model.generate_content(create_prompt_summarize(response.text, taste))
        
        if(taste == "default"):
            return JSONResponse(status_code=200, content={"message": response.text})
        return JSONResponse(status_code=200, content={"message": summarized.text})
    
    except Exception as e:
        print(e)
        return JSONResponse(
            status_code=500,
            content={"message": e}
        )

