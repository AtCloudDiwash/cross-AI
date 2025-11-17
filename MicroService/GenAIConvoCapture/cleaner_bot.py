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
from fastapi.middleware.cors import CORSMiddleware


load_dotenv()

app = FastAPI()

# Allow all origins (for local testing)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def create_prompt(raw_html):
    prompt = f"""
            You are an AI assistant tasked with summarizing a conversation history.

            Input: A series of messages between a user and an AI, formatted as plain text:
            {raw_html}

            Your goal:
            1. Produce a concise, clear, and structured summary of the conversation.
            2. Only include factual content from the conversation — do NOT invent or assume anything.
            3. Ignore any irrelevant text such as system messages or follow-up suggestions. Focus only on the meaningful exchange between the user and AI.
                - system messages
                - UI elements and labels
                - email addresses, usernames, or account identifiers
                - keyboard shortcuts or hotkeys
                - promotional banners, subscription notices, or upgrade prompts
                - footer messages, timestamps, or metadata
            4. Format the summary in a way that another AI can immediately understand the context and continue the conversation seamlessly.
            5. Highlight key points, important questions, user intentions, and relevant facts.
            6. Avoid unnecessary repetition or filler words.
            7. Keep it as short and precise as possible while retaining all important context.

            Output format:
            - Use bullet points or numbered lists if it improves clarity.
            - Clearly distinguish user intentions, topics discussed, and AI responses.
            - Do NOT include raw conversation text — only the distilled context.
        """

    return prompt


class ScrapeRequest(BaseModel):
    raw_conversation: str

@app.post("/scrape_gen")
def get_my_scrape(request: ScrapeRequest):  # Change this line
    try:
        genai.configure(api_key=os.environ['GOOGLE_API_KEY'])
        model = genai.GenerativeModel(
            model_name='gemini-2.5-flash',  
            generation_config={"temperature": 0.7}
        )
        response = model.generate_content(create_prompt(request.raw_conversation))  # And this line
        return JSONResponse(
            status_code=200,
            content={"message": response.text}
        )
    except Exception as e:
        print(f"Error: {e}")  # Add logging
        print(e)
        return JSONResponse(
            status_code=500,
            content={"message": "Internal server error. We are having issues from our side"}  # Return actual error
        )