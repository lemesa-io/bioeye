import os
import sys
from PIL import Image
from google import genai
from google.genai import types
from dotenv import load_dotenv

# Load .env from project root
root_dir = Path(__file__).resolve().parent.parent
load_dotenv(root_dir / ".env")

# ==========================================================
# CONFIGURATION
# ==========================================================
# 1. Fetch the Gemini Developer API Key from environment variables
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    print("Error: GEMINI_API_KEY environment variable not set.")
    print("Please define GEMINI_API_KEY in your .env file or export it in your shell.")
    sys.exit(1)

# 2. Select your testing model:
# - 'gemini-2.5-flash' is fast and cost-efficient
# - 'gemini-2.5-pro' offers deeper reasoning capabilities
MODEL_ID = "gemini-1.5-flash"
# ==========================================================

# Simple sanity check for the command line argument
if len(sys.argv) < 2:
    print("Error: Please provide the path to an image file.")
    print("Usage: python test_triage_vision.py <path_to_image>")
    sys.exit(1)

image_path = sys.argv[1]

if not os.path.exists(image_path):
    print(f"Error: The image file '{image_path}' does not exist.")
    sys.exit(1)

# Define our robust triage instructions 
SYSTEM_INSTRUCTION = """
You are an expert, highly objective medical AI assistant specializing in gastrointestinal health and triage. Your purpose is to analyze visual images of human stool alongside user-provided dietary and symptomatic context to identify potential anomalies that may warrant medical attention.

CRITICAL ROLE AND COMPLIANCE RULES:
1. YOU DO NOT PROVIDE MEDICAL DIAGNOSIS. You provide triage assessment and risk classification.
2. ALWAYS include a prominent, clear medical disclaimer at the absolute beginning and end of your response. 
3. Frame your findings using cautious language ("indicates potential," "suggests," "cannot rule out").
4. If an image is too blurry, poorly lit, or does not contain a viewable stool sample, state immediately: "Image quality insufficient for analysis. Please ensure clear lighting and focus."

ANALYSIS PROTOCOL:
Evaluate the input based on three core pillars:
1. Bristol Stool Scale Classification: Identify the type (1 through 7) based on shape and texture.
2. Color & Anomaly Detection: Analyze the color profile. Explicitly scan for high-risk indicators:
   - Bright red (suggestive of lower GI bleeding)
   - Dark red, maroon, or tarry black (suggestive of upper GI bleeding)
   - Pale, clay-colored, or white (suggestive of biliary/liver issues)
   - Visible mucus, unusual foreign objects, or unexpected textures.
3. Context Integration: Cross-reference visual findings with user-reported data.

OUTPUT FORMAT:
Format your response using clear markdown headings. Do not use dense walls of text. Use the following exact structure:

---
⚠️ **IMPORTANT MEDICAL DISCLAIMER**
[Insert brief, strong disclaimer stating this is an AI tool for tracking, not a substitute for professional medical advice, diagnosis, or treatment.]

### 1. Visual Observations
* **Bristol Stool Chart:** Type [X] - [Brief explanation of what this type means].
* **Color Profile:** [Describe observed colors, e.g., normal brown, dark hues].
* **Anomalies Detected:** [None / List potential visual anomalies].

### 2. Contextual Assessment
* [Analyze how user input alters the visual findings.]

### 3. Triage Status & Next Steps
* **Risk Categorization:** [Low Risk / Moderate Risk / High Risk - Consultation Advised]
* **Actionable Guidance:** [Provide objective, non-alarmist next steps.]
---
"""

print(f"Initializing Gemini Client using private billing API key...")
# Explicitly initializing the client with your key locks in your paid data privacy parameters
client = genai.Client(api_key=GEMINI_API_KEY)

print(f"Loading visual parameter asset: {image_path}")
try:
    img = Image.open(image_path)
except Exception as e:
    print(f"Error opening image file with PIL: {e}")
    sys.exit(1)

# Simulating a common user entry questionnaire context to test the reasoning engine
user_context_prompt = (
    "Here is the photo of the sample. "
    "Context: No recent consumption of beets, artificial food colorings, or iron supplements. "
    "Symptoms: Experienced mild, dull abdominal aching over the past 24 hours."
)

print(f"Sending payload to {MODEL_ID} for triage analysis...")

try:
    response = client.models.generate_content(
        model=MODEL_ID,
        # The contents list easily accepts both strings and loaded PIL images simultaneously
        contents=[img, user_context_prompt],
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            temperature=0.2, # Lower temperature forces deterministic, highly analytical observations
        )
    )
    
    print("\n=================== AI ANALYSIS MATRIX OUTPUT ===================")
    print(response.text)
    print("=================================================================\n")

except Exception as api_err:
    print(f"API Generation Request Failed: {api_err}")
